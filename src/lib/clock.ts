"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Milliseconds left until `endsAt` (server clock). `serverNow` from the latest
 * state lets us correct for a phone whose clock is a few seconds off.
 */
export function useRemaining(endsAt: number | null, serverNow: number): number {
  const offset = useRef(0);
  useEffect(() => {
    offset.current = serverNow - Date.now();
  }, [serverNow]);

  const calc = () => (endsAt == null ? 0 : Math.max(0, endsAt - (Date.now() + offset.current)));
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    if (endsAt == null) {
      setLeft(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const v = calc();
      setLeft(v);
      if (v > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, serverNow]);

  return left;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Turns a number toward its target over `ms`. For score counters. */
export function useCountUp(target: number, ms = 900, from = 0): number {
  const [v, setV] = useState(from);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced) {
      setV(target);
      return;
    }
    const start = performance.now();
    const a = from;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (target - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, from, reduced]);
  return v;
}
