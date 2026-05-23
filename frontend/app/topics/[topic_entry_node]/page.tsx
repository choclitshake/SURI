"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import MainPage from "@/components/mainpage";
import { getTopicIntro, getGraphChain, createSession, skipDiagnostic } from "../../../lib/api";

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "QE":  "Solve quadratic equations using factoring, completing the square, and the quadratic formula. Builds on factoring and polynomial operations.",
  "SLE": "Solve systems of two linear equations using graphing, substitution, and elimination. Builds on linear equations and algebraic expressions.",
  "RER": "Simplify and operate on radical expressions and rational exponents. Builds on laws of exponents.",
  "PE":  "Solve polynomial equations of degree 3 and higher using factoring and the Factor Theorem. Builds on factoring and polynomial division."
};

interface ChainNode {
  node_id: string;
  node_label: string;
  grade: number;
}

export default function TopicIntroPage() {
  const router = useRouter();
  const params = useParams();
  const topicEntryNode = params.topic_entry_node as string;

  const [label, setLabel] = useState<string>("");
  const [grade, setGrade] = useState<number>(0);
  const [chain, setChain] = useState<ChainNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [intro, chainData] = await Promise.all([
          getTopicIntro(topicEntryNode),
          getGraphChain(topicEntryNode)
        ]);
        setLabel(intro.label);
        setGrade(intro.grade);
        setChain(chainData.chain);
      } catch (err: any) {
        setError(err.detail || err.message || "Failed to load topic information.");
      } finally {
        setLoading(false);
      }
    };
    if (topicEntryNode) load();
  }, [topicEntryNode]);

  const handleCreateSession = async (mode: "diagnostic" | "skip") => {
    setActionLoading(true);
    setError(null);
    let sessionId = "";
    
    try {
      const session = await createSession({ topic_entry_node: topicEntryNode });
      sessionId = session.id;
    } catch (err: any) {
      if (err.status === 409 && err.detail && err.detail.session_id) {
        sessionId = err.detail.session_id;
      } else {
        setError(err.detail || "Failed to create learning session.");
        setActionLoading(false);
        return;
      }
    }

    try {
      if (mode === "diagnostic") {
        router.push(`/session/${sessionId}/diagnostic`);
      } else {
        await skipDiagnostic(sessionId);
        router.push(`/session/${sessionId}/lesson`);
      }
    } catch (err: any) {
      setError(err.detail || "Failed to navigate to session.");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const description = TOPIC_DESCRIPTIONS[topicEntryNode] || `Learn about ${label}.`;

  return (
    <MainPage>
      <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Bento Grid Header Block */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Main Branding Display Header Card */}
            <div className="lg:col-span-3 bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
              {/* Ambient gold glow offsets */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4 z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
                  <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">TOPIC INTRO</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded border border-white/5">{topicEntryNode}</span>
              </div>
              
              <div className="z-10">
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
                  {label}
                </h1>
                <p className="font-mono text-xs text-slate-300 mt-2 tracking-wide uppercase">
                  Grade {grade} • Diagnostics & Pathways
                </p>
              </div>
            </div>

            {/* Side Metric Panel */}
            <div className="bg-[#001a54] rounded-2xl p-6 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-slate-300 uppercase tracking-wider">CHAIN LENGTH</span>
                <span className="text-[10px] font-mono text-[#001a54] bg-[#fdd400] px-2.5 py-0.5 rounded-full font-bold">STEPS</span>
              </div>
              <div className="my-3">
                <span className="font-mono text-5xl font-bold text-[#fdd400] tracking-tighter">
                  {loading ? "--" : String(chain.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-300">
                Total prerequisites calculated for this pathway sequence.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {error && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(220,38,38,0.4)]" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[SYSTEM ANOMALY]</span>
                <p className="font-mono text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Topic Description Card */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">Track Overview</h2>
            <p className="font-['Hanken_Grotesk',_sans-serif] text-lg text-[#001a54] leading-relaxed font-semibold">
              {description}
            </p>
          </section>

          {/* Prerequisite Chain Card */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-sm font-mono font-bold text-[#001a54] uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
              Prerequisite Flow
            </h2>
            
            <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              <div className="space-y-4">
                {chain.map((node, idx) => (
                  <div key={node.node_id} className="relative flex items-start gap-4 group">
                    {/* Flow point dot */}
                    <div className="absolute -left-[22px] top-4 w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white group-hover:border-[#001a54] group-hover:bg-[#fdd400] transition-colors duration-200" />
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 w-full max-w-2xl transition-all duration-300 hover:border-[#001a54]/30 hover:bg-white hover:shadow-[0_8px_20px_rgba(0,26,84,0.03)]">
                      <p className="font-['Hanken_Grotesk',_sans-serif] text-sm md:text-base font-bold text-[#001a54]">
                        {node.node_label}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500 mt-1">
                        Grade {node.grade} • ID: {node.node_id}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Action Call Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => handleCreateSession("diagnostic")}
              disabled={actionLoading}
              className="group flex flex-col justify-between items-start text-left bg-white border border-slate-200 hover:border-[#001a54]/30 p-6 rounded-2xl transition-all duration-300 shadow-[0_4px_12px_rgba(0,26,84,0.02)] hover:shadow-[0_15px_30px_rgba(0,26,84,0.06)] disabled:opacity-50 cursor-pointer min-h-[160px]"
            >
              <div>
                <span className="font-mono text-[9px] text-[#001a54] bg-[#fdd400] px-2.5 py-1 rounded font-extrabold uppercase tracking-wider">RECOMMENDED</span>
                <h3 className="font-['Hanken_Grotesk',_sans-serif] font-extrabold text-[#001a54] text-lg mt-4 group-hover:text-[#001a54]/80 transition-colors">
                  Diagnostic Assessment
                </h3>
                <p className="font-mono text-xs text-slate-500 mt-2">
                  Diagnose prerequisite knowledge blocks to adapt and skip sections you already understand.
                </p>
              </div>
              <span className="font-mono text-xs text-[#001a54] font-bold mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                START ASSESSMENT →
              </span>
            </button>

            <button
              onClick={() => handleCreateSession("skip")}
              disabled={actionLoading}
              className="group flex flex-col justify-between items-start text-left bg-[#001a54] border border-white/10 hover:border-[#fdd400]/40 p-6 rounded-2xl transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_0_25px_rgba(253,212,0,0.1)] disabled:opacity-50 cursor-pointer min-h-[160px]"
            >
              <div>
                <span className="font-mono text-[9px] text-[#fdd400] bg-[#fdd400]/10 px-2.5 py-1 rounded border border-[#fdd400]/20 font-bold uppercase tracking-wider">FAST TRACK</span>
                <h3 className="font-['Hanken_Grotesk',_sans-serif] font-extrabold text-white text-lg mt-4 group-hover:text-[#fdd400] transition-colors">
                  Skip to Lessons
                </h3>
                <p className="font-mono text-xs text-slate-300 mt-2">
                  Bypass the baseline diagnostic structure and jump directly to the first standard track node lessons.
                </p>
              </div>
              <span className="font-mono text-xs text-[#fdd400] font-bold mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                GO TO LESSONS →
              </span>
            </button>
          </div>

        </div>
      </div>
    </MainPage>
  );
}