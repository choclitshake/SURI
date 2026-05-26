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

  const handleExit = () => {
    router.push("/topics");
  };

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
  
            <button
              onClick={handleExit}
              className="font-['Manrope'] text-[11px] text-[#1F2720] bg-[#fdd400] hover:bg-[#ffe170] px-4 py-2 rounded-full border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              ← Back to Trails
            </button>
    
          {/* Bento Grid Header Block */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-4">
            
            {/* Main Branding Display Header Card */}
            <div className="lg:col-span-3 bg-[#223324] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
              
              <div className="absolute top-0 right-0 opacity-50 z-0">
                <img src="/suri-snake-right.png" alt="Suri Mascot" className="w-48 h-auto object-contain translate-x-4 translate-y-4 pointer-events-none" />
              </div>
              
              <div className="flex items-center justify-between mb-4 z-10">
                <div className="flex items-center gap-2 bg-[#1b261c] px-3 py-1.5 rounded-full border-[2px] border-[#1F2720]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse border border-[#1F2720]" />
                  <span className="font-['Manrope'] text-xs text-[#fdd400] font-black tracking-[0.2em] uppercase">TRAIL HEAD</span>
                </div>
                <span className="font-['Manrope'] text-[10px] text-[#1F2720] font-black bg-[#fdd400] px-3 py-1 rounded-md border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">{topicEntryNode}</span>
              </div>

              <div className="z-10 mt-6">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                  {label}
                </h1>
                <p className="font-['Manrope'] text-sm text-[#ffe170] mt-2 font-bold uppercase drop-shadow-[1px_1px_0px_#1F2720]">
                  Grade {grade} • Trail Diagnostics
                </p>
              </div>
            </div>

            {/* Side Metric Panel */}
            <div className="bg-[#faf8f5] rounded-[32px] p-6 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all">
              <div className="flex justify-between items-start">
                <span className="font-['Manrope'] text-xs text-[#1F2720] font-black uppercase tracking-wider">TRAIL LENGTH</span>
                <span className="text-[10px] font-black font-['Manrope'] text-[#1F2720] bg-[#e6e8ea] px-2.5 py-0.5 rounded-md border-2 border-[#1F2720]">STEPS</span>
              </div>
              <div className="my-3">
                <span className="font-['Hanken_Grotesk'] text-5xl font-black text-[#1F2720] tracking-tighter drop-shadow-[2px_2px_0px_#e6e8ea] group-hover:text-[#005b21] transition-colors">
                  {loading ? "--" : String(chain.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-['Manrope'] text-xs text-slate-500 font-bold">
                Total prerequisites to clear this pathway.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {error && (
            <div className="bg-red-100 border-[3px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4 mt-6">
              <img src="/suri-snake-sad.png" alt="Sad Suri" className="w-10 h-10 object-contain shrink-0" />
              <div>
                <span className="font-['Manrope'] text-xs text-red-800 font-black uppercase tracking-widest block mb-1">Oh no! A thorny problem!</span>
                <p className="font-['Manrope'] text-sm text-red-900 font-bold">{error}</p>
              </div>
            </div>
          )}

          {/* Topic Description Card */}
          <section className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6 md:p-8 mt-6">
            <h2 className="text-xs font-['Manrope'] font-black text-slate-500 uppercase tracking-widest mb-3">Track Overview</h2>
            <p className="font-['Hanken_Grotesk'] text-xl text-[#1F2720] leading-relaxed font-bold">
              {description}
            </p>
          </section>

          {/* Prerequisite Chain Card */}
          <section className="bg-white rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6 md:p-8 mt-6">
            <h2 className="text-sm font-['Manrope'] font-black text-[#1F2720] uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#fdd400] border-2 border-[#1F2720]" />
              Trail Prerequisites
            </h2>
            
            <div className="relative pl-6 before:absolute before:left-2 before:top-4 before:bottom-4 before:w-1.5 before:bg-[#e6e8ea] before:rounded-full">
              <div className="space-y-4">
                {chain.map((node, idx) => (
                  <div key={node.node_id} className="relative flex items-start gap-4 group">
                    {/* Flow point dot */}
                    <div className="absolute -left-[27px] top-5 w-4 h-4 rounded-full border-[3px] border-[#1F2720] bg-white group-hover:bg-[#fdd400] transition-colors duration-200 z-10" />
                    <div className="bg-[#faf8f5] border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 group-hover:shadow-[5px_5px_0px_0px_#1F2720] rounded-[24px] px-5 py-4 w-full max-w-2xl transition-all duration-300">
                      <p className="font-['Hanken_Grotesk'] text-base md:text-lg font-black text-[#1F2720]">
                        {node.node_label}
                      </p>
                      <p className="font-['Manrope'] text-xs text-slate-500 font-bold mt-1">
                        Grade {node.grade} • ID: {node.node_id}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Action Call Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <button
              onClick={() => handleCreateSession("diagnostic")}
              disabled={actionLoading}
              className="group flex flex-col justify-between items-start text-left bg-[#fdd400] border-[4px] border-[#1F2720] hover:-translate-y-1 hover:-translate-x-1 shadow-[8px_8px_0px_0px_#1F2720] hover:shadow-[12px_12px_0px_0px_#1F2720] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[2px_2px_0px_0px_#1F2720] p-6 rounded-[32px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[160px]"
            >
              <div>
                <span className="font-['Manrope'] text-[10px] text-white bg-[#1F2720] px-3 py-1.5 rounded-md font-black uppercase tracking-wider border-2 border-[#1F2720]">RECOMMENDED</span>
                <h3 className="font-['Hanken_Grotesk'] font-black text-[#1F2720] text-2xl mt-4 group-hover:text-[#005b21] transition-colors drop-shadow-[1px_1px_0px_rgba(31,39,32,0.1)]">
                  Diagnostic Assessment
                </h3>
                <p className="font-['Manrope'] text-sm font-bold text-[#1F2720]/80 mt-2">
                  Diagnose prerequisite knowledge blocks to adapt and skip sections you already understand.
                </p>
              </div>
              <span className="font-['Manrope'] text-sm text-[#1F2720] font-black mt-4 flex items-center gap-2 group-hover:translate-x-1 transition-transform bg-white px-4 py-2 rounded-full border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                START ASSESSMENT →
              </span>
            </button>

            <button
              onClick={() => handleCreateSession("skip")}
              disabled={actionLoading}
              className="group flex flex-col justify-between items-start text-left bg-white border-[4px] border-[#1F2720] hover:-translate-y-1 hover:-translate-x-1 shadow-[8px_8px_0px_0px_#1F2720] hover:shadow-[12px_12px_0px_0px_#1F2720] active:translate-y-0.5 active:translate-x-0.5 active:shadow-[2px_2px_0px_0px_#1F2720] p-6 rounded-[32px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[160px]"
            >
              <div>
                <span className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#e6e8ea] px-3 py-1.5 rounded-md border-2 border-[#1F2720] font-black uppercase tracking-wider">FAST TRACK</span>
                <h3 className="font-['Hanken_Grotesk'] font-black text-[#1F2720] text-2xl mt-4 group-hover:text-[#005b21] transition-colors">
                  Skip to Lessons
                </h3>
                <p className="font-['Manrope'] text-sm font-bold text-slate-500 mt-2">
                  Bypass the baseline diagnostic structure and jump directly to the first standard track node lessons.
                </p>
              </div>
              <span className="font-['Manrope'] text-sm text-[#1F2720] font-black mt-4 flex items-center gap-2 group-hover:translate-x-1 transition-transform bg-[#fdd400] px-4 py-2 rounded-full border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                GO TO LESSONS →
              </span>
            </button>
          </div>

        </div>
      </div>
    </MainPage>
  );
}