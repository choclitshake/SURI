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
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-8">
        <div className="border border-black p-8 max-w-sm w-full text-center">
          <p className="font-mono text-sm animate-pulse uppercase tracking-wider">
            {simplifying ? simplifyText : loadingText}
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !result) {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto flex flex-col justify-center">
        <div className="border border-black p-8 text-center">
          <h2 className="text-xl font-mono uppercase font-bold mb-4">Error</h2>
          <p className="font-mono text-xs text-red-600 mb-8 break-words">
            [ERROR] {errorMsg || "No results available."}
          </p>
          <button
            onClick={() => router.push(`/session/${sessionId}/practice`)}
            className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
          >
            Back to Practice
          </button>
        </div>
      </div>
    );
  }

  if (result.decision === "advance" && result.topic_complete) {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
        <header className="border-b border-black pb-4 mb-8 text-center">
          <h1 className="text-2xl font-mono font-bold uppercase">Topic Complete!</h1>
          <p className="text-3xl mt-2">🎉</p>
        </header>
        <div className="border border-black p-6 text-center mb-8">
          <p className="font-mono text-sm text-gray-600 uppercase mb-2">Mastery</p>
          <p className="font-mono text-lg font-bold">{masteryLabel}</p>
        </div>
        <button
          onClick={handleDashboard}
          disabled={actionLoading}
          className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all bg-white hover:bg-black hover:text-white cursor-pointer disabled:opacity-50"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (result.decision === "advance") {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
        <header className="border-b border-black pb-4 mb-8 text-center">
          <h1 className="text-2xl font-mono font-bold uppercase">Mastered ✓</h1>
        </header>
        <div className="border border-black p-6 text-center mb-6">
          <p className="font-mono text-sm text-gray-600 uppercase mb-2">Mastery</p>
          <p className="font-mono text-lg font-bold">{masteryLabel}</p>
        </div>
        <p className="font-mono text-sm text-center mb-8 uppercase tracking-wide">
          Next up: {result.next_node_label}
        </p>
        <button
          onClick={handleContinue}
          disabled={actionLoading}
          className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all bg-white hover:bg-black hover:text-white cursor-pointer disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    );
  }

  const misconceptionNodes = result.misconception_nodes ?? [];
  const hasMisconceptions = misconceptionNodes.length > 0;

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
      <header className="border-b border-black pb-4 mb-8 text-center">
        <h1 className="text-2xl font-mono font-bold uppercase">Keep Practicing</h1>
      </header>

      <div className="border border-black p-6 text-center mb-8">
        <p className="font-mono text-sm text-gray-600 uppercase mb-2">Mastery</p>
        <p className="font-mono text-lg font-bold">{masteryLabel}</p>
      </div>

      <div className="space-y-4">
        <RemediateCard
          title="Address a Specific Error"
          subtitle={
            hasMisconceptions
              ? "Tap to choose a concept to review"
              : "No specific errors identified"
          }
          disabled={!hasMisconceptions}
          expanded={misconceptionsExpanded}
          onToggle={() => hasMisconceptions && setMisconceptionsExpanded((v) => !v)}
        >
          {hasMisconceptions && (
            <ul className="border-t border-black divide-y divide-black">
              {misconceptionNodes.map((node: MisconceptionNode) => (
                <li key={node.node_id}>
                  <button
                    type="button"
                    onClick={() => handleNavigateToNode(node.node_id)}
                    disabled={actionLoading}
                    className="w-full text-left py-3 px-4 font-mono text-sm uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    {node.node_label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </RemediateCard>

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
          light
        />
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
  const baseClass = light
    ? "border border-gray-300 text-gray-700"
    : "border border-black text-black";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  const handleClick = () => {
    if (disabled) return;
    if (onToggle) {
      onToggle();
    } else if (onAction) {
      onAction();
    }
  };

  return (
    <div className={`${baseClass} ${disabledClass}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || actionLoading}
        className="w-full text-left p-4 disabled:cursor-not-allowed"
      >
        <p className="font-mono text-sm font-bold uppercase">{title}</p>
        <p className="font-mono text-xs mt-1 text-gray-600">{subtitle}</p>
        {onToggle && !disabled && (
          <p className="font-mono text-xs mt-2 uppercase">
            {expanded ? "▲ Collapse" : "▼ Expand"}
          </p>
        )}
      </button>
      {expanded && children}
    </div>
  );
}
