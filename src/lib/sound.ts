"use client";

/**
 * Every sound is synthesised with Web Audio, so there are no audio files to load.
 * Browsers only allow sound after a click, so call unlock() from a click handler.
 */
let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = typeof window !== "undefined" && localStorage.getItem("dash.muted") === "1";
} catch {
  /* storage blocked */
}

export function unlock() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("dash.muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "square", vol = 0.12, slideTo?: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, vol = 0.15, from = 800, to = 3000) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  /** One start light coming on. */
  light: () => tone(440, 0, 0.18, "square", 0.1),
  /** Lights out: go. */
  go: () => {
    tone(880, 0, 0.45, "square", 0.12);
    tone(1320, 0, 0.45, "sine", 0.06);
  },
  tick: () => tone(1500, 0, 0.05, "square", 0.05),
  lockIn: () => tone(1046, 0, 0.08, "sine", 0.06),
  reveal: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.25, "triangle", 0.12)),
  whoosh: () => noise(0, 0.5, 0.18, 400, 4000),
  splat: () => {
    tone(300, 0, 0.25, "sawtooth", 0.08, 80);
    noise(0, 0.2, 0.12, 2000, 300);
  },
  shield: () => tone(600, 0, 0.3, "sine", 0.1, 1400),
  nitro: () => {
    noise(0, 0.6, 0.2, 200, 5000);
    tone(200, 0, 0.6, "sawtooth", 0.05, 900);
  },
  reel: () => tone(900 + Math.random() * 300, 0, 0.04, "square", 0.05),
  turbo: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.2, "square", 0.08)),
  drumroll: (secs = 1.6) => {
    for (let i = 0; i < secs * 22; i++) noise(i / 22, 0.05, 0.12, 150, 400);
  },
  fanfare: () => {
    const notes = [523, 659, 784, 1046, 784, 1046];
    const times = [0, 0.14, 0.28, 0.42, 0.62, 0.76];
    notes.forEach((f, i) => tone(f, times[i], i === notes.length - 1 ? 0.9 : 0.18, "square", 0.1));
    tone(261, 0.42, 1.2, "triangle", 0.1);
  },
  third: () => tone(392, 0, 0.3, "triangle", 0.12),
  second: () => [392, 523].forEach((f, i) => tone(f, i * 0.1, 0.3, "triangle", 0.12)),
};
