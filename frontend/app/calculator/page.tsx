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

import { useRef, useState } from "react";
import MainPage from "@/components/mainpage";

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

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

      setTimeout(() => {
        inputRefs.current[0]?.focus();
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

    const correct = step.newNode?.trim() ?? "";
    const answer = userSteps[index].value.trim();

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
        inputRefs.current[index + 1]?.focus();
      }, 80);
    }
  }

  function skipStep(index: number) {
    setUserSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              value: steps[index].newNode ?? "",
              state: "skipped",
            }
          : s
      )
    );

    if (index + 1 < steps.length) {
      setActiveStep(index + 1);

      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 80);
    }
  }

  function handleSubmit() {
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

  return (
    <MainPage>
      <style jsx>{`
        .practice-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .practice-card {
          border: 1px solid black;
          padding: 24px;
          background: white;
        }

        .practice-title {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .practice-subtitle {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }

        .practice-input-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .practice-input {
          flex: 1;
          border: 1px solid black;
          padding: 12px;
          font-family: monospace;
        }

        .practice-btn {
          border: 1px solid black;
          background: black;
          color: white;
          padding: 12px 20px;
          cursor: pointer;
          font-weight: bold;
        }

        .practice-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .practice-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .practice-chip {
          border: 1px solid black;
          background: white;
          padding: 6px 10px;
          font-family: monospace;
          cursor: pointer;
        }

        .practice-step {
          border-top: 1px solid black;
          padding: 16px 0;
        }

        .practice-step-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .practice-answer {
          border: 1px solid black;
          padding: 10px;
          font-family: monospace;
          min-width: 180px;
        }

        .practice-check-btn,
        .practice-skip-btn {
          border: 1px solid black;
          padding: 8px 14px;
          background: white;
          cursor: pointer;
          font-weight: bold;
        }

        .practice-correct {
          color: green;
        }

        .practice-wrong {
          color: red;
        }

        .practice-error {
          color: red;
          margin-top: 12px;
          font-size: 14px;
        }

        .practice-footer {
          margin-top: 24px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
      `}</style>

      <div className="practice-view">
        {/* Header */}
        <header className="border-b border-black pb-4">
          <h1 className="practice-title flex items-center gap-2">
            <Sparkles size={26} />
            Scaffolded Practice
          </h1>

          <p className="practice-subtitle">
            Enter an algebra expression and solve each intermediate
            step one at a time.
          </p>
        </header>

        {/* Input */}
        <div className="practice-card">
          <div className="practice-input-row">
            <input
              className="practice-input"
              type="text"
              placeholder="e.g. 2x + 3x"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleSolve()
              }
              disabled={loading}
            />

            <button
              className="practice-btn"
              onClick={() => handleSolve()}
              disabled={loading || !expression.trim()}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>

          <div className="practice-chip-row">
            {SAMPLE_PROBLEMS.map((p) => (
              <button
                key={p.expression}
                className="practice-chip"
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
            <div className="practice-error flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="practice-card">
            <div className="mb-6">
              <p className="font-mono text-sm">
                Simplify: <strong>{solvedExpr}</strong>
              </p>
            </div>

            {steps.map((step, i) => {
              const us = userSteps[i];

              const isActive =
                i === activeStep && !submitted;

              const isDone = us.state !== "idle";

              return (
                <div key={i} className="practice-step">
                  <p className="font-mono text-xs uppercase mb-2">
                    {formatChangeType(step.changeType)}
                  </p>

                  {step.oldNode && (
                    <p className="font-mono text-sm mb-3 text-gray-600">
                      → {step.oldNode}
                    </p>
                  )}

                  <div className="practice-step-row">
                    <span className="font-mono text-lg">=</span>

                    {isDone ? (
                      <div
                        className={`practice-answer ${
                          us.state === "correct"
                            ? "practice-correct"
                            : "practice-wrong"
                        }`}
                      >
                        {step.newNode}
                      </div>
                    ) : (
                      <input
                        ref={(el) => {
                          inputRefs.current[i] = el;
                        }}
                        className="practice-answer"
                        type="text"
                        value={us.value}
                        disabled={!isActive}
                        onChange={(e) =>
                          setUserSteps((prev) =>
                            prev.map((s, idx) =>
                              idx === i
                                ? {
                                    ...s,
                                    value: e.target.value,
                                  }
                                : s
                            )
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            checkStep(i);
                          }
                        }}
                      />
                    )}

                    {isActive && !isDone && (
                      <>
                        <button
                          className="practice-check-btn"
                          onClick={() => checkStep(i)}
                        >
                          Check
                        </button>

                        <button
                          className="practice-skip-btn"
                          onClick={() => skipStep(i)}
                        >
                          Skip
                        </button>
                      </>
                    )}

                    {us.state === "correct" && (
                      <CheckCircle2
                        className="practice-correct"
                        size={18}
                      />
                    )}

                    {us.state === "wrong" && (
                      <X
                        className="practice-wrong"
                        size={18}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div className="practice-footer">
              {!submitted ? (
                <button
                  className="practice-btn"
                  disabled={!allDone}
                  onClick={handleSubmit}
                >
                  Submit Practice
                </button>
              ) : (
                <>
                  <div className="font-mono text-sm">
                    Score: {score}% | ✓ {correct} | ✗ {wrong}
                    {" | "}↷ {skipped}
                  </div>

                  <button
                    className="practice-btn"
                    onClick={handleReset}
                  >
                    <RefreshCw size={16} />
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