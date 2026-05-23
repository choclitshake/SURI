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
        const session = await getSession(sessionId);
        
        const { chain: topicChain } = await getTopicChain(session.topic_entry_node);
        setChain(topicChain);
        
        const progress = await getStudentProgress(session.student_id);
        
        const currentSessionProgress = 
          progress.active_sessions.find((s) => s.id === sessionId) ||
          progress.completed_sessions?.find((s) => s.id === sessionId);
        
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
        return { text: "Mastered", bg: "bg-green-50 text-green-700 border-green-200" };
      case "unresolved":
        return { text: "Needs Work", bg: "bg-red-50 text-red-700 border-red-200" };
      case "in_progress":
        return { text: "In Progress", bg: "bg-yellow-50 text-yellow-700 border-yellow-200" };
      default:
        return { text: "Not Attempted", bg: "bg-slate-100 text-slate-400 border-slate-200" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

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
              <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">EVALUATION REPORT</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 uppercase">GO1_DB</span>
          </div>

          <div className="z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
              Diagnostic Results
            </h1>
            <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
              Session ID: <span className="text-[#fdd400]">{sessionId}</span>
            </p>
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
            <div>
              <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[DIAGNOSTIC FAULT]</span>
              <p className="font-mono text-sm text-red-800">{errorMsg}</p>
            </div>
          </div>
        )}

        {chain.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <div className="mb-8">
              <h2 className="text-sm font-mono font-bold text-[#001a54] uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
                Path Evaluation
              </h2>
              <p className="font-sans text-sm md:text-base text-slate-600 leading-relaxed font-medium">
                Understanding has been mapped across your learning pathway [1]. Remediation will initiate at the first weak node to build solid structural foundations.
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

                let cardStyle = "border-slate-200 bg-white hover:border-slate-300";
                if (isGapNode) {
                  cardStyle = "border-[#001a54] bg-slate-50 ring-1 ring-[#001a54] shadow-[0_4px_15px_rgba(0,26,84,0.05)]";
                }

                return (
                  <div 
                    key={nodeId} 
                    className={`p-4 md:p-5 border rounded-2xl transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${cardStyle}`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {isGapNode ? (
                        <span className="font-mono text-[9px] font-extrabold text-[#001a54] bg-[#fdd400] px-2.5 py-1 rounded-md shrink-0 uppercase tracking-widest animate-pulse shadow-[0_0_8px_rgba(253,212,0,0.4)]">
                          START HERE →
                        </span>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-200 mt-1.5 sm:mt-0 shrink-0" />
                      )}
                      <div>
                        <h3 className="text-sm md:text-base font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] leading-snug">
                          {label}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">NODE ID: {nodeId}</p>
                      </div>
                    </div>

                    <div className="self-start sm:self-auto shrink-0">
                      <span className={`inline-block border font-mono text-[10px] uppercase px-2.5 py-1 rounded-lg font-extrabold tracking-wider ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleStartRemediation}
              className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] flex items-center justify-center gap-2"
            >
              Start Remediation Track <span className="text-[#fdd400]">→</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="font-mono text-sm text-slate-500">No diagnostic results mapped in the registry.</p>
          </div>
        )}

      </div>
    </div>
  );
}