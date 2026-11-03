"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession, getContent, ContentResponse } from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import confetti from "canvas-confetti";
import {
  BookOpen,
  Sparkles,
  Compass,
  Flame,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

// SURI's custom motivational tips tailored directly to active node topics
const SURI_COMMENTARY: Record<string, string> = {
  "QE": "Sss-olve this parabola puzzle, Ranger! Those roots are where the curve kisses the baseline trail!",
  "SLE": "Lines overlapping? Sss-uch a perfect intersection of pathways! Find where they meet!",
  "RER": "Rational exponents are just radicals in disguise! Unwrap their power carefully!",
  "FP": "Factoring is like finding GCF keys to unlock hidden gates in the wood!",
  "OI": "Watch those negative signs carefully! They are like tricky bramble thorns!",
  "PE": "Higher-degree polynomials have many roots! Track down every single sss-olution!"
};

// Count Calculus flavor-text, previewing the coming fight while Suri studies
const VILLAIN_WATCH: Record<string, string> = {
  "QE": "Count Calculus is grinding fresh parabola wards into the head of his staff...",
  "SLE": "He is plotting two crossing ley-lines, hoping to trap the unwary at their meeting point...",
  "RER": "Radicals curl like smoke around his gauntlets as he rehearses his opening spell...",
  "FP": "He is stacking factored blocks into a wall, daring you to find the crack...",
  "OI": "Watch the number-line vector closely — he is testing which way it will swing...",
  "PE": "Extra roots are sprouting from his staff like thorns. He will use every one of them..."
};

// ── Client-Side Text Pre-Processor (Converts Wall of Text to Spaced Lessons) ── [2]
function formatLessonMarkdown(text: string): string {
  if (!text) return "";

  const stepRules = [
    { trigger: "Distribute the 2/3", heading: "### Step 1: Distribute Fractional Coefficients" },
    { trigger: "Simplify the multiplication", heading: "### Step 2: Simplify Term Calculations" },
    { trigger: "To eliminate the fraction", heading: "### Step 3: Eliminate Fractional Denominators" },
    { trigger: "Distribute the 3 on both sides", heading: "### Step 4: Apply Left/Right Distribution" },
    { trigger: "Now, we want to arrange", heading: "### Step 5: Group Variables on One Side" },
    { trigger: "Move the constant", heading: "### Step 6: Isolate Variable Terms" },
    { trigger: "The standard form usually", heading: "### Step 7: Standardize Leading Coefficients" }
  ];

  let cleaned = text;
  stepRules.forEach(({ trigger, heading }) => {
    cleaned = cleaned.replace(trigger, `\n\n${heading}\n\n${trigger}`);
  });

  return cleaned;
}

const LESSON_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

  .spellbook-study {
    min-height: 100vh;
    padding: clamp(10px, 1.5vw, 18px);
    background:
      radial-gradient(circle at 50% 0%, rgba(250,204,96,0.18), transparent 28%),
      linear-gradient(135deg, #1b0e12 0%, #392016 42%, #151025 100%);
    color: #fff4d5;
    font-family: Georgia, 'Times New Roman', serif;
    position: relative;
    overflow-x: hidden;
  }
  .spellbook-study::before {
    content: "";
    position: fixed;
    inset: 8px;
    z-index: 0;
    pointer-events: none;
    background: rgba(0,0,0,0.36);
  }
  .spellbook-study::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 22%, rgba(255,211,92,0.12), transparent 24%),
      radial-gradient(circle at 84% 18%, rgba(155,67,207,0.16), transparent 26%),
      url('/login/library.png') center bottom / cover no-repeat;
    opacity: .32;
    mix-blend-mode: screen;
  }

  .tome-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  /* ── Header ── */
  .tome-hud {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 120px;
    margin-bottom: 16px;
    padding: 16px clamp(16px, 3vw, 34px);
    border-radius: 0 0 26px 26px;
    background:
      linear-gradient(90deg, #70411f 0 16px, transparent 16px calc(100% - 16px), #70411f calc(100% - 16px)),
      linear-gradient(180deg, #8b5527 0 14px, transparent 14px calc(100% - 14px), #8b5527 calc(100% - 14px)),
      linear-gradient(180deg, rgba(252,229,177,0.97), rgba(235,189,105,0.97));
    box-shadow: 0 12px 0 rgba(39,18,10,0.84), 0 24px 42px rgba(0,0,0,0.38), inset 0 0 0 4px #3b1d13, inset 0 0 0 10px rgba(255,198,92,0.18);
  }
  .tome-hud::before {
    content: "";
    position: absolute;
    inset: 13px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 0 0 18px 18px;
    pointer-events: none;
  }
  .tome-title-block {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .tome-suri-frame {
    position: relative;
    flex-shrink: 0;
    width: 78px;
    height: 78px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 3px solid #6d411c;
    background: radial-gradient(circle at 35% 25%, rgba(255,255,255,0.5), transparent 55%), linear-gradient(180deg, #2f4022, #182716);
    box-shadow: 0 4px 0 rgba(72,34,16,0.6);
    transition: box-shadow .4s ease, filter .4s ease;
  }
  .tome-suri-frame.charge-1 { box-shadow: 0 4px 0 rgba(72,34,16,0.6), 0 0 14px rgba(76,194,117,0.35); }
  .tome-suri-frame.charge-2 { box-shadow: 0 4px 0 rgba(72,34,16,0.6), 0 0 22px rgba(76,194,117,0.55), 0 0 10px rgba(255,211,92,0.4); }
  .tome-suri-frame.charge-3 { box-shadow: 0 4px 0 rgba(72,34,16,0.6), 0 0 32px rgba(76,194,117,0.75), 0 0 22px rgba(255,211,92,0.65); animation: charged 1.6s ease-in-out infinite; }
  @keyframes charged { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }
  .tome-suri {
    height: 54px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(2px 0 0 #17100a) drop-shadow(-2px 0 0 #17100a) drop-shadow(0 6px 10px rgba(76,194,117,0.44));
  }
  .tome-eyebrow {
    display: block;
    color: #6c278e;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }
  .tome-title {
    color: #3a2111;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(24px, 3.4vw, 38px);
    font-weight: 900;
    line-height: 1.05;
    text-shadow: 0 2px 0 rgba(255,255,255,0.45);
  }
  .tome-subtitle {
    margin-top: 5px;
    color: #4e3477;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .8px;
  }
  .tome-subtitle span { color: #7d36bb; }
  .tome-exit {
    position: relative;
    z-index: 1;
    min-height: 46px;
    padding: 0 20px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    font-weight: 900;
    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
    transition: transform .12s ease, filter .12s ease;
    cursor: pointer;
  }
  .tome-exit:hover { transform: translateY(-2px); filter: brightness(1.04); }

  /* ── Status strip: level badge + knowledge orbs ── */
  .tome-status-row {
    position: relative;
    z-index: 1;
    grid-column: 1 / -1;
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 2px solid rgba(111,61,28,0.2);
  }
  .tome-rank {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tome-level-badge {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid #3e2412;
    background: radial-gradient(circle at 35% 25%, #fff1ad, #d69a32 58%, #7b491d);
    color: #2b170d;
    font-family: 'Nunito', sans-serif;
    font-weight: 900;
    font-size: 11px;
  }
  .tome-rank-label {
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #3a2111;
  }
  .orb-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .orb-caption {
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #6c278e;
    margin-right: 2px;
  }
  .knowledge-orb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #6d411c;
    background: rgba(64,34,16,0.28);
    box-shadow: inset 0 2px 3px rgba(0,0,0,0.3);
    transition: all .3s ease;
  }
  .knowledge-orb.is-lit {
    border-color: #ffe288;
    background: radial-gradient(circle at 35% 25%, #fff6aa, #ffd35c 55%, #b8792d);
    box-shadow: 0 0 10px rgba(255,211,92,0.85), 0 0 4px rgba(255,255,255,0.6);
  }

  /* ── Suri's tip balloon ── */
  .tome-speech {
    position: relative;
    z-index: 1;
    margin: 14px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 3px solid #2c160d;
    border-radius: 18px 18px 18px 6px;
    background: linear-gradient(180deg, #fff2c8, #e5bf73);
    color: #341c11;
    box-shadow: 0 5px 0 rgba(43,22,10,0.74), 0 0 20px rgba(255,207,89,0.2);
  }
  .tome-speech img {
    height: 46px;
    width: auto;
    flex-shrink: 0;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
  }
  .tome-speech p {
    margin: 0;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    line-height: 1.5;
  }

  /* ── Layout: pages + villain sidebar ── */
  .tome-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 270px);
    gap: 16px;
    align-items: start;
  }

  .page-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  .page-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    border: 3px solid #725131;
    border-radius: 8px;
    background: linear-gradient(180deg, #69574a, #33271f);
    color: rgba(255,246,220,0.72);
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    box-shadow: 0 5px 0 #1b0f0a, inset 0 1px 0 rgba(255,255,255,0.1);
    cursor: pointer;
    transition: transform .12s ease, filter .12s ease;
  }
  .page-tab:hover { transform: translateY(-2px); }
  .page-tab .page-roman {
    font-family: "Bree Serif", Georgia, serif;
    font-size: 15px;
    color: #ffe8a2;
  }
  .page-tab.is-active {
    border-color: #ffe288;
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    box-shadow: 0 5px 0 #12361e, 0 0 20px rgba(88,255,138,0.36);
  }
  .page-tab.is-active .page-roman { color: #0b2e17; }
  .page-tab.is-done:not(.is-active) {
    border-color: rgba(255,226,136,0.6);
  }
  .page-tab .page-check {
    font-size: 12px;
    color: #ffe288;
  }

  .page-scroll {
    position: relative;
    z-index: 1;
    min-height: 380px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: 5px solid #5e3619;
    background: linear-gradient(90deg, rgba(25,12,8,0.92), rgba(83,46,24,0.94), rgba(25,12,8,0.92)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 66px);
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.28);
    padding: 14px;
  }
  .page-inner {
    border: 3px solid #9c672b;
    background: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.28), transparent 26%), linear-gradient(180deg, #fff0bf, #dec07b);
    color: #2b170d;
    box-shadow: inset 0 0 0 2px rgba(89,48,18,0.14);
    padding: clamp(16px, 2.4vw, 26px);
    flex: 1;
    animation: pageTurn .4s ease-out;
  }
  @keyframes pageTurn {
    0% { opacity: 0; transform: rotateY(-6deg) translateX(-10px); }
    100% { opacity: 1; transform: rotateY(0) translateX(0); }
  }
  .page-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    padding: 4px 12px;
    border: 2px solid rgba(89,48,18,0.3);
    border-radius: 999px;
    background: rgba(255,255,255,0.35);
    color: #6c278e;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .page-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  @media (min-width: 860px) {
    .page-columns.with-visual { grid-template-columns: minmax(0, 1.7fr) minmax(190px, 1fr); }
  }
  .visual-aid-frame {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 220px;
    padding: 14px;
    border: 3px solid #6d411c;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,244,202,0.65));
    box-shadow: inset 0 0 0 2px rgba(89,48,18,0.12), 0 4px 0 rgba(72,34,16,0.35);
  }
  .visual-aid-tag {
    position: absolute;
    top: 0;
    right: 0;
    padding: 4px 10px;
    background: #3b1d13;
    color: #ffe288;
    font-family: 'Nunito', sans-serif;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    border-radius: 0 6px 0 8px;
  }
  .visual-aid-label {
    font-family: 'Nunito', sans-serif;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: #8a5a25;
    margin-bottom: 6px;
  }

  .markdown-content { line-height: 1.9; }
  .markdown-content p { margin-bottom: 1rem; color: #2b170d; font-weight: 700; }
  .markdown-content h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 20px 0 10px;
    padding-bottom: 6px;
    border-bottom: 2px solid rgba(89,48,18,0.2);
    color: #3b1d13;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 14px;
    letter-spacing: .4px;
    text-transform: uppercase;
  }
  .markdown-content ol, .markdown-content ul { padding-left: 1.4rem; margin-bottom: 1rem; font-weight: 700; }
  .markdown-content li { margin-bottom: .4rem; }
  .markdown-content .katex {
    font-weight: 900 !important;
    font-size: 1.05em;
    color: #1b4320 !important;
    background-color: rgba(121,255,143,0.28) !important;
    padding: 2px 7px !important;
    border-radius: 7px !important;
    border: 1.5px solid #17100a !important;
  }
  .markdown-content .katex-display { margin: 1.2rem 0 !important; }
  .markdown-content .katex-display .katex {
    background-color: #fffaf0 !important;
    border: 3px solid #17100a !important;
    padding: 10px 18px !important;
    border-radius: 12px !important;
    box-shadow: 3px 3px 0 rgba(23,16,10,0.9) !important;
    display: inline-block !important;
  }

  .page-footer-row {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 2px solid rgba(89,48,18,0.2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .page-footer-row { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .page-footer-copy {
    margin: 0;
    color: #5a3a15;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
  }
  .check-off-btn {
    min-height: 46px;
    padding: 0 18px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    box-shadow: 0 5px 0 #12361e, 0 0 16px rgba(88,255,138,0.25);
    cursor: pointer;
    transition: transform .12s ease, filter .12s ease;
    white-space: nowrap;
  }
  .check-off-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
  .check-off-btn:disabled {
    cursor: default;
    color: #17633a;
    background: #dff5c8;
    border-color: #4a7d3a;
    box-shadow: none;
  }

  /* ── Villain watch sidebar ── */
  .villain-watch {
    position: sticky;
    top: 16px;
    border: 3px solid #c68b42;
    background: linear-gradient(90deg, rgba(26,8,12,0.72), transparent 18% 82%, rgba(26,8,12,0.72)), linear-gradient(180deg, #751d2f, #2d1017);
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.18);
    padding: 16px;
  }
  .villain-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 10px;
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    text-align: center;
    justify-content: center;
  }
  .villain-portrait {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }
  .villain-portrait img {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 12px;
    border: 3px solid #17100a;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.5));
  }
  .villain-box {
    min-height: 130px;
    padding: 13px;
    border: 2px solid rgba(255,216,116,0.45);
    background: rgba(34,10,16,0.72);
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 700;
    box-shadow: inset 0 0 18px rgba(0,0,0,0.44);
  }
  .villain-box strong { display: block; margin-bottom: 8px; color: #ffe694; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; }
  .villain-countdown {
    margin-top: 10px;
    text-align: center;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #ffb3a6;
  }

  /* ── Footer action row ── */
  .tome-footer {
    position: relative;
    z-index: 1;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  .tome-action {
    width: 100%;
    min-height: 60px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(16px, 1.9vw, 21px);
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: transform .12s ease, filter .12s ease;
  }
  .tome-action.primary {
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    border-color: #ffe288;
    box-shadow: 0 7px 0 #12361e, 0 0 26px rgba(88,255,138,0.28), inset 0 1px 0 rgba(255,255,255,0.4);
  }
  .tome-action.secondary {
    background: linear-gradient(180deg,#ffe596,#b8792d);
    color: #2a160d;
    box-shadow: 0 6px 0 #28150c, inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .tome-action:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
  .tome-action:disabled {
    cursor: not-allowed;
    color: rgba(255,246,220,0.4);
    background: linear-gradient(180deg, #69574a, #33271f);
    border-color: #725131;
    box-shadow: none;
  }

  /* ── Error / loading states ── */
  .tome-status-card {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    border: 5px solid #5e3619;
    background: linear-gradient(90deg, rgba(25,12,8,0.92), rgba(83,46,24,0.94), rgba(25,12,8,0.92)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 66px);
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.28);
    padding: 14px;
  }
  .tome-status-inner {
    border: 3px solid #8e5b20;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow: inset 0 0 0 3px rgba(20,9,5,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
    padding: clamp(20px, 3vw, 30px);
    text-align: center;
  }
  .status-fault-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 2px solid #6d411c;
    border-radius: 7px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .status-title {
    margin: 14px 0 8px;
    color: #ffe8a2;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 22px;
  }
  .status-copy {
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.6;
    margin: 0 0 18px;
  }
  .status-log {
    text-align: left;
    border-left: 4px solid #ff8e7c;
    background: rgba(34,10,16,0.72);
    border-top: 2px solid rgba(255,216,116,0.35);
    border-right: 2px solid rgba(255,216,116,0.35);
    border-bottom: 2px solid rgba(255,216,116,0.35);
    color: #f7dfad;
    padding: 12px;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    word-break: break-all;
    margin-bottom: 16px;
  }
  .status-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
  .status-actions .tome-action { width: auto; min-width: 180px; min-height: 50px; font-size: 14px; }

  .tome-loading {
    min-height: 100vh;
    display: grid;
    place-items: center;
  }
  .tome-spinner {
    position: relative;
    width: 52px;
    height: 52px;
    margin: 0 auto;
  }
  .tome-spinner::before, .tome-spinner::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .tome-spinner::before { border: 5px solid rgba(109,65,28,0.35); }
  .tome-spinner::after { border: 5px solid transparent; border-top-color: #ffe288; border-right-color: #8749b7; animation: spin .85s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 900px) {
    .tome-hud, .tome-grid { grid-template-columns: 1fr; }
    .villain-watch { position: relative; top: auto; }
  }
  @media (max-width: 640px) {
    .spellbook-study { padding: 8px; }
    .tome-hud { padding: 14px 12px; }
    .tome-suri-frame { width: 62px; height: 62px; }
    .tome-suri { height: 42px; }
    .page-columns.with-visual { grid-template-columns: 1fr; }
  }
`;

// ── Dynamic Lesson Graphic Visualizer Component ─────────────────────────────
function LessonVisualizer({ nodeId }: { nodeId: string }) {
  const id = nodeId?.toUpperCase() || "";

  if (id.includes("QE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#3b1d13" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#3b1d13" strokeWidth="1.5" />
          <path d="M 45 25 Q 100 120 155 25" fill="none" stroke="#3b1d13" strokeWidth="3" />
          <circle cx="68" cy="60" r="5" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" className="animate-pulse" />
          <circle cx="132" cy="60" r="5" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" className="animate-pulse" />
          <text x="54" y="52" className="text-[10px] font-mono font-black fill-[#3b1d13]">x₁</text>
          <text x="138" y="52" className="text-[10px] font-mono font-black fill-[#3b1d13]">x₂</text>
        </svg>
        <p className="text-[9px] font-black text-[#8a5a25] text-center uppercase mt-1 tracking-wider">Parabola Roots</p>
      </div>
    );
  }

  if (id.includes("SLE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#3b1d13" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#3b1d13" strokeWidth="1.5" />
          <line x1="30" y1="100" x2="170" y2="20" stroke="#3b1d13" strokeWidth="3" />
          <line x1="30" y1="20" x2="170" y2="100" stroke="#3b1d13" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="100" cy="60" r="6" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" className="animate-ping" />
          <circle cx="100" cy="60" r="4.5" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" />
          <text x="110" y="55" className="text-[10px] font-mono font-black fill-[#3b1d13]">(x, y)</text>
        </svg>
        <p className="text-[9px] font-black text-[#8a5a25] text-center uppercase mt-1 tracking-wider">Line Intersection</p>
      </div>
    );
  }

  if (id.includes("RER")) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 py-4">
        <div className="flex items-center gap-2 text-center">
          <div className="bg-white border-2 border-[#3b1d13] rounded-xl p-2.5 shadow-[2px_2px_0px_0px_#3b1d13]">
            <span className="font-['Hanken_Grotesk'] text-lg font-black text-[#3b1d13]">x</span>
            <sup className="text-[10px] font-mono font-black text-[#ffd35c] bg-[#3b1d13] px-1 rounded ml-0.5">a/b</sup>
          </div>
          <span className="text-[#3b1d13] font-black">⟺</span>
          <div className="bg-white border-2 border-[#3b1d13] rounded-xl p-2.5 shadow-[2px_2px_0px_0px_#3b1d13] relative flex items-center">
            <sup className="text-[8px] font-mono font-black text-slate-400 absolute left-1 top-1">b</sup>
            <span className="font-['Hanken_Grotesk'] text-lg font-black text-[#3b1d13] pl-1">√x</span>
            <sup className="text-[8px] font-mono font-black text-[#ffd35c] bg-[#3b1d13] px-0.5 rounded ml-0.5">a</sup>
          </div>
        </div>
        <p className="text-[9px] font-black text-[#8a5a25] uppercase tracking-widest text-center">
          Radical Rewrite Rule
        </p>
      </div>
    );
  }

  if (id.includes("FP")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <rect x="30" y="10" width="70" height="70" fill="#3b1d13" fillOpacity="0.05" stroke="#3b1d13" strokeWidth="2" />
          <text x="65" y="50" className="text-[10px] font-mono font-black fill-[#3b1d13]">x²</text>
          <rect x="100" y="10" width="45" height="70" fill="#ffd35c" fillOpacity="0.15" stroke="#3b1d13" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="120" y="50" className="text-[10px] font-mono font-black fill-[#3b1d13]">3x</text>
          <rect x="30" y="80" width="70" height="30" fill="#ffd35c" fillOpacity="0.15" stroke="#3b1d13" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="60" y="100" className="text-[10px] font-mono font-black fill-[#3b1d13]">2x</text>
          <rect x="100" y="80" width="45" height="30" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" />
          <text x="120" y="100" className="text-[10px] font-mono font-black fill-[#3b1d13]">+6</text>
          <text x="65" y="5" className="text-[8px] font-mono fill-slate-400 text-center">x</text>
          <text x="122" y="5" className="text-[8px] font-mono fill-[#3b1d13] font-black text-center">+3</text>
          <text x="20" y="50" className="text-[8px] font-mono fill-slate-400">x</text>
          <text x="18" y="98" className="text-[8px] font-mono fill-[#3b1d13] font-black">+2</text>
        </svg>
        <p className="text-[9px] font-black text-[#8a5a25] text-center uppercase mt-1 tracking-wider">Area Factoring Model</p>
      </div>
    );
  }

  if (id.includes("OI")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-3">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#3b1d13" strokeWidth="2" />
          <polygon points="10,56 10,64 2,60" fill="#3b1d13" />
          <polygon points="190,56 190,64 198,60" fill="#3b1d13" />
          <line x1="40" y1="55" x2="40" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="70" y1="55" x2="70" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="100" y1="53" x2="100" y2="67" stroke="#3b1d13" strokeWidth="2" />
          <line x1="130" y1="55" x2="130" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="160" y1="55" x2="160" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <text x="37" y="76" className="text-[8px] font-mono fill-slate-400">-2</text>
          <text x="67" y="76" className="text-[8px] font-mono fill-slate-400">-1</text>
          <text x="98" y="78" className="text-[9px] font-mono font-black fill-[#3b1d13]">0</text>
          <text x="127" y="76" className="text-[8px] font-mono fill-slate-400">+1</text>
          <text x="157" y="76" className="text-[8px] font-mono fill-slate-400">+2</text>
          <path d="M 40 60 Q 70 20 100 60" fill="none" stroke="#ffd35c" strokeWidth="2" strokeDasharray="2 2" />
          <polygon points="98,53 103,58 97,61" fill="#ffd35c" />
          <text x="65" y="32" className="text-[8px] font-mono font-black fill-[#3b1d13]">+2</text>
        </svg>
        <p className="text-[9px] font-black text-[#8a5a25] text-center uppercase mt-1 tracking-wider">Number Line Vector</p>
      </div>
    );
  }

  if (id.includes("PE") || id.includes("PO") || id.includes("PD")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M 30 110 C 60 10, 80 10, 100 60 C 120 110, 140 110, 170 10" fill="none" stroke="#3b1d13" strokeWidth="2.5" />
          <circle cx="50" cy="60" r="4" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" />
          <circle cx="100" cy="60" r="4" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" />
          <circle cx="150" cy="60" r="4" fill="#ffd35c" stroke="#3b1d13" strokeWidth="2" />
          <text x="125" y="20" className="text-[8px] font-mono fill-slate-400">Degree n = 3</text>
        </svg>
        <p className="text-[9px] font-black text-[#8a5a25] text-center uppercase mt-1 tracking-wider">Multi-Root Polynomial</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <BookOpen size={24} className="text-[#3b1d13]/45" />
      <p className="text-[9px] font-black text-[#8a5a25] uppercase tracking-widest text-center mt-2">Theory Sandbox</p>
    </div>
  );
}

type PageTabId = "concept" | "example" | "explanation";

const PAGE_TABS: { id: PageTabId; roman: string; label: string; icon: typeof BookOpen }[] = [
  { id: "concept", roman: "I", label: "Core Concept", icon: BookOpen },
  { id: "example", roman: "II", label: "Worked Example", icon: Sparkles },
  { id: "explanation", roman: "III", label: "Explanation", icon: Compass },
];

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [currentNode, setCurrentNode] = useState<string>("");
  const [errorType, setErrorType] = useState<"no_content" | "general" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic Interactive States for Lesson Progress
  const [activeTab, setActiveTab] = useState<PageTabId>("concept");
  const [readConcept, setReadConcept] = useState(false);
  const [readExample, setReadExample] = useState(false);
  const [readExplanation, setReadExplanation] = useState(false);

  const loadLessonContent = async () => {
    setErrorType(null);
    setErrorMsg(null);

    try {
      const session = await getSession(sessionId);
      setCurrentNode(session.current_node);
      const data = await getContent(session.current_node);

      if (data.error === "no_content") {
        setErrorType("no_content");
        setContent(null);
        return;
      }

      setContent(data);
    } catch (err: unknown) {
      console.error(err);
      setErrorType("general");
      const message =
        err instanceof Error ? err.message : "Failed to connect to the server.";
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail?: string }).detail)
          : message;
      setErrorMsg(detail);
      setContent(null);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadLessonContent();
    }
  }, [sessionId]);

  const handleStartPractice = () => {
    router.push(`/session/${sessionId}/practice`);
  };

  const handleStartQuiz = () => {
    router.push(`/session/${sessionId}/quiz`);
  };

  const handleExit = () => {
    router.push("/topics");
  };

  // Checkbox understanding indicators triggering confetti [2]
  const handleMarkRead = (section: PageTabId) => {
    if (section === "concept") {
      setReadConcept(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else if (section === "example") {
      setReadExample(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else if (section === "explanation") {
      setReadExplanation(true);
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.8 } });
    }
  };

  const readMap: Record<PageTabId, boolean> = {
    concept: readConcept,
    example: readExample,
    explanation: readExplanation,
  };

  const activeMilestonesCount = [readConcept, readExample, readExplanation].filter(Boolean).length;
  const progressPercent = Math.round((activeMilestonesCount / 3) * 100);
  const pagesRemaining = 3 - activeMilestonesCount;
  const chargeClass = activeMilestonesCount > 0 ? ` charge-${activeMilestonesCount}` : "";

  const StatusWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="spellbook-study tome-loading">
      <style dangerouslySetInnerHTML={{ __html: LESSON_CSS }} />
      <div className="tome-status-card">
        <div className="tome-status-inner">{children}</div>
      </div>
    </div>
  );

  if (errorType === "no_content") {
    return (
      <StatusWrapper>
        <span className="status-fault-badge">Spellbook Sealed</span>
        <h2 className="status-title">Page Not Yet Written</h2>
        <p className="status-copy">
          This section of the spellbook has not been inscribed yet. Suri cannot study a page that isn&apos;t there.
        </p>
        <div className="status-actions">
          <button onClick={handleExit} className="tome-action secondary">
            Exit Session
          </button>
        </div>
      </StatusWrapper>
    );
  }

  if (errorType === "general") {
    return (
      <StatusWrapper>
        <span className="status-fault-badge"><ShieldAlert className="w-3.5 h-3.5" /> Spellbook Fault</span>
        <h2 className="status-title">The Ink Has Smudged</h2>
        <p className="status-log">[FAULT_LOG] {errorMsg}</p>
        <div className="status-actions">
          <button onClick={loadLessonContent} className="tome-action secondary">
            Retry
          </button>
          <button onClick={handleExit} className="tome-action secondary">
            Exit Workspace
          </button>
        </div>
      </StatusWrapper>
    );
  }

  if (!content) {
    return (
      <div className="spellbook-study tome-loading">
        <style dangerouslySetInnerHTML={{ __html: LESSON_CSS }} />
        <div className="tome-spinner" />
      </div>
    );
  }

  // Pre-process raw math
  const cleanLessonMath = (expr: string) => {
    const inline = expr.replace(/\$\$(.+?)\$\$/g, (_, inner) => `$${inner}$`);
    return inline
      .replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2")
      .replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2");
  };

  const lessonBody = formatLessonMarkdown(cleanLessonMath(resolveLessonText(content)));
  const workedExample = formatLessonMarkdown(cleanLessonMath(content.worked_example || ""));
  const guidedExplanation = formatLessonMarkdown(cleanLessonMath(content.guided_explanation || ""));

  const suriTip = SURI_COMMENTARY[currentNode] || "Sss-tudy these rules carefully before moving to practice!";
  const villainTip = VILLAIN_WATCH[currentNode] || "Count Calculus is sharpening his staff somewhere beyond the tree line...";

  const pagePrompt: Record<PageTabId, { copy: string; cta: string }> = {
    concept: { copy: "Finished reading the core concept page?", cta: "Check Off Page I" },
    example: { copy: "Followed and calculated along with the worked example?", cta: "Check Off Page II" },
    explanation: { copy: "Understood the complete guided walkthrough?", cta: "Check Off Page III" },
  };

  return (
    <div className="spellbook-study" data-tutorial-scope="lesson">
      <style dangerouslySetInnerHTML={{ __html: LESSON_CSS }} />
      <div className="tome-shell">

        {/* ── Header: Suri's charging portrait + node title + exit ── */}
        <header className="tome-hud">
          <div className="tome-title-block">
            <div className={`tome-suri-frame${chargeClass}`}>
              <img src="/suri-snake-left.png" alt="Suri Guide" className="tome-suri select-none" />
            </div>
            <div className="min-w-0">
              <span className="tome-eyebrow">Spellbook Study</span>
              <h1 className="tome-title truncate">{content.node_label}</h1>
              <p className="tome-subtitle">
               
              </p>
            </div>
          </div>

          <button onClick={handleExit} className="tome-exit">Exit</button>

          <div className="tome-status-row">
            <div className="tome-rank">
              <span className="tome-level-badge">Lv 1</span>
              <span className="tome-rank-label">Graduate Bookworm</span>
            </div>
            <div className="orb-row" aria-label={`${activeMilestonesCount} of 3 pages studied`}>
              <span className="orb-caption">Knowledge</span>
              {[readConcept, readExample, readExplanation].map((lit, i) => (
                <span key={i} className={`knowledge-orb${lit ? " is-lit" : ""}`} />
              ))}
            </div>
          </div>
        </header>

        {/* ── Suri's tip balloon ── */}
        <div className="tome-speech">
          <img src="/suri-snake-left.png" alt="Suri Guide" className="select-none" />
          <p>
            Suri says: <strong>&ldquo;{suriTip}&rdquo;</strong>
          </p>
        </div>

        <div className="tome-grid">
          <div>
            {/* ── Page tabs ── */}
            <div className="page-tabs" role="tablist" aria-label="Spellbook pages">
              {PAGE_TABS.map(({ id, roman, label, icon: Icon }) => {
                const isActive = activeTab === id;
                const isDone = readMap[id];
                return (
                  <button
                    key={id}
                    data-tutorial={`lesson-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={`page-tab${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                  >
                    <span className="page-roman">Page {roman}</span>
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {isDone && <span className="page-check">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Active page scroll ── */}
            <div className="page-scroll">
              <div className="page-inner" key={activeTab}>
                {activeTab === "concept" && (
                  <>
                    <span className="page-badge"><BookOpen className="w-3.5 h-3.5" /> Concept Page</span>
                    <div className="page-columns with-visual">
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {lessonBody}
                        </ReactMarkdown>
                      </div>
                      <div className="visual-aid-frame">
                        <span className="visual-aid-tag">Visual Aid</span>
                        <span className="visual-aid-label">Graphic Aid</span>
                        <div className="flex-1 flex items-center justify-center">
                          <LessonVisualizer nodeId={currentNode} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "example" && (
                  <>
                    <span className="page-badge"><Sparkles className="w-3.5 h-3.5" /> Worked Example</span>
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {workedExample.replace(/\\n/g, "\n")}
                      </ReactMarkdown>
                    </div>
                  </>
                )}

                {activeTab === "explanation" && (
                  <>
                    <span className="page-badge"><Compass className="w-3.5 h-3.5" /> Guided Walkthrough</span>
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {guidedExplanation.replace(/\\n/g, "\n")}
                      </ReactMarkdown>
                    </div>
                  </>
                )}

                <div className="page-footer-row">
                  <p className="page-footer-copy">{pagePrompt[activeTab].copy}</p>
                  <button
                    type="button"
                    disabled={readMap[activeTab]}
                    onClick={() => handleMarkRead(activeTab)}
                    className="check-off-btn"
                  >
                    {readMap[activeTab] ? "✓ Logged Understood!" : pagePrompt[activeTab].cta}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Villain watch sidebar ── */}
          <aside className="villain-watch" aria-label="Count Calculus preview">
            <h2 className="villain-title"><Flame className="w-4 h-4" /> Villain Watch</h2>
            <div className="villain-portrait">
              <img src="/enemy-math-villain.png" alt="Count Calculus watching from afar" />
            </div>
            <div className="villain-box">
              <strong>Count Calculus</strong>
              {villainTip}
            </div>
            <p className="villain-countdown">
              {pagesRemaining > 0
                ? `${pagesRemaining} page${pagesRemaining === 1 ? "" : "s"} left before he strikes`
                : "Fully studied — he won't see this coming"}
            </p>
          </aside>
        </div>

        {/* ── Footer Navigation ── */}
        <footer className="tome-footer">
          <button
            onClick={handleStartQuiz}
            disabled={progressPercent < 100}
            className="tome-action primary"
          >
            Quiz Me! <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
          <button
            onClick={handleStartPractice}
            className="tome-action secondary"
          >
            Let&apos;s Practice! <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
        </footer>

      </div>
    </div>
  );
}

function resolveLessonText(content: ContentResponse): string {
  const simplified = content.simplified_lesson_text;
  if (!simplified) {
    return content.lesson;
  }
  try {
    const parsed = JSON.parse(simplified) as { lesson?: string };
    if (parsed.lesson) {
      return parsed.lesson;
    }
  } catch {
    return simplified;
  }
  return content.lesson;
}
