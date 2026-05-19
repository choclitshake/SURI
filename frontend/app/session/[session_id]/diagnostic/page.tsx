"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDiagnosticProbe, submitDiagnosticAnswer, DiagnosticProbe } from "../../../../lib/api";

export default function DiagnosticPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [probe, setProbe] = useState<DiagnosticProbe | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
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
      setLoading(false);
    } catch (err: any) {
      setError(err.detail || "Failed to load diagnostic question. The session might be complete.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchNextProbe();
    }
  }, [sessionId]);

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

      // Save diagnostic answer correctness for gap-result page
      const currentAnswers = JSON.parse(sessionStorage.getItem("diagnostic_answers") || "{}");
      currentAnswers[probe.node_id] = res.correct;
      sessionStorage.setItem("diagnostic_answers", JSON.stringify(currentAnswers));

      // Wait a moment for visual feedback before taking action
      setTimeout(() => {
        if (res.next_action === "next_probe") {
          fetchNextProbe();
        } else if (res.next_action === "complete") {
          if (res.identified_node_id) {
            sessionStorage.setItem("identified_node_id", res.identified_node_id);
          }
          if (res.prerequisite_path) {
            sessionStorage.setItem("prerequisite_path", JSON.stringify(res.prerequisite_path));
          }
          router.push(`/session/${sessionId}/gap-result`);
        }
        setSubmitting(false);
      }, 1000);

    } catch (err: any) {
      setError(err.detail || "Failed to submit answer.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono uppercase tracking-wider">GO1 — Placement Diagnostic</h1>
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
                  selectedIdx === idx ? "bg-black text-white hover:bg-black" : "bg-white text-black"
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
              {feedback.correct ? "[CORRECT]" : "[INCORRECT]"} Moving to prerequisite...
            </div>
          )}

          <button
            type="submit"
            disabled={selectedIdx === null || submitting || feedback !== null}
            className="w-full border border-black py-3 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black cursor-pointer"
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
