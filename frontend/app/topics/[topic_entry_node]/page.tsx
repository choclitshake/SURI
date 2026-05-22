"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const description = TOPIC_DESCRIPTIONS[topicEntryNode] || `Learn about ${label}.`;

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto relative">
      <button 
        onClick={() => router.push("/dashboard")}
        className="absolute top-8 right-8 text-sm font-mono uppercase text-gray-500 hover:text-black hover:underline cursor-pointer"
      >
        [Exit]
      </button>

      <header className="border-b border-black pb-4 mb-8 mt-12">
        <h1 className="text-3xl font-mono font-bold uppercase">{label}</h1>
        <p className="text-sm mt-1 text-gray-600 font-mono">Grade {grade} • {topicEntryNode}</p>
      </header>

      {error && (
        <div className="border border-black p-4 mb-6 text-sm font-mono bg-white text-red-600">
          [ERROR] {error}
        </div>
      )}

      <section className="mb-10">
        <p className="font-mono text-base leading-relaxed">
          {description}
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-mono font-bold uppercase mb-4">Prerequisite Chain</h2>
        <div className="border border-black p-6 bg-gray-50">
          <div className="flex flex-col gap-2">
            {chain.map((node, idx) => (
              <div key={node.node_id} className="flex flex-col items-center">
                <div className="border border-black bg-white px-4 py-2 text-center w-full max-w-sm">
                  <p className="font-mono text-sm font-bold">{node.node_label}</p>
                  <p className="font-mono text-xs text-gray-500">Grade {node.grade} • {node.node_id}</p>
                </div>
                {idx < chain.length - 1 && (
                  <div className="text-black font-bold my-1">↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <button
          onClick={() => handleCreateSession("diagnostic")}
          disabled={actionLoading}
          className="flex-1 flex flex-col items-center justify-center border border-black p-4 transition-all bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
        >
          <span className="font-mono font-bold uppercase text-base">Take Diagnostic Assessment</span>
          <span className="font-mono text-xs text-gray-600 mt-1">Find out which concepts you already know</span>
        </button>

        <button
          onClick={() => handleCreateSession("skip")}
          disabled={actionLoading}
          className="flex-1 flex flex-col items-center justify-center border border-black p-4 transition-all bg-black text-white hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
        >
          <span className="font-mono font-bold uppercase text-base">Skip to Topic</span>
          <span className="font-mono text-xs text-gray-400 mt-1">Go straight to the first lesson</span>
        </button>
      </div>
    </div>
  );
}
