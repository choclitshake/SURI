"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainPage from "@/components/mainpage";
import { useWorldNavigation } from "@/components/navigation/LearningShell";
import ProblemRunner from "@/components/playground/ProblemRunner";
import { playground } from "@/lib/playground/client";
import type { PlaygroundDifficulty, PlaygroundNode, PlaygroundTopics } from "@/lib/api";
import styles from "./playground.module.css";

const DIFFICULTIES: PlaygroundDifficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABELS: Record<PlaygroundDifficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

function isDifficulty(value: string | null): value is PlaygroundDifficulty {
  return value !== null && (DIFFICULTIES as string[]).includes(value);
}

function nodeTotals(node: PlaygroundNode) {
  return DIFFICULTIES.reduce(
    (acc, d) => ({ total: acc.total + node.difficulties[d].total, solved: acc.solved + node.difficulties[d].solved }),
    { total: 0, solved: 0 }
  );
}

function ProgressBar({ solved, total }: { solved: number; total: number }) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={solved}>
      <span className={styles.barFill} style={{ width: `${pct}%` }} />
    </span>
  );
}

function PlaygroundInner() {
  const { navigate } = useWorldNavigation();
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic");
  const difficultyParam = params.get("difficulty");
  const difficulty = isDifficulty(difficultyParam) ? difficultyParam : null;
  const view = !topic ? "topics" : difficulty ? "problem" : "difficulty";

  const [topics, setTopics] = useState<PlaygroundTopics | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Refetch on every view change so solved counts and labels stay fresh; keep the old data while loading.
  useEffect(() => {
    let cancelled = false;
    playground
      .getTopics()
      .then((data) => {
        if (!cancelled) {
          setTopics(data);
          setLoadError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load topics.");
      });
    return () => {
      cancelled = true;
    };
  }, [view, attempt]);

  const node = topics?.chains.flatMap((c) => c.nodes).find((n) => n.node_id === topic) ?? null;
  const goTopics = useCallback(() => router.push("/playground"), [router]);
  const goDifficulty = useCallback(() => router.push(`/playground?topic=${topic}`), [router, topic]);
  const goBack = view === "topics" ? () => navigate("/dashboard") : view === "difficulty" ? goTopics : goDifficulty;

  return <MainPage immersive>
    <div data-tutorial-scope={`playground-${view === "problem" ? "problem" : view === "difficulty" ? "difficulty" : "topics"}`} className={`progress-library-page playground-route-page ${styles.page}`}>
      <div className="progress-library-back-row">
        <button type="button" className="topics-library-back" onClick={goBack} aria-label="Go back"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className="progress-library-header">
        <div className="progress-library-kicker"><span aria-hidden="true" /> SURI&apos;S PLAYGROUND <span aria-hidden="true" /></div>
        <h1>Your <em>Playground</em></h1>
        {view !== "topics" && node && <p>{node.label}{difficulty ? ` · ${DIFFICULTY_LABELS[difficulty]}` : ""}</p>}
      </header>

      <main className={styles.content}>
        {view !== "problem" && !topics && !loadError && (
          <div className={styles.panel} aria-busy="true">
            <div className={styles.skeletonLine} /><div className={styles.skeletonLine} /><div className={styles.skeletonLine} />
          </div>
        )}
        {view !== "problem" && loadError && !topics && (
          <div className={styles.panel} role="alert">
            <p className={styles.errorText}>{loadError}</p>
            <button type="button" className={styles.primaryButton} onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </div>
        )}

        {view === "topics" && topics && topics.chains.map((chain) => {
          // Chains list the goal topic first; show them foundation-first, the order a student would learn them.
          const steps = [...chain.nodes].reverse();
          const pathTotals = steps.reduce(
            (acc, n) => ({ total: acc.total + nodeTotals(n).total, solved: acc.solved + nodeTotals(n).solved }),
            { total: 0, solved: 0 }
          );
          return (
            <section key={chain.entry_node_id} className={styles.chain} aria-label={`${chain.label} path`}>
              <header className={styles.chainHeader}>
                <div>
                  <span className={styles.chainKicker}>Path to</span>
                  <h2 className={styles.chainTitle}>{chain.label}</h2>
                </div>
                <div className={styles.chainProgress}>
                  <span>{pathTotals.solved} / {pathTotals.total} solved</span>
                  <ProgressBar solved={pathTotals.solved} total={pathTotals.total} />
                </div>
              </header>
              <ol className={styles.trail}>
                {steps.map((n, i) => {
                  const totals = nodeTotals(n);
                  const done = totals.total > 0 && totals.solved === totals.total;
                  const isGoal = i === steps.length - 1;
                  return (
                    <li key={n.node_id} className={styles.trailItem}>
                      <button
                        type="button"
                        data-tutorial="playground-topic"
                        className={styles.topicCard}
                        data-done={done}
                        data-empty={totals.total === 0}
                        onClick={() => router.push(`/playground?topic=${n.node_id}`)}
                      >
                        <span className={styles.topicHead}>
                          <span className={styles.stepBadge} aria-hidden="true">{done ? "✓" : i + 1}</span>
                          <span className={styles.topicTitle}>{n.label}</span>
                          {isGoal && <span className={styles.goalTag}>Goal</span>}
                        </span>
                        <span className={styles.tierList}>
                          {DIFFICULTIES.map((d) => {
                            const c = n.difficulties[d];
                            const soon = c.total === 0;
                            return (
                              <span key={d} className={styles.tierLine} data-tier={d} data-soon={soon} data-done={!soon && c.solved === c.total} title={soon ? `${DIFFICULTY_LABELS[d]}: coming soon` : `${DIFFICULTY_LABELS[d]}: ${c.solved} of ${c.total} solved`}>
                                <span className={styles.tierLabel}>{DIFFICULTY_LABELS[d]}</span>
                                <span className={styles.segments} aria-hidden="true">
                                  {soon ? <span className={styles.segSoon} /> : Array.from({ length: c.total }, (_, k) => (
                                    <span key={k} className={styles.seg} data-on={k < c.solved} />
                                  ))}
                                </span>
                                <span className={styles.tierNum}>{soon ? "Soon" : `${c.solved}/${c.total}`}</span>
                              </span>
                            );
                          })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        {view === "difficulty" && topics && !node && (
          <div className={styles.panel}>
            <p className={styles.mutedText}>We couldn&apos;t find that topic.</p>
            <button type="button" className={styles.secondaryButton} onClick={goTopics}>Back to topics</button>
          </div>
        )}
        {view === "difficulty" && node && (
          <div className={styles.cardGrid}>
            {DIFFICULTIES.map((d) => {
              const c = node.difficulties[d];
              const empty = c.total === 0;
              return (
                <button key={d} type="button" data-tutorial="playground-difficulty" className={styles.card} disabled={empty} onClick={() => router.push(`/playground?topic=${node.node_id}&difficulty=${d}`)}>
                  <span className={styles.cardTitle}>{DIFFICULTY_LABELS[d]}</span>
                  <span className={styles.cardCount}>{empty ? "Coming soon" : `${c.solved} / ${c.total} solved`}</span>
                </button>
              );
            })}
          </div>
        )}

        {view === "problem" && topic && difficulty && (
          <ProblemRunner
            key={`${topic}-${difficulty}`}
            nodeId={topic}
            nodeLabel={node?.label ?? topic}
            difficulty={difficulty}
            onOtherDifficulty={goDifficulty}
            onTopics={goTopics}
          />
        )}
      </main>
    </div>
  </MainPage>;
}

export default function PlaygroundPage() {
  return <Suspense fallback={null}><PlaygroundInner /></Suspense>;
}
