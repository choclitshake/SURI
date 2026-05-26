"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import "mathlive";
if (typeof customElements !== "undefined") {
  const MFE = customElements.get("math-field");
  if (MFE) (MFE as any).fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.109.2/fonts";
}
import MainPage from "@/components/mainpage";
import React from "react";

// ── Types ─────────────────────────────────────────────────────────

interface MathStep {
  step: number;
  changeType: string;
  oldNode: string | null;
  newNode: string | null;
  substeps?: MathStep[]; // Supports nested substeps returned by the math engine
  subSteps?: MathStep[]; // Fallback camelCase support
}

// ── Sample problems ───────────────────────────────────────────────

const SAMPLE_PROBLEMS = [
  { label: "Simplify", expression: "2x + 3x" },
  { label: "Simplify", expression: "x^2 + 2x + x^2" },
  { label: "Simplify", expression: "4x - 2x + 6" },
  { label: "Simplify", expression: "3x^2 + 2x^2 - x" },
];

// ── Helpers & Pedagogical Decoders ─────────────────────────────────

function formatChangeType(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Robust helper to safely get substeps array regardless of API key casing
 */
function getSubsteps(step: any): MathStep[] {
  if (Array.isArray(step.substeps)) return step.substeps;
  if (Array.isArray(step.subSteps)) return step.subSteps;
  return [];
}

/**
 * Recursively flattens composite steps to extract and display all atomic substeps
 */
function flattenMathSteps(steps: MathStep[]): MathStep[] {
  const result: MathStep[] = [];

  function traverse(step: MathStep) {
    const subs = getSubsteps(step);
    if (subs.length > 0) {
      subs.forEach((sub) => traverse(sub));
    } else {
      result.push(step);
    }
  }

  steps.forEach((step) => traverse(step));
  return result;
}

/**
 * Maps raw backend math change types to descriptive step‑by‑step student explanations
 */
function getDetailedExplanation(changeType: string, oldNode: string | null, newNode: string | null): string {
  const type = changeType.toUpperCase();

  const explanations: Record<string, string> = {
    SIMPLIFY_BASICS: "Simplify basics using primary algebraic axioms. Any value raised to the power of 0 simplifies directly to 1 (x^0 = 1), and multiplying a term by 1 leaves its value unchanged.",
    EVALUATE_ARITHMETIC: "Evaluate normal numerical calculations. Combine constants together directly to clean up the expression's overall size.",
    SIMPLIFY_ARITHMETIC: "Evaluate basic numerical operations. This simplifies integers or decimal constants into a single value.",
    GROUP_LIKE_TERMS: "Group similar algebraic terms side‑by‑side. Like terms are terms that share identical variable factors raised to the exact same exponents (such as grouping x² variables or matching independent constants) so they are prepared to be combined.",
    COLLECT_LIKE_TERMS: "Collect and group identical algebraic terms next to each other. Putting similar terms together makes the next simplification steps straightforward.",
    ADD_POLYNOMIAL_TERMS: "Combine similar polynomial terms. Add the numeric coefficients of terms sharing identical variable groupings and exponent degrees.",
    ADD_COEFFICIENTS: "Add the numerical coefficients of matching like terms. Combine the constants while keeping the shared variable factor unchanged.",
    SUBTRACT_COEFFICIENTS: "Subtract the numeric coefficients of like terms. This simplifies their combined value while keeping the common variable structure intact.",
    MULTIPLY_COEFFICIENTS: "Multiply the numerical constants or coefficients together. This simplifies multiple constant factors into a single coefficient.",
    DISTRIBUTE: "Apply the distributive property: a(b + c) = ab + ac. Multiply the term outside the parentheses with each individual term inside to expand and eliminate the brackets.",
    EXPAND_EXPRESSION: "Multiply out algebraic factors. Systematically expand terms using standard binomial expansion rules (FOIL).",
    REMOVE_PARENTHESES: "Eliminate brackets safely. If there is a subtraction sign outside, ensure you distribute the negative sign to every individual term inside.",
    FACTOR_QUADRATIC: "Factor the quadratic expression. Solve and resolve the trinomial into its constituent binomial factors (for example, factoring x² + 5x + 6 into (x + 2)(x + 3)).",
    FACTOR_COMMON: "Factor out the Greatest Common Factor (GCF) from all terms. Identify the highest shared multiplier and place it outside parentheses.",
    CANCEL_TERMS: "Cancel out equal opposite terms that add up to zero, or simplify matching terms on the numerator and denominator.",
  };

  if (explanations[type]) {
    return explanations[type];
  }

  const cleanType = formatChangeType(changeType);
  return `Apply the operation "${cleanType}" to transition from "${oldNode || "original state"}" to "${newNode || "simplified state"}". This systematically streamlines the expression.`;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": any;
    }
  }
}

type MathFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
};

function MathField({ value, onChange, disabled = false, onEnter }: MathFieldProps) {
  const mathFieldRef = useRef<any>(null);

  // Update math-field value when prop changes
  useEffect(() => {
    if (mathFieldRef.current && mathFieldRef.current.value !== value) {
      mathFieldRef.current.value = value;
    }
  }, [value]);

  // Set up event listeners
  useEffect(() => {
    const mf = mathFieldRef.current;
    if (!mf) return;

    const handleInput = () => {
      onChange(mf.getValue("ascii-math"));
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onEnter?.();
      }
    };

    mf.addEventListener("input", handleInput);
    mf.addEventListener("keydown", handleKey);

    return () => {
      mf.removeEventListener("input", handleInput);
      mf.removeEventListener("keydown", handleKey);
    };
  }, [onChange, onEnter]);

  // Focus management when field becomes active
  useEffect(() => {
    if (!disabled && mathFieldRef.current) {
      setTimeout(() => {
        mathFieldRef.current?.focus();
      }, 100);
    }
  }, [disabled]);

  return React.createElement("math-field", {
    ref: mathFieldRef,
    disabled,
    suppressHydrationWarning: true,
    "virtual-keyboard-mode": "onfocus",
    "virtual-keyboards": "all",
    style: {
      width: "100%",
      minWidth: "180px",
      minHeight: "44px",
      padding: "8px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      background: disabled ? "#f8fafc" : "white",
      fontSize: "1rem",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      outline: "none",
    },
  });
}

// ── Component ─────────────────────────────────────────────────────

export default function AlgebraCalculatorPage() {
  const [expression, setExpression] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<MathStep[]>([]);
  const [solvedExpr, setSolvedExpr] = useState("");

  // ── Fetch steps ────────────────────────────────────────────────

  async function handleSolve(expr?: string) {
    const target = (expr ?? expression).trim();
    if (!target) return;

    setLoading(true);
    setError(null);
    setSteps([]);
    setSolvedExpr(target);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: target }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      if (!data.steps || data.steps.length === 0) {
        setError("No simplification steps found.");
        return;
      }

      // Automatically unpack and flatten any nested substeps
      const fullyDetailedSteps = flattenMathSteps(data.steps);
      setSteps(fullyDetailedSteps);
    } catch {
      setError("Could not reach the solver. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────

  function handleReset() {
    setExpression("");
    setSteps([]);
    setError(null);
    setSolvedExpr("");
  }

  return (
    <MainPage>
      <div className=" min-h-screen text-[#1F2720] py-4 px-4 md:px-8 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Premium Compact Bento Header */}
          <header className="bg-[#223324] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[180px]">

            <div className="flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2 bg-[#1b261c] px-3 py-1.5 rounded-full border-[2px] border-[#1F2720]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse border border-[#1F2720]" />
                <span className="font-['Manrope'] text-xs text-[#fdd400] font-black tracking-[0.2em] uppercase">ALGEBRA SOLVER ENGINE</span>
              </div>
              <span className="font-['Manrope'] text-[10px] text-[#1F2720] font-black bg-[#fdd400] px-3 py-1.5 rounded-md border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] uppercase">CALC_V1</span>
            </div>
            <div className="z-10 mt-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                Algebra <span className="text-[#fdd400]">Calculator</span>
              </h1>
              <p className="font-['Manrope'] text-sm text-[#ffe170] mt-2 font-bold uppercase drop-shadow-[1px_1px_0px_#1F2720]">
                Enter an algebraic expression to view a complete step‑by‑step resolution process.
              </p>
            </div>
          </header>

          {/* Input Panel (Cartoony Card) */}
          <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row items-center">
              <div className="flex-1 w-full">
                <MathField
                  value={expression}
                  disabled={loading}
                  onChange={(value) => setExpression(value)}
                  onEnter={() => handleSolve()}
                />
              </div>
              <button
                className="bg-[#fdd400] hover:bg-[#ffe170] text-[#1F2720] border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] px-4 py-2 text-[12px] font-['Manrope'] font-black uppercase rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                onClick={() => handleSolve()}
                disabled={loading || !expression.trim()}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronRight size={14} />
                )}
                {loading ? "Solving..." : "Solve"}
              </button>
            </div>

            {/* Sample Problems */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1F2720]">
              {SAMPLE_PROBLEMS.map((p) => (
                <button
                  key={p.expression}
                  className="bg-white border border-[#1F2720] text-[#1F2720] hover:bg-[#f0f0f0] px-3 py-1 font-mono text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    setExpression(p.expression);
                    handleSolve(p.expression);
                  }}
                >
                  {p.expression}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-100 border-[3px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4 mt-4">
                <img src="/suri-snake-sad.png" alt="Sad Suri" className="w-10 h-10 object-contain shrink-0" />
                <div>
                  <span className="font-['Manrope'] text-xs text-red-800 font-black uppercase tracking-widest block mb-1">[CALCULATION ERROR]</span>
                  <p className="font-['Manrope'] text-sm text-red-900 font-bold">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Steps Display Panel */}
          {steps.length > 0 && (
            <div className="bg-white rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6 space-y-6">
              <div className="pb-3 border-b border-[#1F2720] flex items-center justify-between">
                <p className="font-mono text-xs text-[#1F2720] uppercase tracking-widest">
                  Solving: <strong className="text-[#1F2720] font-black">{solvedExpr}</strong>
                </p>
                <span className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#fdd400]/20 border border-[#fdd400]/40 px-2 py-0.5 rounded uppercase font-bold">
                  RESOLUTION STREAM
                </span>
              </div>

              {/* Optional faint mascot watermark behind steps */}
              <div className="relative">
                <img src="/suri-snake-right.png" alt="Mascot" className="absolute top-0 right-0 opacity-10 w-48 h-auto pointer-events-none" />
                <div className="space-y-4">
                  {steps.map((step, i) => {
                    const isLast = i === steps.length - 1;
                    return (
                      <div
                        key={i}
                        className={`border-[3px] rounded-[24px] p-4 transition-all duration-300 relative overflow-hidden flex gap-3 ${
                          isLast ? "border-green-200 bg-green-50/10" : "border-[#1F2720] bg-[#faf8f5]"
                        }`}
                      >
                        {/* Vertical indicator */}
                        <div
                          className={`w-1 h-12 rounded-full self-center shrink-0 ${
                            isLast ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-[#fdd400] shadow-[0_0_6px_rgba(253,212,0,0.4)]"
                          }`}
                        />

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#1F2720]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-[#1F2720]">Step {i + 1}</span>
                              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md border border-[#1F2720] bg-[#e6e8ea] font-black tracking-wider">
                                {formatChangeType(step.changeType)}
                              </span>
                            </div>
                            {isLast && (
                              <span className="font-mono text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                                <CheckCircle2 size={10} /> Fully Simplified
                              </span>
                            )}
                          </div>

                          {step.oldNode && (
                            <p className="font-mono text-[10px] text-[#1F2720]">
                              Identified Terms: <span className="line-through text-[#1F2720]">{step.oldNode}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-[#1F2720]">=</span>
                            <div className="font-mono text-sm font-bold text-[#1F2720] bg-white border border-[#1F2720] rounded-xl px-4 py-2 flex-1 shadow-sm">
                              {step.newNode}
                            </div>
                          </div>

                          {/* Tutor Insight */}
                          <div className="bg-[#001a54]/5 rounded-xl p-4 border border-[#1F2720]/40 text-[#1F2720] mt-3 flex items-start gap-3.5">
                            {/* Tutor Mascot Container */}
                            <div className="shrink-0 w-12 h-12 bg-white rounded-full border border-[#1F2720]/20 flex items-center justify-center p-1 shadow-sm">
                              <img 
                                src="/suri-snake-happy.png" 
                                alt="Suri Tutor" 
                                className="w-10 h-10 object-contain" 
                              />
                            </div>
                            
                            {/* Tutor Content */}
                            <div className="flex-1">
                              <p className="text-[9px] font-mono uppercase tracking-widest font-extrabold text-[#001a54] mb-1">
                                Tutor Insight
                              </p>
                              <p className="text-xs font-medium leading-relaxed font-sans">
                                {getDetailedExplanation(step.changeType, step.oldNode, step.newNode)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Reset Control */}
          <div className="flex justify-end mt-4 pt-4 border-t border-[#1F2720]">
            <button
              className="bg-[#1F2720] text-white hover:bg-[#162017] py-3 px-5 text-xs font-mono uppercase font-bold tracking-wider rounded-xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] flex items-center gap-2"
              onClick={handleReset}
            >
              <RefreshCw size={12} />
              Reset Solver
            </button>
          </div>
        </div>
      </div>
    </MainPage>
  );
}