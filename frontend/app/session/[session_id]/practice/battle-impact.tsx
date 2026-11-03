import type { CSSProperties } from "react";
import "./battle-impact.css";

export type CombatHit = {
  target: "enemy" | "suri";
  kind: "rune" | "flame" | "hurt" | "blocked" | "finisher" | "flame-finisher";
};

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  return {
    "--spark-x": `${Math.cos(angle) * 100}px`,
    "--spark-y": `${Math.sin(angle) * 80}px`,
    "--spark-angle": `${i * 36}deg`,
  } as CSSProperties;
});

export function CombatImpact({ target, kind }: CombatHit) {
  const isFlame = kind === "flame" || kind === "flame-finisher";
  return (
    <div className={`combat-impact impact-${target} impact-${kind}`} aria-hidden="true">
      <div className="impact-flash" />
      <div className="impact-origin">
        {isFlame && <>
          <div className="inferno-core" />
          <div className="inferno-shockwave" />
          <div className="inferno-shockwave inferno-shockwave-echo" />
          <div className="inferno-scorch" />
          {SPARKS.map((style, i) => <span key={i} className="inferno-ember" style={style} />)}
        </>}
        <div className="impact-ring" />
        <div className="impact-ring impact-ring-echo" />
        <svg className="impact-burst" viewBox="0 0 100 100">
          <path d="m50 3 8 30 26-17-17 27 30 7-30 8 17 26-27-17-7 30-8-30-26 17 17-27L3 50l30-8-17-26 27 17Z" fill="currentColor" />
        </svg>
        <div className="impact-slash" />
        {SPARKS.map((style, i) => <span key={i} className="impact-spark" style={style} />)}
      </div>
    </div>
  );
}
