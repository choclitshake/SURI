"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { BattleSpells, ArmedSpellBubble, SpellEffect, FLAME_FLIGHT_MS } from "../practice/battle-spells";
import { CombatImpact, type CombatHit } from "../practice/battle-impact";
import { useBattleAudio } from "../practice/battle-audio";

import {
  getSession,
  getTopicChain,
  getDiagnosticProbe,
  submitDiagnosticAnswer,
  submitDiagnostic,
  skipDiagnostic,
  startDiagnosticBattle,
  castDiagnosticSpell,
  DiagnosticProbe,
  DiagnosticBattleState,
  DiagnosticSpellRequest,
  DiagnosticBattleAnswerRequest,
  PracticeSpell,
} from "../../../../lib/api";

const GAME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');
  :root {
    --void-dark: #0a0010; --void-purple: #2d0a4e; --glow-purple: #9b59b6;
    --glow-red: #e74c3c; --glow-gold: #f9c31f; --glow-green: #3dbf6e;
    --heart-red: #ff2244; --heart-empty: #3a1a2a;
  }
  * { box-sizing: border-box; }
  .battle-body { font-family: 'Nunito', sans-serif; min-height: 100dvh; overflow-x: hidden; position: relative; background: #0a0010; display: flex; flex-direction: column; }
  .arena-bg { background: url('/login/arena.png') center bottom / cover no-repeat; position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
  .fog-wisp { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px); animation: fogDrift linear infinite; opacity: 0; }
  @keyframes fogDrift { 0% { opacity: 0; transform: translateX(-60px) scaleX(0.8); } 20% { opacity: 0.18; } 80% { opacity: 0.12; } 100% { opacity: 0; transform: translateX(80px) scaleX(1.2); } }
  .pillar { position: absolute; bottom: 32%; width: 48px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #1c0c2e 0%, #2a1040 30%, #100618 100%); border: 1px solid rgba(155,89,182,0.2); box-shadow: inset 2px 0 6px rgba(0,0,0,0.6), inset -2px 0 6px rgba(0,0,0,0.6); }
  .pillar::before { content: ''; position: absolute; top: -14px; left: -6px; right: -6px; height: 14px; background: linear-gradient(180deg, #3a1a5a, #2a1040); border-radius: 4px 4px 0 0; border: 1px solid rgba(155,89,182,0.3); box-shadow: 0 -4px 12px rgba(155,89,182,0.2); }
  .pillar::after { content: ''; position: absolute; bottom: 0; left: -4px; right: -4px; height: 20px; background: linear-gradient(180deg, #2a1040, #1c0828); border-radius: 2px; }
  .skull-deco { position: absolute; pointer-events: none; opacity: 0.25; animation: skullBob 4s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(155,89,182,0.4)); }
  @keyframes skullBob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
  @keyframes emberRise { 0% { transform: translate(0,0) scale(1); opacity: 0.8; } 50% { transform: translate(var(--ex),-60px) scale(0.7); opacity: 0.6; } 100% { transform: translate(var(--ex2),-130px) scale(0.3); opacity: 0; } }
  .ember { position: absolute; border-radius: 50%; pointer-events: none; background: radial-gradient(circle,#fff 0%,#ffaa00 40%,#ff4400 80%,transparent 100%); animation: emberRise ease-out infinite; filter: blur(0.5px); }
  @keyframes fireflyMove { 0% { transform: translate(0,0) scale(0.7); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 0.8; } 100% { transform: translate(var(--ftx),var(--fty)) scale(1.2); opacity: 0; } }
  .firefly { position: absolute; border-radius: 50%; pointer-events: none; background: radial-gradient(circle,#ffd700 0%,#ff9500 60%,transparent 100%); animation: fireflyMove linear infinite; filter: blur(1px); }
  .hud-bar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 8px 20px; background: linear-gradient(180deg,rgba(10,0,20,0.98) 0%,rgba(15,0,30,0.92) 100%); border-bottom: 2px solid rgba(155,89,182,0.4); box-shadow: 0 4px 20px rgba(0,0,0,0.8); backdrop-filter: blur(10px); flex-shrink: 0; }
  .hud-brand { display: flex; align-items: center; gap: 10px; }
  .hud-logo { font-family: 'Fredoka One', cursive; font-size: 20px; color: #fff; text-shadow: 0 0 10px rgba(155,89,182,0.8); letter-spacing: 2px; }
  .hud-tag { background: rgba(155,89,182,0.25); border: 1px solid rgba(155,89,182,0.5); border-radius: 8px; padding: 3px 10px; font-size: 10px; font-weight: 800; color: #c49a6c; text-transform: uppercase; letter-spacing: 2px; }
  .hud-center { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .hud-progress-text { font-family: 'Fredoka One', cursive; color: rgba(255,255,255,0.7); font-size: 13px; white-space: nowrap; }
  .hud-progress-bar { width: 80px; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; border: 1px solid rgba(155,89,182,0.3); overflow: hidden; }
  .hud-progress-fill { height: 100%; background: linear-gradient(90deg,#9b59b6,#c39bd3); border-radius: 4px; transition: width 0.5s ease; box-shadow: 0 0 8px rgba(155,89,182,0.6); }
  .hud-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .streak-pill { display: flex; align-items: center; gap: 4px; background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.5); border-radius: 14px; padding: 4px 10px; font-family: 'Fredoka One', cursive; color: #ff8c69; font-size: 14px; }
  .score-chip { display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg,#f9d71c,#e8a21a); border: 2px solid #5c3a1e; border-radius: 20px; padding: 5px 12px; font-family: 'Fredoka One', cursive; color: #5c3a1e; font-size: 16px; box-shadow: 0 3px 0 #9a5c08; letter-spacing: 1px; }
  .battle-layout { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 0; }
  .arena-section { display: flex; align-items: flex-end; justify-content: center; gap: 0; padding: 24px 32px 0; position: relative; }
  .char-container { display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; z-index: 10; }
  .char-container.suri-side { align-items: flex-start; flex: 1; max-width: 320px; }
  .char-container.enemy-side { align-items: flex-end; flex: 1; max-width: 320px; }
  .name-plate { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .char-name { font-family: 'Fredoka One', cursive; font-size: 16px; text-shadow: 1px 1px 0 rgba(0,0,0,0.8); letter-spacing: 1px; }
  .char-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; }
  .hearts-bar { display: flex; gap: 6px; align-items: center; justify-content: center; padding: 6px 12px; background: rgba(0,0,0,0.5); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(4px); }
  .heart-icon { flex-shrink: 0; transition: all 0.3s; filter: drop-shadow(0 0 6px rgba(255,34,68,0.8)); }
  .heart-icon.empty { opacity: 0.2; filter: grayscale(1); }
  @keyframes heartBreak { 0% { transform: scale(1.5) rotate(-8deg); filter: drop-shadow(0 0 16px #ff2244) brightness(2); } 25% { transform: scale(0.8) rotate(12deg); } 50% { transform: scale(1.2) rotate(-5deg); } 100% { transform: scale(1) rotate(0); opacity: 0.2; filter: grayscale(1); } }
  .heart-breaking { animation: heartBreak 0.7s ease-out forwards; }
  .sprite-frame { position: relative; display: flex; align-items: flex-end; justify-content: center; }
  .suri-sprite { height: 200px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); transform-origin: bottom center; transition: filter 0.2s; }
  @media (max-width: 700px) { .suri-sprite { height: 130px; } }
  @keyframes suriAttack { 0% { transform: translateX(0) scaleX(1); } 20% { transform: translateX(40px) scaleX(1.15) skewX(-5deg); filter: drop-shadow(0 0 20px #3dbf6e) brightness(1.4); } 45% { transform: translateX(80px) scaleX(1.2) skewX(-8deg); filter: drop-shadow(0 0 30px #3dbf6e) brightness(1.6); } 70% { transform: translateX(20px) scaleX(1.05); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-attacking { animation: suriAttack 0.75s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes suriHit { 0% { transform: translateX(0); } 15% { transform: translateX(-30px) scaleX(0.9); filter: brightness(2.5) saturate(0) drop-shadow(0 0 20px #ff2244); } 55% { transform: translateX(-25px) scaleX(0.95); } 100% { transform: translateX(0) scaleX(1); filter: drop-shadow(0 8px 20px rgba(61,191,110,0.5)); } }
  .suri-hit { animation: suriHit 0.7s ease-out forwards; }
  @keyframes suriIdle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .suri-idle { animation: suriIdle 2.8s ease-in-out infinite; }
  @keyframes suriDefeat { 0% { transform: translateY(0) rotate(0); } 40% { transform: translateY(-10px) rotate(-8deg); filter: brightness(0.6) saturate(0.3); } 100% { transform: translateY(6px) rotate(-12deg); filter: brightness(0.5) saturate(0); opacity: 0.7; } }
  .suri-defeated-anim { animation: suriDefeat 0.8s ease-out forwards; }
  .enemy-sprite { width: 200px; height: 200px; object-fit: cover; drop-shadow(0 0 20px rgba(108,52,131,0.6)); transform-origin: bottom center; }
  @media (max-width: 700px) { .enemy-sprite { width: 130px; height: 130px; } }
  @keyframes enemyIdle { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-6px) rotate(-1.5deg); } 75% { transform: translateY(-4px) rotate(1.5deg); } }
  .enemy-idle { animation: enemyIdle 2.5s ease-in-out infinite; }
  @keyframes enemyHit { 0% { transform: translateX(0) scale(1); } 10% { transform: translateX(30px) scale(1.08); filter: brightness(3) saturate(0); } 25% { transform: translateX(-20px) scale(0.94); filter: brightness(2) hue-rotate(30deg); } 55% { transform: translateX(-10px) scale(0.98); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-hit { animation: enemyHit 0.65s ease-out forwards; }
  @keyframes enemyAttack { 0% { transform: translateX(0) scale(1); } 20% { transform: translateX(-50px) scale(1.15); filter: brightness(1.8) hue-rotate(-20deg); } 45% { transform: translateX(-90px) scale(1.2); filter: brightness(2) drop-shadow(0 0 20px #e74c3c); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
  .enemy-attacking { animation: enemyAttack 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
  @keyframes enemyAppear { 0% { transform: scale(0) rotate(-30deg); opacity: 0; filter: brightness(3); } 60% { transform: scale(1.18) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; filter: brightness(1); } }
  .enemy-appear { animation: enemyAppear 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  @keyframes enemyDefeated { 0% { transform: scale(1) rotate(0); opacity: 1; } 20% { transform: scale(1.2) rotate(-10deg); filter: brightness(3) saturate(0.5); } 100% { transform: scale(0) rotate(400deg); opacity: 0; } }
  .enemy-defeated-anim { animation: enemyDefeated 1s ease-in forwards; }
  .vs-divider { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 40px; gap: 10px; z-index: 10; flex-shrink: 0; width: 80px; }
  .vs-badge { background: linear-gradient(135deg,#f9d71c,#e8a21a); border: 3px solid #5c3a1e; border-radius: 50%; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka One', cursive; font-size: 18px; color: #5c3a1e; box-shadow: 0 4px 0 #9a5c08, 0 0 20px rgba(249,199,31,0.5); animation: vsGlow 2s ease-in-out infinite; flex-shrink: 0; }
  @keyframes vsGlow { 0%,100% { box-shadow: 0 4px 0 #9a5c08, 0 0 20px rgba(249,199,31,0.5); } 50% { box-shadow: 0 4px 0 #9a5c08, 0 0 40px rgba(249,199,31,0.8); } }
  @keyframes dmgPop { 0% { opacity: 1; transform: translate(-50%,0) scale(1.4); } 40% { opacity: 1; transform: translate(-50%,-30px) scale(1); } 100% { opacity: 0; transform: translate(-50%,-80px) scale(0.6); } }
  .dmg-number { position: absolute; pointer-events: none; z-index: 200; font-family: 'Fredoka One', cursive; font-size: 36px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); animation: dmgPop 0.9s ease-out forwards; left: 50%; top: 10%; white-space: nowrap; }
  .dmg-enemy { color: #ff4757; } .dmg-suri { color: #ff8c69; }
  .battle-panel { position: relative; z-index: 10; margin: 12px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  @media (min-width: 900px) { .battle-panel { margin: 12px 60px 28px; } }
  .question-scroll { background: linear-gradient(160deg,rgba(20,5,40,0.95) 0%,rgba(15,3,30,0.98) 100%); border: 2px solid rgba(155,89,182,0.5); border-radius: 20px; padding: 16px 20px; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(155,89,182,0.2); backdrop-filter: blur(10px); }
  .question-scroll::before { content: ''; position: absolute; inset: 0; border-radius: 20px; background: radial-gradient(ellipse at 50% 0%,rgba(155,89,182,0.1) 0%,transparent 70%); pointer-events: none; }
  .question-badge { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg,rgba(155,89,182,0.3),rgba(108,52,131,0.4)); border: 1px solid rgba(155,89,182,0.5); border-radius: 10px; padding: 4px 12px; font-family: 'Fredoka One', cursive; font-size: 11px; color: #c39bd3; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
  .question-text { font-family: 'Nunito', sans-serif; font-weight: 800; color: #f0e8ff; font-size: 17px; line-height: 1.6; margin: 0; }
  @media (max-width: 600px) { .question-text { font-size: 15px; } }
  .spell-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 480px) { .spell-grid { grid-template-columns: 1fr; gap: 8px; } }
  .spell-tile { position: relative; border-radius: 14px; border: 2px solid rgba(155,89,182,0.3); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s; overflow: hidden; user-select: none; background: linear-gradient(160deg,rgba(30,10,55,0.9) 0%,rgba(20,5,40,0.95) 100%); padding: 12px 14px; }
  .spell-tile::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(255,255,255,0.05) 0%,transparent 100%); border-radius: inherit; pointer-events: none; }
  .spell-tile:hover:not(.locked):not(.selected) { transform: translateY(-4px) scale(1.02); border-color: rgba(155,89,182,0.7); box-shadow: 0 8px 20px rgba(0,0,0,0.6), 0 0 20px rgba(155,89,182,0.3); }
  .spell-tile:active:not(.locked) { transform: translateY(1px) scale(0.98); }
  .spell-tile.selected { border-color: rgba(200,150,255,0.8); box-shadow: 0 0 0 2px rgba(155,89,182,0.4); transform: translateY(-2px); animation: selectedSpell 1.5s ease-in-out infinite; }
  @keyframes selectedSpell { 0%,100% { box-shadow: 0 0 0 2px rgba(155,89,182,0.4); } 50% { box-shadow: 0 0 0 4px rgba(155,89,182,0.2), 0 0 20px rgba(155,89,182,0.3); } }
  .spell-tile.locked { cursor: default; opacity: 0.75; }
  /* selectedSpell replaces tileIn (forwards fill), which would leave .spell-tile-enter at opacity: 0 */
  .spell-tile.spell-tile-enter.selected { opacity: 1; }
  .spell-tile.correct-reveal { background: linear-gradient(160deg,rgba(30,90,50,0.95),rgba(15,60,30,0.98)) !important; border-color: #3dbf6e !important; box-shadow: 0 0 20px rgba(61,191,110,0.5) !important; }
  .spell-tile.wrong-reveal { background: linear-gradient(160deg,rgba(90,20,20,0.95),rgba(60,10,10,0.98)) !important; border-color: #e74c3c !important; box-shadow: 0 0 20px rgba(231,76,60,0.5) !important; }
  .spell-label { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: rgba(155,89,182,0.3); border: 1px solid rgba(155,89,182,0.5); border-radius: 8px; font-family: 'Fredoka One', cursive; font-size: 16px; color: #c39bd3; flex-shrink: 0; margin-bottom: 6px; }
  .spell-text { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13px; color: rgba(255,255,255,0.92); line-height: 1.4; word-break: break-word; }
  .spell-check { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; background: rgba(200,150,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; z-index: 10; color: #2d0a4e; font-weight: 900; }
  @keyframes tileIn { 0% { opacity: 0; transform: translateY(24px) scale(0.88); } 60% { transform: translateY(-4px) scale(1.03); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .spell-tile-enter { animation: tileIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; opacity: 0; }
  .spell-tile-enter:nth-child(1) { animation-delay: 0.00s; }
  .spell-tile-enter:nth-child(2) { animation-delay: 0.07s; }
  .spell-tile-enter:nth-child(3) { animation-delay: 0.14s; }
  .spell-tile-enter:nth-child(4) { animation-delay: 0.21s; }
  @keyframes feedbackIn { 0% { opacity: 0; transform: translateY(12px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .feedback-banner { border-radius: 16px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; animation: feedbackIn 0.35s ease-out forwards; border: 2px solid rgba(0,0,0,0.2); }
  .feedback-banner.correct { background: linear-gradient(135deg,rgba(30,80,50,0.97),rgba(20,60,35,0.99)); border-color: rgba(61,191,110,0.6); box-shadow: 0 4px 0 rgba(15,50,25,0.8), 0 0 20px rgba(61,191,110,0.2); }
  .feedback-banner.wrong { background: linear-gradient(135deg,rgba(80,15,15,0.97),rgba(60,8,8,0.99)); border-color: rgba(231,76,60,0.6); box-shadow: 0 4px 0 rgba(50,5,5,0.8), 0 0 20px rgba(231,76,60,0.2); }
  .feedback-title { font-family: 'Fredoka One', cursive; font-size: 16px; color: #fff; margin-bottom: 3px; }
  .feedback-quote { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px; color: rgba(255,255,255,0.8); font-style: italic; margin: 0; }
  .feedback-suri { height: 56px; width: auto; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 3px 8px rgba(0,0,0,0.5)); }
  @keyframes feedbackExcited { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-8px) rotate(-5deg); } 75% { transform: translateY(-5px) rotate(5deg); } }
  .feedback-excited { animation: feedbackExcited 0.5s ease-in-out infinite; }
  .attack-btn { width: 100%; font-family: 'Fredoka One', cursive; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; border-radius: 16px; padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; border: none; outline: none; }
  .attack-btn:active { transform: translateY(3px) !important; }
  .attack-btn.ready { background: linear-gradient(180deg,#b24dff 0%,#7b00dd 100%); box-shadow: 0 6px 0 #4a0099, 0 0 20px rgba(155,89,182,0.4), inset 0 1px 0 rgba(255,255,255,0.25); color: #fff; }
  .attack-btn.ready:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #4a0099, 0 0 30px rgba(155,89,182,0.6), inset 0 1px 0 rgba(255,255,255,0.25); }
  .attack-btn.disabled { background: rgba(255,255,255,0.06); box-shadow: none; color: rgba(255,255,255,0.25); cursor: not-allowed; }
  .outcome-overlay { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; animation: overlayFadeIn 0.4s ease-out; padding: 20px; }
  @keyframes overlayFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
  .defeat-overlay {
    top: -34px;
    bottom: -34px;
    min-height: calc(100% + 68px);
    background: radial-gradient(ellipse at center,rgba(80,10,10,0.95) 0%,rgba(10,0,5,0.98) 100%);
  }
  .outcome-title { font-family: 'Fredoka One', cursive; font-size: 42px; text-align: center; letter-spacing: 3px; animation: outcomePulse 0.9s ease-in-out infinite; }
  @keyframes outcomePulse { 0%,100% { transform: scale(1) rotate(-1deg); } 50% { transform: scale(1.05) rotate(1deg); } }
  .defeat-title { color: #ff4757; text-shadow: 3px 3px 0 #5c0000; }
  .outcome-subtitle { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; color: rgba(255,255,255,0.85); text-align: center; max-width: 340px; line-height: 1.6; }
  .outcome-suri { height: 120px; width: auto; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6)); animation: outcomePulse 1.2s ease-in-out infinite; }
  .outcome-btn { background: linear-gradient(180deg,#f9d71c 0%,#e8a21a 100%); border: 4px solid #5c3a1e; border-radius: 18px; padding: 14px 36px; font-family: 'Fredoka One', cursive; font-size: 18px; color: #5c3a1e; cursor: pointer; box-shadow: 0 6px 0 #9a5c08; letter-spacing: 2px; text-transform: uppercase; transition: transform 0.1s, box-shadow 0.1s; }
  .outcome-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 #9a5c08; }
  .outcome-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 #9a5c08; }
  @keyframes spinGlow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .spin-loader { animation: spinGlow 1s linear infinite; display: inline-block; }
  .intro-screen { position: relative; z-index: 10; min-height: calc(100vh - 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 24px 40px; gap: 20px; }
  .intro-subtitle { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 14px; color: rgba(255,255,255,0.75); text-align: center; max-width: 480px; line-height: 1.7; }
  @keyframes titlePulse { 0%,100% { transform: scale(1) rotate(-1deg); text-shadow: 3px 3px 0 #5c3a1e, 0 0 30px rgba(249,199,31,0.5); } 50% { transform: scale(1.04) rotate(1deg); text-shadow: 3px 3px 0 #5c3a1e, 0 0 60px rgba(249,199,31,0.8); } }
  .intro-title { font-family: 'Fredoka One', cursive; font-size: clamp(32px,6vw,52px); color: #f9c31f; text-shadow: 3px 3px 0 #5c3a1e, 0 0 30px rgba(249,199,31,0.5); animation: titlePulse 2.5s ease-in-out infinite; letter-spacing: 3px; margin: 0; }
  .intro-vs { display: flex; align-items: flex-end; justify-content: center; gap: 20px; width: 100%; max-width: 600px; }
  .intro-char { display: flex; flex-direction: column;  justify-content: center; align-items: center; }
  .intro-enemy-img { width: clamp(110px,20vw,180px); height: clamp(110px,20vw,180px); object-fit: contain; filter: drop-shadow(0 0 30px rgba(108,52,131,0.7)); animation: enemyIdle 2.5s ease-in-out infinite; } 
  .intro-info-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .info-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(155,89,182,0.3); border-radius: 14px; padding: 10px 18px; text-align: center; min-width: 90px; backdrop-filter: blur(8px); }
  .info-card-icon { font-size: 20px; } .info-card-value { font-family: 'Fredoka One', cursive; color: #f9c31f; font-size: 15px; } .info-card-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); }
  .intro-start-btn { width: 100%; max-width: 480px; background: linear-gradient(180deg,#b24dff 0%,#7b00dd 100%); border: 4px solid rgba(155,89,182,0.8); border-radius: 20px; padding: 18px 20px; font-family: 'Fredoka One', cursive; font-size: 22px; color: #fff; cursor: pointer; box-shadow: 0 6px 0 #4a0099, 0 0 30px rgba(155,89,182,0.4); letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 10px; transition: transform 0.1s, box-shadow 0.1s; }
  .intro-start-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 9px 0 #4a0099, 0 0 50px rgba(155,89,182,0.6); }
  .intro-start-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 #4a0099; }
  .intro-start-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .intro-skip-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 10px 20px; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.45); cursor: pointer; letter-spacing: 1px; text-transform: uppercase; transition: color 0.2s, border-color 0.2s; width: 100%; max-width: 480px; }
  .intro-skip-btn:hover:not(:disabled) { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.2); }
  .intro-skip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .speech-bubble { background: rgba(10,0,20,0.9); border: 1px solid rgba(155,89,182,0.4); border-radius: 12px; padding: 8px 14px; font-size: 12px; font-weight: 700; color: rgba(220,200,255,0.9); font-style: italic; text-align: center; max-width: 340px; }
  .error-banner { margin: 0 20px 12px; background: linear-gradient(135deg,rgba(231,76,60,0.2),rgba(192,57,43,0.25)); border: 1px solid rgba(231,76,60,0.5); border-radius: 14px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; z-index: 10; position: relative; }
  .error-banner span { font-size: 12px; font-weight: 700; color: rgba(255,180,170,0.9); }
  .loading-quest { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; }
  .loading-text { font-family: 'Fredoka One', cursive; font-size: 14px; color: #c39bd3; letter-spacing: 2px; text-transform: uppercase; }
  .game-icon { width: 1em; height: 1em; display: inline-block; flex: 0 0 auto; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.28)); }
  .game-icon.lg { width: 28px; height: 28px; }
  .game-icon.xl { width: 38px; height: 38px; }
  .battle-body { background: #193827; color: #fff; }
  .pillar { display: none; }
  .skull-deco { display: none; }
  .hud-bar { background: linear-gradient(180deg,rgba(32,43,27,0.96),rgba(18,30,24,0.92)); border-bottom-color: rgba(255,218,112,0.46); }
  .hud-logo { display: inline-flex; align-items: center; gap: 8px; letter-spacing: 1px; }
  .hud-tag { border-color: rgba(255,218,112,0.5); background: rgba(48,76,39,0.5); color: #ffe08d; }
  .streak-pill, .score-chip { min-height: 32px; }
  .streak-pill { background: rgba(101,56,30,0.72); border-color: rgba(255,184,82,0.55); color: #ffd49a; }
  .score-chip { background: linear-gradient(180deg,#ffe08d,#e0a63a); border-color: #5e421b; color: #3d2a12; }
  .arena-section { padding: clamp(14px, 3vw, 30px) clamp(18px, 5vw, 72px) 0; align-items: flex-end; }
  .arena-section::after { content: ""; position: absolute; left: 8%; right: 8%; bottom: 0; height: clamp(58px, 10vw, 104px); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(11,17,13,0.68), rgba(11,17,13,0.18) 48%, transparent 70%); z-index: 1; pointer-events: none; }
  .char-container { z-index: 12; }
  .char-container.suri-side, .char-container.enemy-side { max-width: 380px; }
  .char-name { display: inline-flex; align-items: center; gap: 7px; }
  .name-plate { background: linear-gradient(180deg, rgba(16,30,23,0.9), rgba(10,18,15,0.8)); border: 1px solid rgba(255,218,112,0.25); border-radius: 10px; padding: 8px 12px; box-shadow: 0 5px 0 rgba(0,0,0,0.24); width: auto; min-width: 160px; }
  .hearts-bar { background: rgba(14,24,18,0.78); border-color: rgba(255,218,112,0.24); border-radius: 12px; }
  .suri-sprite { height: clamp(160px, 24vw, 280px); drop-shadow(0 8px 20px rgb(148, 82, 223)5))}
  .enemy-sprite { width: clamp(150px, 22vw, 240px); height: clamp(150px, 22vw, 240px); }
  .vs-divider { padding-bottom: clamp(66px, 10vw, 120px); }
  .vs-badge { border-radius: 12px; border-color: #5e421b; background: linear-gradient(180deg,#ffe08d,#e0a63a); color: #3d2a12; }
  .battle-panel { margin: 0 clamp(12px, 4vw, 60px) clamp(14px, 3vw, 30px); gap: 10px; }
  .battle-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: stretch; min-height: clamp(230px, 28vh, 330px); }
  .question-scroll, .choices-panel { min-height: 100%; background: linear-gradient(180deg, rgba(44,64,40,0.96), rgba(16,27,21,0.98)); border: 2px solid rgba(255,218,112,0.46); border-radius: 8px; box-shadow: 0 10px 0 rgba(45,29,16,0.82), 0 22px 42px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14); backdrop-filter: blur(8px); }
  .question-scroll { display: flex; flex-direction: column; padding: clamp(16px, 2.5vw, 24px); }
  .question-scroll::before, .choices-panel::before { content: ""; position: absolute; inset: 8px; border: 1px solid rgba(255,218,112,0.18); border-radius: 5px; pointer-events: none; }
  .question-badge { width: fit-content; border-radius: 6px; color: #ffe08d; background: rgba(28,49,30,0.9); border-color: rgba(255,218,112,0.42); }
  .question-text { font-size: clamp(17px, 1.75vw, 24px); line-height: 1.45; color: #fff8df; overflow: auto; }
  .question-text p { margin: 0 0 10px; }
  .question-text p:last-child { margin-bottom: 0; }
  .choices-panel { position: relative; display: flex; flex-direction: column; padding: clamp(14px, 2vw, 20px); gap: 12px; }
  .spell-grid { grid-template-columns: 1fr; gap: 9px; flex: 1; min-height: 0; }
  .spell-tile { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 54px; padding: 10px 42px 10px 10px; border-radius: 8px; background: linear-gradient(180deg, rgba(67,92,45,0.95), rgba(28,47,30,0.98)); border-color: rgba(255,218,112,0.32); text-align: left; box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 3px 0 rgba(28,18,10,0.5); }
  .spell-tile:hover:not(.locked):not(.selected) { transform: translateX(-3px); border-color: rgba(255,218,112,0.76); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 5px 0 rgba(28,18,10,0.55), 0 0 20px rgba(255,218,112,0.2); }
  .spell-label { margin: 0; width: 34px; height: 34px; border-radius: 6px; color: #3d2a12; background: linear-gradient(180deg,#ffe08d,#d69a32); border-color: #6f4a1c; }
  .spell-text { font-size: clamp(13px, 1.25vw, 15px); color: #fff8df; }
  .spell-text p { margin: 0; }
  .spell-check { width: 24px; height: 24px; font-size: 0; color: transparent; }
  .spell-check::before { content: ""; width: 12px; height: 7px; border-left: 3px solid #173421; border-bottom: 3px solid #173421; transform: rotate(-45deg); margin-top: -2px; }
  .spell-check.wrong-mark::before { width: 12px; height: 12px; border: 0; background: linear-gradient(45deg, transparent 40%, #fff 40% 60%, transparent 60%), linear-gradient(-45deg, transparent 40%, #fff 40% 60%, transparent 60%); transform: none; margin: 0; }
  .feedback-banner { border-radius: 0; border: 2px solid rgba(255,226,136,0.35); background: rgba(28,13,9,0.76); box-shadow: inset 0 0 18px rgba(0,0,0,0.35); }
  .feedback-title { display: flex; align-items: center; gap: 8px; }
  .attack-btn { border-radius: 8px; min-height: 56px; }
  .attack-btn.ready { background: linear-gradient(180deg,#f1c553,#ba7f27); box-shadow: 0 6px 0 #5e421b, 0 0 20px rgba(255,218,112,0.24), inset 0 1px 0 rgba(255,255,255,0.24); color: #2d1d12; }
  .attack-btn.ready:hover { box-shadow: 0 8px 0 #5e421b, 0 0 30px rgba(255,218,112,0.38), inset 0 1px 0 rgba(255,255,255,0.24); }
  .loading-quest { min-height: clamp(230px, 28vh, 330px); justify-content: center; }
  @media (max-width: 860px) {
    .hud-bar { gap: 10px; flex-wrap: wrap; }
    .hud-center { order: 3; width: 100%; justify-content: center; }
    .intro-screen { justify-content: flex-start; gap: 12px; padding: 14px 20px 28px; min-height: auto; }
    .intro-title { font-size: 30px; }
    .intro-subtitle { font-size: 12px; line-height: 1.45; max-width: 360px; }
    .intro-vs { max-width: 360px; gap: 10px; }
    .intro-suri-img { height: 105px; }
    .intro-enemy-img { width: 105px; }
    .speech-bubble { max-width: 330px; padding: 7px 12px; }
    .intro-info-row { gap: 8px; }
    .info-card { min-width: 102px; padding: 9px 12px; border-radius: 10px; }
    .intro-start-btn { font-size: 18px; padding: 15px 18px; border-radius: 14px; }
    .intro-skip-btn { padding: 9px 16px; border-radius: 10px; }
    .arena-section { padding-inline: 12px; }
    .name-plate { min-width: 0; padding: 6px 8px; }
    .char-name { font-size: 13px; }
    .char-title { font-size: 8px; }
    .vs-divider { width: 48px; padding-bottom: 70px; }
    .vs-badge { width: 44px; height: 44px; font-size: 15px; }
    .battle-form { grid-template-columns: 1fr; min-height: 0; }
    .question-scroll, .choices-panel { min-height: 190px; }
  }
  /* Storybook diagnostic reskin */
  .battle-body {
    font-family: Georgia, 'Times New Roman', serif;
    background:
      radial-gradient(circle at 50% 0%, rgba(250,204,96,0.16), transparent 28%),
      linear-gradient(135deg, #1b0e12 0%, #392016 42%, #151025 100%);
    color: #fff4d5;
  }
  .battle-body::before {
    content: "";
    position: fixed;
    inset: 8px;
    z-index: 3;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.45);
  }

  .skull-deco { display: none; }
  .hud-bar {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: minmax(190px, 1fr) minmax(240px, 1.25fr) minmax(190px, 1fr);
    gap: 12px;
    min-height: 98px;
    max-width: 1380px;
    margin: 0 auto 12px;
    padding: 13px clamp(14px, 3vw, 36px);
    border: 4px solid #80511f;
    outline: 2px solid rgba(253,224,131,0.36);
    background: linear-gradient(180deg, rgba(253,222,150,0.95), rgba(198,140,62,0.98) 44%, rgba(77,42,19,0.98));
    box-shadow: 0 8px 0 #211009, 0 18px 42px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.4);
    clip-path: polygon(2% 0, 98% 0, 100% 32%, 97% 100%, 3% 100%, 0 32%);
  }
  .hud-brand, .hud-right, .combatant-card { display: flex; align-items: center; gap: 10px; }
  .hud-right { justify-content: flex-end; }
  .combatant-card {
    min-width: 0;
    padding: 9px 10px;
    border: 2px solid rgba(255,222,131,0.45);
    background: rgba(42,20,12,0.55);
    box-shadow: inset 0 0 12px rgba(0,0,0,0.28);
  }
  .hero-card { border-radius: 26px 7px 7px 26px; }
  .enemy-card { border-radius: 7px 26px 26px 7px; justify-content: flex-end; text-align: right; }
  .level-badge {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid #3e2412;
    background: radial-gradient(circle at 35% 25%, #fff1ad, #d69a32 58%, #7b491d);
    color: #2b170d;
    font-weight: 900;
    box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  }
  .chapter-banner {
    justify-self: center;
    width: min(100%, 520px);
    padding: 10px 18px;
    text-align: center;
    color: #3a2111;
    border: 2px solid #8b5823;
    border-radius: 50% 50% 10px 10px / 38% 38% 10px 10px;
    background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.4), transparent 58%), linear-gradient(180deg, #fff1bf, #ddb86c);
    box-shadow: inset 0 0 0 3px rgba(100,60,23,0.16), 0 4px 0 rgba(73,39,16,0.55);
  }
  .chapter-eyebrow, .combatant-subtitle {
    display: block;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .chapter-eyebrow { color: #81511f; }
  .hud-logo {
    display: block;
    color: #2a160d;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(18px, 2vw, 28px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: 0;
    text-shadow: 0 1px 0 rgba(255,255,255,0.45);
  }
  .combatant-name {
    display: block;
    color: #fff2bd;
    font-size: 16px;
    font-weight: 900;
    text-shadow: 0 2px 0 #1a0c08;
  }
  .combatant-subtitle { color: rgba(255,241,191,0.8); }
  .hud-progress-bar {
    width: min(100%, 260px);
    height: 9px;
    margin: 8px auto 0;
    border: 1px solid #80511f;
    border-radius: 0;
    background: rgba(64,34,16,0.36);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.32);
  }
  .hud-progress-fill { background: linear-gradient(90deg,#4cc275,#f5c75d); box-shadow: 0 0 12px rgba(76,194,117,0.72); }
  .hearts-bar { gap: 4px; padding: 0; background: transparent; border: 0; border-radius: 0; }
  .heart-icon { width: 24px; height: 24px; filter: drop-shadow(0 2px 0 #35110d) drop-shadow(0 0 5px rgba(255,42,68,0.75)); }
  .streak-pill, .score-chip {
    border: 2px solid #6d411c;
    border-radius: 7px;
    background: linear-gradient(180deg,#f7dc85,#b8792d);
    color: #2a160d;
    box-shadow: 0 4px 0 rgba(44,22,9,0.7);
  }
  .battle-layout {
    z-index: 4;
    max-width: 1380px;
    min-height: calc(100vh - 136px);
    margin: 0 auto;
    display: grid;
    grid-template-rows: clamp(310px, 43vh, 455px) minmax(350px, auto);
  }
  .arena-section {
    display: grid;
    grid-template-columns: minmax(170px, 0.9fr) minmax(160px, 0.8fr) minmax(170px, 0.9fr);
    align-items: end;
    gap: clamp(8px, 3vw, 42px);
    height: clamp(310px, 43vh, 455px);
    flex-shrink: 0;
    padding: 18px clamp(16px, 4vw, 62px) 0;
    border: 3px solid rgba(245,199,93,0.34);
    border-bottom: 0;
    background: url('/login/arena.png') center bottom / cover no-repeat;
    box-shadow: inset 0 0 0 4px rgba(50,25,14,0.58), inset 0 -40px 70px rgba(0,0,0,0.38);
  }
  .arena-section::after {
    left: 14%;
    right: 14%;
    bottom: -2px;
    height: clamp(70px, 10vw, 115px);
    background: radial-gradient(ellipse at center, rgba(7,5,8,0.78), rgba(7,5,8,0.24) 47%, transparent 72%);
  }
  .reaction-space {
    align-self: start;
    justify-self: center;
    min-width: min(360px, 100%);
    min-height: 84px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12px;
    z-index: 8;
  }
  .speech-bubble {
    position: relative;
    max-width: 360px;
    padding: 13px 18px;
    border: 3px solid #2c160d;
    border-radius: 18px 18px 18px 6px;
    background: linear-gradient(180deg, #fff2c8, #e5bf73);
    color: #341c11;
    font-size: clamp(15px, 1.6vw, 21px);
    font-weight: 900;
    text-align: center;
    box-shadow: 0 5px 0 rgba(43,22,10,0.74), 0 0 24px rgba(255,207,89,0.24);
  }
  .speech-bubble::after {
    content: "";
    position: absolute;
    left: 36px;
    bottom: -13px;
    width: 20px;
    height: 20px;
    background: #e5bf73;
    border-right: 3px solid #2c160d;
    border-bottom: 3px solid #2c160d;
    transform: rotate(45deg);
  }
  .name-plate { display: none; }
  .char-container.suri-side, .char-container.enemy-side { max-width: none; }
  .sprite-frame { min-height: clamp(180px, 27vw, 300px); }
  .sprite-frame::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 78%;
    height: 25px;
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
    height: 42px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(114,255,194,0.28), rgba(255,198,90,0.13) 44%, transparent 72%);
    transform: translateX(-50%);
    z-index: -2;
  }
  .suri-sprite {
    height: clamp(178px, 25vw, 295px);
    filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 5px 0 #17100a) drop-shadow(0 14px 18px rgba(76,194,117,0.44));
  }
  .enemy-sprite {
    width: clamp(170px, 23vw, 275px);
    height: clamp(170px, 23vw, 275px);
    object-position: center top;
    filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 5px 0 #17100a) drop-shadow(0 14px 18px rgba(153, 114, 241, 0.62));
  }
  .vs-divider, .vs-badge { display: none; }
  .battle-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 14px;
    align-items: stretch;
    margin: 0;
    padding: 14px;
    border: 5px solid #5e3619;
    background: linear-gradient(90deg, rgba(25,12,8,0.92), rgba(83,46,24,0.94), rgba(25,12,8,0.92)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 66px);
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.28);
    min-height: 350px;
  }
  .side-panel, .question-scroll, .choices-panel {
    border: 3px solid #8e5b20;
    border-radius: 0;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow: inset 0 0 0 3px rgba(20,9,5,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
  }
  .side-panel { min-height: 282px; padding: 13px; }
  .panel-title {
    margin: 0 0 12px;
    color: #ffe8a2;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    text-align: center;
  }
  .inventory-grid { display: grid; gap: 10px; }
  .power-up {
    display: grid;
    justify-items: center;
    gap: 5px;
    color: #fff2c5;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  .power-icon {
    display: grid;
    place-items: center;
    width: 62px;
    height: 58px;
    border: 3px solid #7d654f;
    border-bottom-color: #2a1c17;
    border-radius: 30px 30px 8px 8px;
    background: radial-gradient(circle at 50% 22%, rgba(255,236,170,0.14), transparent 35%), linear-gradient(180deg, #514554, #171318);
    box-shadow: inset 0 -8px 13px rgba(0,0,0,0.36), 0 4px 0 rgba(0,0,0,0.34);
    font-size: 27px;
  }
  .lore-panel { background: linear-gradient(90deg, rgba(26,8,12,0.72), transparent 18% 82%, rgba(26,8,12,0.72)), linear-gradient(180deg, #751d2f, #2d1017); border-color: #c68b42; }
  .lore-box {
    min-height: 194px;
    padding: 15px 13px;
    border: 2px solid rgba(255,216,116,0.45);
    background: rgba(34,10,16,0.72);
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    line-height: 1.45;
    box-shadow: inset 0 0 18px rgba(0,0,0,0.44);
  }
  .lore-box strong { display: block; margin-bottom: 8px; color: #ffe694; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; }
  .battle-form { display: grid; grid-template-rows: auto 1fr; gap: 12px; min-height: 0; }
  .question-scroll { padding: 11px; }
  .question-scroll::before, .choices-panel::before { display: none; }
  .question-strip {
    min-height: 76px;
    padding: clamp(13px, 2vw, 18px) clamp(16px, 2.4vw, 24px);
    border: 2px solid #9c672b;
    background: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.32), transparent 26%), linear-gradient(180deg, #fff0bf, #dec07b);
    color: #2b170d;
    box-shadow: inset 0 0 0 2px rgba(89,48,18,0.14);
  }
  .question-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #81511f;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .question-text {
    color: #28150c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(16px, 1.7vw, 23px);
    font-weight: 900;
    line-height: 1.35;
  }
  .question-text p, .spell-text p { margin: 0; }
  .choices-panel { padding: clamp(12px, 1.6vw, 18px); gap: 12px; }
  .spell-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; align-content: start; }
  .spell-tile {
    grid-template-columns: 38px minmax(0, 1fr);
    min-height: 68px;
    padding: 11px 40px 11px 11px;
    border: 3px solid #725131;
    border-radius: 7px;
    background: linear-gradient(180deg, rgba(255,255,255,0.12), transparent 38%), linear-gradient(180deg, #69574a, #33271f);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 5px 0 #1b0f0a, 0 8px 14px rgba(0,0,0,0.25);
  }
  .spell-tile:hover:not(.locked):not(.selected) {
    transform: translateY(-3px);
    border-color: #f5c75d;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 7px 0 #1b0f0a, 0 0 22px rgba(245,199,93,0.28);
  }
  .spell-label { width: 34px; height: 34px; border: 2px solid #6d411c; border-radius: 6px; background: linear-gradient(180deg,#ffe596,#c7832e); color: #28150c; font-family: Georgia, 'Times New Roman', serif; font-weight: 900; }
  .spell-text { color: #fff6dc; font-family: 'Nunito', sans-serif; font-size: clamp(14px, 1.15vw, 16px); font-weight: 900; }
  .feedback-banner { border-radius: 0; border: 2px solid rgba(255,226,136,0.35); background: rgba(28,13,9,0.76); box-shadow: inset 0 0 18px rgba(0,0,0,0.35); }
  .bottom-bar { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(150px, 0.8fr) minmax(220px, 1.25fr) minmax(130px, 0.7fr); gap: 12px; }
  .attack-btn, .ornate-btn, .intro-start-btn, .intro-skip-btn, .outcome-btn {
    min-height: 54px;
    border: 3px solid #6d411c;
    border-radius: 7px;
    background: linear-gradient(180deg,#ffe596,#b8792d);
    color: #2a160d;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0;
    box-shadow: 0 6px 0 #28150c, inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .attack-btn { min-height: 64px; font-size: clamp(17px, 1.7vw, 23px); background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%); color: #071d0f; border-color: #ffe288; box-shadow: 0 7px 0 #12361e, 0 0 28px rgba(88,255,138,0.33), inset 0 1px 0 rgba(255,255,255,0.42); }
  .attack-btn.ready:hover, .ornate-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
  .loading-quest { min-height: 310px; justify-content: center; }
  .loading-bar {
    width: min(280px, 70%);
    height: 12px;
    overflow: hidden;
    border: 2px solid rgba(255,226,136,0.55);
    background: rgba(19,9,8,0.72);
    box-shadow: inset 0 2px 5px rgba(0,0,0,0.45);
  }
  .loading-bar::before {
    content: "";
    display: block;
    height: 100%;
    width: 45%;
    background: linear-gradient(90deg, #65d783, #ffe288, #65d783);
    box-shadow: 0 0 18px rgba(255,226,136,0.45);
    animation: loadingBar 1.1s ease-in-out infinite;
  }
  @keyframes loadingBar {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(240%); }
  }
  .intro-screen { border: 5px solid #5e3619; background: rgba(28,14,10,0.6); box-shadow: inset 0 0 0 4px rgba(245,199,93,0.25); }
  .intro-title { color: #ffe288; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0; text-shadow: 4px 4px 0 #211009, 0 0 26px rgba(245,199,93,0.34); }
  .intro-suri-img { filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 10px 20px rgba(76,194,117,0.44)); }
  @media (max-width: 1020px) {
    .hud-bar { grid-template-columns: 1fr; clip-path: none; }
    .hud-brand, .hud-right { justify-content: center; }
    .battle-panel { grid-template-columns: 1fr; }
    .bottom-bar { grid-template-columns: 1fr; }
    .side-panel { min-height: 0; }
    .inventory-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .lore-box { min-height: auto; }
  }
  @media (max-width: 760px) {
    .battle-body { padding: 8px; }
    .battle-body::before { inset: 4px; }
    .battle-layout { grid-template-rows: 280px minmax(350px, auto); }
    .arena-section { grid-template-columns: 1fr 0.75fr 1fr; gap: 4px; height: 280px; padding-inline: 8px; }
    .reaction-space { min-width: 0; min-height: 64px; }
    .speech-bubble { padding: 9px 12px; font-size: 13px; }
    .suri-sprite { height: 142px; }
    .enemy-sprite { width: 136px; height: 136px; }
    .sprite-frame { min-height: 168px; }
    .spell-grid { grid-template-columns: 1fr; }
    .combatant-card { flex-wrap: wrap; justify-content: center; text-align: center; }
    .enemy-card { justify-content: center; }
  }
  .hud-bar {
    min-height: 108px;
    padding: 16px clamp(14px, 3vw, 34px);
    border: 0;
    outline: 0;
    border-radius: 0 0 26px 26px;
    background:
      linear-gradient(90deg, #70411f 0 16px, transparent 16px calc(100% - 16px), #70411f calc(100% - 16px)),
      linear-gradient(180deg, #8b5527 0 14px, transparent 14px calc(100% - 14px), #8b5527 calc(100% - 14px)),
      linear-gradient(180deg, rgba(252,229,177,0.97), rgba(235,189,105,0.97));
    box-shadow:
      0 12px 0 rgba(39,18,10,0.84),
      0 24px 42px rgba(0,0,0,0.38),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255,198,92,0.18);
    clip-path: none;
    overflow: visible;
  }
  .hud-bar::before {
    content: "";
    position: absolute;
    inset: 13px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 0 0 18px 18px;
    pointer-events: none;
  }
  .combatant-card {
    min-height: 72px;
    padding: 10px 13px;
    border: 2px solid #8749b7;
    background:
      radial-gradient(circle at 18% 18%, rgba(255,255,255,0.16), transparent 26%),
      linear-gradient(180deg, rgba(81,39,120,0.96), rgba(55,27,91,0.98));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      0 5px 0 rgba(72,31,94,0.58);
  }
  .hero-card { border-radius: 18px 10px 10px 18px; }
  .enemy-card { border-radius: 10px 18px 18px 10px; }
  .level-badge {
    width: 46px;
    height: 46px;
    border-color: #6d411c;
    background: radial-gradient(circle at 35% 25%, #fff6aa, #ffd35c 48%, #a84e1d);
    color: #321008;
    font-family: "Bree Serif", Georgia, serif;
  }
  .combatant-name {
    color: #fff8e8;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 18px;
    text-shadow: 0 2px 0 #32104d;
  }
  .combatant-subtitle {
    color: rgba(255,231,159,0.86);
    font-family: 'Nunito', sans-serif;
  }
  .chapter-banner {
    position: relative;
    min-height: 76px;
    padding: 11px 24px 13px;
    border: 2px solid #318138;
    border-radius: 18px;
    background:
      radial-gradient(circle at 50% 0%, rgba(255,255,255,0.22), transparent 42%),
      linear-gradient(180deg, rgba(29, 85, 27, 0.98), rgba(13, 61, 25, 0.99));
    
  }
  .hud-crest {
    position: absolute;
    left: 50%;
    top: -52px;
    width: min(270px, 52vw);
    transform: translateX(-50%);
    filter: drop-shadow(0 10px 9px rgba(42,18,24,0.38));
    pointer-events: none;
  }
  .chapter-eyebrow {
    position: relative;
    z-index: 1;
    color: #ffe79f;
    text-shadow: 0 2px 0 #32104d;
  }
  .hud-logo {
    position: relative;
    z-index: 1;
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(19px, 2vw, 27px);
    text-shadow: 0 3px 0 #32104d;
  }
  .hud-progress-bar {
    position: relative;
    z-index: 1;
    width: min(100%, 300px);
    height: 11px;
    border: 1px solid #d7a7ff;
    border-radius: 999px;
    background: rgba(24,8,36,0.62);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.42);
  }
  .hud-progress-fill {
    background: linear-gradient(90deg,#ffd35c,#9b43cf);
    border-radius: 999px;
    box-shadow: 0 0 12px rgba(255,211,92,0.55), 0 0 14px rgba(155,67,207,0.5);
  }
  .hearts-bar {
    margin-top: 3px;
    gap: 5px;
  }
  .streak-pill, .score-chip {
    border-color: #6d411c;
    border-radius: 999px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    box-shadow: 0 4px 0 rgba(72,34,16,0.72);
  }
  @media (max-width: 1020px) {
    .hud-bar { border-radius: 0 0 22px 22px; padding-top: 48px; }
    .hud-crest { top: -36px; width: min(230px, 76vw); }
  }
  @media (max-width: 760px) {
    .hud-bar { min-height: 0; padding: 42px 10px 14px; }
    .chapter-banner { width: 100%; padding-inline: 14px; }
    .hud-crest { width: min(210px, 82vw); }
  }
  .diagnostic-before {
    min-height: 100vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(118px, 14vh, 150px) 22px 34px;
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
    width: min(900px, 100%);
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
    padding: 24px;
    border-radius: 32px 28px 34px 30px;
    background:
      linear-gradient(90deg, #70411f 0 18px, transparent 18px calc(100% - 18px), #70411f calc(100% - 18px)),
      linear-gradient(180deg, #8b5527 0 18px, transparent 18px calc(100% - 18px), #8b5527 calc(100% - 18px)),
      #70411f;
    box-shadow:
      0 28px 46px rgba(42, 24, 20, .36),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255, 198, 92, .22);
  }
  .intro-parchment-frame::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 24px;
    pointer-events: none;
    background:
      radial-gradient(circle at 3% 12%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 97% 13%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 4% 91%, #4a2413 0 15px, transparent 16px),
      radial-gradient(circle at 96% 90%, #4a2413 0 15px, transparent 16px);
    opacity: .76;
  }
  .intro-crest {
    position: absolute;
    width: min(420px, 88vw);
    left: 50%;
    top: 0;
    transform: translate(-50%, -55%);
    z-index: 3;
    filter: drop-shadow(0 16px 14px rgba(42, 18, 24, .38));
    pointer-events: none;
  }
  .intro-parchment-panel {
    position: relative;
    overflow: hidden;
    border-radius: 22px 20px 24px 22px;
    padding: clamp(48px, 7vw, 70px) clamp(22px, 6vw, 62px) clamp(26px, 5vw, 46px);
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
    inset: 14px;
    border: 2px solid rgba(111, 61, 28, .13);
    border-radius: 18px;
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
    font-size: clamp(34px, 5.1vw, 54px);
    line-height: 1;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
    animation: none;
  }
  .intro-ornament {
    display: flex;
    align-items: center;
    gap: 18px;
    width: min(470px, 100%);
    margin: 24px auto 24px;
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
    width: 23px;
    height: 23px;
    background: currentColor;
    clip-path: polygon(50% 0, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0 50%, 36% 36%);
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .7));
  }
  .diagnostic-before .intro-subtitle,
  .diagnostic-before .speech-bubble {
    max-width: 680px;
    margin: 0 auto 18px;
    padding: 14px 18px;
    border: 2px solid #8749b7;
    border-radius: 15px;
    background: linear-gradient(180deg, rgba(81, 39, 120, .96), rgba(55, 27, 91, .98));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .15), 0 3px 0 rgba(72, 31, 94, .44);
    color: #fff8e8;
    font-family: "Nunito", sans-serif;
    font-size: clamp(15px, 1.7vw, 18px);
    font-style: normal;
    font-weight: 900;
    line-height: 1.5;
  }
  .diagnostic-before .speech-bubble::after {
    display: none;
  }
  .diagnostic-before .intro-char {
    width: min(720px, 100%);
    margin: 2px auto 22px;
    padding: 18px;
    border: 2px solid rgba(124, 70, 28, .32);
    border-radius: 18px;
    background: rgba(255, 248, 232, .72);
    box-shadow: inset 0 0 22px rgba(116, 65, 22, .12);
  }
  .diagnostic-before .intro-enemy-img {
    width: clamp(130px, 22vw, 210px);
    height: clamp(130px, 22vw, 210px);
    filter: drop-shadow(0 14px 16px rgba(42, 18, 24, .32));
  }
  .intro-button-row {
    display: flex;
    gap: 14px;
    width: min(720px, 100%);
    margin: 0 auto;
  }
  .intro-button-wrap {
    flex: 1;
    padding: 8px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background: linear-gradient(180deg, #ffcf66, #9a541f);
    filter: drop-shadow(0 8px 0 rgba(72, 34, 16, .72));
  }
  .diagnostic-before .intro-start-btn,
  .diagnostic-before .intro-skip-btn {
    width: 100%;
    max-width: none;
    min-height: 62px;
    margin: 0;
    padding: 12px 18px;
    border: 0;
    border-radius: 0;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background:
      linear-gradient(90deg, rgba(255,255,255,.12), transparent 18%, transparent 82%, rgba(255,255,255,.12)),
      linear-gradient(180deg, #9232cc, #58158f 52%, #391071);
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(20px, 2.4vw, 28px);
    font-weight: 900;
    letter-spacing: 0;
    text-shadow: 0 3px 0 #32104d;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-transform: none;
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
  .diagnostic-before .error-banner {
    width: min(680px, 100%);
    margin: 18px auto 0;
    border: 2px solid #bb3d42;
    border-radius: 14px;
    background: rgba(111, 20, 45, .14);
    color: #6f1430;
  }
  .diagnostic-before .error-banner span {
    color: #6f1430;
  }
  @media (max-width: 720px) {
    .diagnostic-before {
      min-height: 100svh;
      padding: 112px 12px 18px;
    }
    .intro-crest {
      width: min(320px, 90vw);
      transform: translate(-50%, -52%);
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
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); } ::-webkit-scrollbar-thumb { background: rgba(155,89,182,0.5); border-radius: 3px; }
  .diagnostic-battle .battle-layout { width: 100%; min-width: 0; }
  .diagnostic-battle .arena-section { overflow: hidden; }
  .diagnostic-support { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .diagnostic-support .side-panel { min-height: 0; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
`;

// Battle health is separate from the 3-correct / 2-wrong assessment rules.
const ENEMY_HEARTS = 5;
const SURI_HEARTS = 5;
const LABELS = ["A", "B", "C", "D"];

function ArenaBackground() {
  return (
    <div className="arena-bg" aria-hidden="true">
  </div>
  );
}

function HeartIcon({ full, breaking }: { full: boolean; breaking?: boolean }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24"
      className={`heart-icon${breaking ? " heart-breaking" : full ? "" : " empty"}`}
      fill={full || breaking ? "#ff2244" : "#3a1a2a"}
      aria-label={full ? "Full heart" : "Empty heart"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type GameIconName = "sword" | "flame" | "coin" | "heart" | "bolt" | "target" | "gear" | "warning" | "book" | "retry" | "play" | "check" | "cross";

function GameIcon({ name, className = "" }: { name: GameIconName; className?: string }) {
  const cls = `game-icon ${className}`.trim();

  if (name === "sword") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M22.8 3.2 29 3l-.2 6.2-13 13-3.1-3.1 10.1-15.9Z" fill="#d9f3ff" stroke="#33505f" strokeWidth="1.5" />
        <path d="m12.7 19.1-2.8 2.8" stroke="#ffe08d" strokeWidth="4" strokeLinecap="round" />
        <path d="m8.8 20.4 2.8 2.8-5.8 5.8-2.8-2.8 5.8-5.8Z" fill="#8b5629" stroke="#3f2719" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "flame") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M17.1 3.4c2.6 5.1 8 7.6 8 15.1A9.1 9.1 0 0 1 16 27.8a9.1 9.1 0 0 1-9.1-9.3c0-4.9 3.2-8.1 6.1-11.7-.2 3.4 1.2 5.2 3 6.6 1.8-2.3 2.4-5.6 1.1-10Z" fill="#f36b32" stroke="#6b2d18" strokeWidth="1.5" />
        <path d="M16.2 14.4c2 2.5 3.6 4.1 3.6 7.1a3.8 3.8 0 1 1-7.6 0c0-2.5 1.8-4.3 4-7.1Z" fill="#ffe08d" />
      </svg>
    );
  }
  if (name === "coin") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#f4c653" stroke="#6b491b" strokeWidth="2" />
        <circle cx="16" cy="16" r="7" fill="#ffe08d" opacity=".7" />
        <path d="M16 9v14M11 13c1.7-2.1 8.4-2 9.5 0 .8 1.6-.7 2.8-4.3 3.1-3.9.4-5 1.4-4.2 3 .9 2 7.2 2.4 9.3-.1" fill="none" stroke="#6b491b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "heart") {
    return <HeartIcon full />;
  }
  if (name === "bolt") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M18.5 2 7 18h8l-1.5 12L25 13h-8l1.5-11Z" fill="#ffe08d" stroke="#6b491b" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#e7f0d0" stroke="#315437" strokeWidth="2" />
        <circle cx="16" cy="16" r="7" fill="#f36b32" />
        <circle cx="16" cy="16" r="3" fill="#ffe08d" />
      </svg>
    );
  }
  if (name === "gear") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M14 3h4l1 4 3 1.3 3.6-2 2.8 2.8-2 3.6 1.3 3 4 1v4l-4 1-1.3 3 2 3.6-2.8 2.8-3.6-2-3 1.3-1 4h-4l-1-4-3-1.3-3.6 2-2.8-2.8 2-3.6-1.3-3-4-1v-4l4-1 1.3-3-2-3.6 2.8-2.8 3.6 2L13 7l1-4Z" fill="#c8d6c0" stroke="#324934" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="4.5" fill="#33543a" />
      </svg>
    );
  }
  if (name === "warning") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="m16 4 13 23H3L16 4Z" fill="#f4c653" stroke="#6b491b" strokeWidth="2" />
        <path d="M16 12v7" stroke="#3d2a12" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="23" r="1.8" fill="#3d2a12" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M5 6.5c4.2-.8 7.4-.1 11 2.2v18.1c-3.4-2.2-6.8-3-11-2.2V6.5Z" fill="#f4e1a0" stroke="#5b3a20" strokeWidth="1.8" />
        <path d="M27 6.5c-4.2-.8-7.4-.1-11 2.2v18.1c3.4-2.2 6.8-3 11-2.2V6.5Z" fill="#d7f0c0" stroke="#5b3a20" strokeWidth="1.8" />
        <path d="M16 8.7v18.1" stroke="#5b3a20" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "retry") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M24 10a10 10 0 1 0 1.4 10" fill="none" stroke="#3d2a12" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 4v7h-7" fill="none" stroke="#3d2a12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "play") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M10 6 26 16 10 26V6Z" fill="#fff8df" stroke="#173421" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "cross") {
    return (
      <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
        <path d="M9 9 23 23M23 9 9 23" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={cls} aria-hidden="true">
      <path d="m8 16 5 5L24 10" fill="none" stroke="#173421" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SuriState      = "idle" | "attack" | "hit" | "happy" | "sad" | "defeated";
type EnemyAnimState = "idle" | "attack" | "hit" | "defeated" | "appear";

function suriImg(s: SuriState): string {
  if (s === "happy") return "/suri-snake-happy.png";
  if (s === "sad" || s === "hit" || s === "defeated") return "/suri-snake-sad.png";
  if (s === "attack") return "/suri-snake-right.png";
  return "/suri-snake-right.png";
}
function suriAlt(s: SuriState): string {
  if (s === "happy")    return "Suri celebrating";
  if (s === "sad")      return "Suri sad";
  if (s === "hit")      return "Suri recoiling";
  if (s === "defeated") return "Suri defeated";
  if (s === "attack")   return "Suri attacking";
  return "Suri in battle stance";
}
function suriCls(s: SuriState): string {
  if (s === "attack")   return "suri-sprite suri-attacking";
  if (s === "hit")      return "suri-sprite suri-hit";
  if (s === "defeated") return "suri-sprite suri-defeated-anim";
  return "suri-sprite suri-idle";
}
function enemyCls(s: EnemyAnimState): string {
  if (s === "hit")      return "enemy-sprite enemy-hit";
  if (s === "defeated") return "enemy-sprite enemy-defeated-anim";
  if (s === "appear")   return "enemy-sprite enemy-appear";
  if (s === "attack")   return "enemy-sprite enemy-attacking";
  return "enemy-sprite enemy-idle";
}

export default function DiagnosticPage() {
  const router    = useRouter();
  const params    = useParams();
  const sessionId = params.session_id as string;
  const { muted, toggleMuted, unlock: unlockSound, play: playSound } = useBattleAudio();

  const [phase, setPhase]             = useState<"intro" | "battle" | "defeat">("intro");
  const [probe, setProbe]             = useState<DiagnosticProbe | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [skipping, setSkipping]       = useState(false);
  const [showingResults, setShowingResults] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [feedback, setFeedback]       = useState<{ correct: boolean; nextAction: string; blocked?: boolean } | null>(null);
  const [tileKey, setTileKey]         = useState(0);
  const [answeredCount, setAnsweredCount]   = useState(0);
  const [score, setScore]   = useState(0);
  const [streak, setStreak] = useState(0);
  const [suriState, setSuriState]       = useState<SuriState>("idle");
  const [suriHearts, setSuriHearts]     = useState(SURI_HEARTS);
  const [suriBreaking, setSuriBreaking] = useState<number | null>(null);
  const [enemyAnimState, setEnemyAnimState] = useState<EnemyAnimState>("idle");
  const [enemyHearts, setEnemyHearts]       = useState(ENEMY_HEARTS);
  const [enemyBreaking, setEnemyBreaking]   = useState<number | null>(null);
  const [enemyDmg, setEnemyDmg] = useState<string | null>(null);
  const [suriDmg, setSuriDmg]   = useState<string | null>(null);
  const [locked, setLocked]     = useState(false);
  const [battleState, setBattleState] = useState<DiagnosticBattleState | null>(null);
  const [failedAction, setFailedAction] = useState<PracticeSpell | "answer" | null>(null);
  const [combatImpact, setCombatImpact] = useState<(CombatHit & { id: number }) | null>(null);
  const [spellEffect, setSpellEffect] = useState<{ spell: PracticeSpell; label: string; stage: "charge" | "strike"; id: number } | null>(null);
  const battleId = useRef<string | null>(null);
  const busy = useRef(false);
  const pendingCast = useRef<DiagnosticSpellRequest | null>(null);
  const pendingAnswer = useRef<DiagnosticBattleAnswerRequest | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const effectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  const clearBattleTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);
  useEffect(() => clearBattleTimers, [clearBattleTimers]);

  const showSpellEffect = useCallback((spell: PracticeSpell, label: string, stage: "charge" | "strike" = "charge") => {
    if (effectTimer.current) clearTimeout(effectTimer.current);
    setSpellEffect(prev => ({ spell, label, stage, id: (prev?.id ?? 0) + 1 }));
    effectTimer.current = schedule(() => setSpellEffect(null), stage === "strike" ? 2100 : 1800);
  }, [schedule]);

  const showCombatImpact = useCallback((target: CombatHit["target"], kind: CombatHit["kind"]) => {
    if (impactTimer.current) clearTimeout(impactTimer.current);
    setCombatImpact(prev => ({ target, kind, id: (prev?.id ?? 0) + 1 }));
    impactTimer.current = schedule(() => setCombatImpact(null), kind.startsWith("flame") ? 1300 : 650);
  }, [schedule]);

  useEffect(() => {
    sessionStorage.removeItem("diagnostic_answers");
    sessionStorage.removeItem("diagnostic_submit_result");
  }, [sessionId]);

  const finalize = useCallback(async (redirectOverride?: string) => {
    const s = await getSession(sessionId);
    const { chain } = await getTopicChain(s.topic_entry_node);
    const raw = JSON.parse(sessionStorage.getItem("diagnostic_answers") || "{}") as Record<string, boolean>;
    const answers = chain.map(node_id => ({ node_id, correct: !!raw[node_id] }));
    const res = await submitDiagnostic(sessionId, { answers });
    sessionStorage.setItem("diagnostic_submit_result", JSON.stringify(res));
    if (res.gap_node)         sessionStorage.setItem("identified_node_id", res.gap_node);
    if (res.mastered_nodes)   sessionStorage.setItem("diagnostic_mastered",   JSON.stringify(res.mastered_nodes));
    if (res.unresolved_nodes) sessionStorage.setItem("diagnostic_unresolved", JSON.stringify(res.unresolved_nodes));
    router.push(redirectOverride ?? res.redirect);
  }, [sessionId, router]);

  const fetchProbe = useCallback(async () => {
    busy.current = true;
    setLoading(true); setSelectedIdx(null); setFeedback(null);
    setError(null); setLocked(true);
    setSuriState("idle"); setEnemyAnimState("idle");
    try {
      if (!battleId.current) {
        const started = await startDiagnosticBattle(sessionId);
        battleId.current = started.battle_id;
        setBattleState(started.battle);
      }
      const data = await getDiagnosticProbe(sessionId);
      if (data.next_action === "complete") { await finalize(); return; }
      setProbe(data); setPhase("battle"); setTileKey(k => k + 1);
      setAnsweredCount(data.questions_answered ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load question.");
    } finally { setLoading(false); setLocked(false); busy.current = false; }
  }, [sessionId, finalize]);

  const advance = useCallback(async (nextAction: string) => {
    try {
      if (nextAction === "next_probe") await fetchProbe();
      else if (nextAction === "complete") await finalize();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to advance.");
      setLocked(false); busy.current = false;
    }
  }, [fetchProbe, finalize]);

  const triggerEnemyHit = useCallback((nextAction: string, battle: DiagnosticBattleState) => {
    setSuriState("attack");
    playSound(battle.bonus ? "flameLaunch" : "attack");
    if (battle.bonus) showSpellEffect("flame", "FLAME STRIKE · +25 bonus points", "strike");
    const delay = battle.bonus ? FLAME_FLIGHT_MS : 220;
    schedule(() => {
      setEnemyDmg(battle.bonus ? "-1 · +25 pts" : "-1");
      schedule(() => setEnemyDmg(null), 900);
      setEnemyAnimState("hit");
      setEnemyHearts(battle.enemy_hearts);
      setEnemyBreaking(battle.enemy_hearts);
      playSound(battle.bonus ? "explosion" : "hit");
      showCombatImpact("enemy", battle.bonus ? battle.enemy_hearts === 0 ? "flame-finisher" : "flame" : battle.enemy_hearts === 0 ? "finisher" : "rune");
    }, delay);
    schedule(() => {
      if (battle.enemy_hearts === 0) {
        setEnemyAnimState("defeated");
        playSound("victory");
        confetti({ particleCount: 180, spread: 110, origin: { y: .4 } });
        schedule(() => {
          setEnemyBreaking(null); setEnemyHearts(ENEMY_HEARTS);
          setEnemyAnimState("appear"); setSuriState("happy");
          if (nextAction === "next_probe") setBattleState(prev => prev ? {
            ...prev, enemy_hearts: ENEMY_HEARTS, used: [], flame_ready: false, ward_ready: false,
          } : prev);
          schedule(() => { void advance(nextAction); }, 900);
        }, 1400);
      } else {
        setEnemyBreaking(null); setEnemyAnimState("idle"); setSuriState("happy");
        schedule(() => { void advance(nextAction); }, 500);
      }
    }, delay + (battle.bonus ? 950 : 450));
  }, [advance, playSound, schedule, showCombatImpact, showSpellEffect]);

  const triggerSuriHit = useCallback((nextAction: string, battle: DiagnosticBattleState) => {
    setEnemyAnimState("attack");
    playSound("enemyAttack");
    schedule(() => {
      setSuriDmg(battle.blocked ? "BLOCKED" : "-1");
      schedule(() => setSuriDmg(null), 900);
      setSuriState(battle.blocked ? "idle" : "hit");
      setSuriHearts(battle.hearts);
      setSuriBreaking(battle.blocked ? null : battle.hearts);
      showCombatImpact("suri", battle.blocked ? "blocked" : "hurt");
      playSound(battle.blocked ? "blocked" : "hurt");
      if (battle.blocked) showSpellEffect("ward", "Aegis Ward · hit blocked");
      schedule(() => {
        setSuriBreaking(null); setEnemyAnimState("idle");
        if (battle.hearts === 0) {
          setSuriState("defeated"); setPhase("defeat");
          busy.current = false;
        } else {
          setSuriState("idle");
          void advance(nextAction);
        }
      }, 700);
    }, 300);
  }, [advance, playSound, schedule, showCombatImpact, showSpellEffect]);

  const handleCastPowerup = async (spell: PracticeSpell) => {
    if (!battleId.current || !probe || phase !== "battle" || busy.current || locked || loading || (failedAction && failedAction !== spell)) return;
    unlockSound(); busy.current = true; setLocked(true); setError(null);
    const request = pendingCast.current ?? { battle_id: battleId.current, request_id: crypto.randomUUID(), spell };
    pendingCast.current = request;
    try {
      const state = await castDiagnosticSpell(sessionId, request);
      pendingCast.current = null; setFailedAction(null);
      setBattleState(state); setSuriHearts(state.hearts);
      playSound(spell === "flame" ? "flameCharge" : spell === "ward" ? "ward" : "heal");
      showSpellEffect(spell, spell === "bloom" ? "Healing Bloom · +1 heart" : spell === "flame" ? "Flame Strike armed" : "Aegis Ward armed");
    } catch (err) {
      setFailedAction(spell);
      setError(err instanceof Error ? err.message : "Could not confirm spell. Retry the same cast.");
    } finally { setLocked(false); busy.current = false; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx === null || !probe || !battleId.current || busy.current || loading || submitting || locked || (failedAction && failedAction !== "answer")) return;
    unlockSound(); busy.current = true;
    setSubmitting(true); setLocked(true); setError(null);
    const request = pendingAnswer.current ?? {
      node_id: probe.node_id, selected_option_index: selectedIdx,
      battle_id: battleId.current, request_id: crypto.randomUUID(),
    };
    pendingAnswer.current = request;
    try {
      const res = await submitDiagnosticAnswer(sessionId, request);
      if (!res.battle) throw new Error("The server did not return the diagnostic battle state.");
      pendingAnswer.current = null; setFailedAction(null);
      setBattleState(res.battle); setScore(res.battle.score);
      // The backend controls assessment completion; spells never skip a probe.
      const nextAction = res.next_action;
      setFeedback({ correct: res.correct, nextAction, blocked: res.battle.blocked });
      try {
        const cur = JSON.parse(sessionStorage.getItem("diagnostic_answers") || "{}");
        cur[request.node_id] = res.correct;
        sessionStorage.setItem("diagnostic_answers", JSON.stringify(cur));
      } catch { /* The backend's diagnostic logs remain authoritative. */ }
      setAnsweredCount(count => count + 1);
      if (res.correct) {
        setStreak(s => s + 1); toast.success("Direct hit!");
        triggerEnemyHit(nextAction, res.battle);
      } else {
        setStreak(0);
        if (res.battle.blocked) toast("Aegis Ward blocked the hit!", { icon: "🛡️" });
        else toast.error("The enemy counters!");
        triggerSuriHit(nextAction, res.battle);
      }
    } catch (err: unknown) {
      setFailedAction("answer");
      setError(err instanceof Error ? err.message : "Failed to submit answer. Retry the same answer.");
      setLocked(false); busy.current = false;
    } finally { setSubmitting(false); }
  };

  const handleSkip = async () => {
    setSkipping(true); setError(null);
    try { const res = await skipDiagnostic(sessionId); router.push(res.redirect); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to skip."); setSkipping(false); }
  };

  const handleSeeResults = async () => {
    setShowingResults(true); setError(null);
    try {
      await finalize(`/session/${sessionId}/gap-result`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to show results.");
      setShowingResults(false);
    }
  };

  const enemyDefeatedHits = ENEMY_HEARTS - enemyHearts;
  const pct = Math.min((enemyDefeatedHits / ENEMY_HEARTS) * 100, 100);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
      <div data-tutorial-scope={`diagnostic-${phase}`} className={`battle-body diagnostic-battle${phase === "intro" ? " diagnostic-before" : ""}`}>
        <ArenaBackground />
        
        {phase !== "intro" && (
        <header className="hud-bar" role="banner">
          <div className="hud-brand">
            <div className="combatant-card hero-card">
              <span className="level-badge">Lv 1</span>
              <div>
                <span className="combatant-name">Suri</span>
                <span className="combatant-subtitle">Graduate Bookworm</span>
                <div className="hearts-bar" aria-label={`Suri hearts: ${suriHearts} of ${SURI_HEARTS}`}>
                  {Array.from({ length: SURI_HEARTS }, (_, i) => (
                    <HeartIcon key={i} full={i < suriHearts} breaking={suriBreaking === i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="chapter-banner">
            <span className="chapter-eyebrow">{`Challenge ${answeredCount + 1} | Enemy hearts ${enemyHearts}/${ENEMY_HEARTS}`}</span>
            <span className="hud-logo">Diagnostic Battle</span>
            <div className="hud-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quest progress">
              <div className="hud-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="hud-right">
            <div className="combatant-card enemy-card">
              <div>
                <span className="combatant-name">Count Calculus</span>
                <span className="combatant-subtitle">Rune Wizard</span>
                <div className="hearts-bar" aria-label={`Enemy hearts: ${enemyHearts} of ${ENEMY_HEARTS}`}>
                  {Array.from({ length: ENEMY_HEARTS }, (_, i) => { const hi = ENEMY_HEARTS - 1 - i; return <HeartIcon key={hi} full={hi < enemyHearts} breaking={enemyBreaking === hi} />; })}
                </div>
              </div>
              {streak > 1 && <div className="streak-pill" aria-label={`${streak} answer streak`}><GameIcon name="flame" /> {streak}x</div>}
              <div className="score-chip" aria-label={`Score: ${score}`}><GameIcon name="coin" /> {score}</div>
            </div>
          </div>
        </header>
        )}

        {phase === "intro" && (
          <main className="intro-screen" id="intro-screen">
            <div className="intro-parchment-frame">
              
              <div className="intro-parchment-panel">
                <div className="intro-content">
                  <h1 className="intro-title">DIAGNOSTIC BATTLE</h1>

                  <div className="intro-ornament" aria-hidden="true">
                    <span />
                  </div>

                  <p className="intro-subtitle">
                    Prove your knowledge in the arena! Answer correctly to strike the enemy —
                    every wrong answer lets them hit back. Survive with 5 hearts!
                  </p>

                  <div className="speech-bubble">
                    &ldquo;Ready to test your skills? Let&apos;s see what you&apos;ve got!&rdquo;
                  </div>

                  <div className="intro-char">
                    <img src="/enemy-math-villain.png" alt="The Math Villain" className="intro-enemy-img" />
                  </div>

                  <div className="intro-button-row">
                    <div className="intro-button-wrap">
                      <button id="start-battle-btn" className="intro-start-btn" onClick={() => { if (!busy.current) { unlockSound(); void fetchProbe(); } }} disabled={loading} aria-busy={loading}>
                        {loading ? <><span className="spin-loader"><GameIcon name="gear" /></span> Loading...</> : <>START BATTLE</>}
                      </button>
                    </div>
                    <div className="intro-button-wrap">
                      <button id="skip-diagnostic-btn" className="intro-skip-btn" onClick={handleSkip} disabled={skipping || loading}>
                        {skipping ? "Skipping..." : "Skip Diagnostic >"}
                      </button>
                    </div>
                  </div>

                  {error && <div className="error-banner" role="alert"><GameIcon name="warning" /><span>{error}</span></div>}
                </div>
              </div>
            </div>
          </main>
        )}

        {(phase === "battle" || phase === "defeat") && (
          <div className="battle-layout">
            <div className="arena-section" aria-label="Battle arena" data-impact={combatImpact?.kind}>
              {combatImpact && <CombatImpact key={`impact-${combatImpact.id}`} target={combatImpact.target} kind={combatImpact.kind} />}
              {spellEffect && <SpellEffect key={`spell-${spellEffect.id}`} spell={spellEffect.spell} label={spellEffect.label} stage={spellEffect.stage} />}
              <div className="char-container suri-side">
                <div className="name-plate">
                  <span className="char-name" style={{ color: "#8fe06a" }}>Suri</span>
                  <span className="char-title" style={{ color: "#3dbf6e" }}>Your Champion</span>
                </div>
                <div className="sprite-frame">
                  {battleState?.ward_ready && <span className="suri-spell-aura aura-ward" aria-hidden="true" />}
                  {battleState?.flame_ready && <span className="suri-spell-aura aura-flame" aria-hidden="true" />}
                  {suriDmg && <div className="dmg-number dmg-suri" aria-live="assertive">{suriDmg}</div>}
                  <img src={suriImg(suriState)} alt={suriAlt(suriState)} className={suriCls(suriState)} draggable={false} />
                </div>
              </div>
              <div className="reaction-space" aria-live="polite">
                {battleState?.flame_ready || battleState?.ward_ready ? (
                  <ArmedSpellBubble flameReady={!!battleState.flame_ready} wardReady={!!battleState.ward_ready} />
                ) : feedback ? (
                  <div className="speech-bubble">
                    {feedback.correct ? "Correct!" : feedback.blocked ? "Ward blocked the hit!" : "Nice Try!"}
                  </div>
                ) : null}
              </div>
              <div className="char-container enemy-side">
                <div className="name-plate" style={{ alignItems: "flex-end" }}>
                  <span className="char-name" style={{ color: "#ffd780" }}>Math Villain</span>
                  <span className="char-title" style={{ color: "#c39bd3" }}>The Enemy</span>
                </div>
                <div className="sprite-frame">
                  {enemyDmg && <div className="dmg-number dmg-enemy" aria-live="assertive">{enemyDmg}</div>}
                  <img src="/enemy-math-villain.png" alt="The Math Villain" className={enemyCls(enemyAnimState)} draggable={false} />
                </div>
              </div>
              {phase === "defeat" && (
                <div className="outcome-overlay defeat-overlay" role="dialog" aria-label="Defeat screen">
                  <img src="/suri-snake-sad.png" alt="Suri defeated" className="outcome-suri" />
                  <h2 className="outcome-title defeat-title">DEFEATED!</h2>
                  <p className="outcome-subtitle">The Math Villain overpowered Suri! But every warrior learns from defeat...</p>
                  <button id="continue-btn" className="outcome-btn" style={{ background: "linear-gradient(180deg,#3dbf6e,#1a8a45)", borderColor: "#0f5430", color: "#fff", boxShadow: "0 6px 0 #0f5430" }} onClick={handleSeeResults} disabled={showingResults}>
                    <GameIcon name="play" /> {showingResults ? "LOADING..." : "SEE RESULTS"}
                  </button>
                </div>
              )}
            </div>
            {phase === "battle" && (
              <section className="battle-panel" aria-label="Question panel">
                {error && <div className="error-banner" role="alert"><GameIcon name="warning" /><span>{error}</span></div>}
                {loading ? (
                  <div className="loading-quest question-scroll">
                    <span className="spin-loader" style={{ fontSize: 36 }}><GameIcon name="gear" /></span>
                    <p className="loading-text">Loading challenge...</p>
                    <div className="loading-bar" aria-hidden="true" />
                  </div>
                ) : probe ? (
                  <form onSubmit={handleSubmit} noValidate className="battle-form">
                    <div className="question-scroll" role="region" aria-label="Current question">
                      <div className="question-strip">
                        <div className="question-badge"><GameIcon name="book" /> Question</div>
                        <div className="question-text" id="question-text">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{probe.question_text}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <div className="choices-panel">
                      <div className="question-badge"><GameIcon name="bolt" /> Choices</div>
                      <div className="spell-grid" role="radiogroup" aria-labelledby="question-text" key={tileKey}>
                        {probe.options.map((opt, idx) => {
                          const isSelected = selectedIdx === idx;
                          const isCorrect  = feedback !== null && isSelected && feedback.correct;
                          const isWrong    = feedback !== null && isSelected && !feedback.correct;
                          let cls = "spell-tile spell-tile-enter";
                          if (isSelected) cls += " selected";
                          if (locked)     cls += " locked";
                          if (isCorrect && feedback) cls += " correct-reveal";
                          if (isWrong)    cls += " wrong-reveal";
                          return (
                            <button key={idx} type="button" role="radio" aria-checked={isSelected} id={`spell-option-${idx}`} className={cls}
                              onClick={() => { if (!locked && !feedback && !failedAction) setSelectedIdx(idx); }} disabled={!!feedback || locked || !!failedAction}>
                              <div className="spell-label">{LABELS[idx]}</div>
                              <div className="spell-text">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown>
                              </div>
                              {isSelected && !feedback && <div className="spell-check"><GameIcon name="check" /></div>}
                              {isCorrect && feedback && <div className="spell-check" style={{ background: "#3dbf6e" }}><GameIcon name="check" /></div>}
                              {isWrong && <div className="spell-check wrong-mark" style={{ background: "#e74c3c" }}><GameIcon name="cross" /></div>}
                            </button>
                          );
                        })}
                      </div>
                      {feedback && (
                        <div className={`feedback-banner ${feedback.correct ? "correct" : "wrong"}`} role="status">
                          <img src={feedback.correct ? "/suri-snake-happy.png" : "/suri-snake-sad.png"} alt={feedback.correct ? "Suri happy" : "Suri sad"} className={`feedback-suri${feedback.correct ? " feedback-excited" : ""}`} />
                          <div>
                            <p className="feedback-title"><GameIcon name={feedback.correct ? "sword" : "warning"} /> {feedback.correct ? "Direct Hit!" : feedback.blocked ? "Ward Blocked the Hit!" : "Enemy Strikes!"}</p>
                            <p className="feedback-quote">{feedback.correct ? "Excellent spell! The villain recoils in pain!" : feedback.blocked ? "Your shield held. This answer still counts as incorrect." : "That spell was not effective!"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bottom-bar">
                      <button type="button" className="ornate-btn" onClick={handleSkip} disabled={skipping || submitting || locked}>
                        {skipping ? "Skipping..." : "Skip to Lesson"}
                      </button>
                      {!feedback && (
                        <button id="cast-spell-btn" type="submit" className={`attack-btn ${selectedIdx !== null && !locked && (!failedAction || failedAction === "answer") ? "ready" : "disabled"}`} disabled={selectedIdx === null || locked || submitting || (!!failedAction && failedAction !== "answer")} aria-disabled={selectedIdx === null || locked || submitting || (!!failedAction && failedAction !== "answer")}>
                          {submitting ? <><span className="spin-loader"><GameIcon name="gear" /></span> Casting...</> : failedAction === "answer" ? "Retry answer" : selectedIdx !== null ? <><GameIcon name="bolt" /> Attack/Submit</> : "Choose an answer"}
                        </button>
                      )}
                      {feedback && (
                        <button type="button" className="attack-btn ready" disabled>
                          {feedback.correct ? "Resolving Hit..." : "Resolving Counter..."}
                        </button>
                      )}
                      <button type="button" className="ornate-btn" onClick={() => router.push("/dashboard")}>
                        Back to Menu
                      </button>
                    </div>
                  </form>
                ) : null}
                <aside className="diagnostic-support" aria-label="Battle support">
                  <BattleSpells state={battleState} disabled={locked || loading || submitting || !probe}
                    failedAction={failedAction} onCast={spell => void handleCastPowerup(spell)}
                    muted={muted} onToggleMuted={toggleMuted} maxHearts={SURI_HEARTS} />
                  <section className="side-panel lore-panel" aria-label="Enemy lore">
                  <h2 className="panel-title">Villain Lore</h2>
                  <div className="lore-box">
                    <strong>Count Calculus</strong>
                    A horned keeper of forgotten formulas, he binds every wrong answer into a glowing rune on his staff. Break his spell by choosing the truest path.
                  </div>
                  </section>
                </aside>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
