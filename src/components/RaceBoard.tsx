"use client";
import { useEffect, useState } from "react";
import type { RankedPlayer } from "@/shared/types";
import { useCountUp } from "@/lib/clock";
import { Avatar } from "./Avatar";
import { Flame } from "./Marks";

/**
 * The leaderboard as a race: one lane per runner, and each runner
 * sprints from last round's score to this round's.
 */
export function RaceBoard({ entries }: { entries: RankedPlayer[] }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 150);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(1, ...entries.map((e) => e.score));

  return (
    <ol className="race" aria-label="Leaderboard">
      {entries.map((e, i) => (
        <Lane key={e.id} e={e} max={max} go={go} delay={i * 90} />
      ))}
    </ol>
  );
}

function Lane({ e, max, go, delay }: { e: RankedPlayer; max: number; go: boolean; delay: number }) {
  const from = e.prevScore / max;
  const to = e.score / max;
  const at = go ? to : from;
  const score = useCountUp(go ? e.score : e.prevScore, 1100, e.prevScore);
  const moved = e.prevRank != null ? e.prevRank - e.rank : 0;

  return (
    <li className="race__lane">
      <span className="race__rank">{e.rank}</span>
      <div className="race__track">
        <div className="race__runner" style={{ left: `calc(${at} * (100% - 140px))`, transitionDelay: `${delay}ms` }}>
          <Avatar seed={e.avatar} size={52} />
          <span className="race__name">
            {e.name}
            {e.streak >= 2 && (
              <span className="race__streak" title={`${e.streak} right in a row`}>
                <Flame size={16} />
                {e.streak}
              </span>
            )}
          </span>
        </div>
      </div>
      <span className="race__score">
        {score.toLocaleString()}
        {moved > 0 && <span className="race__moved" aria-label={`Up ${moved}`}>▲{moved}</span>}
      </span>
    </li>
  );
}
