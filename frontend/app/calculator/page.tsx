"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import "mathlive";
import MainPage from "@/components/mainpage";
import React from "react";

// ── Types ─────────────────────────────────────────────────────────

interface MathStep {
  step: number;
  changeType: string;
  oldNode: string | null;
  newNode: string | null;
}

type StepState = "idle" | "correct" | "wrong" | "skipped";

interface UserStep {
  value: string;
  state: StepState;
}

// ── Sample problems ───────────────────────────────────────────────

const SAMPLE_PROBLEMS = [
  { label: "Simplify", expression: "2x + 3x" },
  { label: "Simplify", expression: "x^2 + 2x + x^2" },
  { label: "Simplify", expression: "4x - 2x + 6" },
  { label: "Simplify", expression: "3x^2 + 2x^2 - x" },
];

// ── Helpers ───────────────────────────────────────────────────────

function formatChangeType(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
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
    "virtual-keyboard-mode": "onfocus",
    "virtual-keyboards": "all",
    style: {
      width: "100%",
      minWidth: "180px",
      minHeight: "48px",
      padding: "8px",
      border: "2px solid black",
      background: disabled ? "#f5f5f5" : "white",
      fontSize: "1.1rem",
      outline: "none",
    },
  });
}

// ── Component ─────────────────────────────────────────────────────

export default function PracticePage() {
  const [expression, setExpression] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<MathStep[]>([]);
  const [solvedExpr, setSolvedExpr] = useState<string>("");

  const [userSteps, setUserSteps] = useState<UserStep[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const [submitted, setSubmitted] = useState(false);

  const mathFieldRefs = useRef<any[]>([]);

  // ── Fetch steps ────────────────────────────────────────────────

  async function handleSolve(expr?: string) {
    const target = (expr ?? expression).trim();

    if (!target) return;

    setLoading(true);
    setError(null);
    setSteps([]);
    setUserSteps([]);
    setActiveStep(0);
    setSubmitted(false);
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

      setSteps(data.steps);

      setUserSteps(
        data.steps.map(() => ({
          value: "",
          state: "idle" as StepState,
        }))
      );

      // Reset refs array
      mathFieldRefs.current = [];

      setTimeout(() => {
        if (mathFieldRefs.current[0]) {
          mathFieldRefs.current[0].focus();
        }
      }, 100);
    } catch {
      setError(
        "Could not reach the solver. Make sure the server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Step validation ────────────────────────────────────────────

  function checkStep(index: number) {
    const step = steps[index];
    if (!step) return;

    const correct = step.newNode?.trim() ?? "";
    const answer = userSteps[index]?.value.trim() ?? "";

    // Normalize comparison by removing spaces
    const isCorrect =
      answer.replace(/\s/g, "") === correct.replace(/\s/g, "");

    setUserSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              state: isCorrect ? "correct" : "wrong",
            }
          : s
      )
    );

    if (isCorrect && index + 1 < steps.length) {
      setActiveStep(index + 1);

      setTimeout(() => {
        if (mathFieldRefs.current[index + 1]) {
          mathFieldRefs.current[index + 1].focus();
        }
      }, 100);
    }
  }

  function skipStep(index: number) {
    const step = steps[index];
    if (!step) return;

    setUserSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              value: step.newNode ?? "",
              state: "skipped",
            }
          : s
      )
    );

    if (index + 1 < steps.length) {
      setActiveStep(index + 1);

      setTimeout(() => {
        if (mathFieldRefs.current[index + 1]) {
          mathFieldRefs.current[index + 1].focus();
        }
      }, 100);
    }
  }

  function handleSubmit() {
    // Mark any idle steps as wrong
    setUserSteps((prev) =>
      prev.map((s) =>
        s.state === "idle"
          ? {
              ...s,
              state: "wrong",
            }
          : s
      )
    );

    setSubmitted(true);
  }

  function handleReset() {
    setExpression("");
    setSteps([]);
    setUserSteps([]);
    setActiveStep(0);
    setSubmitted(false);
    setError(null);
    setSolvedExpr("");
    mathFieldRefs.current = [];
  }

  // ── Stats ──────────────────────────────────────────────────────

  const correct = userSteps.filter(
    (s) => s.state === "correct"
  ).length;

  const wrong = userSteps.filter(
    (s) => s.state === "wrong"
  ).length;

  const skipped = userSteps.filter(
    (s) => s.state === "skipped"
  ).length;

  const score =
    steps.length > 0
      ? Math.round((correct / steps.length) * 100)
      : 0;

  const allDone =
    steps.length > 0 &&
    userSteps.every((s) => s.state !== "idle");

  // Focus management when active step changes
  useEffect(() => {
    if (!submitted && activeStep < mathFieldRefs.current.length) {
      setTimeout(() => {
        const activeField = mathFieldRefs.current[activeStep];
        if (activeField && !activeField.disabled) {
          activeField.focus();
        }
      }, 100);
    }
  }, [activeStep, submitted]);

  return (
    <MainPage>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <header className="border-b border-black pb-4">
          <h1 className="flex items-center gap-2 text-3xl font-black">
            <Sparkles size={26} />
            Scaffolded Practice
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Enter an algebra expression and solve each
            intermediate step one at a time.
          </p>
        </header>

        {/* Input */}
        <div className="border border-black bg-white p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <div className="flex-1">
              <MathField
                value={expression}
                disabled={loading}
                onChange={(value) => setExpression(value)}
                onEnter={() => handleSolve()}
              />
            </div>

            <button
              className="flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleSolve()}
              disabled={loading || !expression.trim()}
            >
              {loading ? (
                <Loader2
                  className="animate-spin"
                  size={16}
                />
              ) : (
                <ChevronRight size={16} />
              )}

              {loading ? "Solving..." : "Solve"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROBLEMS.map((p) => (
              <button
                key={p.expression}
                className="border border-black px-3 py-2 font-mono text-sm hover:bg-black hover:text-white transition-colors"
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
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="border border-black bg-white p-6">
            <div className="mb-6">
              <p className="font-mono text-sm">
                Simplify:{" "}
                <strong>{solvedExpr}</strong>
              </p>
            </div>

            {steps.map((step, i) => {
              const us = userSteps[i];

              const isActive =
                i === activeStep && !submitted && us?.state === "idle";

              const isDone = us?.state !== "idle";

              return (
                <div
                  key={i}
                  className="border-t border-black py-5 first:border-t-0"
                >
                  <p className="mb-2 font-mono text-xs uppercase font-semibold">
                    {formatChangeType(step.changeType)}
                  </p>

                  {step.oldNode && (
                    <p className="mb-3 font-mono text-sm text-gray-600">
                      → {step.oldNode}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-lg font-bold">
                      =
                    </span>

                    {isDone ? (
                      <div
                        className={`min-w-[180px] border border-black p-3 font-mono ${
                          us?.state === "correct"
                            ? "bg-green-50 text-green-700 border-green-300"
                            : us?.state === "skipped"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                            : "bg-red-50 text-red-700 border-red-300"
                        }`}
                      >
                        {step.newNode}

                        {us?.state === "wrong" &&
                          us?.value &&
                          us.value !== step.newNode && (
                            <div className="mt-1 text-xs text-gray-600">
                              Your answer: {us.value}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="flex-1">
                        <MathField
                          value={us?.value || ""}
                          disabled={!isActive}
                          onChange={(value) =>
                            setUserSteps((prev) =>
                              prev.map((s, idx) =>
                                idx === i
                                  ? {
                                      ...s,
                                      value,
                                    }
                                  : s
                              )
                            )
                          }
                          onEnter={() => checkStep(i)}
                        />
                      </div>
                    )}

                    {isActive && !isDone && (
                      <div className="flex gap-2">
                        <button
                          className="border border-black px-4 py-2 font-bold hover:bg-black hover:text-white transition-colors"
                          onClick={() => checkStep(i)}
                        >
                          Check
                        </button>

                        <button
                          className="border border-black px-4 py-2 font-bold hover:bg-gray-100 transition-colors"
                          onClick={() => skipStep(i)}
                        >
                          Skip
                        </button>
                      </div>
                    )}

                    {us?.state === "correct" && (
                      <CheckCircle2
                        className="text-green-600"
                        size={20}
                      />
                    )}

                    {us?.state === "wrong" && (
                      <X
                        className="text-red-600"
                        size={20}
                      />
                    )}

                    {us?.state === "skipped" && (
                      <span className="text-xs text-yellow-600 font-mono">
                        skipped
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-black flex flex-wrap items-center gap-3">
              {!submitted ? (
                <button
                  className="border border-black bg-black px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-900 transition-colors"
                  disabled={!allDone}
                  onClick={handleSubmit}
                >
                  Submit Practice
                </button>
              ) : (
                <>
                  <div className="font-mono text-sm bg-gray-100 px-4 py-2">
                    Score: {score}% | ✓ {correct} | ✗{" "}
                    {wrong} | ↷ {skipped}
                  </div>

                  <button
                    className="flex items-center gap-2 border border-black bg-black px-4 py-3 text-white hover:bg-gray-900 transition-colors"
                    onClick={handleReset}
                  >
                    <RefreshCw size={16} />
                    Try Again
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </MainPage>
  );
}