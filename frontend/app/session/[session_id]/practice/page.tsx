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
} from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import React from "react";
import confetti from "canvas-confetti";
import { 
  Compass, 
  Leaf, 
  Flame, 
  ShieldAlert, 
  Loader2, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  Check, 
  Calendar 
} from "lucide-react";

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
      minHeight: "48px",
      padding: "10px 14px",
      border: "3px solid #1F2720",
      borderRadius: "14px",
      background: "white",
      fontSize: "0.95rem",
      fontWeight: "bold",
      boxShadow: "3px 3px 0px 0px #1F2720",
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

      // Instantly celebrate a perfectly completed problem [2]
      const allCorrect = response.step_results.every(r => r.correct);
      if (allCorrect) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.75 } });
      }
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
    return expr.replace(/(\d)\s*\*\s*([a-zA-Z])/g, '$1$2').replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, '$1$2');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b261c] flex flex-col items-center justify-center p-8">
        <div className="bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 max-w-sm w-full text-center shadow-[8px_8px_0px_0px_#1F2720]">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#e6e8ea] rounded-full" />
            <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
          <p className="font-['Manrope'] text-xs text-slate-500 font-black animate-pulse uppercase tracking-wider">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (errorMsg && problems.length === 0) {
    return (
      <div className="min-h-screen bg-[#1b261c] p-6 md:p-8 flex flex-col justify-center items-center font-['Manrope']">
        <div className="w-full max-w-xl bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 shadow-[8px_8px_0px_0px_#1F2720] text-center relative overflow-hidden">
          <span className="font-['Manrope'] text-[10px] text-red-900 bg-red-100 border-2 border-[#1F2720] px-3 py-1.5 rounded-md font-black uppercase tracking-wider">DIAGNOSTIC FAULT</span>
          <h2 className="text-xl font-black text-[#1F2720] mt-4 mb-2">Error</h2>
          <p className="font-['Manrope'] text-xs text-red-900 bg-red-50 border-2 border-[#1F2720] rounded-xl p-3 my-4 break-all text-left font-bold">
            [FAULT_LOG] {errorMsg}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button
              onClick={loadPracticeData}
              className="bg-[#fdd400] text-[#1F2720] border-[3px] border-[#1F2720] py-3 px-6 text-xs font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5"
            >
              Retry Connection
            </button>
            <button
              onClick={handleBackToTopics}
              className="bg-white text-[#1F2720] border-[3px] border-[#1F2720] py-3 px-6 text-xs font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5"
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

    const isHighestResult = fullyCorrectCount === problems.length;

    return (
      <div className="min-h-screen bg-[#1b261c] text-[#1F2720] p-6 md:p-8 flex items-center justify-center font-['Manrope']">
        <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-8 max-w-2xl w-full shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden text-center space-y-6">
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

          <span className="font-black text-[10px] text-[#1F2720] bg-[#fdd400] border-2 border-[#1F2720] px-4.5 py-1.5 rounded-md uppercase tracking-widest shadow-[2px_2px_0px_0px_#1F2720]">SESSION COMPLETE</span>
          
          <div className="flex flex-col items-center justify-center gap-3">
            <img 
              src={isHighestResult ? "/suri-snake-happy.png" : "/suri-snake-sad.png"} 
              alt={isHighestResult ? "Suri Happy" : "Suri Supportive"} 
              className="h-24 w-auto object-contain select-none animate-bounce" 
            />
            <p className="text-xs font-black bg-white py-1.5 px-4 rounded-full border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
              {isHighestResult 
                ? "💬 \"Sss-pectacular performance, Ranger! Perfect trail map complete!\"" 
                : "💬 \"You made it through the thorny branches! Let'sss review those stumbling blocks.\""}
            </p>
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2720] font-['Hanken_Grotesk']">Practice Complete!</h1>
          
          <div className="border-[3px] border-[#1F2720] py-6 my-4 bg-white rounded-2xl px-4 shadow-[4px_4px_0px_0px_#1F2720]">
            <p className="text-slate-400 uppercase text-[10px] tracking-wider font-black">Your Score</p>
            <p className="text-5xl font-black mt-1 text-[#1F2720]">
              {fullyCorrectCount} <span className="text-slate-300">/</span> {problems.length}
            </p>
            <p className="text-xs font-bold mt-2.5 text-slate-500">
              Problems solved perfectly without missteps
            </p>
          </div>

          {/* Results Summary Logs */}
          <div className="text-left font-semibold text-xs space-y-3 max-w-md mx-auto bg-white p-4.5 rounded-2xl border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720]">
            {problems.map((prob, idx) => {
              const res = submittedResults[idx];
              const allCorrect = res?.step_results.every(r => r.correct);
              return (
                <div key={prob.id} className="flex justify-between items-center border-b-2 border-[#1F2720]/10 last:border-b-0 pb-2.5 last:pb-0">
                  <span className="text-[#1F2720] font-black truncate max-w-[240px]">Problem {idx + 1}: {cleanMathExpr(prob.problem_expr)}</span>
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border-2 ${
                    allCorrect 
                      ? "bg-green-100 text-green-900 border-[#1F2720]" 
                      : "bg-red-100 text-red-900 border-[#1F2720]"
                  }`}>
                    {allCorrect ? "✓ ALL CORRECT" : "✗ INCORRECT"}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGetResults}
            className="w-full bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase rounded-[20px] tracking-wider transition-all cursor-pointer shadow-[6px_6px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-1 active:translate-x-1 active:shadow-[2px_2px_0px_0px_#1F2720] flex items-center justify-center gap-2"
          >
            Get Session Summary <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
        </div>
      </div>
    );
  }

  const problem = problems[currentProblemIdx];
  const submissionResult = submittedResults[currentProblemIdx];

  const requiresTextInput = (val: string) => {
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) || withoutLatex.includes(",");
  };

  const fixUnbalancedMath = (before: string, after: string) => {
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
    <div className="bg-[#1b261c] min-h-screen text-[#1F2720] py-8 px-4 md:px-8 relative overflow-hidden font-['Manrope'] flex flex-col items-center">
      
      {/* Background Forest Silhouette */}
      <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

      {/* Floating Glowing Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "10%", bottom: "10%", animation: "floatFirefly 8s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "22%", bottom: "5%", animation: "floatFirefly 11s ease-in-out infinite 1.5s" }} />

      {/* Dynamic Math styles overrides */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .markdown-content {
          line-height: 2.1;
        }
        .markdown-content p {
          margin-bottom: 1.25rem;
          color: #1F2720;
          font-weight: 700;
        }
        .markdown-content .katex {
          font-weight: 900 !important;
          font-size: 1.08em;
          color: #1b4320 !important;
          background-color: rgba(121, 255, 143, 0.22) !important;
          padding: 3px 8px !important;
          border-radius: 8px !important;
          border: 1.5px solid #1F2720 !important;
          display: inline-block;
        }
        .markdown-content .katex-display {
          margin: 1.5rem 0 !important;
          padding: 0 !important;
        }
        .markdown-content .katex-display .katex {
          background-color: #ffffff !important;
          border: 3px solid #1F2720 !important;
          padding: 12px 22px !important;
          border-radius: 16px !important;
          box-shadow: 3px 3px 0px 0px #1F2720 !important;
          display: inline-block !important;
        }
      `}} />

      <div className="max-w-3xl w-full mx-auto space-y-6 relative z-10">

        {/* Dynamic header banner */}
        <header className="bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 z-10 border-b-4 border-[#1F2720]/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
              <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-[0.2em] uppercase font-black">SCAFFOLDED PRACTICE</span>
            </div>
            
            <button
              onClick={handleBackToTopics}
              className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#fdd400] hover:bg-[#ffe170] px-4.5 py-2 rounded-xl border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider"
            >
              Exit
            </button>
          </div>

          <div className="z-10 flex items-center gap-4">
            <img src="/suri-snake-left.png" alt="Suri Guide" className="h-16 w-auto object-contain select-none shrink-0 animate-bounce" style={{ animationDuration: "2.5s" }} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Hanken_Grotesk'] drop-shadow-[2.5px_2.5px_0px_#1F2720]">
                Problem Solving Workspace
              </h1>
              <p className="font-['Manrope'] text-[10px] text-emerald-200 mt-1.5 font-bold uppercase tracking-wider">
                Problem <span className="text-[#fdd400] font-black">{currentProblemIdx + 1}</span> of {problems.length}
              </p>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          
          {/* Word Problem Card */}
          {problem.word_problem_text && (
            <section className="bg-white rounded-[28px] border-[4px] border-[#1F2720] p-6 shadow-[6px_6px_0px_0px_#1F2720] relative overflow-hidden">
              <span className="absolute top-0 right-0 bg-[#fdd400] text-[#1F2720] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-bl-2xl border-l-2 border-b-2 border-[#1F2720]">
                REAL-WORLD QUEST
              </span>
              <div className="text-[#1F2720] text-sm md:text-base leading-relaxed mt-2 markdown-content">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {problem.word_problem_text}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Expression Focus Panel */}
          <div className="bg-[#faf8f5] rounded-[24px] border-[3.5px] border-[#1F2720] p-5 shadow-[4px_4px_0px_0px_#1F2720] text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[5px] w-24 bg-[#fdd400] rounded-b-full border-x-2 border-b-2 border-[#1F2720] shadow-[0_0_6px_#fdd400]" />
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Target Mathematical Expression</p>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-[#1F2720] flex justify-center markdown-content select-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {cleanMathExpr(problem.problem_expr).startsWith("$") ? cleanMathExpr(problem.problem_expr) : `$${cleanMathExpr(problem.problem_expr)}$`}
              </ReactMarkdown>
            </div>
          </div>

          {/* Scaffold Steps */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
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

              let borderClass = "border-[#1F2720] hover:border-emerald-700 shadow-[4px_4px_0px_0px_#1F2720]";
              let bgClass = "bg-white";
              let accentClass = "bg-[#fdd400] shadow-[0_0_6px_rgba(253,212,0,0.5)] border-[#1F2720]";

              if (hasSubmitted) {
                if (isCorrect) {
                  borderClass = "border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720]";
                  bgClass = "bg-green-50/50";
                  accentClass = "bg-[#79ff8f] border-[#1F2720]";
                } else if (isMisconceptionStep) {
                  borderClass = "border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720]";
                  bgClass = "bg-red-50/50";
                  accentClass = "bg-[#ef4444] border-[#1F2720]";
                } else {
                  borderClass = "border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]";
                  bgClass = "bg-slate-50";
                  accentClass = "bg-slate-400 border-[#1F2720]";
                }
              }

              const formatMathValue = (val: string) => {
                const trimmed = val.trim();
                return trimmed.startsWith("$") ? trimmed : `$${trimmed}$`;
              };

              return (
                <div
                  key={step.step_index}
                  className={`border-[3.5px] rounded-[24px] p-5 md:p-6 transition-all duration-300 relative overflow-hidden flex gap-4 ${borderClass} ${bgClass}`}
                >
                  <div className={`w-1.5 h-14 rounded-full self-center shrink-0 border-2 ${accentClass} transition-all duration-300`} />

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1F2720]/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-['Manrope'] text-xs font-black text-[#1F2720]">Step {idx + 1}</span>
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border-2 border-[#1F2720] ${
                          step.step_type === "variable_identification"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-purple-100 text-purple-900"
                        }`}>
                          {step.step_type === "variable_identification" ? "Concept Setup" : "Algebraic Step"}
                        </span>
                      </div>

                      {hasSubmitted && (
                        <span className={`font-black text-[10px] uppercase px-2.5 py-1 rounded-md border-2 border-[#1F2720] ${
                          isCorrect ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
                        }`}>
                          {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        </span>
                      )}
                    </div>

                    <div className="text-[#1F2720] text-sm md:text-base font-black leading-relaxed markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {step.instruction}
                      </ReactMarkdown>
                    </div>

                    {/* Checkpoint equation input blocks */}
                    <div className="font-mono text-sm md:text-base flex flex-wrap items-center gap-2 bg-[#faf8f5] border-[3px] border-[#1F2720] rounded-xl p-3 shadow-inner">
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
                            className="border-[3px] border-[#1F2720] rounded-xl bg-white px-3 py-2 text-center font-black focus:outline-none focus:border-[#fdd400] shadow-[2px_2px_0px_0px_#1F2720] w-64 max-w-full text-sm font-mono"
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
                        <span className={`font-black px-2.5 py-1 rounded-lg border-2 border-[#1F2720] text-sm md:text-base ${
                          isCorrect
                            ? "text-green-900 bg-green-100"
                            : "text-red-900 bg-red-100"
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
                      <p className="text-[10px] font-black text-slate-500 flex flex-wrap items-center gap-1.5 mt-2">
                        Expected Formulation:
                        <span className="font-black text-[#1F2720] bg-slate-100 px-2 py-0.5 rounded border-2 border-[#1F2720]">
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

                    {/* SURI's targeted feedback layout block */}
                    {isMisconceptionStep && submissionResult?.feedback_text && (
                      <div className="border-l-[5px] border-[#ef4444] bg-[#faf8f5] rounded-r-2xl border-[3.5px] border-l-0 border-[#1F2720] p-4.5 mt-4 text-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720]">
                        <div className="flex items-center gap-2 mb-2">
                          <img src="/suri-snake-sad.png" alt="Suri sad" className="w-9 h-auto shrink-0" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#1F2720]">
                            Tutor Feedback Guidance
                          </p>
                        </div>
                        <div className="text-xs font-bold leading-relaxed markdown-content">
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
          <div className="mt-6 border-[3.5px] border-[#1F2720] bg-red-100 p-4 text-xs font-black text-red-900 rounded-[20px] shadow-[4px_4px_0px_0px_#1F2720] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
            <span>[ERROR EXCEPTION] {errorMsg}</span>
          </div>
        )}

        {/* Action Bottom Nav */}
        <footer className="mt-8 pt-6 border-t-4 border-[#1F2720]/15">
          {!problemCompleted ? (
            <button
              onClick={handleSubmitProblem}
              disabled={!allInputsFilled || isSubmitting}
              className={`w-full py-4 text-xs font-black uppercase rounded-[24px] tracking-wider transition-all border-[4px] border-[#1F2720] flex items-center justify-center gap-2 cursor-pointer shadow-[6px_6px_0px_0px_#1F2720] ${
                !allInputsFilled || isSubmitting
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                  : "bg-[#fdd400] text-[#1F2720] hover:bg-[#ffe170] hover:-translate-y-0.5 active:translate-y-1 active:translate-x-1 active:shadow-[1px_1px_0px_0px_#1F2720]"
              }`}
            >
              {isSubmitting ? "Evaluating steps..." : "Submit Answer"}
            </button>
          ) : (
            <button
              onClick={handleNextProblem}
              className="w-full bg-[#fdd400] text-[#1F2720] hover:bg-[#ffe170] border-[4px] border-[#1F2720] py-4 text-xs font-black uppercase tracking-wider transition-all rounded-[24px] shadow-[6px_6px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-1 active:translate-x-1 active:shadow-[1px_1px_0px_0px_#1F2720] cursor-pointer flex items-center justify-center gap-2"
            >
              {currentProblemIdx + 1 === problems.length ? "See Results" : "Next Problem"} <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
          )}
        </footer>

      </div>
    </div>
  );
}