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
  const currentProblemIndexRef = useRef(0);
  const currentStepIndexRef = useRef(0);
  // Step state
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [equationRevealed, setEquationRevealed] = useState(false);
  const [isWrongAttempt, setIsWrongAttempt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepAnswers, setStepAnswers] = useState<Record<number, { user: string; correct: string }>>({});
  // Step Result state
  const [stepCorrect, setStepCorrect] = useState<boolean | null>(null);
  const [correctValue, setCorrectValue] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Summary state
  const [summaryData, setSummaryData] = useState<QuizFinishResponse | null>(null);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  const timerFrozenRef = useRef(false);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Streak
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1.0);
  const [streakAtRisk, setStreakAtRisk] = useState(0);

  // 1. Initial Load
  const hasFetched = useRef(false);
  useEffect(() => {
    async function load() {
      if (hasFetched.current) return;
      hasFetched.current = true;
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
          if (timerFrozenRef.current) return prev;
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
    setStepAnswers({});
    setState("STEP");
    timerFrozenRef.current = false;
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

      if (choice !== null) {
        setStepAnswers(prev => ({ 
          ...prev, 
          [currentStep.step_index]: { user: choice, correct: res.correct_value } 
        }));
      }

      const preWrongStreak = currentStreak;
      setTotalPoints(res.total_points);
      setCurrentStreak(res.current_streak);
      setStreakMultiplier(res.streak_multiplier);

      if (!res.correct && choice !== null) {
        // Wrong attempt: lock in, reveal correct answer, move on
        setStreakAtRisk(preWrongStreak);
        setStepCorrect(false);
        setCorrectValue(res.correct_value);
        setPointsEarned(0);
        setCurrentStreak(0);
        setStreakMultiplier(1.0);
        setState("STEP_RESULT");
        advanceTimerRef.current = setTimeout(() => advanceToNext(), 2500);
        return;
      }

      // Correct or Timeout
      setStepCorrect(res.correct);
      setCorrectValue(res.correct_value);
      setPointsEarned(res.points_earned);
      setCurrentStreak(res.current_streak);
      setStreakMultiplier(res.streak_multiplier);
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
      setCurrentStreak(0);
      setStreakMultiplier(1.0);
      setState("STEP_RESULT");
      setTimeout(() => advanceToNext(), 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceToNext = async () => {
    const probIdx = currentProblemIndexRef.current;
    const stepIdx = currentStepIndexRef.current;
    const problem = problems[probIdx];

    if (stepIdx < problem.steps.length - 1) {
      const nextStep = problem.steps[stepIdx + 1];
      currentStepIndexRef.current = stepIdx + 1;
      setCurrentStepIndex(stepIdx + 1);
      setHintText(null);
      setIsWrongAttempt(false);
      setSelectedChoice(null);
      setTimeRemainingMs(nextStep.timer_ms);
      setState("STEP");
    } else if (probIdx < problems.length - 1) {
      currentProblemIndexRef.current = probIdx + 1;
      currentStepIndexRef.current = 0;
      setCurrentProblemIndex(probIdx + 1);
      setCurrentStepIndex(0);
      setState("INTRO");
    } else {
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

  const buyHint = async (type: "hint") => {
    try {
      const res = await useQuizHint({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        hint_type: type,
      });
      setTotalPoints(res.total_points);
      if (type === "hint") setHintText(res.hint_text);
    } catch (err: any) {
      if (err.status === 400) {
        alert("Not enough points!");
      } else {
        console.error(err);
      }
    }
  };

  const requiresTextInput = (val: string) => {
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) || withoutLatex.includes(",");
  };

  const renderMath = (expr: string | null | undefined, autoFormat: boolean = false) => {
    if (!expr) return null;
    let text = expr;
    if (autoFormat && !requiresTextInput(text) && !text.includes("$")) {
      text = `$${text}$`;
    }
    const inline = text.replace(/\$\$(.+?)\$\$/g, (_, inner) => `$${inner}$`);
    const clean = inline.replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2").replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2");
    return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{clean}</ReactMarkdown>;
  };

  if (state === "LOADING") {
    return (
      <div className="min-h-screen bg-[#1b261c] flex flex-col items-center justify-center font-['Manrope'] p-8">
        <div className="bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 max-w-sm w-full text-center shadow-[8px_8px_0px_0px_#1F2720]">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#e6e8ea] rounded-full" />
            <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-black font-['Hanken_Grotesk'] tracking-widest uppercase text-[#1F2720]">Loading Quiz</h2>
        </div>
      </div>
    );
  }

  if (state === "INTRO") {
    return (
      <div className="min-h-screen bg-[#1b261c] flex flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden font-['Manrope']">
        <div className="absolute top-6 right-6 md:top-8 md:right-8 z-20">
          <button
            onClick={() => router.push(`/session/${sessionId}/lesson`)}
            className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#fdd400] hover:bg-[#ffe170] px-4 py-2 rounded-xl border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider"
          >
            Exit
          </button>
        </div>
        <div className="max-w-5xl w-full text-center space-y-8 bg-[#faf8f5] p-8 md:p-12 rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative mx-4">
          <div className="inline-block bg-[#1F2720] px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase text-[#fdd400] shadow-[2px_2px_0px_0px_#fdd400]">
            Problem {currentProblemIndex + 1} of {problems.length}
          </div>
          <div className="text-xl md:text-3xl font-['Hanken_Grotesk'] font-black leading-relaxed text-[#1F2720] markdown-content px-4">
            {renderMath(currentProblem.word_problem_text || "")}
          </div>
          <button
            onClick={handleStartProblem}
            className="mt-12 bg-[#fdd400] text-[#1F2720] border-[4px] border-[#1F2720] w-full py-4 rounded-[24px] font-black uppercase tracking-wider text-lg hover:-translate-y-0.5 active:translate-y-1 active:shadow-[2px_2px_0px_0px_#1F2720] transition-all shadow-[6px_6px_0px_0px_#1F2720]"
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
      <div className="min-h-screen bg-[#1b261c] flex flex-col relative overflow-hidden font-['Manrope']">
        {/* Top Bar */}
        <div className="bg-[#faf8f5] p-4 border-b-[4px] border-[#1F2720] shadow-sm flex items-center justify-between z-10 relative">
          <div className="font-black text-[#1F2720] text-sm uppercase tracking-widest flex items-center gap-2">
            Points <span className="text-lg text-[#1F2720] bg-[#fdd400] border-2 border-[#1F2720] px-2.5 py-0.5 rounded shadow-[2px_2px_0px_0px_#1F2720]">{totalPoints}</span>
            <div className="flex items-center gap-1 bg-orange-100 border-2 border-[#1F2720] px-2.5 py-0.5 rounded shadow-[2px_2px_0px_0px_#1F2720]">
              <span className="text-base leading-none">🔥</span>
              <span className="text-sm text-[#1F2720]">{currentStreak}</span>
              {streakMultiplier > 1.0 && (
                <span className="text-orange-600 text-xs">{streakMultiplier}×</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-black text-[#1F2720] bg-white px-3 py-1.5 rounded-xl border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
              <Timer size={18} className="text-red-500" />
              {(timeRemainingMs / 1000).toFixed(1)}s
            </div>
            <button
              onClick={() => router.push(`/session/${sessionId}/lesson`)}
              className="font-['Manrope'] text-[10px] text-[#1F2720] bg-white hover:bg-slate-100 px-3 py-2 rounded-xl border-2 border-[#1F2720] shadow-[2.5px_2.5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="h-2 bg-slate-200 w-full z-10 relative border-b-2 border-[#1F2720]/10">
          <div
            className="h-full bg-red-500 transition-all duration-100 ease-linear"
            style={{ width: `${Math.max(0, progressPct)}%` }}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full z-10 relative space-y-6">
          {equationRevealed && (
            <div className="bg-[#fdd400]/20 border-[3px] border-[#fdd400] px-6 py-3 rounded-2xl shadow-[4px_4px_0px_0px_#1F2720]">
              <div className="text-[10px] font-black text-[#1F2720] uppercase tracking-widest mb-1 text-center">Problem Equation</div>
              <div className="text-xl font-bold text-[#1F2720]">{renderMath(currentProblem.problem_expr)}</div>
            </div>
          )}

          <div className="text-center space-y-2 w-full">
            <div className="text-lg md:text-xl font-bold text-[#1F2720] bg-[#faf8f5] p-4 rounded-2xl border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720]">
              {renderMath(currentProblem.word_problem_text || "")}
            </div>
          </div>

          <div className="text-center space-y-4 w-full">
            <h2 className="text-[11px] font-black text-emerald-800 bg-emerald-100 border-2 border-[#1F2720] inline-block px-3 py-1 rounded-md uppercase tracking-widest">{renderMath(currentStep.instruction)}</h2>
            <div className="text-3xl md:text-4xl bg-white border-[4px] border-[#1F2720] p-6 rounded-3xl shadow-[6px_6px_0px_0px_#1F2720] text-[#1F2720] font-black flex justify-center markdown-content">
              {renderMath(currentStep.blank_expression.replace("?", "\\_\\_\\_"), true)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
            {currentStep.choices.map((choice, idx) => {
              const isSelected = selectedChoice === choice;
              let btnClass = "border-[#1F2720] text-[#1F2720] hover:bg-slate-50 shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1F2720]";

              if (isSelected) {
                if (isSubmitting) btnClass = "border-[#1F2720] bg-[#fdd400] text-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720]";
                else if (state === "STEP_RESULT" && stepCorrect) btnClass = "border-[#1F2720] bg-[#79ff8f] text-green-900 shadow-[4px_4px_0px_0px_#1F2720]";
                else if (isWrongAttempt || (state === "STEP_RESULT" && !stepCorrect)) btnClass = "border-[#1F2720] bg-red-400 text-red-900 opacity-80 shadow-[4px_4px_0px_0px_#1F2720]";
              } else if (isSubmitting || state === "STEP_RESULT") {
                btnClass = "border-[#1F2720] text-slate-400 bg-slate-100 opacity-50 shadow-[4px_4px_0px_0px_#1F2720]"; // disabled visual
              }

              return (
                <button
                  key={idx}
                  disabled={state === "STEP_RESULT" || isSubmitting}
                  onClick={() => {
                    setSelectedChoice(choice);
                    handleSubmit(choice);
                  }}
                  className={`p-5 md:p-6 text-xl bg-white border-[3px] rounded-2xl font-bold transition-all cursor-pointer ${btnClass} flex justify-center items-center markdown-content`}
                >
                  {renderMath(choice, true)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 justify-center w-full">
            <button
              onClick={() => buyHint("hint")}
              disabled={hintText !== null || state === "STEP_RESULT" || isSubmitting}
              className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-3 bg-[#faf8f5] border-2 border-[#1F2720] text-[#1F2720] rounded-xl shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] disabled:opacity-50 disabled:shadow-[3px_3px_0px_0px_#1F2720] transition-all cursor-pointer"
            >
              <Lightbulb size={16} /> Hint (750 pts)
            </button>
            <button
              onClick={async () => {
                if (totalPoints < 750) {
                  alert("Not enough points!");
                  return;
                }
                timerFrozenRef.current = true;
                setTimeout(() => { timerFrozenRef.current = false; }, 10_000);
                try {
                  const res = await useQuizHint({
                    quiz_session_id: quizSessionId,
                    problem_id: currentProblem.id,
                    step_index: currentStep.step_index,
                    hint_type: "freeze",
                  });
                  setTotalPoints(res.total_points);
                } catch (err: any) {
                  timerFrozenRef.current = false;
                  alert("Not enough points!");
                }
              }}
              disabled={timerFrozenRef.current || state === "STEP_RESULT" || isSubmitting}
              className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-3 bg-blue-100 border-2 border-[#1F2720] text-blue-900 rounded-xl shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] disabled:opacity-50 transition-all cursor-pointer"
            >
              ❄️ Freeze Timer (750 pts)
            </button>
            {timeRemainingMs === 0 && (
              <button
                onClick={handleSkip}
                disabled={state === "STEP_RESULT" || isSubmitting}
                className="flex items-center gap-2 font-black text-xs uppercase tracking-wider px-4 py-3 bg-red-400 border-2 border-[#1F2720] text-red-900 rounded-xl shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] disabled:opacity-50 transition-all cursor-pointer"
              >
                <SkipForward size={16} /> Skip Step
              </button>
            )}
          </div>

          {hintText && (
            <div className="bg-[#ffe170] border-[4px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] text-[#1F2720] p-4 rounded-2xl max-w-xl flex items-start gap-3">
              <img src="/suri-snake-left.png" alt="Suri" className="h-10 w-auto object-contain shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#1F2720] mb-1">SURI ss-says:</p>
                <p className="font-bold text-sm md:text-base">{hintText}</p>
              </div>
            </div>
          )}

          {currentStepIndex > 0 && (
            <div className="w-full bg-[#faf8f5] rounded-2xl p-5 border-[3.5px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] space-y-3 opacity-90 mt-8">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-[#1F2720]/10 pb-2">Previous Steps</h3>
              {currentProblem.steps.slice(0, currentStepIndex).reverse().map((s, idx) => {
                const filledExpr = s.blank_expression.replace("?", s.correct_value);
                const userAnswer = stepAnswers[s.step_index]?.user;
                const correctAnswer = stepAnswers[s.step_index]?.correct;
                const isCorrect = userAnswer !== undefined && correctAnswer !== undefined &&
                  userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm border-b border-slate-200 last:border-0 pb-3 pt-1 last:pb-0 gap-3">
                    <span className="text-[#1F2720] font-bold text-xs">{renderMath(s.instruction)}</span>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border-2 border-[#1F2720]">
                        <span className="font-black text-slate-400 text-[10px] uppercase">Question:</span>
                        <span className="font-black text-[#1F2720] text-sm md:text-base">{renderMath(s.correct_value, true)}</span>
                        <span className="text-[#1F2720]/30 font-black">|</span>
                        <span className="font-black text-[#1F2720]">{renderMath(filledExpr, true)}</span>
                      </div>
                      {userAnswer !== undefined && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border-2 border-[#1F2720]">
                          <span className="font-black text-slate-400 text-[10px] uppercase">Your Answer:</span>
                          <span className={`font-black text-sm md:text-base ${isCorrect ? "text-green-600" : "text-red-500"}`}>
                            {renderMath(userAnswer, true)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP RESULT OVERLAY */}
        {state === "STEP_RESULT" && (
          <div className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${stepCorrect ? 'bg-[#79ff8f]/20' : 'bg-red-500/20'}`}>
            <div className={`bg-[#faf8f5] p-8 rounded-[32px] shadow-[8px_8px_0px_0px_#1F2720] text-center border-[4px] border-[#1F2720] scale-110 transition-transform`}>
              {stepCorrect ? (
                <>
                  <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black font-['Hanken_Grotesk'] text-[#1F2720] mb-2 uppercase">CORRECT!</h2>
                  <p className="text-xl font-black text-green-600 bg-green-100 border-2 border-[#1F2720] px-4 py-1 inline-block rounded-lg shadow-[2px_2px_0px_0px_#1F2720]">+{pointsEarned} pts</p>
                  {currentStreak >= 2 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <span className="text-2xl">🔥</span>
                      <span className="font-black text-orange-600 text-sm uppercase tracking-wider">{currentStreak} streak · {streakMultiplier}×</span>
                    </div>
                  )}
                  {currentStreak === 1 && (
                    <p className="mt-3 text-xs font-black text-slate-400 uppercase tracking-widest">Streak started — keep going!</p>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-black font-['Hanken_Grotesk'] text-[#1F2720] mb-2 uppercase">{timeRemainingMs === 0 && selectedChoice === null ? "TIME OUT" : "INCORRECT"}</h2>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 mt-4">Correct Answer:</p>
                  <div className="text-2xl font-black text-[#1F2720] bg-white border-2 border-[#1F2720] px-6 py-3 inline-block rounded-xl shadow-[3px_3px_0px_0px_#1F2720] markdown-content">{renderMath(correctValue || "", true)}</div>
                
                  {!stepCorrect && streakAtRisk > 0 && (
                    <button
                      onClick={async () => {
                        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
                        try {
                          const res = await useQuizHint({
                            quiz_session_id: quizSessionId,
                            problem_id: currentProblem.id,
                            step_index: currentStep.step_index,
                            hint_type: "save_streak",
                            saved_streak: streakAtRisk,
                          });
                          setTotalPoints(res.total_points);
                          setCurrentStreak(streakAtRisk);
                          const mult = Math.round((1.0 + Math.max(0, streakAtRisk - 1) * 0.1) * 100) / 100;
                          setStreakMultiplier(mult);
                          setStreakAtRisk(0);
                        } catch (err: any) {
                          console.log("save streak error:", err, err.status, err.detail);
                          alert("Not enough points!");
                        }
                        advanceTimerRef.current = setTimeout(() => advanceToNext(), 1500);
                      }}
                      className="mt-4 flex items-center gap-2 mx-auto font-black text-xs uppercase tracking-wider px-4 py-3 bg-orange-100 border-2 border-[#1F2720] text-orange-900 rounded-xl shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      🔥 Save Streak (1000 pts)
                    </button>
                  )}
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
      <div className="min-h-screen bg-[#1b261c] flex flex-col items-center justify-center p-6 text-[#1F2720] font-['Manrope']">
        <div className="max-w-3xl w-full bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-8 md:p-12 shadow-[8px_8px_0px_0px_#1F2720] text-center relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />

          <span className="font-black text-[10px] text-[#1F2720] bg-[#fdd400] border-2 border-[#1F2720] px-4.5 py-1.5 rounded-md uppercase tracking-widest shadow-[2px_2px_0px_0px_#1F2720]">SESSION COMPLETE</span>

          <h1 className="text-4xl font-black font-['Hanken_Grotesk'] text-[#1F2720] mt-4 mb-2 tracking-tight">Quiz Results</h1>

          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 my-8">
            <div className="bg-white p-6 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] flex-1">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Final Score</div>
              <div className="text-5xl font-black text-[#1F2720] drop-shadow-sm">{summaryData.total_points}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] flex-1">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Accuracy</div>
              <div className="text-5xl font-black text-[#1F2720] drop-shadow-sm">{Math.round((summaryData.total_correct / Math.max(1, summaryData.total_steps)) * 100)}%</div>
            </div>
          </div>

          <div className="bg-[#ffe170] border-[4px] border-[#1F2720] p-5 rounded-2xl text-left mb-8 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4">
            <img src="/suri-snake-left.png" alt="Suri" className="h-14 w-auto object-contain shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#1F2720] mb-2">SURI ss-says:</p>
              <p className="text-[#1F2720] font-bold text-sm leading-relaxed">
                {summaryData.feedback_text}
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
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
                Review Basics
              </button>
            ) : (
              <button onClick={() => router.push(`/session/${sessionId}/lesson`)} className="btn-primary">
                Review Lesson
              </button>
            )}
            <button onClick={() => router.push(`/session/${sessionId}/lesson`)} className="bg-white text-[#1F2720] border-[4px] border-[#1F2720] px-8 py-4 text-xs font-black uppercase rounded-[24px] tracking-wider transition-all cursor-pointer shadow-[6px_6px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-1 active:translate-x-1 active:shadow-[2px_2px_0px_0px_#1F2720]">
              Exit Quiz
            </button>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
          .btn-primary {
            background-color: #fdd400;
            color: #1F2720;
            border: 4px solid #1F2720;
            padding: 1rem 2rem;
            border-radius: 24px;
            font-weight: 900;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 6px 6px 0px 0px #1F2720;
            transition: all 0.15s ease-in-out;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            background-color: #ffe170;
          }
          .btn-primary:active {
            transform: translate(4px, 4px);
            box-shadow: 2px 2px 0px 0px #1F2720;
          }
          .markdown-content .katex {
            font-size: 1.1em;
          }
        `}} />
      </div>
    );
  }

  return null;
}
