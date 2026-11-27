"use client";
import { useEffect, useRef } from "react";

const COLORS = ["#FFCE1F", "#FF6B57", "#2ED19A", "#FFFFFF", "#B79CFF", "#FF9A3D"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  shape: 0 | 1 | 2;
}

/** Paper strips and checkered flags falling. Fires once when `fire` turns true. */
export function Confetti({ fire, duration = 5000 }: { fire: boolean; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width;
    const H = () => canvas.height;
    const count = Math.min(220, Math.round(canvas.clientWidth / 5));
    const pieces: Piece[] = Array.from({ length: count }, () => ({
      x: W() / 2 + (Math.random() - 0.5) * W() * 0.3,
      y: H() * 0.35,
      vx: (Math.random() - 0.5) * 22 * dpr,
      vy: (-Math.random() * 18 - 8) * dpr,
      w: (6 + Math.random() * 8) * dpr,
      h: (10 + Math.random() * 10) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: (Math.random() < 0.12 ? 2 : Math.random() < 0.5 ? 1 : 0) as 0 | 1 | 2,
    }));

    let raf = 0;
    const started = performance.now();
    const frame = (t: number) => {
      const age = t - started;
      ctx.clearRect(0, 0, W(), H());
      const fade = age > duration - 1000 ? Math.max(0, (duration - age) / 1000) : 1;
      ctx.globalAlpha = fade;
      for (const p of pieces) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === 2) {
          // a tiny chequered flag
          const s = p.w * 0.9;
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
              ctx.fillStyle = (i + j) % 2 ? "#0E1A3D" : "#FFFFFF";
              ctx.fillRect((i - 1.5) * s * 0.66, (j - 1.5) * s * 0.66, s * 0.66, s * 0.66);
            }
        } else {
          ctx.fillStyle = p.color;
          const sq = Math.cos(p.rot * 3);
          if (p.shape === 0) ctx.fillRect(-p.w / 2, (-p.h / 2) * sq, p.w, p.h * sq);
          else {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.w / 2, (p.w / 2) * Math.abs(sq) + 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      if (age < duration) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [fire, duration]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
