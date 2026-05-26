"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  decideProgression,
  updateSession,
  saveProgress,
  simplifyContent,
  ProgressionDecision,
} from "../../../../lib/api";
import confetti from "canvas-confetti";
import { 
  Compass, 
  Leaf, 
  Flame, 
  ShieldAlert, 
  Loader2, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Trophy,
  Sprout
} from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Calculating your results...");
  const [currentNode, setCurrentNode] = useState("");
  const [result, setResult] = useState<ProgressionDecision | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [simplifying, setSimplifying] = useState(false);
  const [simplifyText, setSimplifyText] = useState("Getting a simpler explanation...");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const session = await getSession(sessionId);
        setCurrentNode(session.current_node);
        const decision = await decideProgression({
          session_id: sessionId,
          node_id: session.current_node,
        });
        setResult(decision);
      } catch (err: unknown) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to calculate results.";
        const detail =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail?: string }).detail)
            : message;
        setErrorMsg(detail);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadResults();
    }
  }, [sessionId]);

  // Launch celebratory confetti when user successfully advances past a module [2]
  useEffect(() => {
    if (result && result.decision === "advance") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [result]);

  const masteryLabel = result
    ? `${result.passed_count} out of 5 correct`
    : "";

  const handleContinue = async () => {
    if (!result?.next_node_id) return;
    setActionLoading(true);
    try {
      await updateSession(sessionId, { current_node: result.next_node_id });
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to update session. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  const handleNavigateToNode = async (nodeId: string) => {
    setActionLoading(true);
    try {
      await updateSession(sessionId, { current_node: nodeId });
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to update session. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSimplified = async () => {
    setSimplifying(true);
    setSimplifyText("Getting a simpler explanation...");
    try {
      await simplifyContent(currentNode);
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Could not load a simpler explanation. Please try again.");
      setSimplifying(false);
    }
  };

  const handleQuit = async () => {
    setActionLoading(true);
    try {
      await saveProgress(sessionId);
      router.push("/dashboard?saved=true");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to save progress. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || simplifying) {
    return (
      <div className="min-h-screen bg-[#1b261c] flex flex-col items-center justify-center p-8">
        <div className="bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 max-w-sm w-full text-center shadow-[8px_8px_0px_0px_#1F2720]">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#e6e8ea] rounded-full" />
            <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
          <p className="font-['Manrope'] text-xs text-[#1F2720] font-black animate-pulse uppercase tracking-wider">
            {simplifying ? simplifyText : loadingText}
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !result) {
    return (
      <div className="min-h-screen bg-[#1b261c] p-6 md:p-8 flex flex-col justify-center items-center font-['Manrope']">
        <div className="w-full max-w-xl bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 shadow-[8px_8px_0px_0px_#1F2720] text-center relative overflow-hidden">
          <span className="font-black text-[10px] text-red-900 bg-red-100 border-2 border-[#1F2720] px-3 py-1.5 rounded-md uppercase tracking-wider">EVALUATION FAULT</span>
          <h2 className="text-xl font-black text-[#1F2720] mt-4 mb-2">Error</h2>
          <p className="font-black text-xs text-red-900 bg-red-50 border-2 border-[#1F2720] rounded-xl p-3 my-4 break-all text-left">
            [FAULT_LOG] {errorMsg || "No results available."}
          </p>
          <button
            onClick={() => router.push(`/session/${sessionId}/practice`)}
            className="w-full bg-[#fdd400] text-[#1F2720] border-[3.5px] border-[#1F2720] py-3.5 px-6 text-xs font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5"
          >
            Back to Practice
          </button>
        </div>
      </div>
    );
  }

  const getHeaderDetails = () => {
    if (result.decision === "advance") {
      if (result.topic_complete) {
        return { title: "Topic Complete!", label: "ADVANCEMENT ARCHIVED", emoji: "🎉" };
      }
      return { title: "Concept Mastered", label: "MILESTONE ACHIEVED", emoji: "✓" };
    }
    return { title: "Keep Practicing", label: "REMEDIATION MODULE", emoji: "⚡" };
  };

  const headerInfo = getHeaderDetails();

  // Determine dynamic diagnostic result evaluations [1]
  const isAdvanceDecision = result.decision === "advance";
  const mascotSrc = isAdvanceDecision ? "/suri-snake-happy.png" : "/suri-snake-sad.png";
  const suriQuote = isAdvanceDecision
    ? "💬 \"Sss-ensational math skills! The trail path is clear and completely safe to pass!\""
    : "💬 \"Oh sss-no! Tricky thorns are blocking our advance. Let'sss strengthen our foundation!\"";

  const renderHeader = () => (
    <header className="bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
      <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4 z-10 border-b-4 border-[#1F2720]/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
          <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-[0.2em] uppercase font-black">{headerInfo.label}</span>
        </div>
        <span className="font-['Manrope'] text-[9px] font-black text-[#1F2720] bg-[#fdd400] px-2.5 py-1 rounded-md border-2 border-[#1F2720] uppercase">GO1_EVAL</span>
      </div>

      <div className="z-10 flex justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Hanken_Grotesk'] drop-shadow-[2.5px_2.5px_0px_#1F2720]">
            {headerInfo.title}
          </h1>
          <p className="font-['Manrope'] text-[10px] text-emerald-200 mt-1.5 font-bold uppercase tracking-wider">
            Session ID: <span className="text-[#fdd400] font-black">{sessionId}</span>
          </p>
        </div>
        {headerInfo.emoji && (
          <span className="text-3xl md:text-4xl bg-white/10 p-3 rounded-2xl border-2 border-white/20 select-none">{headerInfo.emoji}</span>
        )}
      </div>
    </header>
  );

  return (
    <div className="bg-[#1b261c] min-h-screen text-[#1F2720] py-8 px-4 md:px-8 relative overflow-hidden font-['Manrope'] flex flex-col items-center">
      
      {/* Background Forest Silhouette */}
      <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

      {/* Floating Glowing Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "10%", bottom: "10%", animation: "floatFirefly 8s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "22%", bottom: "5%", animation: "floatFirefly 11s ease-in-out infinite 1.5s" }} />

      <div className="max-w-xl w-full mx-auto space-y-6 relative z-10">
        
        {renderHeader()}

        {/* Dynamic Speech Interaction Balloon [1] */}
        <div className="relative bg-[#ffe170] text-[#1F2720] font-black text-xs md:text-sm p-5 rounded-3xl border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720] w-full transform hover:scale-[1.01] transition-transform flex items-center gap-4">
          <img 
            src={mascotSrc} 
            alt="Suri" 
            className="h-14 w-auto object-contain select-none shrink-0 animate-bounce" 
            style={{ animationDuration: "2.5s" }} 
          />
          <span>{suriQuote}</span>
        </div>

        {/* Performance Score Display */}
        <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-6 text-center shadow-[6px_6px_0px_0px_#1F2720]">
          <p className="font-['Manrope'] text-xs text-slate-500 uppercase tracking-widest font-black mb-1">Session Mastery Results</p>
          <p className="font-['Hanken_Grotesk'] text-3xl font-black text-[#1F2720]">{masteryLabel}</p>
          <p className="text-xs text-slate-500 font-bold mt-1.5 leading-normal">Your solved formulas have been evaluated by SURI</p>
        </div>

        {/* ROUTE 1: ADVANCED AND COMPLETE */}
        {result.decision === "advance" && result.topic_complete && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => router.push("/topics")}
              disabled={actionLoading}
              className="w-full bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Choose Next Topic <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
            
            <button
              onClick={handleDashboard}
              disabled={actionLoading}
              className="w-full bg-white text-[#1F2720] border-[3.5px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer disabled:opacity-50"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* ROUTE 2: ADVANCED TO NEXT NODE */}
        {result.decision === "advance" && !result.topic_complete && (
          <>
            <div className="bg-[#faf8f5] rounded-3xl border-[4px] border-[#1F2720] p-5 text-center shadow-[4px_4px_0px_0px_#1F2720] flex items-center justify-center gap-3">
              <span className="h-3 w-3 rounded-full bg-[#fdd400] border-2 border-[#1F2720]" />
              <p className="font-['Manrope'] text-xs text-slate-700 uppercase tracking-wider font-black">
                Next Path Step: <span className="text-[#1F2720] font-black">{result.next_node_label}</span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleContinue}
                disabled={actionLoading}
                className="w-full bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Continue Pathway <ArrowRight className="w-5 h-5 stroke-[3px]" />
              </button>
              
              <button
                onClick={handleDashboard}
                disabled={actionLoading}
                className="w-full bg-white text-[#1F2720] border-[3.5px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer disabled:opacity-50"
              >
                Back to Dashboard
              </button>
            </div>
          </>
        )}

        {/* ROUTE 3: REMEDIATION BLOCK (Keep Practicing) */}
        {result.decision !== "advance" && (
          <div className="space-y-4.5">
            {result.go_deeper_available && result.go_deeper_node && (
              <RemediateCard
                title="Go Deeper into Prerequisites"
                subtitle={`Work on: ${result.go_deeper_node.node_label}`}
                onAction={() => handleNavigateToNode(result.go_deeper_node!.node_id)}
                actionLoading={actionLoading}
              />
            )}

            <RemediateCard
              title="Review This Topic"
              subtitle="Re-read the lesson with a simpler explanation"
              onAction={handleReviewSimplified}
              actionLoading={actionLoading}
            />

            <RemediateCard
              title="Quit"
              subtitle="Your progress will be saved"
              onAction={handleQuit}
              actionLoading={actionLoading}
            />
          </div>
        )}

      </div>
    </div>
  );
}

function RemediateCard({
  title,
  subtitle,
  disabled = false,
  onAction,
  actionLoading = false,
}: {
  title: string;
  subtitle: string;
  disabled?: boolean;
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  return (
    <div className={`border-[3.5px] border-[#1F2720] rounded-[24px] transition-all duration-300 overflow-hidden bg-white shadow-[4px_4px_0px_0px_#1F2720] hover:shadow-[6px_6px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] ${disabledClass}`}>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled || actionLoading}
        className="w-full text-left p-5 disabled:cursor-not-allowed flex items-center justify-between gap-4 group"
      >
        <div className="space-y-1">
          <p className="font-[#Hanken_Grotesk] text-base font-black text-[#1F2720] group-hover:text-emerald-800 transition-colors">
            {title}
          </p>
          <p className="font-['Manrope'] text-xs font-bold text-slate-500">
            {subtitle}
          </p>
        </div>
        <span className="font-['Manrope'] text-sm text-[#1F2720] font-black group-hover:translate-x-1 transition-transform">
          <ArrowRight className="w-5 h-5 stroke-[3px]" />
        </span>
      </button>
    </div>
  );
}