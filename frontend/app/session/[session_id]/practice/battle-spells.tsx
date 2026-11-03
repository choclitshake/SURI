import { Flame, Shield, Flower2, BookOpen, Volume2, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";
import type { PracticeBattleState, PracticeSpell } from "../../../../lib/api";
import "./battle-spells.css";

export const SPELLS = [
  { id: "flame", name: "Flame Strike", icon: Flame, description: "+25 points on your next correct rune.", active: "Next correct rune empowered" },
  { id: "ward", name: "Aegis Ward", icon: Shield, description: "Block the next hit. Mistakes still count.", active: "Next incoming hit blocked" },
  { id: "bloom", name: "Healing Bloom", icon: Flower2, description: "Restore one lost heart.", active: "One heart restored" },
] as const;

export const FLAME_FLIGHT_MS = 680;

export function BattleSpells({ state, disabled, failedAction, onCast, muted, onToggleMuted, maxHearts = 3 }: {
  state: PracticeBattleState | null;
  disabled: boolean;
  failedAction: PracticeSpell | "answer" | null;
  onCast: (spell: PracticeSpell) => void;
  muted: boolean;
  onToggleMuted: () => void;
  maxHearts?: number;
}) {
  return (
    <section className="spellbook" aria-label="Battle powerups">
      <div className="spellbook-heading">
        <BookOpen size={15} aria-hidden="true" /><span>Spell satchel</span>
        <button type="button" className="spell-sound-toggle" onClick={onToggleMuted}
          aria-label={muted ? "Enable battle sounds" : "Mute battle sounds"} aria-pressed={!muted}>
          {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
          <span>Sound {muted ? "off" : "on"}</span>
        </button>
      </div>
      <div className="spellbook-grid">
        {SPELLS.map(({ id, name, icon: Icon, description, active }) => {
          const armed = id === "flame" ? state?.flame_ready : id === "ward" && state?.ward_ready;
          const used = state?.used.includes(id);
          const full = id === "bloom" && (state?.hearts ?? maxHearts) >= maxHearts;
          const unavailable = disabled || !state || used || full || (!!failedAction && failedAction !== id);
          return (
            <button key={id} type="button" className={`spell-card spell-${id}${armed ? " spell-armed" : ""}`}
              disabled={unavailable} onClick={() => onCast(id)} title={description}
              aria-label={`${name}: ${description} ${armed ? active : used ? "Used" : full ? "Hearts full" : "One charge available"}`}>
              <span className="spell-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="spell-name">{name}</span>
              <span className="spell-charge">{failedAction === id ? "Retry cast" : armed ? "Armed" : used ? "Spent" : full ? "Hearts full" : "Cast · 1/1"}</span>
            </button>
          );
        })}
      </div>
      <div className="spellbook-status" role="status">
        {failedAction ? "Cast not confirmed. Retry the same action to reconnect safely."
          : state?.flame_ready || state?.ward_ready ? [state.flame_ready && "Flame Strike armed", state.ward_ready && "Aegis Ward protecting Suri"].filter(Boolean).join(" · ")
          : "One charge each. Refills with the next enemy."}
      </div>
      <details className="spellbook-guide">
        <summary>Spell effects</summary>
        <ul>{SPELLS.map(({ id, name, description }) => <li key={id}><strong>{name}:</strong> {description}</li>)}</ul>
      </details>
    </section>
  );
}

export function ArmedSpellBubble({ flameReady, wardReady }: { flameReady: boolean; wardReady: boolean }) {
  if (!flameReady && !wardReady) return null;
  return (
    <div className="armed-spell-bubble" role="status">
      <div className="armed-spell-heading">Suri&apos;s spells are ready!</div>
      {flameReady && <div className="armed-spell-row armed-flame">
        <Flame size={27} fill="currentColor" aria-hidden="true" />
        <div><strong>Flame Strike armed</strong><span>Your next correct answer unleashes fire!</span></div>
      </div>}
      {wardReady && <div className="armed-spell-row armed-ward">
        <Shield size={27} aria-hidden="true" />
        <div><strong>Aegis Ward active</strong><span>Suri will block the next incoming hit.</span></div>
      </div>}
    </div>
  );
}

export function SpellEffect({ spell, label, stage = "charge" }: { spell: PracticeSpell; label: string; stage?: "charge" | "strike" }) {
  const Icon = SPELLS.find(s => s.id === spell)!.icon;
  return (
    <div className={`spell-effect effect-${spell} effect-${spell}-${stage}`} aria-hidden="true"
      style={{ "--flame-flight-time": `${FLAME_FLIGHT_MS}ms` } as CSSProperties}>
      {(stage === "strike" || spell === "bloom") && <div className="spell-effect-label"><Icon size={18} />{label}</div>}
      {spell === "flame" ? stage === "strike" ? <>
        <div className="flame-projectile"><Flame size={62} fill="currentColor" /></div>
        <div className="flame-flight-trail" />
      </> : <div className="flame-charge-sigil"><Flame size={66} fill="currentColor" /><span /><span /></div>
        : spell === "ward" ? <div className="ward-dome"><Shield size={72} strokeWidth={1.3} /><div className="ward-ring" /></div>
        : <div className="bloom-field">{Array.from({ length: 7 }, (_, i) => <span key={i} style={{ left: `${10 + i * 12}%`, animationDelay: `${i * 70}ms` }}><Flower2 size={20 + (i % 3) * 8} /></span>)}<div className="bloom-ring" /></div>}
    </div>
  );
}
