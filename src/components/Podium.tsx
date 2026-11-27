"use client";
import { useEffect, useState } from "react";
import type { RankedPlayer } from "@/shared/types";
import { usePrefersReducedMotion } from "@/lib/clock";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { ordinal } from "./Marks";

/**
 * Third, then second, a beat of suspense, then the winner drops onto the top step.
 * `stage` goes 0 → 4; `onDone` fires once the winner has landed.
 */
export function Podium({ top, size = "big", onDone }: { top: RankedPlayer[]; size?: "big" | "small"; onDone?: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduced) {
      setStage(4);
      onDone?.();
      return;
    }
    const times = [700, 2100, 3500, 5200];
    const timers = times.map((t, i) => setTimeout(() => setStage(i + 1), t));
    const done = setTimeout(() => onDone?.(), 6200);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const [first, second, third] = top;
  // Left to right on the podium: 2nd, 1st, 3rd.
  const steps: { p: RankedPlayer | undefined; place: 1 | 2 | 3; shownAt: number }[] = [
    { p: second, place: 2, shownAt: 2 },
    { p: first, place: 1, shownAt: 4 },
    { p: third, place: 3, shownAt: 1 },
  ];

  return (
    <div className={`podium podium--${size}`}>
      <Confetti fire={stage >= 4} />
      <p className={`podium__drum${stage === 3 ? " is-shown" : ""}`} aria-hidden={stage !== 3}>
        And the winner is…
      </p>
      <div className="podium__stand">
        {steps.map(({ p, place, shownAt }) => (
          <div key={place} className={`podium__col podium__col--${place}${stage >= shownAt ? " is-up" : ""}`}>
            {p && (
              <div className="podium__who" aria-live="polite">
                {place === 1 && <Crown />}
                <Avatar seed={p.avatar} size={size === "big" ? (place === 1 ? 112 : 88) : place === 1 ? 72 : 56} />
                <span className="podium__name">{p.name}</span>
                <span className="podium__score">{p.score.toLocaleString()}</span>
              </div>
            )}
            <div className="podium__block">
              <span className="podium__place" aria-label={`${ordinal(place)} place`}>
                {place}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Crown() {
  return (
    <svg className="podium__crown" viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
      <path d="M4 28L2 6l12 10L24 2l10 14L46 6l-2 22z" fill="#FFCE1F" stroke="#0E1A3D" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="3" fill="#FF4B3E" />
    </svg>
  );
}
