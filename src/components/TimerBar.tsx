"use client";
import { useRemaining } from "@/lib/clock";

/** A shrinking lane at the top of the screen with the seconds left. */
export function TimerBar({ endsAt, serverNow, limit }: { endsAt: number | null; serverNow: number; limit: number }) {
  const left = useRemaining(endsAt, serverNow);
  const share = Math.max(0, Math.min(1, left / (limit * 1000)));
  const secs = Math.ceil(left / 1000);
  const hurry = left <= 5000 && left > 0;
  return (
    <div className={`timer${hurry ? " is-hurry" : ""}`}>
      <div className="timer__track" aria-hidden="true">
        <div className="timer__fill" style={{ transform: `scaleX(${share})` }} />
      </div>
      <span className="timer__secs" role="timer" aria-label={`${secs} seconds left`}>
        {secs}
      </span>
    </div>
  );
}
