"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type BattleSound = "attack" | "enemyAttack" | "hit" | "hurt" | "flameCharge" | "flameLaunch" | "explosion" | "ward" | "blocked" | "heal" | "victory";

const MUTE_KEY = "suri_battle_muted";
const MUTE_EVENT = "suri-battle-sound-change";
let memoryMuted = false;

function readMuted() {
  try {
    const saved = window.localStorage.getItem(MUTE_KEY);
    return saved === null ? memoryMuted : saved === "true";
  } catch { return memoryMuted; }
}

function subscribeMuted(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(MUTE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(MUTE_EVENT, listener);
  };
}

/** Short, original Web Audio effects. No files, downloads, or audio dependencies. */
export class BattleAudio {
  private context: AudioContext;
  private master: GainNode;
  private noiseBuffer: AudioBuffer;
  private voices = new Set<AudioScheduledSourceNode>();
  private muted = false;

  constructor(context: AudioContext) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = .24;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = .003;
    limiter.release.value = .18;
    this.master.connect(limiter);
    limiter.connect(context.destination);
    this.noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0);
    let seed = 217;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296) * 2 - 1;
    }
  }

  unlock() {
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.master.gain.setValueAtTime(muted ? 0 : .24, this.context.currentTime);
    if (muted) this.stopVoices();
  }

  private stopVoices() {
    this.voices.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
    this.voices.clear();
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      nodes.forEach(node => node.disconnect());
      this.voices.delete(source);
    };
  }

  private envelope(gain: GainNode, start: number, duration: number, volume: number) {
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    gain.connect(this.master);
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay = 0) {
    const start = this.context.currentTime + delay;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(from, start);
    source.frequency.exponentialRampToValueAtTime(to, start + duration);
    this.envelope(gain, start, duration, volume);
    source.connect(gain);
    this.track(source, [gain]);
    source.start(start);
    source.stop(start + duration);
  }

  private noise(duration: number, volume: number, from: number, to: number, type: BiquadFilterType = "lowpass") {
    const start = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    this.envelope(gain, start, duration, volume);
    source.connect(filter);
    filter.connect(gain);
    this.track(source, [filter, gain]);
    source.start(start);
    source.stop(start + duration);
  }

  play(sound: BattleSound) {
    if (this.muted || this.context.state !== "running" || this.voices.size > 24) return;
    switch (sound) {
      case "attack":
      case "enemyAttack":
        this.noise(.22, .32, 2400, 300, "bandpass");
        this.tone("triangle", sound === "attack" ? 240 : 150, 65, .2, .2);
        break;
      case "hit":
      case "hurt":
        this.noise(.18, .4, 2200, 250);
        this.tone("triangle", sound === "hit" ? 180 : 120, 42, .22, .35);
        break;
      case "flameCharge":
        this.noise(.55, .22, 350, 2400, "bandpass");
        this.tone("sawtooth", 65, 260, .55, .12);
        this.tone("sine", 220, 660, .65, .18);
        break;
      case "flameLaunch":
        this.noise(.68, .45, 700, 3800, "bandpass");
        this.tone("sawtooth", 220, 70, .55, .15);
        break;
      case "explosion":
        this.noise(1.15, .8, 3800, 100);
        this.tone("sine", 120, 28, .95, .8);
        this.tone("triangle", 240, 40, .35, .4);
        break;
      case "blocked":
        this.noise(.15, .24, 4000, 1500, "highpass");
        this.tone("triangle", 900, 650, .4, .3);
        this.tone("sine", 1340, 1250, .5, .17);
        break;
      case "ward":
        [392, 587.33, 783.99].forEach((note, i) => this.tone("sine", note, note, .5, .25, i * .07));
        break;
      case "heal":
        [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => this.tone("sine", note, note, .45, .24, i * .1));
        break;
      case "victory":
        [392, 523.25, 659.25, 783.99].forEach((note, i) => this.tone("triangle", note, note, .5, .2, i * .1));
        break;
    }
  }

  dispose() {
    this.stopVoices();
    void this.context.close().catch(() => {});
  }
}

export function useBattleAudio() {
  const engine = useRef<BattleAudio | null>(null);
  const muted = useSyncExternalStore(subscribeMuted, readMuted, () => false);
  useEffect(() => { engine.current?.setMuted(muted); }, [muted]);
  useEffect(() => () => { engine.current?.dispose(); engine.current = null; }, []);

  // Call synchronously from a click/key event, before awaiting a backend response.
  const unlock = useCallback(() => {
    try {
      if (!engine.current && typeof window.AudioContext === "function") {
        engine.current = new BattleAudio(new window.AudioContext());
        engine.current.setMuted(readMuted());
      }
      engine.current?.unlock();
    } catch { /* Audio is optional; gameplay must still work. */ }
  }, []);

  const play = useCallback((sound: BattleSound) => {
    try { engine.current?.play(sound); } catch { /* Audio must never interrupt a turn. */ }
  }, []);

  const toggleMuted = useCallback(() => {
    const nextMuted = !readMuted();
    memoryMuted = nextMuted;
    unlock();
    engine.current?.setMuted(nextMuted);
    try { window.localStorage.setItem(MUTE_KEY, String(nextMuted)); } catch { /* Storage may be disabled. */ }
    window.dispatchEvent(new Event(MUTE_EVENT));
  }, [unlock]);

  return { muted, toggleMuted, unlock, play };
}
