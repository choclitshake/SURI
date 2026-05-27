"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  getTopicChain,
  getStudentProgress,
} from "../../../../lib/api";
import {
  Compass,
  Leaf,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Flame,
  Sprout
} from "lucide-react";

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
        return {
          text: "Clear Trail",
          bg: "bg-green-100 text-green-900 border-[#1F2720]"
        };
      case "unresolved":
        return {
          text: "Thorny Path",
          bg: "bg-red-100 text-red-900 border-[#1F2720]"
        };
      case "in_progress":
        return {
          text: "Exploring",
          bg: "bg-[#ffe170]/40 text-[#1F2720] border-[#1F2720]"
        };
      default:
        return {
          text: "Unexplored",
          bg: "bg-slate-100 text-slate-500 border-slate-300"
        };
    }
  };

  // Determine dynamic diagnostic result evaluations
  const allMastered = chain.length > 0 && chain.every(id => nodeStatuses[id]?.status === "mastered");
  const mascotSrc = allMastered ? "/suri-snake-happy.png" : "/suri-snake-sad.png";
  const suriQuote = allMastered
    ? "💬 \"Sss-pectacular! You fully cleared all trails in this chain! No obstacles detected!\""
    : "💬 \"We found a thorny gap blocking your path. Let'sss clear those algebra brambles together, Ranger!\"";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b261c] flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-[#1F2720]/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1b261c] min-h-screen text-[#1F2720] py-8 px-4 md:px-8 relative overflow-hidden font-['Manrope'] flex flex-col items-center">

      {/* Inline styles for custom animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
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

      {/* Background Forest Overlay */}
      <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

      {/* Floating Glowing Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "8%", bottom: "12%", animation: "floatFirefly 7s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "24%", bottom: "6%", animation: "floatFirefly 10s ease-in-out infinite 1.5s" }} />
      <div className="firefly w-1.5 h-1.5" style={{ left: "48%", bottom: "16%", animation: "floatFirefly 5s ease-in-out infinite 0.5s" }} />

      <div className="max-w-3xl w-full mx-auto space-y-6 relative z-10">

        {/* Premium Bento Header (Forest with Gold Accents) */}
        <header className="bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/25 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4 z-10 border-b-4 border-[#1F2720]/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
              <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-[0.2em] uppercase font-black">EVALUATION REPORT</span>
            </div>
            <span className="font-['Manrope'] text-[9px] font-black text-[#1F2720] bg-[#fdd400] px-2.5 py-1 rounded-md border-2 border-[#1F2720] uppercase">
              GO1_DB
            </span>
          </div>

          <div className="z-10 flex items-center gap-4">
            <img
              src={mascotSrc}
              alt="Suri Guide"
              className="h-20 w-auto object-contain select-none shrink-0 animate-jelly"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                Diagnostic Results
              </h1>
              <p className="font-['Manrope'] text-[10px] text-emerald-200 mt-1 font-bold uppercase tracking-wider">
                Session ID: <span className="text-[#fdd400]">{sessionId}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Interactive Speech Bubble Display */}
        <div className="relative bg-[#ffe170] text-[#1F2720] font-black text-xs md:text-sm p-5 rounded-3xl border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720] w-full transform hover:scale-[1.01] transition-transform">
          <span>{suriQuote}</span>
        </div>

        {/* Global Error Alerts */}
        {errorMsg && (
          <div className="bg-red-100 border-[3.5px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-['Manrope'] text-[11px] text-red-900 font-black uppercase tracking-widest block mb-1">
                [DIAGNOSTIC FAULT DETECTED]
              </span>
              <p className="font-['Manrope'] text-xs text-red-900 font-extrabold">{errorMsg}</p>
            </div>
          </div>
        )}

        {chain.length > 0 ? (
          <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-6 md:p-8 shadow-[8px_8px_0px_0px_#1F2720]">

            {/* Upper Map Description */}
            <div className="mb-8">
              <h2 className="text-sm font-['Manrope'] font-black text-[#1F2720] uppercase tracking-widest mb-3 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-700 fill-emerald-700" />
                Path Evaluation
              </h2>
              <p className="font-['Manrope'] text-sm md:text-base text-slate-700 leading-relaxed font-bold">
                Your mathematical understanding has been mapped directly to your active topic chain. Remediation begins at the first identified weak node to ensure structurally solid foundations.
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

                let cardStyle = "border-[#1F2720] bg-white hover:bg-slate-50 shadow-[3px_3px_0px_0px_#1F2720]";
                if (isGapNode) {
                  cardStyle = "border-[#1F2720] bg-[#ffe170]/15 shadow-[6px_6px_0px_0px_#1F2720] ring-2 ring-[#1F2720] scale-[1.01]";
                }

                return (
                  <div
                    key={nodeId}
                    className={`p-4 md:p-5 border-[3px] rounded-2xl transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${cardStyle}`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {isGapNode ? (
                        <span className="font-['Manrope'] text-[9px] font-black text-[#1F2720] bg-[#fdd400] px-2.5 py-1.5 rounded-md shrink-0 uppercase tracking-widest animate-pulse border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720]">
                          START HERE →
                        </span>
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-slate-200 mt-1.5 sm:mt-0 shrink-0 border border-[#1F2720]/20" />
                      )}
                      <div>
                        <h3 className="text-sm md:text-base font-black font-['Hanken_Grotesk'] text-[#1F2720] leading-snug">
                          {label}
                        </h3>
                        <p className="text-[10px] font-['Manrope'] font-bold text-slate-400 mt-0.5">NODE ID: {nodeId}</p>
                      </div>
                    </div>

                    <div className="self-start sm:self-auto shrink-0">
                      <span className={`inline-block border-2 text-[10px] uppercase px-2.5 py-1 rounded-lg font-black tracking-wider ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                onClick={handleStartRemediation}
                className="flex-1 bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Start Remediation Track <ArrowRight className="w-4 h-4 stroke-[3px]" />
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 bg-white text-[#1F2720] border-[3.5px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-2xl tracking-wider shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-8 text-center shadow-[6px_6px_0px_0px_#1F2720]">
            <p className="font-['Manrope'] text-sm text-slate-500 font-bold">No diagnostic results mapped in the registry.</p>
          </div>
        )}

      </div>
    </div>
  );
}