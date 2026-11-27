"use client";
import { useRemaining } from "@/lib/clock";

const TOTAL = 4000;
const LIGHT_EVERY = 600;

/** Five red lights come on one by one, then all go out: go. */
export function StartLights({ endsAt, serverNow, compact = false }: { endsAt: number | null; serverNow: number; compact?: boolean }) {
  const left = useRemaining(endsAt, serverNow);
  const elapsed = TOTAL - left;
  const go = elapsed >= LIGHT_EVERY * 5 + 300;
  const on = go ? 0 : Math.min(5, Math.floor(elapsed / LIGHT_EVERY) + 1);

  return (
    <div className={`lights${compact ? " lights--compact" : ""}`} role="timer" aria-live="polite" aria-label={go ? "Go" : `Starting in ${Math.ceil(left / 1000)}`}>
      <div className="lights__rig">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`lights__bulb${i < on ? " is-on" : ""}`} />
        ))}
      </div>
      <p className={`lights__go${go ? " is-shown" : ""}`} aria-hidden={!go}>
        Go
      </p>
    </div>
  );
}
