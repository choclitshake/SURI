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
      minHeight: "48px",
      padding: "8px",
      border: "2px solid black",
      background: "white",
      fontSize: "1.1rem",
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
      // 1. Fetch the session to get current_node
      const session = await getSession(sessionId);
      const currentNode = session.current_node;
      setNodeId(currentNode);

      // 2. Fetch or generate 5 practice problems
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

  // Check if all steps in the current problem have a non-empty value entered
  const currentProblem = problems[currentProblemIdx];
  const allInputsFilled = currentProblem 
    ? currentProblem.steps.every(step => (inputs[step.step_index] || "").trim() !== "")
    : false;

  // Submit current problem steps
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

  // Move to next problem
  const handleNextProblem = () => {
    setInputs({});
    setProblemCompleted(false);
    setCurrentProblemIdx(prev => prev + 1);
  };

  // Navigates to the results screen
  const handleGetResults = () => {
    router.push(`/session/${sessionId}/results`);
  };

  const handleBackToTopics = () => {
    router.push("/topics");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-8">
        <div className="border border-black p-8 max-w-sm w-full text-center">
          <p className="font-mono text-sm animate-pulse uppercase tracking-wider">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (errorMsg && problems.length === 0) {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto flex flex-col justify-center">
        <div className="border border-black p-8 text-center">
          <h2 className="text-xl font-mono uppercase font-bold mb-4">Error</h2>
          <p className="font-mono text-xs text-red-600 mb-8 break-words">[ERROR] {errorMsg}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={loadPracticeData}
              className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
            >
              Retry
            </button>
            <button
              onClick={handleBackToTopics}
              className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
            >
              Back to Topics
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final summary screen state
  const isPracticeOver = currentProblemIdx >= problems.length;

  if (isPracticeOver) {
    // Count how many problems were fully correct (every step correct)
    const fullyCorrectCount = Object.values(submittedResults).reduce((count, result) => {
      const allCorrect = result.step_results.every(r => r.correct);
      return count + (allCorrect ? 1 : 0);
    }, 0);

    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto flex flex-col justify-center">
        <div className="border border-black p-8 text-center space-y-6">
          <h1 className="text-3xl font-mono font-bold uppercase tracking-wider">Practice Complete!</h1>
          
          <div className="border-y border-black py-6 my-4">
            <p className="text-gray-600 font-mono uppercase text-xs">Your Score</p>
            <p className="text-5xl font-mono font-bold mt-2">
              {fullyCorrectCount} / {problems.length}
            </p>
            <p className="text-sm font-sans mt-2 text-gray-800">
              Problems solved perfectly
            </p>
          </div>

          <div className="text-left font-mono text-sm space-y-2 max-w-md mx-auto">
            {problems.map((prob, idx) => {
              const res = submittedResults[idx];
              const allCorrect = res?.step_results.every(r => r.correct);
              return (
                <div key={prob.id} className="flex justify-between border-b border-gray-100 pb-2">
                  <span>Problem {idx + 1}: {prob.problem_expr}</span>
                  <span className={allCorrect ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {allCorrect ? "✓ ALL CORRECT" : "✗ INCORRECT"}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGetResults}
            className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
          >
            Get Results
          </button>
        </div>
      </div>
    );
  }

  const problem = problems[currentProblemIdx];
  const submissionResult = submittedResults[currentProblemIdx];

  return (
    <div className="min-h-screen bg-white text-black font-sans p-6 sm:p-8 max-w-3xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-mono font-bold uppercase tracking-wide">
              Scaffolded Practice
            </h1>
            <p className="text-xs font-mono text-gray-500 mt-2">
              Problem {currentProblemIdx + 1} of {problems.length}
            </p>
          </div>
          <button
            onClick={handleBackToTopics}
            className="border border-black py-1.5 px-3 text-xs font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
          >
            Exit
          </button>
        </div>
      </header>

      <main className="space-y-6">
        {/* Word Problem Card */}
        {problem.word_problem_text && (
          <section className="border border-black p-5 bg-gray-50 relative">
            <span className="absolute -top-3 left-4 bg-white border border-black px-2 py-0.5 text-[10px] font-mono uppercase font-bold">
              Real-World Scenario
            </span>
            <div className="text-gray-800 text-sm leading-relaxed mt-1 markdown-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {problem.word_problem_text}
              </ReactMarkdown>
            </div>
          </section>
        )}

        {/* Expression Section */}
        <div className="border border-black p-4 text-center font-mono">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Target Expression</p>
          <div className="text-2xl font-bold mt-1 tracking-wide flex justify-center markdown-content">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {problem.problem_expr.startsWith("$") ? problem.problem_expr : `$${problem.problem_expr}$`}
            </ReactMarkdown>
          </div>
        </div>

        {/* Scaffold Steps */}
        <section className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500">
            Guided Steps
          </h2>

          {problem.steps.map((step, idx) => {
            const stepResult = submissionResult?.step_results.find(
              r => r.step_index === step.step_index
            );

            const isCorrect = stepResult?.correct;
            const hasSubmitted = !!submissionResult;
            
            // Split blank_expression by '___' to place the input inline
            const exprParts = step.blank_expression.split("___");
            const beforeBlank = exprParts[0];
            const afterBlank = exprParts[1] || "";

            // Check if this step is the misconception point
            const isMisconceptionStep = 
              submissionResult?.misconception_found && 
              submissionResult?.misconception_step_index === step.step_index;

            return (
              <div 
                key={step.step_index} 
                className={`border p-4 transition-all duration-300 ${
                  hasSubmitted
                    ? isCorrect
                      ? "border-green-600 bg-green-50/20"
                      : isMisconceptionStep
                        ? "border-red-600 bg-red-50/40 ring-1 ring-red-600"
                        : "border-gray-300 bg-gray-50/30"
                    : "border-black"
                }`}
              >
                {/* Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-gray-200 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">Step {idx + 1}</span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
                      step.step_type === "variable_identification"
                        ? "border-blue-600 text-blue-700 bg-blue-50/50"
                        : "border-purple-600 text-purple-700 bg-purple-50/50"
                    }`}>
                      {step.step_type === "variable_identification" ? "Concept Setup" : "Algebraic Step"}
                    </span>
                  </div>
                  
                  {hasSubmitted && (
                    <span className={`font-mono text-xs font-bold uppercase ${
                      isCorrect ? "text-green-600" : "text-red-600"
                    }`}>
                      {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  )}
                </div>

                {/* Instruction */}
                <div className="text-gray-700 text-sm font-sans mb-3 markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {step.instruction}
                  </ReactMarkdown>
                </div>

                {/* Fill in the blank section */}
                <div className="font-mono text-base flex flex-wrap items-center gap-2 bg-gray-50/50 p-2.5 border border-dashed border-gray-300">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: ({node, ...props}) => <span {...props} /> }}
                  >
                    {beforeBlank}
                  </ReactMarkdown>
                  
                  {!hasSubmitted ? (
                   <div className="w-64">
                    <MathField
                      value={inputs[step.step_index] || ""}
                      onChange={(value) =>
                        handleInputChange(step.step_index, value)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  ) : (
                    <span className={`font-bold px-2 py-0.5 border-b-2 ${
                      isCorrect 
                        ? "border-green-600 text-green-700 bg-green-50"
                        : "border-red-600 text-red-700 bg-red-50"
                    }`}>
                      {stepResult?.submitted_value || "—"}
                    </span>
                  )}

                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: ({node, ...props}) => <span {...props} /> }}
                  >
                    {afterBlank}
                  </ReactMarkdown>
                </div>

                {/* If submitted & incorrect, reveal correct value */}
                {hasSubmitted && !isCorrect && (
                  <p className="mt-2 text-xs font-mono text-gray-500 flex items-center gap-1">
                    Expected: <span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 border border-gray-300">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: ({node, ...props}) => <span {...props} /> }}
                      >
                        {step.correct_value.startsWith("$") || !step.correct_value.match(/[x^+\-*\/=]/) ? step.correct_value : `$${step.correct_value}$`}
                      </ReactMarkdown>
                    </span>
                  </p>
                )}

                {/* Misconception AI tutor alert */}
                {isMisconceptionStep && submissionResult.feedback_text && (
                  <div className="mt-4 border-l-4 border-red-600 bg-red-50 p-3 text-red-900">
                    <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-red-700 mb-1">
                      Tutor Feedback
                    </p>
                    <div className="text-xs font-sans italic leading-relaxed markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {submissionResult.feedback_text}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {errorMsg && (
        <div className="mt-6 border border-red-600 bg-red-50 p-4 text-xs font-mono text-red-600 break-words">
          [ERROR] {errorMsg}
        </div>
      )}

      <footer className="mt-12 pt-6 border-t border-black">
        {!problemCompleted ? (
          <button
            onClick={handleSubmitProblem}
            disabled={!allInputsFilled || isSubmitting}
            className={`w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all ${
              !allInputsFilled || isSubmitting
                ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-white hover:bg-black hover:text-white cursor-pointer"
            }`}
          >
            {isSubmitting ? "Evaluating steps..." : "Submit Answer"}
          </button>
        ) : (
          <button
            onClick={handleNextProblem}
            className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
          >
            {currentProblemIdx + 1 === problems.length ? "See Results" : "Next Problem"}
          </button>
        )}
      </footer>
    </div>
  );
}
