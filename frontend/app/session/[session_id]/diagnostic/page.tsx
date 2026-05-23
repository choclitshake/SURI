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
      <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Premium Bento Header (Navy with Gold Accents) */}
          <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            {/* Subtle ambient gold and navy glow offsets */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
                <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">PLACEMENT DIAGNOSTIC</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 uppercase">DB_SYNC</span>
            </div>

            <div className="z-10">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
                Baseline Diagnostic
              </h1>
              <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
                Session ID: <span className="text-[#fdd400]">{sessionId}</span>
              </p>
            </div>
          </header>

          {error && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[DIAGNOSTIC FAULT]</span>
                <p className="font-mono text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Diagnostic Intro Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)] space-y-6">
            <p className="font-sans text-sm md:text-base text-slate-600 leading-relaxed font-medium">
              This short diagnostic walks through the prerequisite chain for your active topic. 
              Your answers help map out existing baseline knowledge block skills to identify custom starting nodes.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={fetchNextProbe}
                disabled={loading}
                className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] disabled:opacity-50"
              >
                {loading ? "Initializing Diagnostics..." : "Start Placement Diagnostic"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={skipping}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-3 text-xs font-mono uppercase rounded-xl tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  {skipping ? "Redirecting..." : "Skip Diagnostics"}
                </button>
                <p className="font-mono text-[10px] text-slate-400 mt-2">
                  Bypass questions and jump directly to the first active lesson segment.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Dynamic Probe header */}
        <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
              <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">EVALUATION ACTIVE</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 uppercase">DB_SYNC</span>
          </div>

          <div className="z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
              Diagnostic Probe
            </h1>
            <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
              Session ID: <span className="text-[#fdd400]">{sessionId}</span>
            </p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
            <div>
              <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[SUBMISSION FAULT]</span>
              <p className="font-mono text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 shadow-[0_4px_12px_rgba(0,26,84,0.02)] flex flex-col items-center justify-center space-y-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
            </div>
            <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase animate-pulse">Retrieving next evaluation query...</p>
          </div>
        ) : probe ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
              <span className="bg-[#fdd400] text-[#001a54] font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded">
                Assessing: {probe.node_id}
              </span>
            </div>

            <h2 className="text-base md:text-lg font-['Hanken_Grotesk',_sans-serif] font-extrabold text-[#001a54] leading-snug mb-6">
              {probe.question_text}
            </h2>

            <div className="space-y-4 mb-8">
              {probe.options.map((option, idx) => (
                <label
                  key={idx}
                  className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    selectedIdx === idx
                      ? "border-[#001a54] bg-[#001a54] text-white shadow-[0_4px_12px_rgba(0,26,84,0.15)]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
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
                  <span className={`font-mono text-sm mr-3 font-bold ${selectedIdx === idx ? "text-[#fdd400]" : "text-[#001a54]"}`}>
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="font-mono text-sm font-semibold">{option}</span>
                </label>
              ))}
            </div>

            {feedback && (
              <div className={`rounded-xl p-4 mb-6 text-center font-mono text-xs uppercase tracking-wider font-extrabold border ${
                feedback.correct 
                  ? "bg-green-50 text-green-700 border-green-200" 
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {feedback.correct ? "✓ [CORRECT]" : "✗ [INCORRECT]"} Moving on to next node...
              </div>
            )}

            <button
              type="submit"
              disabled={selectedIdx === null || submitting || feedback !== null}
              className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] disabled:opacity-50"
            >
              {submitting ? "Submitting Evaluation..." : "Submit Answer"}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="font-mono text-sm text-slate-500">No active evaluation targets.</p>
          </div>
        )}

      </div>
    </div>
  );
}