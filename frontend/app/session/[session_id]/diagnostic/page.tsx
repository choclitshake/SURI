"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { 
  getSession,
  getTopicChain,
  getDiagnosticProbe,
  submitDiagnosticAnswer,
  submitDiagnostic,
  skipDiagnostic,
  DiagnosticProbe,
} from "../../../../lib/api";
import { 
  Compass, 
  Leaf, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  ShieldAlert, 
  ArrowRight 
} from "lucide-react";

const RenderMath = ({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
    {text}
  </ReactMarkdown>
);

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
  const [topicEntryNode, setTopicEntryNode] = useState<string>("");

  // Per-node question progress
  const [nodeQuestionCount, setNodeQuestionCount] = useState(0);  // questions answered for current node
  const [nodeQuestionTotal, setNodeQuestionTotal] = useState(8);  // always 8
  const [currentNodeLabel, setCurrentNodeLabel] = useState("");

  // Show toast and confetti on feedback change
  useEffect(() => {
    if (feedback) {
      toast.success(feedback.correct ? "✅ Correct!" : "❌ Incorrect");
      if (feedback.correct) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [feedback]);

  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [answeredCount, setAnsweredCount] = useState<number>(0);

  const fetchNextProbe = async () => {
    setLoading(true);
    setSelectedIdx(null);
    setFeedback(null);
    setError(null);
    try {
      const data = await getDiagnosticProbe(sessionId);
      setProbe(data);
      setPhase("probes");
      // Update per-node progress from the response
      if (data.questions_answered !== undefined) setNodeQuestionCount(data.questions_answered);
      if (data.questions_total !== undefined) setNodeQuestionTotal(data.questions_total);
      if (data.node_label) setCurrentNodeLabel(data.node_label);
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
    
    // Fetch total questions for UI
    const initTotal = async () => {
      try {
        const session = await getSession(sessionId);
        setTopicEntryNode(session.topic_entry_node);
        const { chain } = await getTopicChain(session.topic_entry_node);
        setTotalQuestions(chain.length);
      } catch (e) {
        console.error("Failed to load chain length", e);
      }
    };
    initTotal();
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

      // If node is complete, store the pass/fail result per node
      if (res.node_complete) {
        const currentAnswers = JSON.parse(
          sessionStorage.getItem("diagnostic_answers") || "{}"
        );
        currentAnswers[probe.node_id] = res.node_passed ?? res.correct;
        sessionStorage.setItem("diagnostic_answers", JSON.stringify(currentAnswers));
        setAnsweredCount(Object.keys(currentAnswers).length);
        // Reset per-node counter for the next node
        setNodeQuestionCount(0);
      } else {
        // Update question counter within the current node
        if (res.questions_answered !== undefined) setNodeQuestionCount(res.questions_answered);
      }

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

  return (
    <div className="bg-[#1b261c] min-h-screen text-[#1F2720] py-8 px-4 md:px-8 relative overflow-hidden font-['Manrope']">
      
      {/* Inline styles for custom gamification animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatFirefly {
          0% { transform: translateY(110%) translateX(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-20px) translateX(30px); opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes bounceJelly {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(0.95, 1.05); }
          50% { transform: translateY(0) scale(1.05, 0.95); }
          70% { transform: translateY(-2px) scale(0.98, 1.02); }
        }
        .firefly {
          position: absolute;
          background: #fdd400;
          border-radius: 50%;
          filter: drop-shadow(0 0 5px #ffe170);
          pointer-events: none;
        }
        .animate-jelly {
          animation: bounceJelly 2.5s ease-in-out infinite;
        }
      ` }} />

      {/* Background Forest Silhouette Pattern */}
      <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

      {/* Floating Glowing Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "10%", bottom: "10%", animation: "floatFirefly 7s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "22%", bottom: "6%", animation: "floatFirefly 10s ease-in-out infinite 1.5s" }} />
      <div className="firefly w-1.5 h-1.5" style={{ left: "45%", bottom: "12%", animation: "floatFirefly 5s ease-in-out infinite 0.5s" }} />
      <div className="firefly w-3 h-3" style={{ left: "78%", bottom: "14%", animation: "floatFirefly 9s ease-in-out infinite 2s" }} />

      <div className="max-w-3xl mx-auto space-y-6 relative z-10">

        {/* Dynamic Header Block */}
        <header className="bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          
          {/* Backlight gold orb */}
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/25 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4 z-10 border-b-4 border-[#1F2720]/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
              <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-[0.2em] uppercase font-black">
                {phase === "intro" ? "PLACEMENT DIAGNOSTIC" : "EVALUATION ACTIVE"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/topics/${topicEntryNode}`)}
                className="font-['Manrope'] text-[10px] text-[#1F2720] bg-white hover:bg-slate-100 px-3 py-2 rounded-xl border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider"
              >
                Exit
              </button>
              <span className="font-['Manrope'] text-[9px] font-black text-[#1F2720] bg-[#fdd400] px-2.5 py-1 rounded-md border-2 border-[#1F2720] uppercase">
                DB_SYNC
              </span>
            </div>
          </div>

          <div className="z-10 flex items-center gap-4">
            <img 
              src={phase === "intro" ? "/suri-snake-right.png" : "/suri-snake-left.png"} 
              alt="Suri Guide" 
              className="h-16 w-auto object-contain select-none shrink-0 animate-jelly" 
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                {phase === "intro" ? "Baseline Diagnostic" : "Diagnostic Probe"}
              </h1>
              <p className="font-['Manrope'] text-[10px] text-emerald-200 mt-1 font-bold uppercase tracking-wider">
                Session ID: <span className="text-[#fdd400]">{sessionId}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Global Error Exception Alert */}
        {error && (
          <div className="bg-red-100 border-[3.5px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-['Manrope'] text-[11px] text-red-900 font-black uppercase tracking-widest block mb-1">
                [DIAGNOSTIC EXCEPTION]
              </span>
              <p className="font-['Manrope'] text-xs text-red-900 font-extrabold">{error}</p>
            </div>
          </div>
        )}

        {/* PHASE 1: INTRO COMPONENT */}
        {phase === "intro" ? (
          <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-6 md:p-8 shadow-[8px_8px_0px_0px_#1F2720] space-y-6">
            <p className="font-['Manrope'] text-sm md:text-base text-slate-700 leading-relaxed font-bold">
              This short diagnostic builds up from foundational prerequisites to your active topic. 
              Your answers help map out existing baseline knowledge block skills to identify custom starting nodes.
            </p>

            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={fetchNextProbe}
                disabled={loading}
                className="w-full bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Initializing Diagnostics..." : "Start Placement Diagnostic"}
              </button>

              <div className="text-center pt-3 border-t-2 border-[#1F2720]/10">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={skipping}
                  className="w-full bg-[#f2f4f6] text-[#1F2720] border-[3.5px] border-[#1F2720] py-3.5 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer disabled:opacity-50"
                >
                  {skipping ? "Redirecting..." : "Skip Diagnostics"}
                </button>
                <p className="font-['Manrope'] text-[10px] text-slate-400 mt-2.5 font-bold uppercase">
                  Bypass questions and jump directly to the first active lesson segment.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* PHASE 2: ACTIVE EVALUATION PROBES */
          <>
            {loading ? (
              <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-12 shadow-[8px_8px_0px_0px_#1F2720] flex flex-col items-center justify-center space-y-4">
                <Loader2 size={36} className="animate-spin text-[#1F2720]" />
                <p className="font-['Manrope'] text-[11px] text-slate-500 tracking-widest uppercase font-black animate-pulse">
                  Retrieving next evaluation query...
                </p>
              </div>
            ) : probe ? (
              <form 
                onSubmit={handleSubmit} 
                className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-6 md:p-8 shadow-[8px_8px_0px_0px_#1F2720] space-y-6"
              >
                {/* Probe Header Details */}
                <div className="flex flex-col gap-3 pb-3.5 border-b-[4px] border-[#1F2720]/15 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#fdd400] text-[#1F2720] font-['Manrope'] text-[10px] font-black uppercase px-2.5 py-1.5 rounded-md border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                      {currentNodeLabel || probe.node_id}
                    </span>
                    <span className="font-['Manrope'] text-[11px] font-black text-slate-500 uppercase tracking-widest">
                      Question {nodeQuestionCount + 1} of {nodeQuestionTotal}
                    </span>
                  </div>
                  {/* Per-node progress bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full border border-[#1F2720]/20 overflow-hidden">
                    <div
                      className="h-full bg-[#fdd400] rounded-full transition-all duration-500"
                      style={{ width: `${((nodeQuestionCount) / nodeQuestionTotal) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question Body */}
                <div className="text-base md:text-lg font-['Hanken_Grotesk'] font-black text-[#1F2720] leading-snug mb-6 markdown-content">
                  <RenderMath text={probe.question_text} />
                </div>

                {/* Multi Choice Radio Blocks */}
                <div className="space-y-4 mb-8">
                  {probe.options.map((option, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start p-4 rounded-2xl border-[3.5px] cursor-pointer transition-all duration-200 shadow-[3px_3px_0px_0px_#1F2720] hover:shadow-[5px_5px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] ${
                        selectedIdx === idx
                          ? "border-[#1F2720] bg-[#ffe170] text-[#1F2720] font-black"
                          : "border-[#1F2720] bg-white text-slate-700 font-bold hover:bg-slate-50"
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
                      <span className={`font-['Manrope'] text-sm mr-3 font-black shrink-0 ${selectedIdx === idx ? "text-[#1F2720]" : "text-emerald-700"}`}>
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span className="font-['Manrope'] text-sm markdown-content"><RenderMath text={option} /></span>
                    </label>
                  ))}
                </div>

                {/* Interactive Answer Feedback Overlay */}
                {feedback && (
                  <div className={`rounded-2xl p-4 mb-5 text-center font-['Manrope'] text-xs uppercase tracking-wider font-black border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] ${
                    feedback.correct 
                      ? "bg-green-100 text-green-900" 
                      : "bg-red-100 text-red-900"
                  }`}>
                    {feedback.correct ? "✓ [CORRECT! SSS-PECTACULAR]" : "✗ [INCORRECT! KEEP FOCUSSED RANGER]"} Moving on to next trail segment...
                  </div>
                )}

                {/* Dynamic mascot mood feedback */}
                {feedback && (
                  <div className="flex flex-col items-center justify-center gap-3 mt-4 mb-6 animate-jelly">
                    <img 
                      src={feedback.correct ? "/suri-snake-happy.png" : "/suri-snake-sad.png"} 
                      alt={feedback.correct ? "Suri Happy" : "Suri Sad"} 
                      className="w-24 h-auto object-contain select-none animate-bounce" 
                      style={{ animationDuration: "2s" }}
                    />
                    <p className="font-['Manrope'] text-[11px] font-black text-[#1F2720] bg-white py-1.5 px-4 rounded-full border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720]">
                      {feedback.correct 
                        ? "💬 \"Sss-pot on, Ranger! Beautifully solved!\"" 
                        : "💬 \"Oh sss-no! Don't let the thorns stop you!\""}
                    </p>
                  </div>
                )}

                {/* Submission Action */}
                <button
                  type="submit"
                  disabled={selectedIdx === null || submitting || feedback !== null}
                  className="w-full bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Submitting Evaluation..." : "Submit Answer"}
                </button>
              </form>
            ) : (
              <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-8 text-center shadow-[6px_6px_0px_0px_#1F2720]">
                <p className="font-['Manrope'] text-sm text-slate-500 font-bold">No active evaluation targets.</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}