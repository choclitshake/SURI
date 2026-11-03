"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getSession,
  startQuiz,
  submitQuizStep,
  skipQuizStep,
  useQuizHint as purchaseQuizHint,
  finishQuiz,
  QuizProblem,
  QuizFinishResponse,
  ApiError,
} from "../../../../lib/api";
import PointsNotice, { type PointsNoticeData } from "@/components/quiz/PointsNotice";
import { useTutorial } from "@/components/tutorial/TutorialProvider";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import {
  Timer,
  Lightbulb,
  SkipForward,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Flame,
  Sparkles,
  BookOpen,
  Snowflake,
  ChevronDown,
} from "lucide-react";

type QuizState =
  | "LOADING"
  | "INTRO"
  | "STEP"
  | "STEP_SEALED"
  | "SUMMARY";

// Verdicts stay hidden during the quiz; the ledger reveals them on Quiz Complete.
type RuneOutcome = "correct" | "wrong" | "skipped" | "timeout";

type RuneRecord = {
  problemIndex: number;
  stepIndex: number;
  answer: string | null;
  correctValue: string;
  outcome: RuneOutcome;
  points: number;
};

const OUTCOME_LABEL: Record<RuneOutcome, string> = {
  correct: "Forged",
  wrong: "Cracked",
  skipped: "Skipped",
  timeout: "Time ran out",
};

const SEAL_DELAY_MS = 700;

const QUIZ_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

  .quiz-forge {
    min-height: 100vh;
    min-height: 100dvh;
    padding: clamp(10px, 1.5vw, 18px);
    background:
      radial-gradient(circle at 50% 0%, rgba(250,204,96,0.18), transparent 28%),
      linear-gradient(135deg, #1b0e12 0%, #392016 42%, #151025 100%);
    color: #fff4d5;
    font-family: Georgia, 'Times New Roman', serif;
    position: relative;
    overflow-x: hidden;
  }

  .quiz-forge::before {
    content: "";
    position: fixed;
    inset: 8px;
    z-index: 0;
    pointer-events: none;
    background: rgba(0,0,0,0.36);
  }

  .quiz-forge::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 22%, rgba(255,211,92,0.12), transparent 24%),
      radial-gradient(circle at 84% 18%, rgba(155,67,207,0.16), transparent 26%),
      url('/login/arena.png') center bottom / cover no-repeat;
    opacity: .38;
    mix-blend-mode: screen;
  }

  .quiz-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  /* =========================
     HUD
  ========================= */

  .quiz-hud {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 112px;
    margin-bottom: 18px;
    padding: 18px clamp(16px, 3vw, 34px);

    border-radius: 0 0 26px 26px;

    background:
      linear-gradient(
        90deg,
        #70411f 0 16px,
        transparent 16px calc(100% - 16px),
        #70411f calc(100% - 16px)
      ),
      linear-gradient(
        180deg,
        #8b5527 0 14px,
        transparent 14px calc(100% - 14px),
        #8b5527 calc(100% - 14px)
      ),
      linear-gradient(
        180deg,
        rgba(252,229,177,0.97),
        rgba(235,189,105,0.97)
      );

    box-shadow:
      0 12px 0 rgba(39,18,10,0.84),
      0 24px 42px rgba(0,0,0,0.38),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255,198,92,0.18);
  }

  .quiz-hud::before {
    content: "";
    position: absolute;
    inset: 13px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 0 0 18px 18px;
    pointer-events: none;
  }

  .quiz-title-block {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .quiz-suri {
    height: 68px;
    width: auto;
    object-fit: contain;
    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 10px 18px rgba(76,194,117,0.44));
  }

  .quiz-eyebrow {
    display: block;
    color: #6c278e;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }

  .quiz-title {
    color: #3a2111;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(26px, 3.5vw, 40px);
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 2px 0 rgba(255,255,255,0.45);
  }

  .quiz-subtitle {
    margin-top: 6px;
    color: #4e3477;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .8px;
  }

  .quiz-hud-right {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .quiz-stat {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 6px 11px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;

    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
  }

  .quiz-stat.timer {
    background:
      linear-gradient(
        180deg,
        #ffe4e1,
        #ffaaa1 58%,
        #c74a42
      );
  }

  .quiz-stat.streak {
    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );
  }

  .quiz-exit {
    position: relative;
    z-index: 1;

    min-height: 42px;
    padding: 0 16px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    font-weight: 900;

    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
    transition: transform .12s ease, filter .12s ease;
    cursor: pointer;
  }

  .quiz-exit:hover {
    transform: translateY(-2px);
    filter: brightness(1.04);
  }

  /* =========================
     TIMER
  ========================= */

  .quiz-timer-track {
    position: relative;
    z-index: 2;
    height: 10px;
    margin: -18px 14px 18px;
    overflow: hidden;

    border: 2px solid #5e3619;
    background: #24130d;

    box-shadow:
      0 4px 0 #160b07,
      inset 0 0 0 1px rgba(255,255,255,.08);
  }

  .quiz-timer-fill {
    height: 100%;
    background:
      linear-gradient(
        90deg,
        #7f2cad,
        #ffd35c,
        #9df2a7
      );

    transition: width .1s linear;
  }

  /* =========================
     FORGE CARDS
  ========================= */

  .quiz-card {
    position: relative;
    z-index: 1;

    border: 5px solid #5e3619;

    background:
      linear-gradient(
        90deg,
        rgba(25,12,8,0.94),
        rgba(83,46,24,0.96),
        rgba(25,12,8,0.94)
      ),
      repeating-linear-gradient(
        90deg,
        rgba(255,255,255,0.035) 0 2px,
        transparent 2px 66px
      );

    box-shadow:
      0 9px 0 #160b07,
      inset 0 0 0 3px rgba(245,199,93,0.28);

    padding: 14px;
  }

  .quiz-panel {
    border: 3px solid #8e5b20;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow:
      inset 0 0 0 3px rgba(20,9,5,0.55),
      inset 0 1px 0 rgba(255,255,255,0.12);

    padding: clamp(14px, 2vw, 20px);
  }

  .quiz-panel + .quiz-panel {
    margin-top: 14px;
  }

  .quiz-panel-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;

    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-scroll {
    border: 2px solid #9c672b;

    background:
      radial-gradient(
        circle at 18% 12%,
        rgba(255,255,255,0.32),
        transparent 26%
      ),
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #2b170d;

    box-shadow:
      inset 0 0 0 2px rgba(89,48,18,0.14);

    padding: clamp(14px, 2vw, 22px);
  }

  .quiz-step-instruction {
    font-family: 'Nunito', sans-serif;
    font-size: clamp(15px, 1.6vw, 18px);
    font-weight: 700;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .quiz-instruction-label {
    margin: 0 0 6px;
    color: #81511f;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-expression {
    display: flex;
    justify-content: center;
    align-items: center;

    min-height: 82px;

    color: #28150c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(22px, 3vw, 34px);
    font-weight: 900;
  }

  /* =========================
     INTRO
  ========================= */

  .quiz-intro {
    width: min(850px, 100%);
    margin: 40px auto;
  }

  .quiz-intro-suri {
    height: 105px;
    width: auto;
    margin: 0 auto 10px;
    object-fit: contain;

    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 12px 20px rgba(76,194,117,.38));
  }

  .quiz-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 5px 10px;

    border: 2px solid #6d411c;
    border-radius: 7px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .7px;
  }

  .quiz-intro-text {
    color: #3b1b6e;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(17px, 2vw, 23px);
    font-weight: 900;
    line-height: 1.6;
  }

  /* =========================
     QUESTION AREA
  ========================= */

  .quiz-main {
    width: min(930px, 100%);
    margin: 0 auto;
  }

  .quiz-question {
    margin-top: 14px;
    color: #3b1b6e;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(15px, 1.35vw, 18px);
    font-weight: 900;
    line-height: 1.6;
  }

  .quiz-step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;

    padding-bottom: 10px;
    border-bottom: 2px solid rgba(255,226,136,0.18);
  }

  .quiz-step-title {
    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;

    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .quiz-step-rune {
    width: 48px;
    height: 48px;

    display: grid;
    place-items: center;

    border: 3px solid #725131;
    border-radius: 12px;

    background:
      linear-gradient(
        180deg,
        #69574a,
        #33271f
      );

    color: #fff6dc;

    box-shadow: 0 5px 0 #1b0f0a;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 20px;
  }

  .quiz-answer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .quiz-answer {
    min-height: 74px;
    padding: 14px;

    border: 3px solid #8e5b20;
    border-radius: 0;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow: inset 0 0 0 3px rgba(20,9,5,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
    border: 3px solid #6d411c;
    border-radius: 8px;


    color: #ffffff;

    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(18px, 2vw, 25px);
    font-weight: 900;


    transition:
      transform .12s ease,
      filter .12s ease,
      box-shadow .12s ease;
    cursor: pointer;
  }

  /* Hover lifts only on pointer devices so a tap on a tablet doesn't leave a
     choice stuck in its hover state. */
  @media (hover: hover) {
    .quiz-answer:hover:not(:disabled) {
      transform: translateY(-3px);
      filter: brightness(1.06);
    }

    .quiz-action:hover:not(:disabled) {
      transform: translateY(-2px);
      filter: brightness(1.06);
    }
  }

  .quiz-answer,
  .quiz-action,
  .quiz-exit {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  @media (pointer: coarse) {
    .quiz-exit,
    .quiz-action {
      min-height: 48px;
    }
  }

  .quiz-answer:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow:
      0 2px 0 #28150c,
      inset 0 0 0 2px rgba(255,255,255,.24);
  }

  /* Selection is gold, never green: green would read as "correct" before the reveal. */
  .quiz-answer.selected {
    border-color: #ffe288;

    background:
      linear-gradient(
        180deg,
        #8a5bc0 0%,
        #5b2f8a 55%,
        #32174f 100%
      );

    box-shadow:
      0 6px 0 #1d0c2e,
      0 10px 22px rgba(255,211,92,.22);
  }

  .quiz-answer:focus-visible {
    outline: 3px solid #ffe288;
    outline-offset: 3px;
  }

  .quiz-answer.disabled {
    filter: grayscale(.65);
    opacity: .45;
    cursor: not-allowed;
  }

  /* =========================
     SUBMIT ROW
  ========================= */

  .quiz-submit-row {
    display: flex;
    justify-content: center;
    margin-top: 14px;
  }

  .quiz-action.submit-rune {
    min-width: 220px;
    font-size: 17px;
  }

  /* =========================
     ACTIONS
  ========================= */

  .quiz-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 16px;
  }

  .quiz-action {
    min-height: 46px;
    padding: 0 15px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    border: 3px solid #6d411c;
    border-radius: 8px;

    background:
      linear-gradient(
        180deg,
        #fff6aa,
        #ffd35c 58%,
        #c7832e
      );

    color: #321008;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    font-weight: 900;

    box-shadow: 0 5px 0 #28150c;

    transition:
      transform .12s ease,
      filter .12s ease;
    cursor: pointer;
  }

  .quiz-action:active:not(:disabled) {
    transform: translateY(3px);
  }

  .quiz-action.freeze {
    background:
      linear-gradient(
        180deg,
        #dceeff,
        #82b7e8 58%,
        #4779b1
      );

    color: #102b4d;
  }

  .quiz-action.skip {
    background:
      linear-gradient(
        180deg,
        #ffb6ae,
        #e76c65 58%,
        #9f302f
      );

    color: #3b0908;
  }

  .quiz-action:focus-visible {
    outline: 3px solid #ffe288;
    outline-offset: 4px;
  }

  .quiz-action.sealed:disabled {
    opacity: 1;
    filter: none;
    background:
      linear-gradient(
        180deg,
        #c9a6f0,
        #8749b7 58%,
        #4c2470
      );
    color: #fff4d5;
  }

  .quiz-sealed-note {
    margin-top: 10px;
    text-align: center;

    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 800;
  }

  .quiz-action:disabled {
    opacity: .45;
    filter: grayscale(.5);
    cursor: not-allowed;
  }

  /* =========================
     HINT
  ========================= */

  .quiz-hint {
    margin: 16px auto 0;
    max-width: 680px;

    display: flex;
    align-items: flex-start;
    gap: 12px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    color: #f7dfad;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(255,226,136,.12);

    padding: 14px;
  }

  .quiz-hint img {
    height: 48px;
    width: auto;
    object-fit: contain;

    filter:
      drop-shadow(2px 0 0 #17100a)
      drop-shadow(-2px 0 0 #17100a);
  }

  .quiz-hint-title {
    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-hint-text {
    margin-top: 4px;

    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.5;
  }

  /* =========================
     PREVIOUS STEPS
  ========================= */

  .quiz-history {
    margin-top: 16px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(20,9,5,.55);

    padding: 14px;
  }

  .quiz-history-title {
    display: flex;
    align-items: center;
    gap: 7px;

    color: #ffe8a2;

    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;

    padding-bottom: 9px;
    border-bottom: 2px solid rgba(255,226,136,.18);
  }

  .quiz-history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    padding: 11px 0;

    border-bottom: 1px solid rgba(255,226,136,.12);

    color: #f7dfad;

    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 800;
  }

  .quiz-history-row:last-child {
    border-bottom: 0;
  }

  .quiz-history-answer {
    display: flex;
    align-items: center;
    gap: 8px;

    padding: 6px 9px;

    border: 2px solid #9c672b;

    background:
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #28150c;

    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 900;
  }

  /* =========================
     RUNE LEDGER (Quiz Complete review)
  ========================= */

  .quiz-ledger {
    margin-top: 26px;
    text-align: left;
  }

  .quiz-ledger-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid rgba(255,226,136,.22);
  }

  .quiz-ledger-title {
    color: #ffe8a2;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(22px, 3vw, 28px);
    line-height: 1.1;
  }

  .quiz-ledger-tally {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .quiz-ledger-problem {
    margin-top: 14px;
    border: 3px solid #8e5b20;
    background: linear-gradient(180deg, #4a2a18, #24130d);
    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(20,9,5,.55);
  }

  .quiz-ledger-problem > :not(summary) {
    margin-left: clamp(12px, 2vw, 18px);
    margin-right: clamp(12px, 2vw, 18px);
  }

  .quiz-ledger-problem > ol {
    padding-bottom: clamp(10px, 1.6vw, 14px);
  }

  /* Each problem is a native disclosure: keyboard, screen reader and touch
     support come for free, and the page stays short until a problem is opened. */
  .quiz-ledger-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 10px clamp(12px, 2vw, 18px);
    cursor: pointer;
    list-style: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .quiz-ledger-summary::-webkit-details-marker {
    display: none;
  }

  .quiz-ledger-summary:focus-visible {
    outline: 3px solid #ffe288;
    outline-offset: -3px;
  }

  .quiz-ledger-problem[open] > .quiz-ledger-summary {
    border-bottom: 2px solid rgba(255,226,136,.18);
  }

  .quiz-ledger-chevron {
    color: #ffe8a2;
    transition: transform .3s cubic-bezier(.16,1,.3,1);
  }

  .quiz-ledger-problem[open] .quiz-ledger-chevron {
    transform: rotate(180deg);
  }

  @media (hover: hover) {
    .quiz-ledger-summary:hover {
      background: rgba(255,226,136,.06);
    }
  }

  .quiz-ledger-problem-title {
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }

  .quiz-ledger-problem-text {
    margin-top: 12px;
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.55;
    max-width: 70ch;
  }

  .quiz-ledger-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,226,136,.14);
    animation: quiz-ledger-in .5s cubic-bezier(.16,1,.3,1) both;
    animation-delay: calc(var(--i, 0) * 70ms);
  }

  .quiz-ledger-row:last-child {
    border-bottom: 0;
    padding-bottom: 2px;
  }

  @keyframes quiz-ledger-in {
    from { opacity: 0; transform: translateY(8px); filter: blur(3px); }
    to { opacity: 1; transform: none; filter: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .quiz-ledger-row { animation: none; }
  }

  .quiz-ledger-num {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 3px solid #6d411c;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }

  .quiz-ledger-body {
    min-width: 0;
  }

  .quiz-ledger-instruction {
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.45;
  }

  .quiz-ledger-expr {
    margin-top: 8px;
    padding: 8px 12px;
    border: 2px solid #9c672b;
    background: linear-gradient(180deg, #fff0bf, #dec07b);
    color: #28150c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(16px, 2vw, 20px);
    font-weight: 900;
    overflow-x: auto;
  }

  .quiz-ledger-answers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .quiz-ledger-answer {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border-radius: 7px;
    border: 2px solid transparent;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 15px;
    font-weight: 900;
  }

  .quiz-ledger-answer-label {
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .quiz-ledger-answer.yours {
    border-color: #c96a5c;
    background: #ffd9d2;
    color: #5a1410;
  }

  .quiz-ledger-answer.yours.is-correct,
  .quiz-ledger-answer.right {
    border-color: #4f9b62;
    background: #d4f5d9;
    color: #0f3d1e;
  }

  .quiz-ledger-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .quiz-ledger-verdict {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 4px 10px;
    border-radius: 7px;
    border: 2px solid;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .6px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .quiz-ledger-points {
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .outcome-correct .quiz-ledger-num,
  .quiz-ledger-verdict.outcome-correct {
    border-color: #4f9b62;
    background: #d4f5d9;
    color: #0f3d1e;
  }

  .outcome-wrong .quiz-ledger-num,
  .quiz-ledger-verdict.outcome-wrong {
    border-color: #c96a5c;
    background: #ffd9d2;
    color: #5a1410;
  }

  .outcome-skipped .quiz-ledger-num,
  .outcome-timeout .quiz-ledger-num,
  .quiz-ledger-verdict.outcome-skipped,
  .quiz-ledger-verdict.outcome-timeout {
    border-color: #9c672b;
    background: #ecdcb6;
    color: #4a3520;
  }

  /* =========================
     SUMMARY
  ========================= */

  .quiz-summary {
    width: min(860px, 100%);
    margin: 45px auto;
    text-align: center;
  }

  .quiz-summary-suri {
    height: 100px;
    width: auto;
    margin: 0 auto 5px;
    object-fit: contain;

    filter:
      drop-shadow(3px 0 0 #17100a)
      drop-shadow(-3px 0 0 #17100a)
      drop-shadow(0 12px 20px rgba(76,194,117,.38));
  }

  .quiz-summary-title {
    color: #ffe8a2;

    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(34px, 5vw, 52px);
    line-height: 1;
  }

  .quiz-summary-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
  }

  .quiz-summary-stat {
    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #fff0bf,
        #dec07b
      );

    color: #28150c;

    padding: 18px;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(89,48,18,.14);
  }

  .quiz-summary-stat-label {
    color: #6c278e;

    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1.3px;
  }

  .quiz-summary-stat-value {
    margin-top: 4px;

    color: #3a2111;

    font-family: "Bree Serif", Georgia, serif;
    font-size: 42px;
  }

  .quiz-feedback {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    margin-top: 16px;

    border: 3px solid #8e5b20;

    background:
      linear-gradient(
        180deg,
        #57321d,
        #24130d
      );

    color: #f7dfad;

    text-align: left;

    box-shadow:
      0 6px 0 #160b07,
      inset 0 0 0 2px rgba(20,9,5,.55);

    padding: 16px;
  }

  .quiz-summary-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    margin-top: 22px;
  }

  /* =========================
     MARKDOWN
  ========================= */

  .markdown-content p {
    margin: 0;
  }

  .markdown-content .katex {
    font-weight: 900 !important;
    color: inherit !important;
  }

  .markdown-content .katex-display {
    margin: .8rem 0 !important;
  }

  /* =========================
     MOBILE
  ========================= */

  @media (max-width: 900px) {
    .quiz-hud {
      grid-template-columns: 1fr;
    }

    .quiz-hud-right {
      justify-content: flex-start;
    }
  }

  @media (max-width: 640px) {
    .quiz-forge {
      padding: 8px;
    }

    .quiz-hud {
      padding: 16px 12px;
    }

    .quiz-title-block {
      align-items: flex-start;
    }

    .quiz-suri {
      height: 55px;
    }

    .quiz-answer-grid {
      grid-template-columns: 1fr;
    }

    .quiz-summary-stats {
      grid-template-columns: 1fr;
    }

    .quiz-history-row {
      align-items: flex-start;
      flex-direction: column;
    }

    .quiz-ledger-row {
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
    }

    .quiz-ledger-num {
      width: 34px;
      height: 34px;
      font-size: 15px;
    }

    .quiz-ledger-side {
      grid-column: 2;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
  }
`;

function ForgeRuneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M32 5 50 15v20L32 59 14 35V15L32 5Z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="M32 5 50 15v20L32 59 14 35V15L32 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M32 15v34M22 24h20L24 42h18"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutcomeIcon({ outcome }: { outcome: RuneOutcome }) {
  const Icon =
    outcome === "correct"
      ? CheckCircle2
      : outcome === "wrong"
        ? XCircle
        : outcome === "skipped"
          ? SkipForward
          : Timer;
  return <Icon className="w-4 h-4" aria-hidden="true" />;
}

export default function QuizPage() {
  const { active: tutorialActive, isPending: isTutorialPending } = useTutorial();
  const tutorialPaused = tutorialActive || isTutorialPending("quiz-step");
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [state, setState] = useState<QuizState>("LOADING");
  const [quizSessionId, setQuizSessionId] = useState<string>("");
  const [problems, setProblems] = useState<QuizProblem[]>([]);

  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointsNotice, setPointsNotice] = useState<PointsNoticeData | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const purchasePendingRef = useRef(false);

  const currentProblemIndexRef = useRef(0);
  const currentStepIndexRef = useRef(0);

  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const [runeLog, setRuneLog] = useState<RuneRecord[]>([]);

  const [summaryData, setSummaryData] =
    useState<QuizFinishResponse | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  const timerFrozenRef = useRef(false);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isTimerFrozen, setIsTimerFrozen] = useState(false);

  const hasFetched = useRef(false);

  useEffect(() => {
    async function load() {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        const session = await getSession(sessionId);

        const data = await startQuiz({
          session_id: sessionId,
          node_id: session.current_node,
        });

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

  // Clean up any pending timers on unmount so callbacks don't fire
  // (or throw) after the component is gone.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (state !== "STEP" || pointsNotice || tutorialPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (timerFrozenRef.current) {
        lastTickRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setTimeRemainingMs((prev) => {
        if (prev <= 0) {
          return 0;
        }

        return Math.max(0, prev - delta);
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state, pointsNotice, tutorialPaused]);

  useEffect(() => {
    if (
      state === "STEP" &&
      timeRemainingMs <= 0 &&
      !isSubmitting &&
      !pointsNotice &&
      !tutorialPaused &&
      !timedOut
    ) {
      handleTimeout();
    }
  }, [state, timeRemainingMs, isSubmitting, timedOut, pointsNotice, tutorialPaused]);

  const currentProblem = problems[currentProblemIndex];
  const currentStep = currentProblem?.steps[currentStepIndex];

  const handleStartProblem = () => {
    setHintText(null);

    setSelectedChoice(null);
    setTimedOut(false);

    setTimeRemainingMs(currentProblem.steps[0].timer_ms);

    timerFrozenRef.current = false;
    setIsTimerFrozen(false);

    setState("STEP");
  };

  // Record the rune's verdict without showing it, then move on after a short beat.
  const sealRune = (record: Omit<RuneRecord, "problemIndex" | "stepIndex">) => {
    setRuneLog((prev) => [
      ...prev,
      {
        problemIndex: currentProblemIndexRef.current,
        stepIndex: currentStep.step_index,
        ...record,
      },
    ]);

    setState("STEP_SEALED");

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => advanceToNext(), SEAL_DELAY_MS);
  };

  const handleTimeout = async () => {
    if (state !== "STEP") return;
    if (isSubmitting) return;

    // Stop the timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Prevent another timeout from firing
    setTimeRemainingMs(0);
    setTimedOut(true);
    setIsSubmitting(true);

    try {
      const res = await submitQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        submitted_value: null,
        time_remaining_ms: 0,
      });

      setTotalPoints(res.total_points);
      setSelectedChoice(null);

      sealRune({
        answer: null,
        correctValue: res.correct_value,
        outcome: "timeout",
        points: 0,
      });
    } catch (err) {
      console.error("Failed to submit timeout:", err);

      // If the timeout request fails, let the user retry/skip
      setTimedOut(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (choice: string | null) => {
    if (state !== "STEP") return;
    if (isSubmitting) return;
    if (timeRemainingMs <= 0) return;

    // Stop timer while submitting
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsSubmitting(true);

    try {
      const res = await submitQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        submitted_value: choice,
        time_remaining_ms: Math.max(0, timeRemainingMs),
      });

      setTotalPoints(res.total_points);

      sealRune({
        answer: choice,
        correctValue: res.correct_value,
        outcome: res.correct ? "correct" : "wrong",
        points: res.points_earned,
      });
    } catch (err) {
      console.error("Error submitting step:", err);

      // Restart timer if submission failed
      if (state === "STEP" && timeRemainingMs > 0) {
        lastTickRef.current = Date.now();
      }

      alert("Error submitting step. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (state !== "STEP") return;
    if (isSubmitting) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsSubmitting(true);

    try {
      const res = await skipQuizStep({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
      });

      sealRune({
        answer: null,
        correctValue: res.correct_value,
        outcome: "skipped",
        points: 0,
      });
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
      setSelectedChoice(null);
      setTimedOut(false);
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
        const res = await finishQuiz({
          quiz_session_id: quizSessionId,
        });

        setSummaryData(res);
        setState("SUMMARY");
      } catch (err) {
        console.error(err);
        alert("Failed to finish quiz.");
      }
    }
  };

  const purchaseBoost = async (type: "hint" | "freeze", opener: HTMLElement) => {
    if (purchasePendingRef.current || pointsNotice) return null;
    const required = 750;
    const action = type === "hint" ? "Hint" : "Freeze Timer";
    const showNotice = (current: number, cost: number, failed = false) => {
      setPointsNotice({ action, required: cost, current, failed, opener });
    };

    if (totalPoints < required) {
      showNotice(totalPoints, required);
      return null;
    }

    purchasePendingRef.current = true;
    setIsPurchasing(true);
    try {
      const res = await purchaseQuizHint({
        quiz_session_id: quizSessionId,
        problem_id: currentProblem.id,
        step_index: currentStep.step_index,
        hint_type: type,
      });
      setTotalPoints(res.total_points);
      return res;
    } catch (err: unknown) {
      const detail = err instanceof ApiError ? err.detail : null;
      if (detail && typeof detail === "object" && "code" in detail &&
          detail.code === "insufficient_points" && "required" in detail &&
          typeof detail.required === "number" && Number.isFinite(detail.required) &&
          "current" in detail && typeof detail.current === "number" && Number.isFinite(detail.current)) {
        setTotalPoints(detail.current);
        showNotice(detail.current, detail.required);
      } else {
        console.error("Failed to purchase quiz boost:", err);
        showNotice(totalPoints, required, true);
      }
      return null;
    } finally {
      purchasePendingRef.current = false;
      setIsPurchasing(false);
    }
  };

  const closePointsNotice = () => {
    setPointsNotice(null);
  };

  const buyHint = async (opener: HTMLElement) => {
    const res = await purchaseBoost("hint", opener);
    if (res) setHintText(res.hint_text);
  };

  const handleFreeze = async (opener: HTMLElement) => {
    if (isTimerFrozen || state !== "STEP" || isSubmitting) return;

    const res = await purchaseBoost("freeze", opener);
    if (res) {

      // Only freeze once the server confirms the purchase.
      timerFrozenRef.current = true;
      setIsTimerFrozen(true);

      if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
      freezeTimeoutRef.current = setTimeout(() => {
        timerFrozenRef.current = false;
        setIsTimerFrozen(false);
      }, 10_000);
    }
  };

  const requiresTextInput = (val: string) => {
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) ||
      withoutLatex.includes(",");
  };

  const renderMath = (
    expr: string | null | undefined,
    autoFormat: boolean = false
  ) => {
    if (!expr) return null;

    let text = expr;

    if (
      autoFormat &&
      !requiresTextInput(text) &&
      !text.includes("$")
    ) {
      text = `$${text}$`;
    }

    const inline = text.replace(
      /\$\$(.+?)\$\$/g,
      (_, inner) => `$${inner}$`
    );

    const clean = inline
      .replace(
        /(\d)\s*\*\*\s*([a-zA-Z])/g,
        "$1$2"
      )
      .replace(
        /([a-zA-Z])\s*\*\*\s*([a-zA-Z])/g,
        "$1$2"
      );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {clean}
      </ReactMarkdown>
    );
  };

  /* =========================
     LOADING
  ========================= */

  if (state === "LOADING") {
    return (
      <div className="quiz-forge flex flex-col items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-card max-w-sm w-full text-center">
          <div className="quiz-panel">
            <img
              src="/suri-snake-left.png"
              alt="Suri"
              className="quiz-intro-suri"
            />

            <div className="relative w-12 h-12 mx-auto mb-5">
              <div className="absolute inset-0 border-4 border-[#6d411c] rounded-full" />
              <div className="absolute inset-0 border-4 border-[#ffe288] border-t-[#8749b7] rounded-full animate-spin" />
            </div>

            <p className="quiz-panel-title justify-center w-full animate-pulse">
              Loading Quiz...
            </p>

            <p className="quiz-hint-text">
              Suri is preparing the next challenge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     INTRO
  ========================= */

  if (state === "INTRO") {
    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">
          <header className="quiz-hud">
            <div className="quiz-title-block">
              <img
                src="/suri-snake-left.png"
                alt="Suri Guide"
                className="quiz-suri select-none shrink-0"
              />

              <div>
                <span className="quiz-eyebrow">
                  Guided Quiz Challenge
                </span>

                <h1 className="quiz-title">
                  Rune Challenge
                </h1>

                <p className="quiz-subtitle">
                  Problem {currentProblemIndex + 1} of {problems.length}
                  {" "} | {" "}
                  Stabilize each rune before the timer runs out
                </p>
              </div>
            </div>

            <div className="quiz-hud-right">
              <button
                onClick={() =>
                  router.push(`/session/${sessionId}/lesson`)
                }
                className="quiz-exit"
              >
                Exit
              </button>
            </div>
          </header>

          <main className="quiz-intro">
            <div className="quiz-card">
              <div className="quiz-panel text-center">
                <span className="quiz-badge">
                  <BookOpen className="w-4 h-4 mr-1" />
                  Quest Problem {currentProblemIndex + 1}
                </span>

                <div className="quiz-scroll mt-4">
                  <div className="quiz-intro-text markdown-content">
                    {renderMath(
                      currentProblem.word_problem_text || ""
                    )}
                  </div>
                </div>

                <button
                  onClick={handleStartProblem}
                  className="quiz-action w-full mt-5"
                  style={{
                    minHeight: "60px",
                    fontSize: "21px",
                  }}
                >
                  Begin Rune Challenge
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* =========================
     STEP + RESULT
  ========================= */

  if (state === "STEP" || state === "STEP_SEALED") {
    const progressPct =
      currentStep && currentStep.timer_ms
        ? (timeRemainingMs / currentStep.timer_ms) * 100
        : 0;

    const isSealed = state === "STEP_SEALED";
    const totalRunes = problems.reduce((sum, p) => sum + p.steps.length, 0);
    const sealedAnswers = new Map(
      runeLog
        .filter((r) => r.problemIndex === currentProblemIndex)
        .map((r) => [r.stepIndex, r.answer])
    );

    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">

          {/* HUD */}

          <header className="quiz-hud">
            <div className="quiz-title-block">
              <img
                src="/suri-snake-left.png"
                alt="Suri Guide"
                className="quiz-suri select-none shrink-0"
              />

              <div>
                <span className="quiz-eyebrow">
                  Rune Forging Challenge
                </span>

                <h1 className="quiz-title">
                  Solve the Rune
                </h1>

                <p className="quiz-subtitle">
                  Problem {currentProblemIndex + 1} of {problems.length}
                  {" "} • {" "}
                  Step {currentStepIndex + 1} of {currentProblem.steps.length}
                </p>
              </div>
            </div>

            <div className="quiz-hud-right">
              {/* Points stay visible for spending on boosts; the streak and
                  every verdict stay sealed until Quiz Complete. */}
              <div className="quiz-stat" aria-label={`${totalPoints} points`}>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {totalPoints} pts
              </div>

              <div
                className="quiz-stat"
                aria-label={`${runeLog.length} of ${totalRunes} runes sealed`}
              >
                <ForgeRuneIcon className="w-4 h-4" />
                {runeLog.length}/{totalRunes} sealed
              </div>

              <div className="quiz-stat timer">
                <Timer className="w-4 h-4" />
                {(timeRemainingMs / 1000).toFixed(1)}s
              </div>

              <button
                onClick={() =>
                  router.push(`/session/${sessionId}/lesson`)
                }
                className="quiz-exit"
              >
                Exit
              </button>
            </div>
          </header>

          {/* TIMER */}

          <div className="quiz-timer-track">
            <div
              className="quiz-timer-fill"
              style={{
                width: `${Math.max(0, progressPct)}%`,
              }}
            />
          </div>

          {/* MAIN */}

          <main className="quiz-main" data-tutorial-scope="quiz-step">

            {/* Quest Context */}

            <section className="quiz-panel">
              <div className="quiz-panel-title">
                <BookOpen className="w-4 h-4" />
                Quest Context
              </div>

              <div className="quiz-scroll quiz-question markdown-content">
                {renderMath(
                  currentProblem.word_problem_text || ""
                )}
              </div>
            </section>

            {/* Current Rune */}

            <section className="quiz-panel">
              <div className="quiz-step-header">
                <div className="flex items-center gap-3">
                  <div className="quiz-step-rune">
                    <ForgeRuneIcon className="w-7 h-7" />
                  </div>

                  <div>
                    <div className="quiz-step-title">
                      Rune {currentStepIndex + 1}
                    </div>

                    <span className="quiz-badge">
                      Algebraic Step
                    </span>
                  </div>
                </div>

                <span className="quiz-badge">
                  {timeRemainingMs > 0
                    ? "Rune Active"
                    : "Rune Expired"}
                </span>
              </div>

              {/* Current step directions must be visible before answering. */}

              <div className="quiz-scroll quiz-step-instruction markdown-content mt-3" id="quiz-step-instruction">
                <h2 className="quiz-instruction-label">Instructions</h2>
                {renderMath(currentStep.instruction)}
              </div>

              {/* Expression */}

              <div className="quiz-scroll quiz-expression markdown-content mt-3">
                {renderMath(
                  currentStep.blank_expression.replace(
                    "?",
                    "\\_\\_\\_"
                  ),
                  true
                )}
              </div>

              {/* Choices */}

              <div className="quiz-answer-grid">
                {currentStep.choices.map((choice, idx) => {
                  const isSelected = selectedChoice === choice;

                  // No correct/wrong styling here: the verdict is revealed
                  // only in the Quiz Complete ledger.
                  let className = "quiz-answer";

                  if (isSelected) {
                    className += " selected";
                  } else if (isSealed || isSubmitting || timedOut) {
                    className += " disabled";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={
                        state !== "STEP" ||
                        isSubmitting ||
                        timedOut ||
                        timeRemainingMs <= 0
                      }
                      onClick={() => {
                        if (state !== "STEP") return;
                        if (isSubmitting) return;
                        if (timedOut) return;
                        if (timeRemainingMs <= 0) return;

                        setSelectedChoice(choice);
                      }}
                      className={className}
                    >
                      <div className="markdown-content">
                        {renderMath(choice, true)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="quiz-submit-row">
                <button
                  type="button"
                  onClick={() => handleSubmit(selectedChoice)}
                  disabled={
                    selectedChoice === null ||
                    state !== "STEP" ||
                    isSubmitting ||
                    timedOut ||
                    timeRemainingMs <= 0
                  }
                  className={`quiz-action submit-rune${isSealed ? " sealed" : ""}`}
                >
                  <CheckCircle2 className="w-4 h-4" />

                  {isSealed
                    ? "Rune Sealed"
                    : isSubmitting
                      ? "Forging..."
                      : "Submit Rune"}
                </button>
              </div>

              <p className="quiz-sealed-note" aria-live="polite">
                {isSealed
                  ? "Sealed. Suri reveals every rune when the quiz is complete."
                  : "Answers stay sealed until the quiz is complete. Points can be spent on boosts."}
              </p>
            </section>

            {/* Actions */}

            <div className="quiz-actions">
              <button
                onClick={(event) => buyHint(event.currentTarget)}
                disabled={
                  hintText !== null ||
                  isPurchasing ||
                  isSealed ||
                  isSubmitting
                }
                className="quiz-action"
              >
                <Lightbulb className="w-4 h-4" />
                Hint · 750 pts
              </button>

              <button
                onClick={(event) => handleFreeze(event.currentTarget)}
                disabled={
                  isTimerFrozen ||
                  isPurchasing ||
                  isSealed ||
                  isSubmitting
                }
                className="quiz-action freeze"
              >
                <Snowflake className="w-4 h-4" />
                {isTimerFrozen
                  ? "Timer Frozen"
                  : "Freeze Timer · 750 pts"}
              </button>

              <button
                onClick={handleSkip}
                disabled={
                  state !== "STEP" ||
                  isSubmitting ||
                  timedOut
                }
                className="quiz-action skip"
              >
                <SkipForward className="w-4 h-4" />
                Skip Rune
              </button>
            </div>

            {/* Hint */}

            {hintText && (
              <div className="quiz-hint">
                <img
                  src="/suri-snake-left.png"
                  alt="Suri"
                />

                <div>
                  <div className="quiz-hint-title">
                    Suri ss-says:
                  </div>

                  <div className="quiz-hint-text">
                    {hintText}
                  </div>
                </div>
              </div>
            )}

            {/* Previous Steps */}

            {currentStepIndex > 0 && (
              <section className="quiz-history">
                <div className="quiz-history-title">
                  <Flame className="w-4 h-4" />
                  Previously Forged Runes
                </div>

                {currentProblem.steps
                  .slice(0, currentStepIndex)
                  .reverse()
                  .map((s, idx) => {
                    // Show the rune as the learner sealed it, never the
                    // correct value, so nothing is revealed mid-quiz.
                    const userAnswer = sealedAnswers.get(s.step_index) ?? null;

                    const filledExpr =
                      userAnswer !== null
                        ? s.blank_expression.replace("?", userAnswer)
                        : s.blank_expression.replace("?", "\\_\\_\\_");

                    return (
                      <div
                        key={idx}
                        className="quiz-history-row"
                      >
                        <span className="markdown-content">
                          {renderMath(s.instruction)}
                        </span>

                        <div className="flex flex-col gap-2">
                          <div className="quiz-history-answer">
                            <span className="text-[9px] uppercase">
                              {userAnswer !== null ? "Sealed as:" : "Left unsealed:"}
                            </span>

                            {renderMath(
                              filledExpr,
                              true
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </section>
            )}
          </main>

          {pointsNotice && <PointsNotice notice={pointsNotice} onClose={closePointsNotice} />}
        </div>
      </div>
    );
  }

  /* =========================
     SUMMARY
  ========================= */

  if (state === "SUMMARY" && summaryData) {
    const { progression } = summaryData;

    const accuracy = Math.round(
      (summaryData.total_correct /
        Math.max(1, summaryData.total_steps)) *
        100
    );

    let bestStreak = 0;
    let streak = 0;
    for (const rune of runeLog) {
      streak = rune.outcome === "correct" ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
    }

    const tally: Record<RuneOutcome, number> = {
      correct: 0,
      wrong: 0,
      skipped: 0,
      timeout: 0,
    };
    for (const rune of runeLog) tally[rune.outcome] += 1;

    const ledger = problems
      .map((problem, problemIndex) => ({
        problem,
        problemIndex,
        runes: runeLog.filter((r) => r.problemIndex === problemIndex),
      }))
      .filter((group) => group.runes.length > 0);

    return (
      <div className="quiz-forge">
        <style dangerouslySetInnerHTML={{ __html: QUIZ_CSS }} />

        <div className="quiz-shell">
          <main className="quiz-summary">
            <div className="quiz-card">
              <div className="quiz-panel">

                <img
                  src="/suri-snake-happy.png"
                  alt="Suri"
                  className="quiz-summary-suri"
                />

                <span className="quiz-badge">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Quest Complete
                </span>

                <h1 className="quiz-summary-title mt-4" data-tutorial-scope="quiz-summary">
                  Quiz Complete!
                </h1>

                <p className="quiz-subtitle">
                  The rune chain has been forged.
                </p>

                <div className="quiz-summary-stats">
                  <div className="quiz-summary-stat">
                    <div className="quiz-summary-stat-label">
                      Final Score
                    </div>

                    <div className="quiz-summary-stat-value">
                      {summaryData.total_points}
                    </div>
                  </div>

                  <div className="quiz-summary-stat">
                    <div className="quiz-summary-stat-label">
                      Accuracy
                    </div>

                    <div className="quiz-summary-stat-value">
                      {accuracy}%
                    </div>
                  </div>

                  <div className="quiz-summary-stat">
                    <div className="quiz-summary-stat-label">
                      Best Streak
                    </div>

                    <div className="quiz-summary-stat-value">
                      {bestStreak}
                    </div>
                  </div>
                </div>

                <div className="quiz-feedback">
                  <img
                    src="/suri-snake-left.png"
                    alt="Suri"
                    className="h-14 w-auto object-contain shrink-0"
                  />

                  <div>
                    <div className="quiz-hint-title mb-2">
                      Suri ss-says:
                    </div>

                    <p className="text-sm leading-relaxed font-bold">
                      {summaryData.feedback_text}
                    </p>
                  </div>
                </div>

                {ledger.length > 0 && (
                  <section className="quiz-ledger" aria-labelledby="quiz-ledger-title">
                    <div className="quiz-ledger-head">
                      <h2 id="quiz-ledger-title" className="quiz-ledger-title">
                        Rune Ledger
                      </h2>

                      <div className="quiz-ledger-tally">
                        {(Object.keys(tally) as RuneOutcome[])
                          .filter((outcome) => tally[outcome] > 0)
                          .map((outcome) => (
                            <span
                              key={outcome}
                              className={`quiz-ledger-verdict outcome-${outcome}`}
                            >
                              <OutcomeIcon outcome={outcome} />
                              {tally[outcome]} {OUTCOME_LABEL[outcome]}
                            </span>
                          ))}
                      </div>
                    </div>

                    {ledger.map(({ problem, problemIndex, runes }) => {
                      const forged = runes.filter((r) => r.outcome === "correct").length;
                      const outcome: RuneOutcome =
                        forged === runes.length ? "correct" : "wrong";

                      return (
                      <details key={problem.id} className="quiz-ledger-problem">
                        <summary className="quiz-ledger-summary">
                          <span className="quiz-ledger-problem-title">
                            Problem {problemIndex + 1}
                          </span>

                          <span className={`quiz-ledger-verdict outcome-${outcome}`}>
                            <OutcomeIcon outcome={outcome} />
                            {forged}/{runes.length} forged
                          </span>

                          <ChevronDown className="quiz-ledger-chevron w-5 h-5" aria-hidden="true" />
                        </summary>

                        {problem.word_problem_text && (
                          <div className="quiz-ledger-problem-text markdown-content">
                            {renderMath(problem.word_problem_text)}
                          </div>
                        )}

                        <ol className="mt-2">
                          {runes.map((rune, i) => {
                            const step = problem.steps.find(
                              (s) => s.step_index === rune.stepIndex
                            );
                            if (!step) return null;

                            return (
                              <li
                                key={rune.stepIndex}
                                className={`quiz-ledger-row outcome-${rune.outcome}`}
                                style={{ "--i": i } as React.CSSProperties}
                              >
                                <span className="quiz-ledger-num" aria-hidden="true">
                                  {rune.stepIndex + 1}
                                </span>

                                <div className="quiz-ledger-body">
                                  <div className="quiz-ledger-instruction markdown-content">
                                    {renderMath(step.instruction)}
                                  </div>

                                  <div className="quiz-ledger-expr markdown-content">
                                    {renderMath(
                                      step.blank_expression.replace("?", rune.correctValue),
                                      true
                                    )}
                                  </div>

                                  <div className="quiz-ledger-answers">
                                    {rune.answer !== null && (
                                      <span
                                        className={`quiz-ledger-answer yours${
                                          rune.outcome === "correct" ? " is-correct" : ""
                                        }`}
                                      >
                                        <span className="quiz-ledger-answer-label">
                                          Your answer
                                        </span>
                                        <span className="markdown-content">
                                          {renderMath(rune.answer, true)}
                                        </span>
                                      </span>
                                    )}

                                    {rune.outcome !== "correct" && (
                                      <span className="quiz-ledger-answer right">
                                        <span className="quiz-ledger-answer-label">
                                          Correct
                                        </span>
                                        <span className="markdown-content">
                                          {renderMath(rune.correctValue, true)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="quiz-ledger-side">
                                  <span className={`quiz-ledger-verdict outcome-${rune.outcome}`}>
                                    <OutcomeIcon outcome={rune.outcome} />
                                    {OUTCOME_LABEL[rune.outcome]}
                                  </span>

                                  {rune.points > 0 && (
                                    <span className="quiz-ledger-points">
                                      +{rune.points} pts
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </details>
                      );
                    })}
                  </section>
                )}

                <div className="quiz-summary-actions">
                  {progression.topic_complete ? (
                    <button
                      onClick={() =>
                        router.push("/topics")
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Return to Dashboard
                    </button>
                  ) : progression.decision ===
                      "advance" &&
                    progression.next_node_id ? (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Next Lesson
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : progression.go_deeper_available &&
                    progression.go_deeper_node ? (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Review Basics
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        router.push(
                          `/session/${sessionId}/lesson`
                        )
                      }
                      className="quiz-action"
                      style={{
                        minHeight: "56px",
                        padding: "0 28px",
                      }}
                    >
                      Review Lesson
                    </button>
                  )}

                  <button
                    onClick={() =>
                      router.push(
                        `/session/${sessionId}/lesson`
                      )
                    }
                    className="quiz-action skip"
                    style={{
                      minHeight: "56px",
                      padding: "0 28px",
                    }}
                  >
                    Exit Quiz
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return null;
}
