import type { Answer, Question } from "./types";

/** Lowercase, strip accents and punctuation, collapse spaces. Works for Latin and Cyrillic. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining accents (keeps Cyrillic letters like ө, ү)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const A = [...a];
  const B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

/** Typos allowed for an answer of this length. */
function typoBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  return 2;
}

export function textMatches(guess: string, accepted: string[]): boolean {
  const g = normalizeText(guess);
  if (!g) return false;
  return accepted.some((a) => {
    const n = normalizeText(a);
    if (!n) return false;
    if (n === g) return true;
    return levenshtein(n, g) <= typoBudget([...n].length);
  });
}

/** How right an answer is, from 0 (wrong) to 1 (perfect). */
export function accuracyOf(q: Question, a: Answer | null): number {
  if (!a || a.type !== q.type) return 0;
  switch (q.type) {
    case "choice": {
      if (a.type !== "choice") return 0;
      if (q.correct.length === 0) return 0; // poll
      return q.correct.includes(a.optionId) ? 1 : 0;
    }
    case "truefalse":
      return a.type === "truefalse" && a.value === q.correct ? 1 : 0;
    case "slider": {
      if (a.type !== "slider") return 0;
      const range = Math.max(q.max - q.min, 1e-9);
      const off = Math.abs(a.value - q.correct);
      if (off <= q.step / 2 + 1e-9) return 1;
      // Full marks only on the button; zero once you're 25% of the scale away.
      return clamp01(1 - off / (range * 0.25));
    }
    case "order": {
      if (a.type !== "order") return 0;
      const right = q.items.map((i) => i.id);
      if (a.order.length !== right.length) return 0;
      let hits = 0;
      right.forEach((id, i) => {
        if (a.order[i] === id) hits++;
      });
      return hits / right.length;
    }
    case "type":
      return a.type === "type" && textMatches(a.text, q.answers) ? 1 : 0;
    case "pin": {
      if (a.type !== "pin") return 0;
      const aspect = q.imageAspect && q.imageAspect > 0 ? q.imageAspect : 1;
      // Measure in image-width units so tall and wide pictures are fair.
      const dx = a.x - q.target.x;
      const dy = (a.y - q.target.y) / aspect;
      const dist = Math.hypot(dx, dy);
      if (dist <= q.radius) return 1;
      return clamp01(1 - (dist - q.radius) / (q.radius * 3));
    }
  }
}

/** Counts as "right" for streaks and the right/wrong banner. */
export const RIGHT_THRESHOLD = 0.75;

export const BASE_POINTS = 1000;
export const STREAK_STEP = 100;
export const STREAK_CAP = 5;

/**
 * Faster answers earn more: an instant answer keeps 100% of the points,
 * one at the buzzer keeps 50%.
 */
export function pointsFor(opts: {
  accuracy: number;
  timeMs: number;
  limitMs: number;
  mode: Question["points"];
  streakAfter: number;
}): number {
  if (opts.mode === "none" || opts.accuracy <= 0) return 0;
  const mult = opts.mode === "double" ? 2 : 1;
  const t = clamp01(opts.timeMs / Math.max(opts.limitMs, 1));
  const speed = 1 - t / 2;
  const base = Math.round(BASE_POINTS * mult * opts.accuracy * speed);
  const bonus =
    opts.accuracy >= RIGHT_THRESHOLD && opts.streakAfter >= 2
      ? Math.min(opts.streakAfter - 1, STREAK_CAP) * STREAK_STEP
      : 0;
  return base + bonus;
}

export function isPoll(q: Question): boolean {
  return q.type === "choice" && q.correct.length === 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
