"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  startQuiz,
  submitQuizStep,
  skipQuizStep,
  useQuizHint,
  finishQuiz,
  QuizProblem,
  QuizStartResponse,
  QuizFinishResponse,
} from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Loader2, Timer, Lightbulb, SkipForward, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

type QuizState = "LOADING" | "INTRO" | "STEP" | "STEP_RESULT" | "SUMMARY";

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [state, setState] = useState<QuizState>("LOADING");
  const [nodeId, setNodeId] = useState<string>("");
  const [quizSessionId, setQuizSessionId] = useState<string>("");
  const [problems, setProblems] = useState<QuizProblem[]>([]);
  
  // Progress tracking
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  
  // Step state
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [equationRevealed, setEquationRevealed] = useState(false);
  const [isWrongAttempt, setIsWrongAttempt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step Result state
  const [stepCorrect, setStepCorrect] = useState<boolean | null>(null);
  const [correctValue, setCorrectValue] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  
  // Summary state
  const [summaryData, setSummaryData] = useState<QuizFinishResponse | null>(null);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);

  // 1. Initial Load
  useEffect(() => {
    async function load() {
      try {
        const session = await getSession(sessionId);
        setNodeId(session.current_node);
        const data = await startQuiz({ session_id: sessionId, node_id: session.current_node });
        setProblems(data.problems);
        setQuizSessionId(data.quiz_session_id);
        setState("INTRO");
      } catch (err) {
        console.error(err);
        alert("Failed to start quiz. Check console.");
      }
    }
    load();
  }, [sessionId]);

  // Timer Logic
  useEffect(() => {
    if (state === "STEP") {
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;
        
        setTimeRemainingMs((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            return 0; // Timer hits 0, stops here.
          }
          return next;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const currentProblem = problems[currentProblemIndex];
  const currentStep = currentProblem?.steps[currentStepIndex];

  // Actions
  const handleStartProblem = () => {
    setHintText(null);
    setEquationRevealed(false);
    setIsWrongAttempt(false);
    setSelectedChoice(null);
    setTimeRemainingMs(currentProblem.steps[0].timer_ms);
    setState("STEP");
  };

  const handleSubmit = async (choice: string | null) => {
    if (state !== "STEP") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    
    try {
      const res = await submitQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        submitted_value: choice,
        time_remaining_ms: timeRemainingMs,
      });

      setTotalPoints(res.total_points);
      
      if (!res.correct && choice !== null) {
        // Wrong attempt: lock in, reveal correct answer, move on
        setStepCorrect(false);
        setCorrectValue(res.correct_value);
        setPointsEarned(0);
        setState("STEP_RESULT");
        setTimeout(() => advanceToNext(), 2500); // Give 2.5s to read the correct answer
        return;
      }

      // Correct or Timeout
      setStepCorrect(res.correct);
      setCorrectValue(res.correct_value);
      setPointsEarned(res.points_earned);
      setState("STEP_RESULT");
      
      setTimeout(() => advanceToNext(), 1500);

    } catch (err) {
      console.error(err);
      alert("Error submitting step.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeout = () => {
    // Deprecated: Timeout no longer auto-submits. User must click Skip or a choice.
  };

  const handleSkip = async () => {
    if (state !== "STEP") return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await skipQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
      });
      setStepCorrect(false);
      setCorrectValue(res.correct_value);
      setPointsEarned(0);
      setState("STEP_RESULT");
      setTimeout(() => advanceToNext(), 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceToNext = async () => {
    if (currentStepIndex < currentProblem.steps.length - 1) {
      // Next step in same problem
      const nextStep = currentProblem.steps[currentStepIndex + 1];
      setCurrentStepIndex(currentStepIndex + 1);
      setHintText(null);
      setIsWrongAttempt(false);
      setSelectedChoice(null);
      setTimeRemainingMs(nextStep.timer_ms);
      setState("STEP");
    } else if (currentProblemIndex < problems.length - 1) {
      // Next problem
      setCurrentProblemIndex(currentProblemIndex + 1);
      setCurrentStepIndex(0);
      setState("INTRO");
    } else {
      // Finish quiz
      setState("LOADING");
      try {
        const res = await finishQuiz({ quiz_session_id: quizSessionId });
        setSummaryData(res);
        setState("SUMMARY");
      } catch (err) {
        console.error(err);
        alert("Failed to finish quiz.");
      }
    }
  };

  const buyHint = async (type: "hint" | "equation") => {
    try {
      const res = await useQuizHint({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        hint_type: type,
      });
      setTotalPoints(res.total_points);
      if (type === "hint") setHintText(res.hint_text);
      if (type === "equation") setEquationRevealed(true);
    } catch (err: any) {
      if (err.status === 400) {
        alert("Not enough points!");
      } else {
        console.error(err);
      }
    }
  };

  const renderMath = (expr: string | null | undefined) => {
    if (!expr) return null;
    const inline = expr.replace(/\$\$(.+?)\$\$/g, (_, inner) => `$${inner}$`);
    const clean = inline.replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2").replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2");
    return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{clean}</ReactMarkdown>;
  };

  if (state === "LOADING") {
    return (
      <div className="min-h-screen bg-[#001a54] flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h2 className="text-xl font-bold font-['Hanken_Grotesk'] tracking-widest uppercase">Loading Quiz</h2>
      </div>
    );
  }

  if (state === "INTRO") {
    return (
      <div className="min-h-screen bg-[#001a54] flex flex-col items-center justify-center text-white p-8">
        <div className="max-w-2xl text-center space-y-8">
          <div className="inline-block bg-white/10 px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase text-[#fdd400]">
            Problem {currentProblemIndex + 1} of {problems.length}
          </div>
          <div className="text-3xl md:text-5xl font-['Hanken_Grotesk'] font-extrabold leading-tight">
            {renderMath(currentProblem.word_problem_text || "")}
          </div>
          <button
            onClick={handleStartProblem}
            className="mt-12 bg-[#fdd400] text-black px-12 py-4 rounded-full font-bold uppercase tracking-wider text-lg hover:scale-105 transition-transform shadow-[0_0_30px_rgba(253,212,0,0.3)]"
          >
            Start Solving
          </button>
        </div>
      </div>
    );
  }

  if (state === "STEP" || state === "STEP_RESULT") {
    const progressPct = (timeRemainingMs / currentStep.timer_ms) * 100;
    
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white p-4 shadow-sm flex items-center justify-between z-10 relative">
          <div className="font-mono font-bold text-[#001a54]">
            Total Points: <span className="text-lg text-[#fdd400] bg-[#001a54] px-2 py-0.5 rounded">{totalPoints}</span>
          </div>
          <div className="flex items-center gap-2 font-mono font-bold text-slate-500">
            <Timer size={18} />
            {(timeRemainingMs / 1000).toFixed(1)}s
          </div>
        </div>

        {/* Timer Bar */}
        <div className="h-1.5 bg-slate-200 w-full z-10 relative">
          <div 
            className="h-full bg-[#fdd400] transition-all duration-100 ease-linear" 
            style={{ width: `${Math.max(0, progressPct)}%` }}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full z-10 relative space-y-8">
          {equationRevealed && (
            <div className="bg-white/50 border border-slate-200 px-6 py-3 rounded-2xl shadow-sm">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Problem Equation</div>
              <div className="text-xl font-bold text-[#001a54]">{renderMath(currentProblem.problem_expr)}</div>
            </div>
          )}

          <div className="text-center space-y-2">
            <div className="text-xl md:text-2xl font-['Hanken_Grotesk'] font-bold text-slate-800 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              {renderMath(currentProblem.word_problem_text || "")}
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-700">{renderMath(currentStep.instruction)}</h2>
            <div className="text-4xl bg-white border-2 border-[#001a54] p-8 rounded-3xl shadow-[0_10px_30px_rgba(0,26,84,0.05)] text-[#001a54] font-bold">
              {renderMath(currentStep.blank_expression.replace("?", "\\_\\_\\_"))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {currentStep.choices.map((choice, idx) => {
              const isSelected = selectedChoice === choice;
              let btnClass = "border-slate-200 text-[#001a54] hover:border-[#fdd400] hover:shadow-md";
              
              if (isSelected) {
                if (isSubmitting) btnClass = "border-[#fdd400] bg-[#fdd400]/10 text-[#001a54]";
                else if (state === "STEP_RESULT" && stepCorrect) btnClass = "border-green-500 bg-green-50 text-green-700";
                else if (isWrongAttempt || (state === "STEP_RESULT" && !stepCorrect)) btnClass = "border-red-500 bg-red-50 text-red-700 opacity-50";
              } else if (isSubmitting || state === "STEP_RESULT") {
                btnClass = "border-slate-200 text-slate-400 opacity-50"; // disabled visual
              }

              return (
                <button
                  key={idx}
                  disabled={state === "STEP_RESULT" || isSubmitting}
                  onClick={() => {
                    setSelectedChoice(choice);
                    handleSubmit(choice);
                  }}
                  className={`p-6 text-xl bg-white border-2 rounded-2xl font-bold shadow-sm transition-all hover:-translate-y-1 ${btnClass}`}
                >
                  {renderMath(choice)}
                </button>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => buyHint("hint")}
              disabled={hintText !== null || state === "STEP_RESULT" || isSubmitting}
              className="flex items-center gap-2 font-mono text-sm font-bold uppercase px-4 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
            >
              <Lightbulb size={16} /> Hint (750 pts)
            </button>
            {!equationRevealed && (
              <button
                onClick={() => buyHint("equation")}
                disabled={state === "STEP_RESULT" || isSubmitting}
                className="flex items-center gap-2 font-mono text-sm font-bold uppercase px-4 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                Show Equation (2500 pts)
              </button>
            )}
            {timeRemainingMs === 0 && (
              <button
                onClick={handleSkip}
                disabled={state === "STEP_RESULT" || isSubmitting}
                className="flex items-center gap-2 font-mono text-sm font-bold uppercase px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              >
                <SkipForward size={16} /> Skip Step
              </button>
            )}
          </div>

          {hintText && (
            <div className="bg-[#fdd400]/20 border border-[#fdd400] text-[#001a54] p-4 rounded-xl font-medium max-w-xl text-center">
              💡 {hintText}
            </div>
          )}

          {currentStepIndex > 0 && (
            <div className="w-full bg-slate-100 rounded-xl p-4 border border-slate-200 space-y-2 opacity-80 mt-8">
              <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">Previous Steps</h3>
              {currentProblem.steps.slice(0, currentStepIndex).reverse().map((s, idx) => {
                const filledExpr = s.blank_expression.replace("?", s.correct_value);
                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm border-b border-slate-200 last:border-0 pb-2 last:pb-0 gap-2">
                    <span className="text-slate-600 font-medium">{renderMath(s.instruction)}</span>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-400 text-xs uppercase">Answer:</span>
                      <span className="font-bold text-[#001a54] text-lg">{renderMath(s.correct_value)}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-[#001a54]">{renderMath(filledExpr)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP RESULT OVERLAY */}
        {state === "STEP_RESULT" && (
          <div className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${stepCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <div className={`bg-white p-8 rounded-3xl shadow-2xl text-center border-4 ${stepCorrect ? 'border-green-500' : 'border-red-500'} scale-110 transition-transform`}>
              {stepCorrect ? (
                <>
                  <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black text-green-600 mb-2">CORRECT!</h2>
                  <p className="text-xl font-bold text-slate-600">+{pointsEarned} pts</p>
                </>
              ) : (
                <>
                  <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black text-red-600 mb-2">{timeRemainingMs === 0 && selectedChoice === null ? "TIME OUT" : "INCORRECT"}</h2>
                  <p className="text-lg font-bold text-slate-600 mb-2">Correct Answer:</p>
                  <div className="text-2xl font-bold text-[#001a54] bg-slate-100 px-4 py-2 rounded-xl">{renderMath(correctValue || "")}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (state === "SUMMARY" && summaryData) {
    const { progression } = summaryData;
    return (
      <div className="min-h-screen bg-[#001a54] flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-3xl w-full bg-white rounded-3xl p-8 md:p-12 shadow-2xl text-slate-800 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#fdd400]/20 rounded-full blur-[60px]" />
          
          <h1 className="text-4xl font-black font-['Hanken_Grotesk'] text-[#001a54] mb-2 uppercase tracking-tight">Session Complete</h1>
          
          <div className="flex justify-center gap-8 my-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="text-sm font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Final Score</div>
              <div className="text-5xl font-black text-[#fdd400] drop-shadow-sm">{summaryData.total_points}</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="text-sm font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Accuracy</div>
              <div className="text-5xl font-black text-[#001a54] drop-shadow-sm">{Math.round((summaryData.total_correct / Math.max(1, summaryData.total_steps)) * 100)}%</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl text-left mb-8 shadow-inner">
            <h3 className="text-xs font-mono font-bold text-blue-800 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Lightbulb size={16} /> AI Feedback
            </h3>
            <p className="text-blue-900 leading-relaxed font-medium">
              {summaryData.feedback_text}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-8 mt-4 flex flex-col sm:flex-row gap-4 justify-center">
            {progression.topic_complete ? (
              <button onClick={() => router.push("/topics")} className="btn-primary">
                Return to Dashboard
              </button>
            ) : progression.decision === "advance" && progression.next_node_id ? (
              <button onClick={() => router.push(`/session/${sessionId}/lesson`)} className="btn-primary">
                Next Lesson <ArrowRight size={18} />
              </button>
            ) : progression.go_deeper_available && progression.go_deeper_node ? (
              <button onClick={() => router.push(`/session/${sessionId}/lesson`)} className="btn-primary">
                Review Basics: {progression.go_deeper_node.node_label}
              </button>
            ) : (
              <button onClick={() => router.push(`/session/${sessionId}/lesson`)} className="btn-primary">
                Review Lesson
              </button>
            )}
            <button onClick={() => router.push("/topics")} className="px-6 py-4 rounded-xl font-mono font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors">
              Exit
            </button>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .btn-primary {
            background-color: #001a54;
            color: white;
            padding: 1rem 2rem;
            border-radius: 0.75rem;
            font-family: monospace;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0,26,84,0.15);
          }
          .btn-primary:hover {
            background-color: #001138;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,26,84,0.25);
          }
        `}} />
      </div>
    );
  }

  return null;
}
