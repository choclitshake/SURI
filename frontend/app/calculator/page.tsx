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
  if (MFE) MFE.fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.109.2/fonts";
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
      // If composite step has substeps, traverse into them to show complete details
      subs.forEach((sub) => traverse(sub));
    } else {
      // If atomic step, append directly to show in the resolution stream
      result.push(step);
    }
  }

  steps.forEach((step) => traverse(step));
  return result;
}

/**
 * Maps raw backend math change types to descriptive step-by-step student explanations
 */
function getDetailedExplanation(changeType: string, oldNode: string | null, newNode: string | null): string {
  const type = changeType.toUpperCase();
  
  const explanations: Record<string, string> = {
    // Basic Arithmetic rules
    "SIMPLIFY_BASICS": "Simplify basics using primary algebraic axioms. Any value raised to the power of 0 simplifies directly to 1 (x^0 = 1), and multiplying a term by 1 leaves its value unchanged.",
    "EVALUATE_ARITHMETIC": "Evaluate normal numerical calculations. Combine constants together directly to clean up the expression's overall size.",
    "SIMPLIFY_ARITHMETIC": "Evaluate basic numerical operations. This simplifies integers or decimal constants into a single value.",
    
    // Grouping
    "GROUP_LIKE_TERMS": "Group similar algebraic terms side-by-side. Like terms are terms that share identical variable factors raised to the exact same exponents (such as grouping x² variables or matching independent constants) so they are prepared to be combined.",
    "COLLECT_LIKE_TERMS": "Collect and group identical algebraic terms next to each other. Putting similar terms next to each other makes the next simplification steps straightforward.",
    
    // Polynomial Operations & Coefficients
    "ADD_POLYNOMIAL_TERMS": "Combine similar polynomial terms. Add the numeric coefficients of terms sharing identical variable groupings and exponent degrees.",
    "ADD_COEFFICIENTS": "Add the numerical coefficients of matching like terms. Combine the constants while keeping the shared variable factor unchanged.",
    "SUBTRACT_COEFFICIENTS": "Subtract the numeric coefficients of like terms. This simplifies their combined value while keeping the common variable structure intact.",
    "MULTIPLY_COEFFICIENTS": "Multiply the numerical constants or coefficients together. This simplifies multiple constant factors into a single coefficient.",
    
    // Brackets, Parentheses & Distribution
    "DISTRIBUTE": "Apply the distributive property: a(b + c) = ab + ac. Multiply the term outside the parentheses with each individual term inside to expand and eliminate the brackets.",
    "EXPAND_EXPRESSION": "Multiply out algebraic factors. Systematically expand terms using standard binomial expansion rules (FOIL).",
    "REMOVE_PARENTHESES": "Eliminate brackets safely. If there is a subtraction sign outside, ensure you distribute the negative sign to every individual term inside.",
    
    // Factoring
    "FACTOR_QUADRATIC": "Factor the quadratic expression. Solve and resolve the trinomial into its constituent binomial factors (for example, factoring x² + 5x + 6 into (x + 2)(x + 3)).",
    "FACTOR_COMMON": "Factor out the Greatest Common Factor (GCF) from all terms. Identify the highest shared multiplier and place it outside parentheses.",
    "CANCEL_TERMS": "Cancel out equal opposite terms that add up to zero, or simplify matching terms on the numerator and denominator.",
  };

  if (explanations[type]) {
    return explanations[type];
  }

  // Intelligent fallback description
  const cleanType = formatChangeType(changeType);
  return `Apply the operation "${cleanType}" to transition from "${oldNode || 'original state'}" to "${newNode || 'simplified state'}". This systematically streamlines the expression.`;
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

function MathField({
  value,
  onChange,
  disabled = false,
  onEnter,
}: MathFieldProps) {
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
  const [solvedExpr, setSolvedExpr] = useState<string>("");

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expression: target,
        }),
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
      setError(
        "Could not reach the solver. Make sure the server is running."
      );
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
      <div className="bg-slate-50 min-h-screen text-slate-800 py-4 px-4 md:px-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Premium Compact Bento Header (Navy with Gold Accents) */}
          <header className="bg-[#001a54] rounded-2xl p-4 md:p-5 border border-white/10 shadow-[0_0_20px_rgba(0,26,84,0.3)] relative overflow-hidden flex flex-col justify-between">
            {/* Subtle ambient gold and navy glow offsets */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#fdd400]/10 rounded-full blur-[40px] pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#fdd400]/5 rounded-full blur-[40px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-2.5 z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_6px_#fdd400]" />
                <span className="font-mono text-[10px] text-slate-300 font-bold tracking-[0.2em] uppercase">ALGEBRA SOLVER ENGINE</span>
              </div>
              <span className="font-mono text-[9px] text-slate-400 bg-black/30 px-2 py-1 rounded-lg border border-white/5 uppercase">CALC_V1</span>
            </div>

            <div className="z-10">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
                Algebra <span className="text-[#fdd400]">Calculator</span>
              </h1>
              <p className="font-mono text-[10px] text-slate-300 mt-1 tracking-wide uppercase">
                Enter an algebraic expression to view a complete step-by-step resolution process [1].
              </p>
            </div>
          </header>

          {/* Input Panel (White-Dominant Light Card) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-[0_4px_12px_rgba(0,26,84,0.02)] space-y-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <MathField
                  value={expression}
                  disabled={loading}
                  onChange={(value) => setExpression(value)}
                  onEnter={() => handleSolve()}
                />
              </div>

              <button
                className="bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-3 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handleSolve()}
                disabled={loading || !expression.trim()}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                {loading ? "Solving..." : "Solve"}
              </button>
            </div>

            {/* Sample Problems */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {SAMPLE_PROBLEMS.map((p) => (
                <button
                  key={p.expression}
                  className="bg-slate-50 border border-slate-200 text-[#001a54] hover:bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
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
              <div className="mt-2 flex items-center gap-2 text-xs font-mono text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Steps Display Panel (Shows all steps including unpacked substeps) */}
          {steps.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-6 shadow-[0_4px_12px_rgba(0,26,84,0.02)] space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                  Solving: <strong className="text-[#001a54] font-black">{solvedExpr}</strong>
                </p>
                <span className="font-mono text-[9px] text-[#001a54] bg-[#fdd400]/20 border border-[#fdd400]/40 px-2 py-0.5 rounded uppercase font-bold">
                  RESOLUTION STREAM
                </span>
              </div>

              <div className="space-y-4">
                {steps.map((step, i) => {
                  const isLastStep = i === steps.length - 1;

                  return (
                    <div
                      key={i}
                      className={`border rounded-2xl p-4 md:p-5 transition-all duration-300 relative overflow-hidden flex gap-3 ${
                        isLastStep 
                          ? "border-green-200 bg-green-50/10" 
                          : "border-slate-100 bg-slate-50/50"
                      }`}
                    >
                      {/* Left vertical status indicator line (Interactive gold color for active steps) */}
                      <div className={`w-1 h-12 rounded-full self-center shrink-0 ${
                        isLastStep 
                          ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" 
                          : "bg-[#fdd400] shadow-[0_0_6px_rgba(253,212,0,0.4)]"
                      } transition-all duration-300`} />

                      <div className="flex-1 space-y-3">
                        {/* Step Header info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-[#001a54]">Step {i + 1}</span>
                            <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 bg-slate-50 font-bold">
                              {formatChangeType(step.changeType)}
                            </span>
                          </div>
                          
                          {isLastStep && (
                            <span className="font-mono text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Fully Simplified
                            </span>
                          )}
                        </div>

                        {step.oldNode && (
                          <p className="font-mono text-[10px] text-slate-400">
                            Identified Terms: <span className="line-through text-slate-400">{step.oldNode}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-base font-bold text-[#001a54]">=</span>
                          <div className="font-mono text-sm font-bold text-[#001a54] bg-white border border-slate-200 rounded-xl px-4 py-2 flex-1 shadow-sm">
                            {step.newNode}
                          </div>
                        </div>

                        {/* Pedagogical Tutor Explanation Box */}
                        <div className="bg-[#001a54]/5 rounded-xl p-3 border border-slate-200/40 text-slate-600 mt-2">
                          <p className="text-[9px] font-mono uppercase tracking-widest font-extrabold text-[#001a54] mb-1">
                            Tutor Insight
                          </p>
                          <p className="text-xs font-medium leading-relaxed font-sans">
                            {getDetailedExplanation(step.changeType, step.oldNode, step.newNode)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset Control Block */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  className="bg-[#001a54] text-white hover:bg-[#001545] py-3 px-5 text-xs font-mono uppercase font-bold tracking-wider rounded-xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)] flex items-center gap-2"
                  onClick={handleReset}
                >
                  <RefreshCw size={12} />
                  Reset Solver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainPage>
  );
}