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
  MisconceptionNode,
} from "../../../../lib/api";

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Calculating your results...");
  const [currentNode, setCurrentNode] = useState("");
  const [result, setResult] = useState<ProgressionDecision | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [misconceptionsExpanded, setMisconceptionsExpanded] = useState(false);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_15px_30px_rgba(0,26,84,0.05)]">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
          <p className="font-mono text-xs text-slate-500 animate-pulse uppercase tracking-wider">
            {simplifying ? simplifyText : loadingText}
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !result) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-8 flex flex-col justify-center items-center">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_15px_30px_rgba(0,26,84,0.05)] text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#fdd400]/10 rounded-full blur-[40px] pointer-events-none" />
          <span className="font-mono text-[9px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">EVALUATION FAULT</span>
          <h2 className="text-xl font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] mt-3 mb-2">Error</h2>
          <p className="font-mono text-xs text-red-600 bg-red-50/50 border border-red-100 rounded-lg p-3 my-4 break-all text-left">
            [FAULT_LOG] {errorMsg || "No results available."}
          </p>
          <button
            onClick={() => router.push(`/session/${sessionId}/practice`)}
            className="w-full bg-[#001a54] text-white hover:bg-[#001545] py-3.5 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)]"
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

  const renderHeader = () => (
    <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
          <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">{headerInfo.label}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 uppercase">GO1_EVAL</span>
      </div>

      <div className="z-10 flex justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
            {headerInfo.title}
          </h1>
          <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
            Session ID: <span className="text-[#fdd400]">{sessionId}</span>
          </p>
        </div>
        {headerInfo.emoji && (
          <span className="text-3xl md:text-4xl bg-white/5 p-3 rounded-2xl border border-white/10">{headerInfo.emoji}</span>
        )}
      </div>
    </header>
  );

  if (result.decision === "advance" && result.topic_complete) {
    return (
      <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
        <div className="max-w-xl mx-auto space-y-6">
          {renderHeader()}

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <p className="font-mono text-xs text-slate-400 uppercase tracking-widest mb-1">Session Mastery</p>
            <p className="font-['Hanken_Grotesk',_sans-serif] text-2xl font-black text-[#001a54]">{masteryLabel}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Topic path elements perfectly finished [1]</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/progress")}
              disabled={actionLoading}
              className="w-full bg-[#fdd400] text-[#001a54] hover:bg-[#e6c100] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(253,212,0,0.2)] flex items-center justify-center gap-2"
            >
              Choose Next Topic <span className="text-[#001a54]">→</span>
            </button>
            <button
              onClick={handleDashboard}
              disabled={actionLoading}
              className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] disabled:opacity-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result.decision === "advance") {
    return (
      <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
        <div className="max-w-xl mx-auto space-y-6">
          {renderHeader()}

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <p className="font-mono text-xs text-slate-400 uppercase tracking-widest mb-1">Session Mastery</p>
            <p className="font-['Hanken_Grotesk',_sans-serif] text-2xl font-black text-[#001a54]">{masteryLabel}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-[0_4px_12px_rgba(0,26,84,0.02)] flex items-center justify-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
            <p className="font-mono text-xs text-slate-600 uppercase tracking-wider font-bold">
              Next Track Segment: <span className="text-[#001a54] font-black">{result.next_node_label}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleContinue}
              disabled={actionLoading}
              className="w-full bg-[#fdd400] text-[#001a54] hover:bg-[#e6c100] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(253,212,0,0.2)] flex items-center justify-center gap-2"
            >
              Continue Pathway <span className="text-[#001a54]">→</span>
            </button>
            <button
              onClick={handleDashboard}
              disabled={actionLoading}
              className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] disabled:opacity-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const misconceptionNodes = result.misconception_nodes ?? [];
  const hasMisconceptions = misconceptionNodes.length > 0;

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {renderHeader()}

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
          <p className="font-mono text-xs text-slate-400 uppercase tracking-widest mb-1">Session Mastery</p>
          <p className="font-['Hanken_Grotesk',_sans-serif] text-2xl font-black text-[#001a54]">{masteryLabel}</p>
        </div>

        <div className="space-y-4">


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
      </div>
    </div>
  );
}

function RemediateCard({
  title,
  subtitle,
  disabled = false,
  expanded = false,
  onToggle,
  onAction,
  actionLoading = false,
  light = false,
  children,
}: {
  title: string;
  subtitle: string;
  disabled?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAction?: () => void;
  actionLoading?: boolean;
  light?: boolean;
  children?: ReactNode;
}) {
  const borderClass = light 
    ? "border-slate-200 bg-white opacity-80" 
    : "border-slate-200/80 bg-white hover:border-[#001a54]/30";
  const disabledClass = disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer";

  const handleClick = () => {
    if (disabled) return;
    if (onToggle) {
      onToggle();
    } else if (onAction) {
      onAction();
    }
  };

  return (
    <div className={`border rounded-2xl transition-all duration-300 overflow-hidden shadow-[0_4px_12px_rgba(0,26,84,0.02)] hover:shadow-[0_12px_24px_rgba(0,26,84,0.04)] ${borderClass} ${disabledClass}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || actionLoading}
        className="w-full text-left p-5 disabled:cursor-not-allowed flex items-center justify-between gap-4 group"
      >
        <div className="space-y-1">
          <p className="font-['Hanken_Grotesk',_sans-serif] text-sm md:text-base font-extrabold text-[#001a54] group-hover:text-[#001a54]/80 transition-colors">{title}</p>
          <p className="font-mono text-xs text-slate-500">{subtitle}</p>
        </div>
        {onToggle && !disabled && (
          <span className="font-mono text-[10px] uppercase font-bold text-[#001a54] bg-[#fdd400]/25 px-2.5 py-1 rounded-md">
            {expanded ? "▲ Collapse" : "▼ Expand"}
          </span>
        )}
        {onAction && !disabled && (
          <span className="font-mono text-sm text-[#001a54] font-bold group-hover:translate-x-1 transition-transform">
            →
          </span>
        )}
      </button>
      {expanded && children}
    </div>
  );
}