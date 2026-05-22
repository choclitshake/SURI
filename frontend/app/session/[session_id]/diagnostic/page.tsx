"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  getTopicChain,
  getDiagnosticProbe,
  submitDiagnosticAnswer,
  submitDiagnostic,
  skipDiagnostic,
  DiagnosticProbe,
} from "../../../../lib/api";

export default function DiagnosticPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [phase, setPhase] = useState<"intro" | "probes">("intro");
  const [probe, setProbe] = useState<DiagnosticProbe | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; nextAction: string } | null>(null);

  const fetchNextProbe = async () => {
    setLoading(true);
    setSelectedIdx(null);
    setFeedback(null);
    setError(null);
    try {
      const data = await getDiagnosticProbe(sessionId);
      setProbe(data);
      setPhase("probes");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load diagnostic question.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sessionStorage.removeItem("diagnostic_answers");
    sessionStorage.removeItem("diagnostic_submit_result");
  }, [sessionId]);

  const finalizeDiagnostic = async () => {
    const session = await getSession(sessionId);
    const { chain } = await getTopicChain(session.topic_entry_node);
    const answersObj = JSON.parse(
      sessionStorage.getItem("diagnostic_answers") || "{}"
    ) as Record<string, boolean>;
    const answers = chain.map((node_id) => ({
      node_id,
      correct: !!answersObj[node_id],
    }));

    const res = await submitDiagnostic(sessionId, { answers });
    sessionStorage.setItem("diagnostic_submit_result", JSON.stringify(res));

    if (res.all_mastered) {
      router.push(res.redirect);
      return;
    }

    if (res.gap_node) {
      sessionStorage.setItem("identified_node_id", res.gap_node);
    }
    if (res.mastered_nodes) {
      sessionStorage.setItem(
        "diagnostic_mastered",
        JSON.stringify(res.mastered_nodes)
      );
    }
    if (res.unresolved_nodes) {
      sessionStorage.setItem(
        "diagnostic_unresolved",
        JSON.stringify(res.unresolved_nodes)
      );
    }
    router.push(res.redirect);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx === null || !probe || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await submitDiagnosticAnswer(sessionId, {
        node_id: probe.node_id,
        selected_option_index: selectedIdx,
      });

      setFeedback({ correct: res.correct, nextAction: res.next_action });

      const currentAnswers = JSON.parse(
        sessionStorage.getItem("diagnostic_answers") || "{}"
      );
      currentAnswers[probe.node_id] = res.correct;
      sessionStorage.setItem("diagnostic_answers", JSON.stringify(currentAnswers));

      setTimeout(async () => {
        try {
          if (res.next_action === "next_probe") {
            await fetchNextProbe();
          } else if (res.next_action === "complete") {
            await finalizeDiagnostic();
          }
        } catch (err: unknown) {
          setError(
            err instanceof Error ? err.message : "Failed to finalize diagnostic."
          );
        } finally {
          setSubmitting(false);
        }
      }, 1000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit answer."
      );
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      const res = await skipDiagnostic(sessionId);
      router.push(res.redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to skip diagnostic.");
      setSkipping(false);
    }
  };

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto">
        <header className="border-b border-black pb-4 mb-8">
          <h1 className="text-2xl font-mono uppercase tracking-wider">
            Placement Diagnostic
          </h1>
          <p className="text-xs font-mono text-gray-600 mt-1">
            Session ID: {sessionId}
          </p>
        </header>

        {error && (
          <div className="border border-black p-4 mb-6 text-sm font-mono">
            [ERROR] {error}
          </div>
        )}

        <div className="border border-black p-6 space-y-6">
          <p className="font-sans text-sm text-gray-800 leading-relaxed">
            This short diagnostic walks through the prerequisite chain for your
            topic. Your answers help SURI find the best place to start learning.
          </p>

          <button
            type="button"
            onClick={fetchNextProbe}
            disabled={loading}
            className="w-full border border-black py-3 text-sm font-mono uppercase font-bold bg-white hover:bg-black hover:text-white disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Loading..." : "Start Diagnostic"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              disabled={skipping}
              className="w-full border border-gray-400 py-3 text-sm font-mono uppercase text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
            >
              {skipping ? "Starting..." : "Skip and Start Learning"}
            </button>
            <p className="font-mono text-xs text-gray-500 mt-2">
              Go straight to the first lesson
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono uppercase tracking-wider">
          GO1 — Placement Diagnostic
        </h1>
        <p className="text-xs font-mono text-gray-600 mt-1">Session ID: {sessionId}</p>
      </header>

      {error && (
        <div className="border border-black p-4 mb-6 text-sm font-mono bg-white">
          [ERROR] {error}
        </div>
      )}

      {loading ? (
        <p className="font-mono text-sm">Loading next question...</p>
      ) : probe ? (
        <form onSubmit={handleSubmit} className="border border-black p-6">
          <div className="border-b border-black pb-3 mb-6">
            <span className="bg-black text-white font-mono text-xs uppercase px-2 py-1">
              Assessing: {probe.node_id}
            </span>
          </div>

          <h2 className="text-lg font-mono font-bold mb-6">{probe.question_text}</h2>

          <div className="space-y-4 mb-8">
            {probe.options.map((option, idx) => (
              <label
                key={idx}
                className={`flex items-start p-4 border border-black cursor-pointer transition-all hover:bg-gray-100 ${
                  selectedIdx === idx
                    ? "bg-black text-white hover:bg-black"
                    : "bg-white text-black"
                }`}
              >
                <input
                  type="radio"
                  name="probe-option"
                  checked={selectedIdx === idx}
                  onChange={() => setSelectedIdx(idx)}
                  disabled={submitting || feedback !== null}
                  className="sr-only"
                />
                <span className="font-mono text-sm mr-3 font-bold">
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span className="font-mono text-sm">{option}</span>
              </label>
            ))}
          </div>

          {feedback && (
            <div className="border border-black p-4 mb-6 text-center font-mono text-sm uppercase">
              {feedback.correct ? "[CORRECT]" : "[INCORRECT]"} Moving on...
            </div>
          )}

          <button
            type="submit"
            disabled={selectedIdx === null || submitting || feedback !== null}
            className="w-full border border-black py-3 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit Answer"}
          </button>
        </form>
      ) : (
        <p className="font-mono text-sm">No diagnostic questions active.</p>
      )}
    </div>
  );
}
