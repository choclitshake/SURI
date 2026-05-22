"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  getTopicChain,
  getStudentProgress,
} from "../../../../lib/api";

const NODE_LABELS: Record<string, string> = {
  QE: "Quadratic Equations",
  FP: "Factoring Polynomials",
  SP: "Special Products / Polynomial Multiplication",
  LE: "Laws of Exponents",
  OI: "Operations on Integers",
  FD: "Fractions & Decimals",
  SLE: "Systems of Linear Equations",
  L2V: "Linear Equations in 2 Variables",
  L1V: "Linear Equations in 1 Variable",
  AE: "Algebraic Expressions & Evaluation",
  RPP: "Ratio, Proportion, Percent",
  RER: "Rational Exponents & Radicals",
  PE: "Polynomial Equations",
  PD: "Polynomial Division",
  PO: "Polynomial Operations"
};

interface NodeStatusInfo {
  status: string;
  source: string;
}

export default function GapResultPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [chain, setChain] = useState<string[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatusInfo>>({});
  const [gapNode, setGapNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Fetch current session to get student_id and topic_entry_node
        const session = await getSession(sessionId);
        
        // 2. Fetch topic chain (ordered from entry node to floor)
        const { chain: topicChain } = await getTopicChain(session.topic_entry_node);
        setChain(topicChain);
        
        // 3. Fetch progress for the student
        const progress = await getStudentProgress(session.student_id);
        
        // Find the active session progress
        const currentSessionProgress = 
          progress.active_sessions.find((s) => s.id === sessionId) ||
          progress.completed_sessions?.find((s) => s.id === sessionId);
        
        // 4. Map node statuses
        const statusesMap: Record<string, NodeStatusInfo> = {};
        if (currentSessionProgress) {
          currentSessionProgress.mastered_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "mastered", source: n.source || "" };
          });
          currentSessionProgress.in_progress_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "in_progress", source: n.source || "" };
          });
          currentSessionProgress.unresolved_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "unresolved", source: n.source || "" };
          });
        }
        setNodeStatuses(statusesMap);

        // 5. Read identified_node_id from sessionStorage or use session current_node
        const storedGapNode = sessionStorage.getItem("identified_node_id") || session.current_node;
        setGapNode(storedGapNode);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load diagnostic results.");
      } finally {
        setLoading(false);
      }
    };
    
    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  const handleStartRemediation = () => {
    router.push(`/session/${sessionId}/lesson`);
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "mastered":
        return { text: "Passed", bg: "bg-green-100 text-green-800 border-green-300" };
      case "unresolved":
        return { text: "Needs Work", bg: "bg-red-100 text-red-800 border-red-300" };
      case "in_progress":
        return { text: "In Progress", bg: "bg-yellow-100 text-yellow-800 border-yellow-300" };
      default:
        return { text: "Not Attempted", bg: "bg-gray-100 text-gray-500 border-gray-300" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono uppercase tracking-wider">GO1 — Diagnostic Results</h1>
        <p className="text-xs font-mono text-gray-600 mt-1">Session ID: {sessionId}</p>
      </header>

      {errorMsg && (
        <div className="mb-6 border border-black p-4 text-sm font-mono text-red-600">
          [ERROR] {errorMsg}
        </div>
      )}

      {chain.length > 0 ? (
        <div className="border border-black p-6">
          <div className="mb-8">
            <h2 className="text-lg font-mono font-bold uppercase mb-2">Diagnostic Results</h2>
            <p className="text-sm font-mono text-gray-700">
              We assessed your understanding along the learning path. Remediation will start at the deepest weak node to solidify your foundations.
            </p>
          </div>

          {/* List of nodes in topic chain in order */}
          <div className="space-y-4 my-8">
            {chain.map((nodeId) => {
              const label = NODE_LABELS[nodeId] || nodeId;
              const isGapNode = nodeId === gapNode;
              const nodeInfo = nodeStatuses[nodeId];
              const status = nodeInfo?.status;
              const badge = getStatusBadge(status);

              return (
                <div 
                  key={nodeId} 
                  className={`p-4 border ${
                    isGapNode 
                      ? "border-2 border-black bg-gray-50 font-bold" 
                      : "border-gray-200"
                  } flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
                >
                  <div className="flex items-center gap-2">
                    {isGapNode && (
                      <span className="font-mono text-sm font-bold text-red-600 animate-pulse">
                        Start here →
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-mono uppercase">
                        {label}
                      </h3>
                      <p className="text-xs font-mono text-gray-500">{nodeId}</p>
                    </div>
                  </div>

                  <div>
                    <span className={`inline-block border font-mono text-xs uppercase px-2 py-0.5 font-bold ${badge.bg}`}>
                      {badge.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleStartRemediation}
            className="w-full border border-black py-3 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
          >
            Start Remediation
          </button>
        </div>
      ) : (
        <p className="font-mono text-sm">No diagnostic results found.</p>
      )}
    </div>
  );
}
