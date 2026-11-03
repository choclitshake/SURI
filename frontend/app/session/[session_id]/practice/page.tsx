"use client";

import "mathlive";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { BattleSpells, ArmedSpellBubble, SpellEffect, SPELLS, FLAME_FLIGHT_MS } from "./battle-spells";
import { CombatImpact, type CombatHit } from "./battle-impact";
import { useBattleAudio } from "./battle-audio";

import {
  getSession,
  startPractice,
  submitPracticeStep,
  actInPracticeBattle,
  PracticeBattleAction,
  PracticeBattleState,
  PracticeSpell,
  PracticeProblem,
  PracticeStep,
  PracticeSubmitStepResponse,
} from "../../../../lib/api";
import MathField from "../../../../components/math/MathField";

/* String & Math normalization functions for client-side step checking */
function normalizeVal(val: string): string {
  let v = val.trim().toLowerCase();
  v = v.replace(/\\\\/g, "\\");
  v = v.replace(/\$/g, "").replace(/\*/g, "");
  v = v.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
  v = v.replace(/\\left/g, "").replace(/\\right/g, "");
  v = v.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
  v = v.replace(/\\frac([a-zA-Z0-9])([a-zA-Z0-9])/g, "$1/$2");
  v = v.replace(/\\sqrt\s*\[\]\s*\{/g, "\\sqrt{");
  v = v.replace(/\\sqrt\s*\{([^}]+)\}/g, "\\sqrt{$1}");
  v = v.replace(/\\sqrt\s*([a-zA-Z0-9])/g, "\\sqrt{$1}");
  v = v.replace(/\s*([+\-*/=()^,])\s*/g, "$1");
  v = v.replace(/\s+/g, " ");
  v = v.replace(/\^\{(\([^()]+\))\}/g, "^($1)");
  v = v.replace(/\^\{([a-zA-Z0-9]+)\}/g, "^$1");
  return v;
}

function isFloat(val: string): boolean {
  return !isNaN(parseFloat(val)) && isFinite(Number(val));
}

function checkStepCorrect(submitted: string, correct: string): boolean {
  const subNorm = normalizeVal(submitted);
  const corrNorm = normalizeVal(correct);
  if (isFloat(subNorm) && isFloat(corrNorm)) {
    return Math.abs(parseFloat(subNorm) - parseFloat(corrNorm)) <= 0.01;
  }
  return subNorm === corrNorm;
}

const requiresTextInput = (val: string) => {
  const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
  return /[a-zA-Z]{2,}/.test(withoutLatex) || withoutLatex.includes(",");
};

const cleanMathExpr = (expr: string) => {
  return expr.replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2").replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2");
};

function formatMathInText(text: string): string {
  if (!text) return "";
  // Fix double or triple underscores inside math delimiters so KaTeX doesn't throw subscript errors
  return text.replace(/\$([^$]+)\$/g, (_match, mathContent) => {
    const cleanedMath = mathContent
      .replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2")
      .replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2")
      .replace(/_{2,}/g, "\\underline{\\quad\\quad}");
    return `$${cleanedMath}$`;
  });
}

/**
 * Turn a stored step instruction / answer / feedback string into markdown KaTeX can render.
 * Strings that already contain $...$ are cleaned in place; bare values like "\frac34-\frac18"
 * are wrapped in $...$ unless they are plain words (e.g. "x = 2, 3" style text answers).
 */
function toMathMarkdown(raw: string, isValue = false): string {
  const t = (raw ?? "").replace(/\\\\/g, "\\").trim();
  if (!t) return "";
  if (t.includes("$")) {
    return t.replace(/\$\$?([^$]+?)\$\$?/g, (_m, inner: string) => {
      const math = inner
        .replace(/["“”]/g, "")
        .replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2")
        .replace(/(\d+)\s*\/\s*(\d+)/g, "\\frac{$1}{$2}")
        .trim();
      return `$${math}$`;
    });
  }
  if (isValue && !requiresTextInput(t)) {
    const math = t.replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2").replace(/(\d+)\s*\/\s*(\d+)/g, "\\frac{$1}{$2}");
    return `$${math}$`;
  }
  return t;
}

function MathInline({ text, isValue = false }: { text: string; isValue?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: (props) => <span {...props} /> }}
    >
      {toMathMarkdown(text, isValue)}
    </ReactMarkdown>
  );
}

const fixUnbalancedMath = (before: string, after: string) => {
  let b = before;
  let a = after;

  const doubleDollarsBefore = (b.match(/\$\$/g) || []).length;
  if (doubleDollarsBefore % 2 !== 0) {
    b = b + "$$";
    a = "$$" + a;
  } else {
    const singleBefore = b.replace(/\$\$/g, "");
    const singleDollarsBefore = (singleBefore.match(/\$/g) || []).length;
    if (singleDollarsBefore % 2 !== 0) {
      b = b + "$";
      a = "$" + a;
    }
  }

  // Escape leading '+' or '-' if followed by space/word so markdown parser doesn't treat it as an unordered list item
  const escapeLeadingListMarkers = (segment: string) => {
    // If segment begins with '+' or '-' followed by space or math (e.g. "+ y = 5"),
    // escape it with a backslash so Markdown renders a literal '+' or '-' instead of a list bullet (<ul><li>)
    return segment.replace(/^(\s*)([\+\-])(\s+)/, "$1\\$2$3");
  };

  return { fixedBefore: escapeLeadingListMarkers(b), fixedAfter: escapeLeadingListMarkers(a) };
};

const ENEMY_ROSTER = [
  { name: "Fraction Fiend", title: "Splitter of Wholes", img: "/fraction-fiend-villain.png" },
  { name: "Variable Phantom", title: "The Unknown", img: "/variable-phantom-villan.png" },
  { name: "Exponent Wraith", title: "Power Corruptor", img: "/exponent-wraith-villain.png" },
  { name: "Equation Golem", title: "Balance Breaker", img: "/equation-golem-villain.png" },
  { name: "Polynomial Hydra", title: "Many-Termed Beast", img: "/polynomial-hydra-villain.png" },
];

function calculateStars(mistakes: number): number {
  if (mistakes === 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

const GAME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&family=Bree+Serif&display=swap');
  :root {
    --void-dark: #0a0010; --void-purple: #2d0a4e; --glow-purple: #9b59b6;
    --glow-red: #e74c3c; --glow-gold: #f9c31f; --glow-green: #3dbf6e;
    --heart-red: #ff2244; --heart-empty: #3a1a2a;
  }
  * { box-sizing: border-box; }
  .battle-body { font-family: Georgia, 'Times New Roman', serif; min-height: 100dvh; overflow-x: hidden; position: relative; background: #0a0010; display: flex; flex-direction: column; color: #fff4d5; }
  .arena-bg { background: url('/login/arena.png') center bottom / cover no-repeat; position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; opacity: 0.85; }
  /* Storybook diagnostic Bookworm Parchment HUD Bar */
  .hud-bar {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(210px, 1.25fr) minmax(180px, 1fr);
    align-items: center;
    gap: 12px;
    min-height: 124px;
    width: 100%;
    margin: 0;
    padding: 20px clamp(12px, 2.5vw, 28px);
    border: 4px solid #80511f;
    outline: 0;
    border-radius: 18px;
    background:
      linear-gradient(90deg, #70411f 0 16px, transparent 16px calc(100% - 16px), #70411f calc(100% - 16px)),
      linear-gradient(180deg, #8b5527 0 14px, transparent 14px calc(100% - 14px), #8b5527 calc(100% - 14px)),
      linear-gradient(180deg, rgba(252,229,177,0.97), rgba(235,189,105,0.97));
    box-shadow:
      0 8px 0 rgba(39,18,10,0.84),
      0 16px 32px rgba(0,0,0,0.38),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255,198,92,0.18);
    clip-path: none;
    overflow: visible;
  }
  .hud-bar::before {
    content: "";
    position: absolute;
    inset: 11px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 10px;
    pointer-events: none;
  }
  .hud-brand, .hud-right, .combatant-card { display: flex; align-items: center; gap: 10px; }
  .hud-right { justify-content: flex-end; }
  .combatant-card {
    min-width: 0;
    min-height: 88px;
    padding: 14px 16px;
    border: 2px solid #8749b7;
    background:
      radial-gradient(circle at 18% 18%, rgba(255,255,255,0.16), transparent 26%),
      linear-gradient(180deg, rgba(81,39,120,0.96), rgba(55,27,91,0.98));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      0 5px 0 rgba(72,31,94,0.58);
  }
  .hero-card { border-radius: 18px 10px 10px 18px; }
  .enemy-card { border-radius: 10px 18px 18px 10px; justify-content: space-between; }
  .level-badge {
    width: 46px;
    height: 46px;
    border: 2px solid #6d411c;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 25%, #fff6aa, #ffd35c 48%, #a84e1d);
    color: #321008;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 14px;
    font-weight: 900;
    display: grid;
    place-items: center;
    box-shadow: 0 3px 0 rgba(0,0,0,0.35);
    flex-shrink: 0;
  }
  .chapter-banner {
    position: relative;
    min-height: 88px;
    padding: 16px 24px 18px;
    border: 2px solid #318138;
    border-radius: 18px;
    background:
      radial-gradient(circle at 50% 0%, rgba(255,255,255,0.22), transparent 42%),
      linear-gradient(180deg, rgba(29, 85, 27, 0.98), rgba(13, 61, 25, 0.99));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 5px 0 rgba(18,52,21,0.58);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    justify-self: center;
    width: min(100%, 520px);
    text-align: center;
  }
  .chapter-eyebrow, .combatant-subtitle {
    display: block;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .chapter-eyebrow {
    color: #ffe79f;
    text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  }
  .hud-logo {
    display: block;
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(20px, 2.2vw, 28px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: 0;
    text-shadow: 0 2px 0 #123d18;
  }
  .combatant-name {
    display: block;
    color: #fff8e8;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 18px;
    font-weight: 900;
    text-shadow: 0 2px 0 #32104d;
  }
  .combatant-subtitle {
    color: rgba(255,231,159,0.86);
  }
  .hud-progress-bar {
    width: min(100%, 280px);
    height: 10px;
    margin: 4px auto 0;
    border: 1px solid #d7a7ff;
    border-radius: 999px;
    background: rgba(24,8,36,0.62);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.42);
    overflow: hidden;
  }
  .hud-progress-fill {
    background: linear-gradient(90deg,#ffd35c,#9b43cf);
    height: 100%;
    border-radius: 999px;
    box-shadow: 0 0 12px rgba(255,211,92,0.55), 0 0 14px rgba(155,67,207,0.5);
  }
  .hearts-bar {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
  }
  .heart-icon { width: 22px; height: 22px; filter: drop-shadow(0 2px 0 #35110d) drop-shadow(0 0 5px rgba(255,42,68,0.75)); }
  .streak-pill, .score-chip {
    border: 2px solid #6d411c;
    border-radius: 999px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    box-shadow: 0 4px 0 rgba(72,34,16,0.72);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    font-family: 'Fredoka One', cursive;
    font-size: 14px;
    white-space: nowrap;
  }
  .streak-pill {
    background: rgba(231,76,60,0.25);
    border-color: #e74c3c;
    color: #ff8c69;
  }
  .enemy-stats-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 5px;
    flex-shrink: 0;
  }
  
  /* Main Battle Grid Layout (Left Full-Height Chronicle + Right Main Column) */
  .battle-layout {
    z-index: 4;
    max-width: 1560px;
    width: 100%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 20px;
    padding: 16px clamp(12px, 2vw, 24px) 24px;
    flex: 1;
    min-height: calc(100vh - 32px);
    align-items: stretch;
  }

  /* Left Column: Step Chronicle */
  .step-chronicle {
    grid-column: 1;
    grid-row: 1;
    border: 4px solid #80511f;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(42,20,12,0.96), rgba(20,9,5,0.98));
    box-shadow:
      0 8px 0 rgba(39,18,10,0.84),
      0 16px 36px rgba(0,0,0,0.5),
      inset 0 0 0 3px rgba(245,199,93,0.22);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
  }
  .panel-header-title {
    color: #ffe8a2; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 900;
    letter-spacing: 1.3px; text-transform: uppercase; display: flex; align-items: center; gap: 6px;
  }
  .word-problem-card {
    background: rgba(42, 20, 12, 0.75);
    border: 2px solid rgba(245, 199, 93, 0.4);
    border-left: 4px solid rgba(245, 175, 50, 0.8);
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 0;
    color: #fff4d5;
    font-family: 'Bree Serif', Georgia, serif;
    font-size: clamp(13px, 1.2vw, 15px);
    font-weight: 400;
    font-style: normal;
    line-height: 1.7;
  }
  .target-expr-scroll {
    border: 2px solid #9c672b;
    background: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.32), transparent 26%), linear-gradient(180deg, #fff0bf, #dec07b);
    color: #2b170d; box-shadow: inset 0 0 0 2px rgba(89,48,18,0.14), 0 3px 0 rgba(30,15,8,0.4);
    padding: 12px; border-radius: 8px;
  }
  .chronicle-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    max-height: none;
    padding-right: 4px;
  }
  .chronicle-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 8px;
    border: 2px solid rgba(142,91,32,0.6); background: rgba(30,15,10,0.7);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .chronicle-item.is-correct { border-color: #3dbf6e; background: rgba(18,50,28,0.85); box-shadow: inset 0 0 8px rgba(61,191,110,0.2); }
  .chronicle-item.is-wrong { border-color: #e74c3c; background: rgba(60,18,18,0.85); box-shadow: inset 0 0 8px rgba(231,76,60,0.2); }
  .chronicle-item.is-active { border-color: #f9c31f; background: rgba(75,45,15,0.88); box-shadow: 0 0 12px rgba(249,195,31,0.35); animation: activeGlow 1.5s ease-in-out infinite; }
  .chronicle-item.is-pending { opacity: 0.45; }
  @keyframes activeGlow { 0%,100% { box-shadow: 0 0 8px rgba(249,195,31,0.3); } 50% { box-shadow: 0 0 16px rgba(249,195,31,0.6); } }
  .chronicle-badge {
    width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center;
    background: #6d411c; color: #ffe8a2; font-family: "Bree Serif", Georgia, serif; font-size: 14px; font-weight: 900; flex-shrink: 0;
  }
  .chronicle-item.is-correct .chronicle-badge { background: #3dbf6e; color: #071d0f; }
  .chronicle-item.is-wrong .chronicle-badge { background: #e74c3c; color: #fff; }
  .chronicle-item.is-active .chronicle-badge { background: #f9c31f; color: #2b170d; }
  .chronicle-equation-preview {
    padding: 4px 8px;
    background: rgba(14,6,4,0.7);
    border: 1px solid rgba(142,91,32,0.5);
    border-radius: 6px;
    display: inline-block;
  }
  .chronicle-filled-slot {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 4px;
    font-weight: 800;
    font-family: monospace;
    font-size: 12px;
    background: #fff8e8;
    color: #2b170d;
    border: 1.5px solid #8e5b20;
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
  .chronicle-filled-slot.is-correct {
    border-color: #3dbf6e;
    background: #e8f8ee;
    color: #0d4a22;
  }
  .chronicle-filled-slot.is-wrong {
    border-color: #e74c3c;
    background: #fde8e8;
    color: #6b1414;
  }

  /* Right Column: Stacks HUD Bar + Arena + Input Panel with clean gaps */
  .right-main-area {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  /* Arena Section */
  .arena-section {
    display: grid;
    grid-template-columns: minmax(130px, 0.9fr) minmax(140px, 0.8fr) minmax(130px, 0.9fr);
    align-items: end;
    gap: clamp(8px, 2.5vw, 36px);
    min-height: clamp(230px, 30vh, 340px);
    flex-shrink: 0;
    padding: 14px clamp(14px, 3vw, 48px) 0;
    border: 4px solid #80511f;
    border-radius: 18px;
    background: url('/login/arena.png') center bottom / cover no-repeat;
    box-shadow:
      0 8px 0 rgba(39,18,10,0.84),
      0 16px 36px rgba(0,0,0,0.4),
      inset 0 0 0 4px rgba(50,25,14,0.58),
      inset 0 -40px 70px rgba(0,0,0,0.38);
    position: relative;
    overflow: hidden;
  }
  .arena-section::after {
    content: "";
    position: absolute;
    left: 10%;
    right: 10%;
    bottom: -2px;
    height: clamp(60px, 9vw, 100px);
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(7,5,8,0.78), rgba(7,5,8,0.24) 47%, transparent 72%);
    z-index: 1;
    pointer-events: none;
  }

  .reaction-space {
    align-self: start;
    justify-self: center;
    min-width: min(280px, 100%);
    min-height: 70px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 10px;
    z-index: 8;
  }
  .speech-bubble {
    position: relative;
    max-width: 280px;
    padding: 10px 16px;
    border: 3px solid #2c160d;
    border-radius: 16px 16px 16px 6px;
    background: linear-gradient(180deg, #fff2c8, #e5bf73);
    color: #341c11;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(14px, 1.4vw, 18px);
    font-weight: 900;
    text-align: center;
    box-shadow: 0 5px 0 rgba(43,22,10,0.74), 0 0 24px rgba(255,207,89,0.24);
  }
  .speech-bubble::after {
    content: "";
    position: absolute;
    left: 30px;
    bottom: -11px;
    width: 16px;
    height: 16px;
    background: #e5bf73;
    border-right: 3px solid #2c160d;
    border-bottom: 3px solid #2c160d;
    transform: rotate(45deg);
  }

  .char-container { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; z-index: 10; }
  .char-container.suri-side { align-items: flex-start; flex: 1; }
  .char-container.enemy-side { align-items: flex-end; flex: 1; }

  .sprite-frame {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    min-height: clamp(150px, 22vw, 250px);
    z-index: 5;
  }
  .sprite-frame::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 78%;
    height: 22px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0,0,0,0.62), transparent 68%);
    transform: translateX(-50%);
    z-index: -1;
  }
  .sprite-frame::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 2px;
    width: 64%;
    height: 38px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(114,255,194,0.28), rgba(255,198,90,0.13) 44%, transparent 72%);
    transform: translateX(-50%);
    z-index: -2;
  }

  .suri-sprite {
    height: clamp(150px, 21vw, 250px);
    width: auto;
    object-fit: contain;
    filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 5px 0 #17100a) drop-shadow(0 14px 18px rgba(76,194,117,0.44));
    transform-origin: bottom center;
    transition: filter 0.2s;
  }
  .enemy-sprite {
    width: clamp(140px, 19vw, 230px);
    height: clamp(140px, 19vw, 230px);
    object-fit: contain;
    object-position: center top;
    filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 5px 0 #17100a) drop-shadow(0 14px 18px rgba(153, 114, 241, 0.62));
    transform-origin: bottom center;
  }

  @keyframes suriAttack { 0% { transform: translateX(0) scaleX(1); } 20% { transform: translateX(40px) scaleX(1.15) skewX(-5deg); filter: drop-shadow(0 0 20px #3dbf6e) brightness(1.4); } 45% { transform: translateX(80px) scaleX(1.2) skewX(-8deg); filter: drop-shadow(0 0 30px #3dbf6e) brightness(1.6); } 70% { transform: translateX(20px) scaleX(1.05); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-attacking { animation: suriAttack 0.75s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes suriHit { 0% { transform: translateX(0); } 15% { transform: translateX(-30px) scaleX(0.9); filter: brightness(2.5) saturate(0) drop-shadow(0 0 20px #ff2244); } 55% { transform: translateX(-25px) scaleX(0.95); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-hit { animation: suriHit 0.7s ease-out forwards; }
  @keyframes suriIdle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .suri-idle { animation: suriIdle 2.8s ease-in-out infinite; }
  @keyframes suriDefeat { 0% { transform: translateY(0) rotate(0); } 40% { transform: translateY(-10px) rotate(-8deg); filter: brightness(0.6) saturate(0.3); } 100% { transform: translateY(6px) rotate(-12deg); filter: brightness(0.5) saturate(0); opacity: 0.7; } }
  .suri-defeated-anim { animation: suriDefeat 0.8s ease-out forwards; }

  @keyframes enemyIdle { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-6px) rotate(-1.5deg); } 75% { transform: translateY(-4px) rotate(1.5deg); } }
  .enemy-idle { animation: enemyIdle 2.5s ease-in-out infinite; }
  @keyframes enemyHit { 0% { transform: translateX(0) scale(1); } 10% { transform: translateX(30px) scale(1.08); filter: brightness(3) saturate(0); } 25% { transform: translateX(-20px) scale(0.94); filter: brightness(2) hue-rotate(30deg); } 55% { transform: translateX(-10px) scale(0.98); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-hit { animation: enemyHit 0.42s ease-out forwards; }
  @keyframes enemyAttack { 0% { transform: translateX(0) scale(1); } 20% { transform: translateX(-50px) scale(1.15); filter: brightness(1.8) hue-rotate(-20deg); } 45% { transform: translateX(-90px) scale(1.2); filter: brightness(2) drop-shadow(0 0 20px #e74c3c); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-attacking { animation: enemyAttack 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes enemyAppear { 0% { transform: scale(0) rotate(-30deg); opacity: 0; filter: brightness(3); } 60% { transform: scale(1.18) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; filter: brightness(1); } }
  .enemy-appear { animation: enemyAppear 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  @keyframes enemyDefeated { 0% { transform: scale(1) rotate(0); opacity: 1; } 20% { transform: scale(1.2) rotate(-10deg); filter: brightness(3) saturate(0.5); } 100% { transform: scale(0) rotate(400deg); opacity: 0; } }
  .enemy-defeated-anim { animation: enemyDefeated 1s ease-in forwards; }
  @keyframes dmgPop { 0% { opacity: 1; transform: translate(-50%,0) scale(1.4); } 40% { opacity: 1; transform: translate(-50%,-30px) scale(1); } 100% { opacity: 0; transform: translate(-50%,-80px) scale(0.6); } }
  .dmg-number { position: absolute; pointer-events: none; z-index: 200; font-family: 'Fredoka One', cursive; font-size: 36px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); animation: dmgPop 0.9s ease-out forwards; left: 50%; top: 10%; white-space: nowrap; }
  .dmg-enemy { color: #ff4757; } .dmg-suri { color: #ff8c69; }

  /* Input Answer Panel */
  .input-panel {
    border: 4px solid #80511f;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(38,18,11,0.98), rgba(20,9,5,0.99));
    box-shadow:
      0 8px 0 rgba(39,18,10,0.84),
      0 16px 36px rgba(0,0,0,0.4),
      inset 0 0 0 3px rgba(245,199,93,0.24);
    padding: clamp(14px, 2vw, 22px);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .active-step-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(26,12,7,0.6);
    border: 2px solid rgba(142,91,32,0.5);
    border-radius: 10px;
    padding: 16px;
    box-shadow: inset 0 0 14px rgba(0,0,0,0.3);
  }
  .step-badge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .step-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    color: #ffe08d;
    background: rgba(56,28,15,0.85);
    border: 1px solid rgba(255,218,112,0.42);
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .step-type-pill {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #f9c31f;
    background: rgba(30,15,8,0.7);
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid rgba(249,195,31,0.3);
  }
  .step-instruction-text {
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.45;
    color: #fff8df;
    font-weight: 700;
  }
  .equation-input-strip {
    padding: 14px 20px;
    background: rgba(18,8,5,0.85);
    border: 2px solid #8e5b20;
    border-radius: 10px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    font-family: monospace;
    font-size: 18px;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
    min-height: 74px;
  }
  .step-text-input {
    min-width: 220px;
    height: 54px;
    padding: 8px 18px;
    border: 3px solid #f5b025;
    border-radius: 10px;
    background: linear-gradient(180deg, #fffdf2, #fbeec8);
    color: #2b170d;
    font-weight: 800;
    font-size: 18px;
    text-align: center;
    outline: none;
    cursor: text;
    box-shadow: 0 0 14px rgba(245,176,37,0.45), 0 4px 0 #28150c;
    transition: all 0.15s ease;
  }
  .step-text-input:hover {
    cursor: text;
    border-color: #ffd45e;
    box-shadow: 0 0 18px rgba(249,195,31,0.65), 0 4px 0 #28150c;
  }
  .step-text-input:focus {
    cursor: text;
    border-color: #ffe57f;
    box-shadow: 0 0 22px rgba(249,195,31,0.85), 0 4px 0 #28150c;
  }
  .step-math-input-wrapper {
    min-width: 220px;
    max-width: 100%;
    cursor: text;
    display: inline-flex;
    align-items: center;
  }
  .step-math-input-wrapper:hover {
    cursor: text;
  }
  math-field {
    cursor: text !important;
    transition: all 0.15s ease;
  }
  math-field:hover {
    cursor: text !important;
    border-color: #ffd45e !important;
    box-shadow: 0 0 18px rgba(249,195,31,0.65), 0 4px 0 #28150c !important;
  }
  math-field:focus,
  math-field:focus-within {
    cursor: text !important;
    border-color: #ffe57f !important;
    box-shadow: 0 0 22px rgba(249,195,31,0.85), 0 4px 0 #28150c !important;
  }
  math-field::part(container),
  math-field * {
    cursor: text !important;
  }

  /* Attack button */
  .attack-btn {
    width: 100%; font-family: 'Fredoka One', cursive; font-size: 18px; letter-spacing: 2px; text-transform: uppercase;
    border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 8px;
    cursor: pointer; border: 3px solid #6d411c; outline: none; transition: transform 0.1s;
  }
  .attack-btn.ready {
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f; border-color: #ffe288; box-shadow: 0 6px 0 #12361e, 0 0 20px rgba(88,255,138,0.3);
  }
  .attack-btn.ready:hover { transform: translateY(-2px); filter: brightness(1.08); }
  .attack-btn.disabled { background: rgba(255,255,255,0.06); box-shadow: none; color: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.1); cursor: not-allowed; }

  .ornate-btn {
    min-height: 48px; border: 3px solid #6d411c; border-radius: 7px;
    background: linear-gradient(180deg,#ffe596,#b8792d); color: #2a160d;
    font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: 900;
    box-shadow: 0 4px 0 #28150c; cursor: pointer; padding: 8px 16px;
  }
  .ornate-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }

  .bottom-bar { display: grid; grid-template-columns: minmax(140px, 0.8fr) minmax(220px, 1.25fr) minmax(130px, 0.7fr); gap: 12px; margin-top: 6px; }

  /* Feedback banner */
  .feedback-banner {
    border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;
    border: 2px solid rgba(255,226,136,0.35); background: rgba(28,13,9,0.76);
  }
  .feedback-banner.correct { background: linear-gradient(135deg,rgba(30,80,50,0.97),rgba(20,60,35,0.99)); border-color: rgba(61,191,110,0.6); }
  .feedback-banner.wrong { background: linear-gradient(135deg,rgba(80,15,15,0.97),rgba(60,8,8,0.99)); border-color: rgba(231,76,60,0.6); }
  .feedback-banner.checkpoint {
    background: linear-gradient(135deg, rgba(68, 33, 10, 0.97), rgba(42, 19, 6, 0.99));
    border-color: #f5b025;
    box-shadow: 0 0 16px rgba(245, 176, 37, 0.35);
  }
  .feedback-suri { height: 48px; width: auto; object-fit: contain; flex-shrink: 0; }
  .feedback-title { font-family: 'Fredoka One', cursive; font-size: 14px; color: #fff; margin: 0; }
  .feedback-quote { font-family: 'Nunito', sans-serif; font-size: 12px; color: rgba(255,255,255,0.85); margin: 0; }
  .chronicle-checkpoint-flag {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 10px;
    margin: 4px 0 6px;
    border-radius: 8px;
    background: linear-gradient(90deg, rgba(245, 176, 37, 0.08), rgba(245, 176, 37, 0.22), rgba(245, 176, 37, 0.08));
    border: 1px dashed rgba(245, 176, 37, 0.6);
    color: #ffe8a2;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  /* Shield Bar */
  .shield-bar { display: flex; gap: 6px; align-items: center; justify-content: center; }
  .shield-node {
    width: 16px; height: 16px; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    background: #552277; transition: all 0.3s;
  }
  .shield-node.active { background: #f9c31f; box-shadow: 0 0 8px #f9c31f; }

  /* Guidance Mode */
  .guidance-banner {
    background: rgba(249,195,31,0.12); border: 2px dashed #f9c31f; border-radius: 8px; padding: 10px 14px;
    color: #ffe79f; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; text-align: center;
  }
  
  /* Intro Parchment (Bookworm style matching Diagnostic) */
  .diagnostic-before {
    min-height: 100vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 3vh, 32px) 20px 20px;
    font-family: "Nunito", sans-serif;
    background: #83c3ff url("/login/results.png") center / cover no-repeat;
    color: #3b1766;
  }
  .diagnostic-before .arena-bg {
    display: none;
  }
  .diagnostic-before::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(circle at 50% 39%, rgba(255, 239, 185, .34), transparent 28%),
      linear-gradient(90deg, rgba(19, 13, 38, .34), transparent 26%, transparent 72%, rgba(31, 15, 44, .24)),
      linear-gradient(180deg, rgba(255, 255, 255, .08), transparent 45%, rgba(43, 29, 40, .2));
    pointer-events: none;
  }
  .diagnostic-before .intro-screen {
    width: min(820px, 100%);
    min-height: auto;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    gap: 0;
  }
  .intro-parchment-frame {
    position: relative;
    width: 100%;
    padding: 16px;
    border-radius: 28px 24px 30px 26px;
    background:
      linear-gradient(90deg, #70411f 0 18px, transparent 18px calc(100% - 18px), #70411f calc(100% - 18px)),
      linear-gradient(180deg, #8b5527 0 18px, transparent 18px calc(100% - 18px), #8b5527 calc(100% - 18px)),
      #70411f;
    box-shadow:
      0 20px 36px rgba(42, 24, 20, .36),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255, 198, 92, .22);
  }
  .intro-parchment-frame::before {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: 20px;
    pointer-events: none;
    background:
      radial-gradient(circle at 3% 12%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 97% 13%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 4% 91%, #4a2413 0 15px, transparent 16px),
      radial-gradient(circle at 96% 90%, #4a2413 0 15px, transparent 16px);
    opacity: .76;
  }
  .intro-parchment-panel {
    position: relative;
    overflow: hidden;
    border-radius: 18px 16px 20px 18px;
    padding: clamp(24px, 3.5vh, 40px) clamp(20px, 4vw, 48px) clamp(18px, 2.5vh, 28px);
    background:
      radial-gradient(circle at 18% 24%, rgba(255, 255, 255, .34), transparent 26%),
      radial-gradient(circle at 80% 76%, rgba(174, 102, 34, .12), transparent 31%),
      linear-gradient(135deg, rgba(129, 73, 24, .08) 0 14%, transparent 14% 28%, rgba(129, 73, 24, .06) 28% 42%, transparent 42% 57%, rgba(129, 73, 24, .06) 57% 70%, transparent 70%),
      #f6ddaa;
    box-shadow:
      inset 0 0 0 2px rgba(124, 70, 28, .2),
      inset 0 0 34px rgba(116, 65, 22, .18);
    text-align: center;
  }
  .intro-parchment-panel::before {
    content: "";
    position: absolute;
    inset: 10px;
    border: 2px solid rgba(111, 61, 28, .13);
    border-radius: 14px;
    pointer-events: none;
  }
  .intro-content {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
  }
  .diagnostic-before .intro-title {
    color: #3c126b;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(26px, 3.8vw, 42px);
    line-height: 1.1;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
    animation: none;
  }
  .intro-ornament {
    display: flex;
    align-items: center;
    gap: 14px;
    width: min(400px, 100%);
    margin: 10px auto 12px;
    color: #7d36bb;
  }
  .intro-ornament::before,
  .intro-ornament::after {
    content: "";
    height: 2px;
    flex: 1;
    background: linear-gradient(90deg, transparent, currentColor);
    box-shadow: 0 1px 0 rgba(255, 255, 255, .55);
  }
  .intro-ornament::after {
    background: linear-gradient(90deg, currentColor, transparent);
  }
  .intro-ornament span {
    width: 18px;
    height: 18px;
    background: currentColor;
    clip-path: polygon(50% 0, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0 50%, 36% 36%);
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .7));
  }
  .diagnostic-before .intro-subtitle,
  .diagnostic-before .speech-bubble {
    max-width: 620px;
    margin: 0 auto 10px;
    padding: 10px 16px;
    border: 2px solid #8749b7;
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(81, 39, 120, .96), rgba(55, 27, 91, .98));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .15), 0 3px 0 rgba(72, 31, 94, .44);
    color: #fff8e8;
    font-family: "Nunito", sans-serif;
    font-size: clamp(13px, 1.4vw, 15px);
    font-style: normal;
    font-weight: 800;
    line-height: 1.45;
  }
  .diagnostic-before .speech-bubble::after {
    display: none;
  }
  .diagnostic-before .intro-char {
    width: min(640px, 100%);
    margin: 2px auto 12px;
    padding: 10px;
    border: 2px solid rgba(124, 70, 28, .32);
    border-radius: 14px;
    background: rgba(255, 248, 232, .72);
    box-shadow: inset 0 0 22px rgba(116, 65, 22, .12);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .diagnostic-before .intro-enemy-img {
    width: clamp(90px, 14vh, 130px);
    height: clamp(90px, 14vh, 130px);
    filter: drop-shadow(0 10px 12px rgba(42, 18, 24, .32));
    display: block;
    margin: 0 auto;
    object-fit: contain;
  }
  .intro-button-row {
    display: flex;
    gap: 12px;
    width: min(640px, 100%);
    margin: 0 auto;
  }
  .intro-button-wrap {
    flex: 1;
    padding: 6px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background: linear-gradient(180deg, #ffcf66, #9a541f);
    filter: drop-shadow(0 6px 0 rgba(72, 34, 16, .72));
  }
  .diagnostic-before .intro-start-btn,
  .diagnostic-before .intro-skip-btn {
    width: 100%;
    max-width: none;
    min-height: 52px;
    margin: 0;
    padding: 10px 16px;
    border: 0;
    border-radius: 0;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background:
      linear-gradient(90deg, rgba(255,255,255,.12), transparent 18%, transparent 82%, rgba(255,255,255,.12)),
      linear-gradient(180deg, #9232cc, #58158f 52%, #391071);
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(18px, 2.1vw, 24px);
    font-weight: 900;
    letter-spacing: 0;
    text-shadow: 0 3px 0 #32104d;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-transform: none;
    cursor: pointer;
  }
  .diagnostic-before .intro-skip-btn {
    background:
      linear-gradient(90deg, rgba(255,255,255,.2), transparent 18%, transparent 82%, rgba(255,255,255,.2)),
      linear-gradient(180deg, #fff1bc, #f3bd50 54%, #a96525);
    color: #3c126b;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
  }
  .diagnostic-before .intro-start-btn:hover:not(:disabled),
  .diagnostic-before .intro-skip-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.06);
  }
  @media (max-width: 720px) {
    .diagnostic-before {
      min-height: 100svh;
      padding: 112px 12px 18px;
    }
    .intro-parchment-frame {
      padding: 14px;
      border-radius: 24px;
    }
    .intro-parchment-panel {
      padding: 42px 15px 24px;
      border-radius: 18px;
    }
    .diagnostic-before .intro-title {
      font-size: 34px;
    }
    .intro-button-row {
      flex-direction: column;
    }
    .diagnostic-before .intro-start-btn,
    .diagnostic-before .intro-skip-btn {
      min-height: 58px;
      font-size: 22px;
    }
  }

  /* Completion screen */
  .completion-screen-wrap {
    position: relative;
    z-index: 10;
    width: 100%;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    background: rgba(10, 5, 3, 0.45);
  }
  .completion-card {
    position: relative;
    z-index: 10;
    width: min(720px, 94%);
    margin: 0 auto;
    padding: 36px 32px;
    border-radius: 24px;
    border: 4px solid #9c672b;
    background: linear-gradient(180deg, rgba(46, 23, 14, 0.98), rgba(24, 11, 6, 0.98));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 176, 37, 0.35);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .completion-title {
    font-family: 'Nunito', sans-serif;
    font-size: clamp(26px, 3.5vw, 36px);
    font-weight: 900;
    color: #ffe8a2;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-shadow: 0 3px 6px rgba(0,0,0,0.7), 0 0 20px rgba(245, 176, 37, 0.4);
    margin: 0 0 8px;
  }
  .completion-subtitle {
    font-size: 16px;
    font-weight: 600;
    color: #ffdca8;
    max-width: 540px;
    margin: 0 auto 16px;
    line-height: 1.5;
  }
  .completion-suri-img {
    width: 110px;
    height: auto;
    margin: 8px auto 20px;
    filter: drop-shadow(0 8px 16px rgba(0,0,0,0.6));
    user-select: none;
  }
  .completion-problem-list {
    width: 100%;
    max-width: 640px;
    margin: 0 auto 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .completion-problem-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: rgba(30, 14, 8, 0.88);
    border: 2px solid #8e5b20;
    border-radius: 12px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3);
  }
  .completion-problem-row.has-report { flex-wrap: wrap; }
  .completion-problem-row.has-report .completion-problem-text { max-width: none; white-space: normal; overflow: visible; flex: 1 1 60%; }
  .completion-step-report {
    flex-basis: 100%;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed rgba(142, 91, 32, 0.7);
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
  }
  .step-card {
    padding: 12px 14px;
    background: rgba(255, 244, 213, 0.06);
    border: 1px solid rgba(255, 220, 168, 0.18);
    border-left: 5px solid #5fbf7a;
    border-radius: 10px;
    font-family: 'Nunito', sans-serif;
    color: #fff4d5;
  }
  .step-card.is-wrong { border-left-color: #e8705f; background: rgba(232, 112, 95, 0.09); }
  .step-card.is-breakdown { border-color: rgba(245, 176, 37, 0.6); border-left-color: #f5b025; box-shadow: 0 0 0 1px rgba(245, 176, 37, 0.25); }
  .step-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .step-card-mark { font-weight: 900; font-size: 16px; color: #8fe3a4; }
  .step-card.is-wrong .step-card-mark { color: #ff9a8b; }
  .step-card-title { font-size: 13px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase; color: #ffdca8; }
  .step-card-flag { margin-left: auto; padding: 2px 10px; border-radius: 999px; background: rgba(245, 176, 37, 0.2); border: 1px solid rgba(245, 176, 37, 0.55); font-size: 11px; font-weight: 800; color: #ffe08d; }
  .step-card-instruction { font-size: 15px; font-weight: 600; line-height: 1.5; color: #fff4d5; margin-bottom: 10px; }
  .step-card-answers { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
  .step-card-answer { display: flex; flex-direction: column; gap: 3px; padding: 8px 12px; background: rgba(20, 9, 5, 0.55); border-radius: 8px; }
  .step-card-answer.is-key { background: rgba(95, 191, 122, 0.14); }
  .step-card-label { font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #d9bd8a; }
  .step-card-value { font-size: 17px; font-weight: 700; color: #fff; overflow-wrap: anywhere; }
  .completion-step-note { font-size: 14px; line-height: 1.5; font-style: italic; color: #f3d9a0; padding: 2px 4px; }
  .completion-problem-text {
    font-size: 15px;
    font-weight: 800;
    color: #fff4d5;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .completion-stars {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .star-icon {
    width: 22px;
    height: 22px;
    color: #f9c31f;
    filter: drop-shadow(0 2px 4px rgba(249,195,31,0.5));
  }
  .star-icon.empty {
    color: rgba(255,255,255,0.2);
    filter: none;
  }
  .completion-score-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 28px;
    margin: 0 auto 24px;
    border-radius: 9999px;
    background: linear-gradient(180deg, rgba(38, 18, 10, 0.9), rgba(20, 9, 5, 0.95));
    border: 2px solid #f5b025;
    box-shadow: 0 0 18px rgba(245, 176, 37, 0.35);
    font-size: 20px;
    font-weight: 900;
    color: #ffe8a2;
  }
  .completion-score-badge .score-val {
    color: #fff;
    font-size: 22px;
  }
  .completion-action-btn {
    width: 100%;
    max-width: 360px;
    padding: 16px 28px;
    font-family: 'Nunito', sans-serif;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #2b1307;
    background: linear-gradient(180deg, #ffe58f, #f5b025 55%, #bd7314);
    border: 3px solid #6d3a14;
    border-radius: 14px;
    box-shadow: 0 6px 0 #3a1b08, 0 10px 20px rgba(0,0,0,0.5);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .completion-action-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
    box-shadow: 0 8px 0 #3a1b08, 0 14px 24px rgba(0,0,0,0.6);
  }
  .completion-action-btn:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #3a1b08;
  }
  
    @media (max-width: 880px) {
    .battle-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto; gap: 12px; }
    .right-main-area { grid-column: 1; grid-row: 2; min-width: 0; }
    .step-chronicle { max-height: 260px; min-width: 0; }
    .chronicle-list { max-height: 160px; }
    .arena-section { min-height: 200px; padding-inline: 12px; }
    .bottom-bar { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) {
    .hud-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px; gap: 8px; }
    .chapter-banner { grid-column: 1 / -1; grid-row: 1; min-height: 64px; width: 100%; padding: 8px; }
    .hud-brand, .hud-right { min-width: 0; }
    .combatant-card { width: 100%; min-height: 80px; padding: 8px; gap: 6px; }
    .combatant-name { font-size: 14px; }
    .combatant-subtitle { font-size: 8px; letter-spacing: .4px; }
    .level-badge { width: 30px; height: 30px; font-size: 10px; }
    .score-chip { padding: 3px 6px; font-size: 12px; }
    .arena-section { grid-template-columns: minmax(0, 1fr) minmax(0, .35fr) minmax(0, 1fr); gap: 4px; }
    .char-container, .reaction-space { min-width: 0; }
    .suri-sprite, .enemy-sprite { max-width: 100%; }
    .step-badge-row { flex-wrap: wrap; gap: 8px; }
    .step-text-input { min-width: 0; width: min(260px, 100%); }
    .step-math-input-wrapper { min-width: 0; width: 100%; }
    .step-math-input-wrapper math-field { min-width: 0 !important; }
  }

  /* Problem Transition Loading Popup */
  .problem-loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 5, 3, 0.75);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  }
  .problem-loading-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 28px 40px;
    background: linear-gradient(180deg, rgba(46, 23, 14, 0.98), rgba(24, 11, 6, 0.98));
    border: 3px solid #9c672b;
    border-radius: 18px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.85), 0 0 28px rgba(245, 176, 37, 0.4);
    text-align: center;
    min-width: 280px;
    animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .problem-loading-spinner {
    width: 46px;
    height: 46px;
    border: 4px solid rgba(245, 176, 37, 0.2);
    border-top-color: #f5b025;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .problem-loading-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .problem-loading-title {
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 0.5px;
  }
  .problem-loading-sub {
    color: #d4a373;
    font-size: 13px;
    font-weight: 600;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

function ArenaBackground() {
  return <div className="arena-bg" aria-hidden="true" />;
}

function HeartIcon({ full, breaking }: { full: boolean; breaking?: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24"
      className={`heart-icon${breaking ? " heart-breaking" : full ? "" : " empty"}`}
      fill={full || breaking ? "#ff2244" : "#3a1a2a"}
      aria-label={full ? "Full heart" : "Empty heart"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type GameIconName = "sword" | "flame" | "coin" | "heart" | "bolt" | "book" | "check" | "cross" | "warning" | "play" | "star";

function GameIcon({ name, className = "" }: { name: GameIconName; className?: string }) {
  const cls = `game-icon ${className}`.trim();

  if (name === "sword") {
    return (
      <svg viewBox="0 0 32 32" width="18" height="18" className={cls} aria-hidden="true">
        <path d="M22.8 3.2 29 3l-.2 6.2-13 13-3.1-3.1 10.1-15.9Z" fill="#d9f3ff" stroke="#33505f" strokeWidth="1.5" />
        <path d="m12.7 19.1-2.8 2.8" stroke="#ffe08d" strokeWidth="4" strokeLinecap="round" />
        <path d="m8.8 20.4 2.8 2.8-5.8 5.8-2.8-2.8 5.8-5.8Z" fill="#8b5629" stroke="#3f2719" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "flame") {
    return (
      <svg viewBox="0 0 32 32" width="18" height="18" className={cls} aria-hidden="true">
        <path d="M17.1 3.4c2.6 5.1 8 7.6 8 15.1A9.1 9.1 0 0 1 16 27.8a9.1 9.1 0 0 1-9.1-9.3c0-4.9 3.2-8.1 6.1-11.7-.2 3.4 1.2 5.2 3 6.6 1.8-2.3 2.4-5.6 1.1-10Z" fill="#f36b32" stroke="#6b2d18" strokeWidth="1.5" />
        <path d="M16.2 14.4c2 2.5 3.6 4.1 3.6 7.1a3.8 3.8 0 1 1-7.6 0c0-2.5 1.8-4.3 4-7.1Z" fill="#ffe08d" />
      </svg>
    );
  }
  if (name === "coin") {
    return (
      <svg viewBox="0 0 32 32" width="18" height="18" className={cls} aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#f4c653" stroke="#6b491b" strokeWidth="2" />
        <circle cx="16" cy="16" r="7" fill="#ffe08d" opacity=".7" />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg viewBox="0 0 32 32" width="18" height="18" className={cls} aria-hidden="true">
        <path d="M18.5 2 7 18h8l-1.5 12L25 13h-8l1.5-11Z" fill="#ffe08d" stroke="#6b491b" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg viewBox="0 0 32 32" width="18" height="18" className={cls} aria-hidden="true">
        <path d="M5 6.5c4.2-.8 7.4-.1 11 2.2v18.1c-3.4-2.2-6.8-3-11-2.2V6.5Z" fill="#f4e1a0" stroke="#5b3a20" strokeWidth="1.8" />
        <path d="M27 6.5c-4.2-.8-7.4-.1-11 2.2v18.1c3.4-2.2 6.8-3 11-2.2V6.5Z" fill="#d7f0c0" stroke="#5b3a20" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg viewBox="0 0 32 32" width="16" height="16" className={cls} aria-hidden="true">
        <path d="m8 16 5 5L24 10" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "cross") {
    return (
      <svg viewBox="0 0 32 32" width="16" height="16" className={cls} aria-hidden="true">
        <path d="M9 9 23 23M23 9 9 23" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" className={cls} fill="currentColor" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }
  return null;
}

type SuriState = "idle" | "attack" | "hit" | "happy" | "sad" | "defeated";
type EnemyAnimState = "idle" | "attack" | "hit" | "defeated" | "appear";

function suriImg(s: SuriState): string {
  if (s === "happy") return "/suri-snake-happy.png";
  if (s === "sad" || s === "hit" || s === "defeated") return "/suri-snake-sad.png";
  return "/suri-snake-right.png";
}
function suriAlt(s: SuriState): string {
  if (s === "happy") return "Suri celebrating";
  if (s === "sad" || s === "hit") return "Suri recoiling";
  if (s === "attack") return "Suri attacking";
  return "Suri in battle stance";
}
function suriCls(s: SuriState): string {
  if (s === "attack") return "suri-sprite suri-attacking";
  if (s === "hit") return "suri-sprite suri-hit";
  if (s === "defeated") return "suri-sprite suri-defeated-anim";
  return "suri-sprite suri-idle";
}
function enemyCls(s: EnemyAnimState): string {
  if (s === "hit") return "enemy-sprite enemy-hit";
  if (s === "defeated") return "enemy-sprite enemy-defeated-anim";
  if (s === "appear") return "enemy-sprite enemy-appear";
  if (s === "attack") return "enemy-sprite enemy-attacking";
  return "enemy-sprite enemy-idle";
}

export default function PracticePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;
  const { muted, toggleMuted, unlock: unlockSound, play: playSound } = useBattleAudio();

  const MAX_HEARTS = 3;

  const [phase, setPhase] = useState<"intro" | "battle" | "complete">("intro");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [problemLoading, setProblemLoading] = useState<boolean>(false);

  const [nodeId, setNodeId] = useState<string>("");
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentProblemIdx, setCurrentProblemIdx] = useState<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [stepInput, setStepInput] = useState<string>("");

  const [completedSteps, setCompletedSteps] = useState<Array<{
    step: PracticeStep;
    submittedValue: string;
    correct: boolean;
  }>>([]);

  const [allStepSubmissions, setAllStepSubmissions] = useState<Record<number, { step_index: number; submitted_value: string }[]>>({});
  const [problemStars, setProblemStars] = useState<Record<number, number>>({});
  // Per-step reports returned by the backend, shown on the completion screen.
  const [problemReports, setProblemReports] = useState<Record<number, PracticeSubmitStepResponse>>({});
  // First answer given for each step. Retries and checkpoint resets never
  // overwrite it, so the backend scores the student's first attempt.
  const firstAttemptsRef = useRef<Record<number, Record<number, string>>>({});
  const [problemMistakes, setProblemMistakes] = useState<number>(0);

  // Battle states
  const [suriState, setSuriState] = useState<SuriState>("idle");
  const [suriHearts, setSuriHearts] = useState<number>(MAX_HEARTS);
  const [suriBreaking, setSuriBreaking] = useState<number | null>(null);

  const [enemyAnimState, setEnemyAnimState] = useState<EnemyAnimState>("idle");
  const [enemyShields, setEnemyShields] = useState<number>(0);

  const [enemyDmg, setEnemyDmg] = useState<string | null>(null);
  const [suriDmg, setSuriDmg] = useState<string | null>(null);
  const [combatImpact, setCombatImpact] = useState<(CombatHit & { id: number }) | null>(null);
  const impactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strikeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locked, setLocked] = useState<boolean>(false);
  const battleBusy = useRef(false);
  const pendingAction = useRef<PracticeBattleAction | null>(null);
  const effectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<PracticeBattleState | null>(null);
  const [failedAction, setFailedAction] = useState<PracticeSpell | "answer" | null>(null);
  const [spellEffect, setSpellEffect] = useState<{ spell: PracticeSpell; label: string; stage: "charge" | "strike"; id: number } | null>(null);

  useEffect(() => () => {
    if (effectTimer.current) clearTimeout(effectTimer.current);
    if (impactTimer.current) clearTimeout(impactTimer.current);
    if (strikeTimer.current) clearTimeout(strikeTimer.current);
  }, []);

  const unlockBattle = () => {
    battleBusy.current = false;
    setLocked(false);
  };

  const showSpellEffect = (spell: PracticeSpell, label: string, stage: "charge" | "strike" = "charge") => {
    if (effectTimer.current) clearTimeout(effectTimer.current);
    setSpellEffect(prev => ({ spell, label, stage, id: (prev?.id ?? 0) + 1 }));
    effectTimer.current = setTimeout(() => setSpellEffect(null), stage === "strike" ? 2100 : 1800);
  };

  const showCombatImpact = (target: CombatHit["target"], kind: CombatHit["kind"]) => {
    if (impactTimer.current) clearTimeout(impactTimer.current);
    setCombatImpact(prev => ({ target, kind, id: (prev?.id ?? 0) + 1 }));
    impactTimer.current = setTimeout(() => setCombatImpact(null), kind.startsWith("flame") ? 1300 : 650);
  };

  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [guidanceMode, setGuidanceMode] = useState<boolean>(false);
  const [stepFeedback, setStepFeedback] = useState<{ correct: boolean; correctValue: string } | null>(null);
  const [checkpointNotice, setCheckpointNotice] = useState<{ targetStep: number; wasCheckpoint: boolean } | null>(null);

  // Load practice problems
  const loadPracticeData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await getSession(sessionId);
      const currentNode = session.current_node;
      setNodeId(currentNode);

      const practiceData = await startPractice({
        session_id: sessionId,
        node_id: currentNode,
        enable_powerups: true,
      });

      setBattleId(practiceData.battle_id ?? null);
      try {
        if (practiceData.battle_id) {
          sessionStorage.setItem(`suri_battle_${sessionId}`, practiceData.battle_id);
        } else {
          sessionStorage.removeItem(`suri_battle_${sessionId}`);
        }
      } catch { /* storage unavailable; score just won't be logged */ }
      setBattleState(practiceData.battle_id ? {
        hearts: MAX_HEARTS, used: [], flame_ready: false, ward_ready: false,
        score: 0, correct: null, blocked: false, bonus: 0,
      } : null);
      setProblems(practiceData.problems);
      if (practiceData.problems.length > 0) {
        setEnemyShields(practiceData.problems[0].steps.length);
      }
      setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to load practice problems.");
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      void Promise.resolve().then(loadPracticeData);
    }
  }, [sessionId, loadPracticeData]);

  const currentProblem = problems[currentProblemIdx];
  const currentStep = currentProblem?.steps[currentStepIdx];
  const currentEnemy = ENEMY_ROSTER[currentProblemIdx % ENEMY_ROSTER.length];

  const performBattleAction = async (action: PracticeSpell | "answer") => {
    if (!battleId) return null;
    // Keep the exact payload and ID on a timeout: retrying replays the server result.
    if (pendingAction.current && pendingAction.current.action !== action) {
      toast.error("Retry your previous cast first.");
      return null;
    }
    const request = pendingAction.current ?? {
      battle_id: battleId, problem_id: currentProblem.id,
      request_id: crypto.randomUUID(), action,
      ...(action === "answer" ? { step_index: currentStep.step_index, submitted_value: stepInput.trim() } : {}),
    };
    pendingAction.current = request;
    try {
      const result = await actInPracticeBattle(request);
      pendingAction.current = null;
      setFailedAction(null);
      setBattleState(result);
      return { result, submittedValue: request.submitted_value };
    } catch (error) {
      setFailedAction(action);
      toast.error(error instanceof Error ? error.message : "Could not confirm your cast. Please retry.");
      return null;
    }
  };

  const handleCastPowerup = async (spell: PracticeSpell) => {
    if (!battleId || locked || battleBusy.current || problemLoading || phase !== "battle") return;
    unlockSound();
    battleBusy.current = true;
    setLocked(true);
    const response = await performBattleAction(spell);
    if (response) {
      setSuriHearts(response.result.hearts);
      playSound(spell === "flame" ? "flameCharge" : spell === "ward" ? "ward" : "heal");
      showSpellEffect(spell, spell === "bloom" ? "Healing Bloom · +1 heart" : spell === "flame" ? "Flame charged · unleash with a correct rune" : `${SPELLS.find(s => s.id === spell)!.name} armed`);
    }
    unlockBattle();
  };

  // Auto-focus input field on step change, problem start, or after locking completes
  useEffect(() => {
    if (phase === "battle" && !locked) {
      const timer = setTimeout(() => {
        const textInput = document.querySelector<HTMLInputElement>(".step-text-input");
        if (textInput) {
          textInput.focus();
        } else {
          const mathField = document.querySelector<HTMLElement & { focus: () => void }>("math-field");
          mathField?.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [phase, currentProblemIdx, currentStepIdx, locked]);

  const handleStartBattle = () => {
    unlockSound();
    setEnemyShields(problems[0]?.steps.length ?? MAX_HEARTS);
    setPhase("battle");
    setEnemyAnimState("appear");
    setTimeout(() => setEnemyAnimState("idle"), 800);
  };

  const advanceToNextProblem = useCallback(async (newSubmissions: { step_index: number; submitted_value: string }[], mistakes: number) => {
    const nextProbIdx = currentProblemIdx + 1;
    if (nextProbIdx < problems.length) {
      setProblemLoading(true);
    }

    const stars = calculateStars(mistakes);
    setProblemStars(prev => ({ ...prev, [currentProblemIdx]: stars }));
    setAllStepSubmissions(prev => ({ ...prev, [currentProblemIdx]: newSubmissions }));

    // Send each step's first attempt to the backend for scoring
    try {
      const firstAttempts: Record<number, string> = firstAttemptsRef.current[currentProblemIdx] || {};
      const report = await submitPracticeStep({
        session_id: sessionId,
        node_id: nodeId,
        problem_id: currentProblem.id,
        student_steps: Object.entries(firstAttempts).map(([stepIndex, value]) => ({
          step_index: Number(stepIndex),
          submitted_value: value,
        })),
      });
      setProblemReports(prev => ({ ...prev, [currentProblemIdx]: report }));
    } catch (err) {
      console.error("Backend step submission failed:", err);
    }

    if (nextProbIdx >= problems.length) {
      setPhase("complete");
      playSound("victory");
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    } else {
      // Brief smooth transition display for the loading popup
      await new Promise(resolve => setTimeout(resolve, 600));

      setCurrentProblemIdx(nextProbIdx);
      setCurrentStepIdx(0);
      setCompletedSteps([]);
      setStepInput("");
      setProblemMistakes(0);
      setSuriHearts(MAX_HEARTS);
      setGuidanceMode(false);
      setCheckpointNotice(null);
      setEnemyShields(problems[nextProbIdx].steps.length);
      setEnemyAnimState("appear");
      setProblemLoading(false);
      setStepFeedback(null);
      setSpellEffect(null);
      setCombatImpact(null);
      setBattleState(prev => prev ? {
        ...prev, hearts: MAX_HEARTS, used: [], flame_ready: false, ward_ready: false,
        correct: null, blocked: false, bonus: 0,
      } : null);
      unlockBattle();
      setTimeout(() => setEnemyAnimState("idle"), 800);
    }
  }, [currentProblemIdx, currentProblem, problems, sessionId, nodeId, playSound]);

  const handleCastStep = async () => {
    if (!currentStep || locked || battleBusy.current || problemLoading || !stepInput.trim() || (failedAction && failedAction !== "answer")) return;

    unlockSound();
    battleBusy.current = true;
    setLocked(true);
    setStepFeedback(null);
    setCheckpointNotice(null);

    const response = battleId ? await performBattleAction("answer") : null;
    if (battleId && !response) {
      unlockBattle();
      return;
    }
    const result = response?.result;
    const submittedValue = response?.submittedValue ?? stepInput.trim();
    const isCorrect = result?.correct ?? checkStepCorrect(submittedValue, currentStep.correct_value);
    const attemptsForProblem = (firstAttemptsRef.current[currentProblemIdx] ||= {});
    if (!(currentStep.step_index in attemptsForProblem)) {
      attemptsForProblem[currentStep.step_index] = submittedValue;
    }
    const newCompletedStep = {
      step: currentStep,
      submittedValue,
      correct: isCorrect,
    };

    const newSubmissions = [
      ...(allStepSubmissions[currentProblemIdx] || []),
      { step_index: currentStep.step_index, submitted_value: submittedValue },
    ];
    setAllStepSubmissions(prev => ({ ...prev, [currentProblemIdx]: newSubmissions }));

    if (isCorrect) {
      // Mark step complete in chronicle only on correct answer
      setCompletedSteps(prev => [...prev, newCompletedStep]);
      // Correct step execution
      setSuriState("attack");
      playSound(result?.bonus ? "flameLaunch" : "attack");
      if (result?.bonus) showSpellEffect("flame", "FLAME STRIKE · +25 bonus points", "strike");
      const impactDelay = result?.bonus ? FLAME_FLIGHT_MS : 220;
      strikeTimer.current = setTimeout(() => {
        setEnemyDmg(result?.bonus ? "-1 · +25 pts" : "-1");
        setTimeout(() => setEnemyDmg(null), 900);
        setEnemyAnimState("hit");
        playSound(result?.bonus ? "explosion" : "hit");
        showCombatImpact("enemy", result?.bonus ? enemyShields <= 1 ? "flame-finisher" : "flame" : enemyShields <= 1 ? "finisher" : "rune");
      }, impactDelay);

      setScore(s => result?.score ?? s + (10 + streak * 5));
      setStreak(s => s + 1);
      toast.success("Rune Strike!");

      setTimeout(() => {
        const nextShields = Math.max(0, enemyShields - 1);
        setEnemyShields(nextShields);

        if (nextShields <= 0) {
          // Enemy Defeated — all steps done for this problem
          setEnemyAnimState("defeated");
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          setTimeout(() => {
            setSuriState("happy");
            setTimeout(() => {
              setSuriState("idle");
              void advanceToNextProblem(newSubmissions, problemMistakes);
            }, 600);
          }, 1000);
        } else {
          // More steps remain — advance to next step
          setEnemyAnimState("idle");
          setSuriState("happy");
          setTimeout(() => {
            setSuriState("idle");
            setCurrentStepIdx(idx => idx + 1);
            setStepInput("");
            unlockBattle();
          }, 600);
        }
      }, impactDelay + (result?.bonus ? 950 : 450));

    } else {
      // Wrong step execution
      setEnemyAnimState("attack");
      playSound("enemyAttack");

      setStreak(0);
      const newMistakes = problemMistakes + 1;
      setProblemMistakes(newMistakes);
      setStepFeedback({ correct: false, correctValue: currentStep.correct_value });

      const nextHearts = result?.hearts ?? Math.max(0, suriHearts - 1);

      strikeTimer.current = setTimeout(() => {
        setSuriDmg(result?.blocked ? "BLOCKED" : "-1");
        setTimeout(() => setSuriDmg(null), 900);
        showCombatImpact("suri", result?.blocked ? "blocked" : "hurt");
        playSound(result?.blocked ? "blocked" : "hurt");
        if (result?.blocked) showSpellEffect("ward", "Aegis Ward · hit blocked");
        setSuriState(result?.blocked ? "idle" : "hit");
        setSuriBreaking(result?.blocked ? null : nextHearts);
        setSuriHearts(nextHearts);

        if (nextHearts <= 0) {
          // Recommendation 1: Phase / Checkpoint Reset
          const totalSteps = currentProblem?.steps.length || 1;
          const checkpointIdx = totalSteps > 3 ? Math.floor(totalSteps / 2) : 0;
          const targetStepIdx = currentStepIdx >= checkpointIdx ? checkpointIdx : 0;
          const wasCheckpoint = targetStepIdx > 0;

          setSuriState("defeated");
          setCheckpointNotice({
            targetStep: targetStepIdx + 1,
            wasCheckpoint,
          });

          if (wasCheckpoint) {
            toast.error(`Shields Broken! Falling back to Checkpoint (Step ${targetStepIdx + 1})...`);
          } else {
            toast.error("Shields Broken! Resetting to Step 1...");
          }

          setTimeout(() => {
            setSuriBreaking(null);
            setSuriHearts(MAX_HEARTS);
            setCurrentStepIdx(targetStepIdx);
            setStepInput("");

            const validStepIndices = new Set(
              currentProblem.steps.slice(0, targetStepIdx).map(s => s.step_index)
            );
            setCompletedSteps(prev => prev.filter(cs => validStepIndices.has(cs.step.step_index)));
            setAllStepSubmissions(prev => ({
              ...prev,
              [currentProblemIdx]: (prev[currentProblemIdx] || []).filter(sub => validStepIndices.has(sub.step_index)),
            }));
            setEnemyShields(totalSteps - targetStepIdx);
            setEnemyAnimState("idle");
            setSuriState("idle");
            unlockBattle();
          }, 1200);

        } else {
          if (result?.blocked) toast("Aegis Ward blocked the hit. Try the rune again!", { icon: "🛡️" });
          else toast.error("Rune Countered!");
          setTimeout(() => {
            setSuriBreaking(null);
            setSuriState("sad");
            setEnemyAnimState("idle");
            setTimeout(() => setSuriState("idle"), 600);
          }, 600);

          setTimeout(() => {
            setSuriBreaking(null);
            setEnemyAnimState("idle");
            unlockBattle();
          }, 1200);
        }
      }, 300);
    }
  };

  const handleBackToTopics = () => router.push(`/session/${sessionId}/lesson`);
  const handleGetResults = () => router.push(`/session/${sessionId}/results`);

  if (loading) {
    return (
      <div className="battle-body flex flex-col items-center justify-center p-6 text-center">
        <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
        <ArenaBackground />
        <div className="relative z-10 font-bold text-lg color-[#ffe8a2] animate-pulse">
          Suri is heating the forge and preparing the combat arena...
        </div>
      </div>
    );
  }

  if (errorMsg || problems.length === 0) {
    return (
      <div className="battle-body flex flex-col items-center justify-center p-6 text-center">
        <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
        <ArenaBackground />
        <div className="relative z-10 max-w-md p-6 bg-red-950/80 border-2 border-red-500 rounded-xl">
          <h2 className="text-xl font-bold text-red-200 mb-2">Error</h2>
          <p className="text-sm text-red-300 mb-4">{errorMsg || "No practice problems found."}</p>
          <button onClick={handleBackToTopics} className="ornate-btn">Back to Lesson</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
      <div data-tutorial-scope={`practice-${phase}`} className={`battle-body${phase === "intro" ? " diagnostic-before" : ""}`}>
        <ArenaBackground />

        {/* Loading popup between practice items */}
        {problemLoading && (
          <div className="problem-loading-overlay">
            <div className="problem-loading-card">
              <div className="problem-loading-spinner" />
              <div className="problem-loading-text">
                <span className="problem-loading-title">Loading Next Challenge...</span>
                <span className="problem-loading-sub">Preparing battle runes</span>
              </div>
            </div>
          </div>
        )}


        {/* Intro Splash Screen */}
        {phase === "intro" && (
          <main className="intro-screen" id="intro-screen">
            <div className="intro-parchment-frame">
              <div className="intro-parchment-panel">
                <div className="intro-content">
                  <h1 className="intro-title">RUNE FORGING BATTLE</h1>

                  <div className="intro-ornament" aria-hidden="true">
                    <span />
                  </div>

                  <p className="intro-subtitle">
                    Construct Suri&apos;s counter-spell one step at a time! Each correct step strikes the
                    monster and chips its rune shield. Survive with 3 shields or enter Guardian Mode!
                  </p>

                  <div className="speech-bubble">
                    &ldquo;Ready to forge the counter-runes? Let&apos;s master this together!&rdquo;
                  </div>

                  <div className="intro-char">
                    <img src={currentEnemy.img} alt={currentEnemy.name} className="intro-enemy-img" />
                  </div>

                  <div className="intro-button-row">
                    <div className="intro-button-wrap">
                      <button className="intro-start-btn" onClick={handleStartBattle}>
                        START BATTLE ⚡
                      </button>
                    </div>
                    <div className="intro-button-wrap">
                      <button className="intro-skip-btn" onClick={handleBackToTopics}>
                        Exit to Lesson &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* Battle Layout */}
        {phase === "battle" && (
          <div className="battle-layout">
            {/* Left Column: Step Chronicle (Progress Trail) */}
            <aside className="step-chronicle">
              <div className="panel-header-title">
                <GameIcon name="book" /> Target Expression
              </div>
              <div className="target-expr-scroll font-bold text-center text-lg">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {cleanMathExpr(currentProblem.problem_expr).startsWith("$") ? cleanMathExpr(currentProblem.problem_expr) : `$${cleanMathExpr(currentProblem.problem_expr)}$`}
                </ReactMarkdown>
              </div>

              {currentProblem.word_problem_text && (
                <div className="word-problem-card">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: (props) => <span {...props} /> }}
                  >
                    {formatMathInText(currentProblem.word_problem_text)}
                  </ReactMarkdown>
                </div>
              )}

              <div className="panel-header-title mt-2">
                <GameIcon name="sword" /> Step Chronicle
              </div>
              <div className="chronicle-list">
                {(() => {
                  const totalSteps = currentProblem.steps.length;
                  const checkpointIdx = totalSteps > 3 ? Math.floor(totalSteps / 2) : 0;

                  return currentProblem.steps.map((st, idx) => {
                    const completed = completedSteps.find(cs => cs.step.step_index === st.step_index);
                    const isActive = idx === currentStepIdx && !completed;
                    const isPending = idx > currentStepIdx && !completed;

                    let statusClass = "";
                    if (completed) {
                      statusClass = completed.correct ? "is-correct" : "is-wrong";
                    } else if (isActive) {
                      statusClass = "is-active";
                    } else if (isPending) {
                      statusClass = "is-pending";
                    }

                    return (
                      <React.Fragment key={st.step_index}>
                        {checkpointIdx > 0 && idx === checkpointIdx && (
                          <div className="chronicle-checkpoint-flag">
                            <span>🚩 Milestone Checkpoint</span>
                          </div>
                        )}
                        <div className={`chronicle-item ${statusClass}`}>
                          <div className="chronicle-badge">{idx + 1}</div>
                      <div className="flex-1 text-xs space-y-1">
                        <div className="font-bold text-amber-100 leading-snug">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{ p: (props) => <span {...props} /> }}
                          >
                            {formatMathInText(st.instruction)}
                          </ReactMarkdown>
                        </div>
                        {completed && (
                          <div className="chronicle-equation-preview mt-1">
                            {(() => {
                              const cleanBlankExpr = cleanMathExpr(st.blank_expression).replace("?", "___");
                              const exprParts = cleanBlankExpr.split("___");
                              const rawBefore = exprParts[0];
                              const rawAfter = exprParts[1] || "";
                              const { fixedBefore, fixedAfter } = fixUnbalancedMath(rawBefore, rawAfter);

                              return (
                                <div className="chronicle-input-slot-display flex items-center gap-1.5 flex-wrap text-xs">
                                  {rawBefore.trim() && (
                                    <span className="text-amber-100 font-mono">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: (props) => <span {...props} /> }}>
                                        {fixedBefore}
                                      </ReactMarkdown>
                                    </span>
                                  )}
                                  <span className={`chronicle-filled-slot ${completed.correct ? "is-correct" : "is-wrong"}`}>
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: (props) => <span {...props} /> }}>
                                      {completed.submittedValue.startsWith("$") ? completed.submittedValue : `$${completed.submittedValue}$`}
                                    </ReactMarkdown>
                                  </span>
                                  {rawAfter.trim() && (
                                    <span className="text-amber-100 font-mono">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: (props) => <span {...props} /> }}>
                                        {fixedAfter}
                                      </ReactMarkdown>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {isActive && <div className="text-amber-300 font-bold text-[11px] animate-pulse">In Progress...</div>}
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
            </div>
          </aside>

            {/* Right Area: HUD Header (Top) + Arena (Middle) + Input Answer (Bottom) */}
            <div className="right-main-area">
              {/* HUD Header Bar */}
              <header className="hud-bar" role="banner">
                <div className="hud-brand">
                  <div className="combatant-card hero-card">
                    <span className="level-badge">Lv 1</span>
                    <div>
                      <span className="combatant-name">Suri</span>
                      <span className="combatant-subtitle">GRADUATE BOOKWORM</span>
                      <div className="hearts-bar" aria-label={`Suri hearts: ${suriHearts} of ${MAX_HEARTS}`}>
                        {Array.from({ length: MAX_HEARTS }, (_, i) => (
                          <HeartIcon key={i} full={i < suriHearts} breaking={suriBreaking === i} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chapter-banner">
                  <span className="chapter-eyebrow">
                    {`CHALLENGE ${currentProblemIdx + 1} | STEP ${currentStepIdx + 1} OF ${currentProblem?.steps.length || 1}`}
                  </span>
                  <span className="hud-logo">Practice Battle</span>
                  <div className="hud-progress-bar" role="progressbar">
                    <div
                      className="hud-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.round(((currentProblemIdx + (currentStepIdx / Math.max(1, currentProblem?.steps.length || 1))) / Math.max(1, problems.length)) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                <div className="hud-right">
                  <div className="combatant-card enemy-card">
                    <div>
                      <span className="combatant-name">{currentEnemy.name}</span>
                      <span className="combatant-subtitle">{currentEnemy.title}</span>
                      <div className="hearts-bar" aria-label="Enemy shields">
                        {Array.from({ length: MAX_HEARTS }, (_, i) => {
                          const hi = MAX_HEARTS - 1 - i;
                          return <HeartIcon key={hi} full={hi < enemyShields} breaking={enemyAnimState === "hit" && hi === enemyShields - 1} />;
                        })}
                      </div>
                    </div>
                    <div className="enemy-stats-stack">
                      {streak > 1 && <div className="streak-pill" aria-label={`${streak} answer streak`}><GameIcon name="flame" /> {streak}x</div>}
                      <div className="score-chip" aria-label={`Score: ${score}`}><GameIcon name="coin" /> {score}</div>
                    </div>
                  </div>
                </div>
              </header>

              {/* Middle: Arena Section */}
              <div className="arena-section" aria-label="Battle arena" data-impact={combatImpact?.kind}>
                {combatImpact && <CombatImpact key={`impact-${combatImpact.id}`} target={combatImpact.target} kind={combatImpact.kind} />}
                {spellEffect && <SpellEffect key={`spell-${spellEffect.id}`} spell={spellEffect.spell} label={spellEffect.label} stage={spellEffect.stage} />}
                <div className="char-container suri-side">
                  <div className="sprite-frame">
                    {battleState?.ward_ready && <span className="suri-spell-aura aura-ward" aria-hidden="true" />}
                    {battleState?.flame_ready && <span className="suri-spell-aura aura-flame" aria-hidden="true" />}
                    {suriDmg && <div className="dmg-number dmg-suri">{suriDmg}</div>}
                    <img src={suriImg(suriState)} alt={suriAlt(suriState)} className={suriCls(suriState)} draggable={false} />
                  </div>
                </div>

                <div className="reaction-space" aria-live="polite">
                  {battleState?.flame_ready || battleState?.ward_ready ? (
                    <ArmedSpellBubble flameReady={!!battleState.flame_ready} wardReady={!!battleState.ward_ready} />
                  ) : stepFeedback ? (
                    <div className="speech-bubble">
                      {stepFeedback.correct ? "Rune Forged! ⚡" : "Nice Try!"}
                    </div>
                  ) : guidanceMode ? (
                    <div className="speech-bubble" style={{ fontSize: 13 }}>
                      🛡️ Guardian Shield Active
                    </div>
                  ) : null}
                </div>

                <div className="char-container enemy-side">
                  <div className="sprite-frame">
                    {enemyDmg && <div className="dmg-number dmg-enemy">{enemyDmg}</div>}
                    <img src={currentEnemy.img} alt={currentEnemy.name} className={enemyCls(enemyAnimState)} draggable={false} />
                  </div>
                </div>
              </div>

              {/* Bottom: Input Answer Panel */}
              <section className="input-panel" aria-label="Input step answer">
                {guidanceMode && (
                  <div className="guidance-banner">
                    🛡️ SURI&apos;S GUARDIAN MODE ACTIVE: Focus shields down! Review the pattern to complete the forge.
                  </div>
                )}

                {currentStep && (
                  <div className="active-step-box">
                    <div className="step-badge-row">
                      <span className="step-badge"><GameIcon name="bolt" /> Step {currentStepIdx + 1} of {currentProblem.steps.length}</span>
                      <span className="step-type-pill">{currentStep.step_type}</span>
                    </div>

                    <div className="step-instruction-text">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: (props) => <span {...props} /> }}
                      >
                        {formatMathInText(currentStep.instruction)}
                      </ReactMarkdown>
                    </div>

                    {/* Equation Input Slot */}
                    <div className="equation-input-strip">
                      {(() => {
                        const cleanBlankExpr = cleanMathExpr(currentStep.blank_expression).replace("?", "___");
                        const exprParts = cleanBlankExpr.split("___");
                        const rawBefore = exprParts[0];
                        const rawAfter = exprParts[1] || "";
                        const { fixedBefore, fixedAfter } = fixUnbalancedMath(rawBefore, rawAfter);

                        return (
                          <>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: (props) => <span {...props} /> }}>
                              {fixedBefore}
                            </ReactMarkdown>

                            {requiresTextInput(currentStep.correct_value) ? (
                              <input
                                key={`text-${currentProblemIdx}-${currentStepIdx}`}
                                type="text"
                                value={stepInput}
                                onChange={(e) => setStepInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !locked && stepInput.trim()) {
                                    e.preventDefault();
                                    void handleCastStep();
                                  }
                                }}
                                disabled={locked || !!failedAction}
                                autoFocus
                                placeholder="..."
                                className="step-text-input"
                              />
                            ) : (
                              <div
                                className="step-math-input-wrapper"
                                onClick={() => {
                                  const mf = document.querySelector<HTMLElement & { focus: () => void }>(".step-math-input-wrapper math-field");
                                  mf?.focus();
                                }}
                              >
                                <MathField
                                  key={`math-${currentProblemIdx}-${currentStepIdx}`}
                                  value={stepInput}
                                  onChange={setStepInput}
                                  disabled={locked || !!failedAction}
                                  autoFocus
                                  onEnter={() => {
                                    if (!locked && stepInput.trim()) {
                                      void handleCastStep();
                                    }
                                  }}
                                />
                              </div>
                            )}

                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: (props) => <span {...props} /> }}>
                              {fixedAfter}
                            </ReactMarkdown>
                          </>
                        );
                      })()}
                    </div>

                    {/* Feedback Banner */}
                    {checkpointNotice ? (
                      <div className="feedback-banner checkpoint">
                        <img src="/suri-snake-sad.png" alt="Suri recovering" className="feedback-suri" />
                        <div>
                          <p className="feedback-title">
                            <GameIcon name="warning" /> {checkpointNotice.wasCheckpoint ? "Shields Shattered — Checkpoint Recovered!" : "Shields Shattered — Starting Over at Step 1!"}
                          </p>
                          <div className="feedback-quote">
                            {checkpointNotice.wasCheckpoint
                              ? `Milestone preserved! Returned to Step ${checkpointNotice.targetStep} with 3 fresh hearts.`
                              : "All hearts were lost. Hearts restored to 3 — let's re-forge from Step 1!"}
                          </div>
                        </div>
                      </div>
                    ) : stepFeedback && !stepFeedback.correct ? (
                      <div className="feedback-banner wrong">
                        <img src="/suri-snake-sad.png" alt="Suri sad" className="feedback-suri" />
                        <div>
                          <p className="feedback-title"><GameIcon name="warning" /> Rune Countered!</p>
                          <div className="feedback-quote flex items-center gap-1">
                            <span>Correct answer:</span>
                            <span className="font-bold underline text-amber-200 ml-1">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{ p: (props) => <span {...props} /> }}
                              >
                                {stepFeedback.correctValue.startsWith("$") ? stepFeedback.correctValue : `$${stepFeedback.correctValue}$`}
                              </ReactMarkdown>
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Action Button */}
                    <button
                      onClick={handleCastStep}
                      disabled={locked || !stepInput.trim() || (!!failedAction && failedAction !== "answer")}
                      className={`attack-btn ${stepInput.trim() && !locked && (!failedAction || failedAction === "answer") ? "ready" : "disabled"}`}
                    >
                      {locked ? "Casting Rune..." : failedAction === "answer" ? "RETRY INSCRIPTION ⚡" : "CAST INSCRIPTION ⚡"}
                    </button>
                  </div>
                )}

                {/* Bottom Nav */}
                <div className="bottom-bar">
                  <button onClick={handleBackToTopics} className="ornate-btn">
                    Back to Lesson
                  </button>
                  <div />
                  <button onClick={() => router.push("/dashboard")} className="ornate-btn">
                    Back to Menu
                  </button>
                </div>
              </section>
            </div>
            <BattleSpells state={battleState} disabled={locked || problemLoading || !currentStep}
              failedAction={failedAction} onCast={spell => void handleCastPowerup(spell)}
              muted={muted} onToggleMuted={toggleMuted} />
          </div>
        )}

        {/* Completion Screen */}
        {phase === "complete" && (
          <main className="completion-screen-wrap">
            <div className="completion-card">
              <h1 className="completion-title">PRACTICE BATTLE COMPLETE!</h1>
              <p className="completion-subtitle">
                Suri forged every counter-spell and restored balance to the arena!
              </p>

              <img src="/suri-snake-happy.png" alt="Suri Happy" className="completion-suri-img" />

              <div className="completion-problem-list">
                {problems.map((prob, idx) => {
                  const stars = problemStars[idx] || 1;
                  return (
                    <div key={prob.id} className={`completion-problem-row${problemReports[idx] ? " has-report" : ""}`}>
                      <span className="completion-problem-text">
                        Problem {idx + 1}:{" "}
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{ p: (props) => <span {...props} /> }}
                        >
                          {cleanMathExpr(prob.problem_expr).startsWith("$") ? cleanMathExpr(prob.problem_expr) : `$${cleanMathExpr(prob.problem_expr)}$`}
                        </ReactMarkdown>
                      </span>
                      <div className="completion-stars">
                        {Array.from({ length: 3 }, (_, sIdx) => (
                          <GameIcon key={sIdx} name="star" className={`star-icon${sIdx < stars ? "" : " empty"}`} />
                        ))}
                      </div>
                      {problemReports[idx] && (
                        <div className="completion-step-report">
                          {problemReports[idx].step_results.map((r) => {
                            const isBreakdown = problemReports[idx].misconception_step_index === r.step_index;
                            const stepInfo = prob.steps.find(st => st.step_index === r.step_index);
                            return (
                              <div
                                key={r.step_index}
                                className={`step-card${r.correct ? " is-correct" : " is-wrong"}${isBreakdown ? " is-breakdown" : ""}`}
                              >
                                <div className="step-card-head">
                                  <span className="step-card-mark">{r.correct ? "✓" : "✗"}</span>
                                  <span className="step-card-title">Step {r.step_index + 1}</span>
                                  {isBreakdown && <span className="step-card-flag">Reasoning broke down here</span>}
                                </div>
                                {stepInfo?.instruction && (
                                  <div className="step-card-instruction"><MathInline text={stepInfo.instruction} /></div>
                                )}
                                <div className="step-card-answers">
                                  <div className="step-card-answer">
                                    <span className="step-card-label">Your first answer</span>
                                    <span className="step-card-value">
                                      {r.submitted_value ? <MathInline text={r.submitted_value} isValue /> : "(blank)"}
                                    </span>
                                  </div>
                                  {!r.correct && (
                                    <div className="step-card-answer is-key">
                                      <span className="step-card-label">Correct answer</span>
                                      <span className="step-card-value"><MathInline text={r.correct_value} isValue /></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {problemReports[idx].feedback_text && (
                            <div className="completion-step-note"><MathInline text={problemReports[idx].feedback_text} /></div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="completion-score-badge">
                <span>Total Score:</span>
                <span className="score-val">{score} ⚡</span>
              </div>

              <button onClick={handleGetResults} className="completion-action-btn">
                Get Session Summary &gt;
              </button>
            </div>
          </main>
        )}
      </div>
    </>
  );
}
