"use client";
import "mathlive";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  getSession, 
  startPractice, 
  submitPracticeStep, 
  PracticeProblem, 
  PracticeSubmitStepResponse,
  StepEvaluationResult
} from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import React from "react";

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
};

function MathField({
  value,
  onChange,
  disabled = false,
}: MathFieldProps) {
  const mathFieldRef = useRef<any>(null);

  useEffect(() => {
    if (mathFieldRef.current && mathFieldRef.current.value !== value) {
      mathFieldRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    const mf = mathFieldRef.current;

    if (!mf) return;

    const handleInput = () => {
      onChange(mf.value);
    };

    mf.addEventListener("input", handleInput);

    return () => {
      mf.removeEventListener("input", handleInput);
    };
  }, [onChange]);

  return React.createElement("math-field", {
    ref: mathFieldRef,
    disabled,
    "virtual-keyboard-mode": "onfocus",
    style: {
      width: "100%",
      minWidth: "180px",
      minHeight: "44px",
      padding: "8px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      background: "white",
      fontSize: "1rem",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      outline: "none",
    },
  });
}

export default function PracticePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>("Loading practice problems...");
  const [nodeId, setNodeId] = useState<string>("");
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentProblemIdx, setCurrentProblemIdx] = useState<number>(0);
  
  // Inputs for current problem: step_index -> student value
  const [inputs, setInputs] = useState<Record<number, string>>({});
  
  // Results of submitted problems
  const [submittedResults, setSubmittedResults] = useState<Record<number, PracticeSubmitStepResponse>>({});
  const [problemCompleted, setProblemCompleted] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load the session and practice set
  const loadPracticeData = async () => {
    setLoading(true);
    setErrorMsg(null);
    setLoadingText("Loading practice problems...");

    try {
      const session = await getSession(sessionId);
      const currentNode = session.current_node;
      setNodeId(currentNode);

      const practiceData = await startPractice({
        session_id: sessionId,
        node_id: currentNode,
      });

      setProblems(practiceData.problems);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.detail || err.message || "Failed to load practice problems. Please try again.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadPracticeData();
    }
  }, [sessionId]);

  // Handle value change for step inputs
  const handleInputChange = (stepIdx: number, val: string) => {
    setInputs(prev => ({
      ...prev,
      [stepIdx]: val
    }));
  };

  const currentProblem = problems[currentProblemIdx];
  const allInputsFilled = currentProblem 
    ? currentProblem.steps.every(step => (inputs[step.step_index] || "").trim() !== "")
    : false;

  const handleSubmitProblem = async () => {
    if (!currentProblem || !allInputsFilled || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const submissionPayload = currentProblem.steps.map(step => ({
      step_index: step.step_index,
      submitted_value: (inputs[step.step_index] || "").trim()
    }));

    try {
      const response = await submitPracticeStep({
        session_id: sessionId,
        node_id: nodeId,
        problem_id: currentProblem.id,
        student_steps: submissionPayload
      });

      setSubmittedResults(prev => ({
        ...prev,
        [currentProblemIdx]: response
      }));
      setProblemCompleted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.detail || err.message || "Failed to submit answers. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextProblem = () => {
    setInputs({});
    setProblemCompleted(false);
    setCurrentProblemIdx(prev => prev + 1);
  };

  const handleGetResults = () => {
    router.push(`/session/${sessionId}/results`);
  };

  const handleBackToTopics = () => {
    router.push(`/topics/${nodeId}`);
  };

  const cleanMathExpr = (expr: string) => {
    // Replaces patterns like '6*x' with '6x'
    return expr.replace(/(\d)\s*\*\s*([a-zA-Z])/g, '$1$2').replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, '$1$2');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_15px_30px_rgba(0,26,84,0.05)]">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
          <p className="font-mono text-xs text-slate-500 animate-pulse uppercase tracking-wider">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (errorMsg && problems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-8 flex flex-col justify-center items-center">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_15px_30px_rgba(0,26,84,0.05)] text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#fdd400]/10 rounded-full blur-[40px] pointer-events-none" />
          <span className="font-mono text-[9px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">DIAGNOSTIC FAULT</span>
          <h2 className="text-xl font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] mt-3 mb-2">Error</h2>
          <p className="font-mono text-xs text-red-600 bg-red-50/50 border border-red-100 rounded-lg p-3 my-4 break-all text-left">
            [FAULT_LOG] {errorMsg}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button
              onClick={loadPracticeData}
              className="bg-[#001a54] text-white hover:bg-[#001545] py-3 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)]"
            >
              Retry Connection
            </button>
            <button
              onClick={handleBackToTopics}
              className="bg-white hover:bg-slate-50 text-[#001a54] border border-slate-200 hover:border-slate-300 py-3 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer"
            >
              Back to Topics
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPracticeOver = currentProblemIdx >= problems.length;

  if (isPracticeOver) {
    const fullyCorrectCount = Object.values(submittedResults).reduce((count, result) => {
      const allCorrect = result.step_results.every(r => r.correct);
      return count + (allCorrect ? 1 : 0);
    }, 0);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-2xl w-full shadow-[0_15px_40px_rgba(0,26,84,0.06)] relative overflow-hidden text-center space-y-6">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#001a54]/5 rounded-full blur-[60px] pointer-events-none" />

          <span className="font-mono text-[9px] text-[#001a54] bg-[#fdd400] px-3 py-1 rounded-full font-extrabold uppercase tracking-widest">SESSION COMPLETE</span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#001a54] font-['Hanken_Grotesk',_sans-serif]">Practice Complete!</h1>
          
          <div className="border-y border-slate-100 py-6 my-4 bg-slate-50/50 rounded-xl px-4">
            <p className="text-slate-400 font-mono uppercase text-[10px] tracking-wider">Your Score</p>
            <p className="text-5xl font-mono font-bold mt-1 text-[#001a54]">
              {fullyCorrectCount} <span className="text-slate-300">/</span> {problems.length}
            </p>
            <p className="text-xs font-sans mt-2 text-slate-500 font-medium">
              Problems solved perfectly without missteps
            </p>
          </div>

          <div className="text-left font-mono text-xs space-y-2.5 max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-200/50">
            {problems.map((prob, idx) => {
              const res = submittedResults[idx];
              const allCorrect = res?.step_results.every(r => r.correct);
              return (
                <div key={prob.id} className="flex justify-between items-center border-b border-slate-200/60 last:border-b-0 pb-2 last:pb-0">
                  <span className="text-slate-600 font-semibold truncate max-w-[240px]">Problem {idx + 1}: {cleanMathExpr(prob.problem_expr)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    allCorrect 
                      ? "bg-green-50 text-green-700 border border-green-200" 
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {allCorrect ? "✓ ALL CORRECT" : "✗ INCORRECT"}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGetResults}
            className="w-full bg-[#001a54] text-white hover:bg-[#001545] py-4 text-sm font-mono uppercase font-bold tracking-wider transition-all rounded-2xl shadow-[0_4px_20px_rgba(0,26,84,0.12)] hover:shadow-[0_0_25px_rgba(253,212,0,0.15)] cursor-pointer flex items-center justify-center gap-2"
          >
            Get Session Summary <span className="text-[#fdd400]">→</span>
          </button>
        </div>
      </div>
    );
  }

  const problem = problems[currentProblemIdx];
  const submissionResult = submittedResults[currentProblemIdx];

  const requiresTextInput = (val: string) => {
    // Strip latex commands (e.g., \sqrt, \frac) before checking for actual words
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) || withoutLatex.includes(",");
  };

  const fixUnbalancedMath = (before: string, after: string) => {
    // Determine if the blank splits a LaTeX block
    const doubleDollarsBefore = (before.match(/\$\$/g) || []).length;
    if (doubleDollarsBefore % 2 !== 0) {
      return { fixedBefore: before + "$$", fixedAfter: "$$" + after };
    }
    
    const singleBefore = before.replace(/\$\$/g, "");
    const singleDollarsBefore = (singleBefore.match(/\$/g) || []).length;
    if (singleDollarsBefore % 2 !== 0) {
      return { fixedBefore: before + "$", fixedAfter: "$" + after };
    }
    
    return { fixedBefore: before, fixedAfter: after };
  };


  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Bento Grid Header Block */}
        <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          {/* Subtle ambient gold and navy glow offsets */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
              <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">SCAFFOLDED PRACTICE</span>
            </div>
            <button
              onClick={handleBackToTopics}
              className="font-mono text-[10px] text-black bg-[#fdd400] hover:bg-black hover:text-white px-3 py-1.5 rounded-xl border border-white/5 transition-all cursor-pointer font-bold uppercase tracking-wider"
            >
              Exit
            </button>
          </div>

          <div className="z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
              Problem Solving Workspace
            </h1>
            <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
              Problem <span className="text-[#fdd400] font-bold">{currentProblemIdx + 1}</span> of {problems.length}
            </p>
          </div>
        </header>

        <main className="space-y-6">
          {/* Word Problem Card */}
          {problem.word_problem_text && (
            <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_4px_12px_rgba(0,26,84,0.02)] relative overflow-hidden">
              <span className="absolute top-0 right-0 bg-[#fdd400]/20 text-[#001a54] px-3 py-1 text-[9px] font-mono uppercase font-bold tracking-wider rounded-bl-xl border-l border-b border-slate-200/10">
                REAL-WORLD SCENARIO
              </span>
              <div className="text-slate-700 text-sm md:text-base leading-relaxed mt-2 markdown-content font-medium">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {problem.word_problem_text}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Expression Focus Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_4px_12px_rgba(0,26,84,0.02)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-24 bg-[#fdd400] rounded-b-full shadow-[0_0_8px_#fdd400]" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Target Mathematical Expression</p>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-[#001a54] flex justify-center markdown-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {cleanMathExpr(problem.problem_expr).startsWith("$") ? cleanMathExpr(problem.problem_expr) : `$${cleanMathExpr(problem.problem_expr)}$`}
              </ReactMarkdown>
            </div>
          </div>

          {/* Scaffold Steps */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-400">
              Guided Equation Steps
            </h2>

            {problem.steps.map((step, idx) => {
              const stepResult = submissionResult?.step_results.find(
                r => r.step_index === step.step_index
              );

              const isCorrect = stepResult?.correct;
              const hasSubmitted = !!submissionResult;

              const cleanBlankExpr = cleanMathExpr(step.blank_expression);
              const exprParts = cleanBlankExpr.split("___");
              const rawBefore = exprParts[0];
              const rawAfter = exprParts[1] || "";
              const { fixedBefore: beforeBlank, fixedAfter: afterBlank } = fixUnbalancedMath(rawBefore, rawAfter);

              const isMisconceptionStep =
                submissionResult?.misconception_found &&
                submissionResult?.misconception_step_index === step.step_index;

              const isTextStep = requiresTextInput(step.correct_value);

              let borderClass = "border-slate-200 hover:border-[#001a54]/30";
              let bgClass = "bg-white";
              let accentClass = "bg-[#fdd400] shadow-[0_0_6px_rgba(253,212,0,0.5)]";

              if (hasSubmitted) {
                if (isCorrect) {
                  borderClass = "border-green-300/80";
                  bgClass = "bg-green-50/20";
                  accentClass = "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]";
                } else if (isMisconceptionStep) {
                  borderClass = "border-red-300";
                  bgClass = "bg-red-50/10";
                  accentClass = "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]";
                } else {
                  borderClass = "border-slate-300";
                  bgClass = "bg-slate-50/40";
                  accentClass = "bg-slate-400";
                }
              }

              const formatMathValue = (val: string) => {
                const trimmed = val.trim();
                return trimmed.startsWith("$") ? trimmed : `$${trimmed}$`;
              };

              return (
                <div
                  key={step.step_index}
                  className={`border rounded-2xl p-5 md:p-6 transition-all duration-300 relative overflow-hidden flex gap-4 ${borderClass} ${bgClass}`}
                >
                  <div className={`w-1 h-12 rounded-full self-center shrink-0 ${accentClass} transition-all duration-300`} />

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#001a54]">Step {idx + 1}</span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md border font-bold ${
                          step.step_type === "variable_identification"
                            ? "border-blue-200 text-blue-700 bg-blue-50/50"
                            : "border-purple-200 text-purple-700 bg-purple-50/50"
                        }`}>
                          {step.step_type === "variable_identification" ? "Concept Setup" : "Algebraic Step"}
                        </span>
                      </div>

                      {hasSubmitted && (
                        <span className={`font-mono text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-700 text-sm md:text-base font-semibold leading-relaxed markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {step.instruction}
                      </ReactMarkdown>
                    </div>

                    <div className="font-mono text-sm md:text-base flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: ({ node, ...props }) => <span {...props} /> }}
                      >
                        {beforeBlank}
                      </ReactMarkdown>

                      {!hasSubmitted ? (
                        isTextStep ? (
                          <input
                            type="text"
                            value={inputs[step.step_index] || ""}
                            onChange={(e) => handleInputChange(step.step_index, e.target.value)}
                            disabled={isSubmitting}
                            placeholder="..."
                            className="border-b-2 border-[#001a54] bg-white px-2 py-1 text-center font-mono focus:outline-none focus:border-slate-400 w-64 max-w-full transition-all text-sm rounded"
                          />
                        ) : (
                          <div className="w-64 max-w-full">
                            <MathField
                              value={inputs[step.step_index] || ""}
                              onChange={(value) => handleInputChange(step.step_index, value)}
                              disabled={isSubmitting}
                            />
                          </div>
                        )
                      ) : (
                        <span className={`font-bold px-2 py-1 rounded-lg border text-sm md:text-base ${
                          isCorrect
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-red-200 text-red-700 bg-red-50"
                        }`}>
                          {stepResult?.submitted_value ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{ p: ({ node, ...props }) => <span {...props} /> }}
                            >
                              {isTextStep
                                ? stepResult.submitted_value
                                : formatMathValue(stepResult.submitted_value)}
                            </ReactMarkdown>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}

                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: ({ node, ...props }) => <span {...props} /> }}
                      >
                        {afterBlank}
                      </ReactMarkdown>
                    </div>

                    {hasSubmitted && !isCorrect && (
                      <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-2">
                        Expected Formulation:
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{ p: ({ node, ...props }) => <span {...props} /> }}
                          >
                            {formatMathValue(cleanMathExpr(step.correct_value))}
                          </ReactMarkdown>
                        </span>
                      </p>
                    )}

                    {isMisconceptionStep && submissionResult?.feedback_text && (
                      <div className="border-l-4 border-red-500 bg-red-50/50 rounded-r-xl p-4 mt-4 text-red-950">
                        <p className="text-[9px] font-mono uppercase tracking-widest font-extrabold text-red-700 mb-1">
                          Tutor Feedback
                        </p>
                        <div className="text-sm font-medium leading-relaxed markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {submissionResult.feedback_text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </main>

        {errorMsg && (
          <div className="mt-6 border border-red-200 bg-red-50 p-4 text-xs font-mono text-red-600 rounded-xl break-words">
            [ERROR] {errorMsg}
          </div>
        )}

        <footer className="mt-8 pt-6 border-t border-slate-200">
          {!problemCompleted ? (
            <button
              onClick={handleSubmitProblem}
              disabled={!allInputsFilled || isSubmitting}
              className={`w-full py-4 text-sm font-mono uppercase font-bold tracking-wider transition-all rounded-2xl flex items-center justify-center gap-2 ${
                !allInputsFilled || isSubmitting
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-[#001a54] text-white hover:bg-[#001545] cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.12)] hover:shadow-[0_0_20px_rgba(253,212,0,0.15)]"
              }`}
            >
              {isSubmitting ? "Evaluating steps..." : "Submit Answer"}
            </button>
          ) : (
            <button
              onClick={handleNextProblem}
              className="w-full bg-[#001a54] text-white hover:bg-[#001545] py-4 text-sm font-mono uppercase font-bold tracking-wider transition-all rounded-2xl shadow-[0_4px_20px_rgba(0,26,84,0.12)] hover:shadow-[0_0_25px_rgba(253,212,0,0.15)] cursor-pointer flex items-center justify-center gap-2"
            >
              {currentProblemIdx + 1 === problems.length ? "See Results" : "Next Problem"} <span className="text-[#fdd400]">→</span>
            </button>
          )}
        </footer>

      </div>
    </div>
  );
}