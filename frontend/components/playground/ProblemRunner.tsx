"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import MathField from "../math/MathField";
import PromptText from "./PromptText";
import { playground } from "../../lib/playground/client";
import type {
  PlaygroundAnswerType,
  PlaygroundDifficulty,
  PlaygroundProblem,
  PlaygroundReveal,
} from "../../lib/api";
import styles from "../../app/playground/playground.module.css";

type Result = "correct" | "revealed" | "skipped";
type Feedback =
  | { kind: "wrong" | "wrong_form" | "unparseable" | "empty" | "correct"; message: string }
  | { kind: "revealed"; reveal: PlaygroundReveal };

type State = {
  status: "loading" | "error" | "empty" | "active" | "summary";
  problems: PlaygroundProblem[];
  index: number;
  results: Record<string, Result>;
  answer: string;
  feedback: Feedback | null;
  error: string;
};

type Action =
  | { type: "LOAD" }
  | { type: "LOADED"; problems: PlaygroundProblem[] }
  | { type: "FAILED"; error: string }
  | { type: "ANSWER"; answer: string }
  | { type: "FEEDBACK"; feedback: Feedback; result?: Result }
  | { type: "SKIP" }
  | { type: "NEXT" };

const INITIAL: State = {
  status: "loading",
  problems: [],
  index: 0,
  results: {},
  answer: "",
  feedback: null,
  error: "",
};

function advance(state: State): State {
  const next = state.index + 1;
  if (next >= state.problems.length) return { ...state, status: "summary", answer: "", feedback: null };
  return { ...state, index: next, answer: "", feedback: null };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return INITIAL;
    case "LOADED": {
      // Solved problems go first and count as done, so a returning student resumes at the next unsolved one.
      const solved = action.problems.filter((p) => p.solved);
      const unsolved = action.problems.filter((p) => !p.solved);
      const replay = unsolved.length === 0; // everything solved: start over from 1
      const problems = replay ? action.problems : [...solved, ...unsolved];
      const results: Record<string, Result> = {};
      if (!replay) solved.forEach((p) => { results[p.id] = "correct"; });
      return {
        ...INITIAL,
        status: problems.length ? "active" : "empty",
        problems,
        results,
        index: replay ? 0 : solved.length,
      };
    }
    case "FAILED":
      return { ...INITIAL, status: "error", error: action.error };
    case "ANSWER":
      return { ...state, answer: action.answer };
    case "FEEDBACK": {
      const id = state.problems[state.index].id;
      const results = { ...state.results };
      if (action.result && !(action.result === "revealed" && results[id] === "correct")) {
        results[id] = action.result;
      }
      return { ...state, feedback: action.feedback, results };
    }
    case "SKIP": {
      const id = state.problems[state.index].id;
      return advance({ ...state, results: { ...state.results, [id]: state.results[id] ?? "skipped" } });
    }
    case "NEXT":
      return advance(state);
  }
}

const FORMAT_HINTS: Partial<Record<PlaygroundAnswerType, string>> = {
  solution_set: "Separate solutions with commas",
  ordered_pair: "Enter as (x, y)",
  equation: "Enter the full equation, e.g. y = …",
};

const ICONS: Record<Result, string> = { correct: "✓", revealed: "👁", skipped: "↷" };
const LABELS: Record<Result, string> = { correct: "Correct", revealed: "Revealed", skipped: "Skipped" };

interface Props {
  nodeId: string;
  nodeLabel: string;
  difficulty: PlaygroundDifficulty;
  onOtherDifficulty: () => void;
  onTopics: () => void;
}

export default function ProblemRunner({ nodeId, nodeLabel, difficulty, onOtherDifficulty, onTopics }: Props) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "LOAD" });
    playground
      .getSitting(nodeId, difficulty)
      .then((sitting) => {
        if (!cancelled) dispatch({ type: "LOADED", problems: sitting.problems });
      })
      .catch((err: unknown) => {
        if (!cancelled) dispatch({ type: "FAILED", error: err instanceof Error ? err.message : "Could not load problems." });
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, difficulty, round]);

  const problem = state.problems[state.index];
  const locked = state.feedback?.kind === "correct" || state.feedback?.kind === "revealed";
  const isLast = state.index === state.problems.length - 1;

  const check = useCallback(async () => {
    if (!problem || busy || locked) return;
    if (!state.answer.trim()) {
      dispatch({ type: "FEEDBACK", feedback: { kind: "empty", message: "Type your answer first." } });
      return;
    }
    setBusy(true);
    try {
      const res = await playground.check(problem.id, state.answer);
      if (res.correct) {
        dispatch({ type: "FEEDBACK", feedback: { kind: "correct", message: res.message || "Correct!" }, result: "correct" });
      } else {
        const kind = res.reason === "wrong_form" || res.reason === "unparseable" || res.reason === "empty" ? res.reason : "wrong";
        dispatch({ type: "FEEDBACK", feedback: { kind, message: res.message } });
      }
    } catch {
      dispatch({ type: "FEEDBACK", feedback: { kind: "unparseable", message: "Couldn't check that right now. Try again." } });
    } finally {
      setBusy(false);
    }
  }, [problem, busy, locked, state.answer]);

  const reveal = useCallback(async () => {
    if (!problem || busy || locked) return;
    setBusy(true);
    try {
      const res = await playground.reveal(problem.id);
      dispatch({ type: "FEEDBACK", feedback: { kind: "revealed", reveal: res }, result: "revealed" });
    } catch {
      dispatch({ type: "FEEDBACK", feedback: { kind: "unparseable", message: "Couldn't load the answer right now." } });
    } finally {
      setBusy(false);
    }
  }, [problem, busy, locked]);

  const handleChange = useCallback((value: string) => dispatch({ type: "ANSWER", answer: value }), []);

  if (state.status === "loading") {
    return <div className={styles.panel} aria-busy="true"><div className={styles.skeletonLine} /><div className={styles.skeletonLine} /></div>;
  }
  if (state.status === "error") {
    return (
      <div className={styles.panel} role="alert">
        <p className={styles.errorText}>{state.error}</p>
        <button type="button" className={styles.primaryButton} onClick={() => setRound((r) => r + 1)}>Try again</button>
      </div>
    );
  }
  if (state.status === "empty") {
    return (
      <div className={styles.panel}>
        <p className={styles.mutedText}>No problems here yet. Check back soon!</p>
        <button type="button" className={styles.secondaryButton} onClick={onOtherDifficulty}>Pick another difficulty</button>
      </div>
    );
  }

  if (state.status === "summary") {
    const counts = { correct: 0, revealed: 0, skipped: 0 };
    state.problems.forEach((p) => { counts[state.results[p.id] ?? "skipped"] += 1; });
    return (
      <section className={styles.panel} aria-label="Summary">
        <h2 className={styles.panelTitle}>{nodeLabel} · {difficulty}</h2>
        <div className={styles.summaryCounts}>
          {(Object.keys(counts) as Result[]).map((key) => (
            <div key={key} className={styles.summaryCount}>
              <strong>{counts[key]}</strong>
              <span>{ICONS[key]} {LABELS[key]}</span>
            </div>
          ))}
        </div>
        <ol className={styles.summaryList}>
          {state.problems.map((p, i) => {
            const result = state.results[p.id] ?? "skipped";
            return (
              <li key={p.id} className={styles.summaryItem} data-result={result}>
                <span className={styles.summaryIcon} aria-label={LABELS[result]}>{ICONS[result]}</span>
                <span className={styles.summaryNumber}>{i + 1}.</span>
                <PromptText text={p.prompt} className={styles.summaryPrompt} system />
              </li>
            );
          })}
        </ol>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={() => setRound((r) => r + 1)}>Try this set again</button>
          <button type="button" className={styles.secondaryButton} onClick={onOtherDifficulty}>Other difficulty</button>
          <button type="button" className={styles.secondaryButton} onClick={onTopics}>Topics</button>
        </div>
      </section>
    );
  }

  const hint = FORMAT_HINTS[problem.answer_type];
  const fb = state.feedback;
  return (
    <section className={styles.panel} aria-label="Problem">
      <div className={styles.problemMeta}>
        <span className={styles.progressText}>{state.index + 1} / {state.problems.length}</span>
        <span className={styles.chip}>{problem.style === "word" ? "Word" : "Equation"}</span>
        {problem.solved && <span className={`${styles.chip} ${styles.chipSolved}`} title="Already solved">✓ Solved before</span>}
      </div>
      <div data-tutorial="playground-prompt"><PromptText text={problem.prompt} className={styles.prompt} system /></div>
      <div className={styles.answerRow}>
        <div data-tutorial="playground-answer" className={styles.answerField}>
          <MathField key={problem.id} value={state.answer} onChange={handleChange} onEnter={check} disabled={locked || busy} />
        </div>
        {problem.unit && <span className={styles.unit}>{problem.unit}</span>}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}

      {fb && fb.kind !== "revealed" && (
        <p className={`${styles.feedback} ${fb.kind === "correct" ? styles.feedbackGood : styles.feedbackBad}`} role="status">
          {fb.kind === "correct" ? "✓ " : ""}{fb.message}
        </p>
      )}
      {fb?.kind === "revealed" && (
        <div className={styles.reveal} role="status">
          <div className={styles.revealAnswer}>
            Answer: <PromptText text={`$${fb.reveal.answer}$`} className={styles.inlineMath} />
            {fb.reveal.unit ? ` ${fb.reveal.unit}` : ""}
          </div>
          <ol className={styles.steps}>
            {fb.reveal.solution_steps.map((s, i) => (
              <li key={i}>
                <PromptText text={s.explanation} className={styles.stepText} />
                <PromptText text={`$$${s.latex}$$`} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div data-tutorial="playground-actions" className={styles.actionBar}>
        {locked ? (
          <button type="button" className={`${styles.primaryButton} ${styles.mainAction}`} onClick={() => dispatch({ type: "NEXT" })}>
            {isLast ? "See summary" : "Next"} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <>
            <div className={styles.sideActions}>
              <button type="button" className={styles.secondaryButton} onClick={reveal} disabled={busy}>Reveal answer</button>
              <button type="button" className={styles.secondaryButton} onClick={() => dispatch({ type: "SKIP" })} disabled={busy}>Skip</button>
            </div>
            <button type="button" data-tutorial="playground-check" className={`${styles.primaryButton} ${styles.mainAction}`} onClick={check} disabled={busy}>Check</button>
          </>
        )}
      </div>
    </section>
  );
}
