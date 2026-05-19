"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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

export default function GapResultPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [identifiedNodeId, setIdentifiedNodeId] = useState<string | null>(null);
  const [prereqPath, setPrereqPath] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Read from sessionStorage
    const node = sessionStorage.getItem("identified_node_id");
    const pathJson = sessionStorage.getItem("prerequisite_path");
    const answersJson = sessionStorage.getItem("diagnostic_answers");

    if (node) setIdentifiedNodeId(node);
    if (pathJson) {
      try {
        const path: string[] = JSON.parse(pathJson);
        // Reverse path so it renders from entry node DOWN to identified weak node
        setPrereqPath([...path].reverse());
      } catch (e) {
        console.error("Failed to parse prerequisite path", e);
      }
    }
    if (answersJson) {
      try {
        setAnswers(JSON.parse(answersJson));
      } catch (e) {
        console.error("Failed to parse diagnostic answers", e);
      }
    }
  }, []);

  const handleStartRemediation = () => {
    router.push(`/session/${sessionId}/lesson`);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono uppercase tracking-wider">GO1 — Diagnostic Results</h1>
        <p className="text-xs font-mono text-gray-600 mt-1">Session ID: {sessionId}</p>
      </header>

      {identifiedNodeId ? (
        <div className="border border-black p-6">
          <div className="mb-8">
            <h2 className="text-lg font-mono font-bold uppercase mb-2">Identified Foundation Gap</h2>
            <p className="text-sm font-mono text-gray-700">
              We assessed your understanding along the learning path. Remediation will start at the deepest weak node to solidify your foundations.
            </p>
          </div>

          {/* Vertical path visualization */}
          <div className="relative pl-8 border-l border-black space-y-8 my-8 ml-4">
            {prereqPath.map((nodeId, idx) => {
              const label = NODE_LABELS[nodeId] || nodeId;
              const isWeakNode = nodeId === identifiedNodeId;
              const isPassed = answers[nodeId] === true;

              let statusLabel = "Not Assessed";
              let statusClass = "text-gray-500 font-mono";
              let dotClass = "bg-white border-black";

              if (isWeakNode) {
                statusLabel = "Starting Here";
                statusClass = "text-black font-bold font-mono";
                dotClass = "bg-black border-black";
              } else if (isPassed) {
                statusLabel = "Passed";
                statusClass = "text-gray-900 font-mono line-through";
                dotClass = "bg-white border-black flex items-center justify-center font-bold text-xs";
              }

              return (
                <div key={nodeId} className="relative">
                  {/* Vertical line dot */}
                  <span
                    className={`absolute -left-[41px] top-1.5 w-4 h-4 rounded-none border ${dotClass}`}
                  >
                    {isPassed && "✓"}
                  </span>

                  <div>
                    <h3 className={`text-sm font-mono uppercase ${isWeakNode ? "font-bold" : ""}`}>
                      {label}
                    </h3>
                    <p className={`text-xs mt-1 ${statusClass}`}>
                      [{statusLabel}]
                    </p>
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
        <p className="font-mono text-sm">No diagnostic results found in session storage.</p>
      )}
    </div>
  );
}
