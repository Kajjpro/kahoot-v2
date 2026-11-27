"use client";
import type { PublicQuestion, Reveal, RevealStats } from "@/shared/types";
import { Avatar } from "./Avatar";
import { OPTION_COLORS, Shape, seconds } from "./Marks";

/** The question on the big screen while players answer. */
export function QuestionStage({ q }: { q: PublicQuestion }) {
  const hasPicture = !!q.image && q.type !== "pin";
  return (
    <div className={`stage stage--${q.type}`}>
      {hasPicture && (
        <div className="stage__picture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="" />
        </div>
      )}
      {q.type === "choice" && (
        <ul className={`tiles tiles--${q.options.length}`}>
          {q.options.map((o, i) => (
            <li key={o.id} className="tile" style={{ background: OPTION_COLORS[i] }}>
              <Shape i={i} />
              <span>{o.text}</span>
            </li>
          ))}
        </ul>
      )}
      {q.type === "truefalse" && (
        <ul className="tiles tiles--2">
          <li className="tile tile--true">
            <Shape i={0} /> <span>True</span>
          </li>
          <li className="tile tile--false">
            <Shape i={2} /> <span>False</span>
          </li>
        </ul>
      )}
      {q.type === "slider" && (
        <div className="scale" aria-label={`Guess between ${q.min} and ${q.max}`}>
          <span>
            {fmt(q.min)}
            {q.unit ? ` ${q.unit}` : ""}
          </span>
          <div className="scale__line" />
          <span>
            {fmt(q.max)}
            {q.unit ? ` ${q.unit}` : ""}
          </span>
        </div>
      )}
      {q.type === "order" && (
        <ul className="chips">
          {q.items.map((it) => (
            <li key={it.id} className="chip">
              {it.text}
            </li>
          ))}
        </ul>
      )}
      {q.type === "type" && <p className="stage__note">Type your answer on your phone.</p>}
      {q.type === "pin" && q.image && (
        <div className="pinboard pinboard--stage" style={{ aspectRatio: String(q.imageAspect ?? 1.5) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="" />
        </div>
      )}
    </div>
  );
}

/** What everyone answered, shown on the big screen after time is up. */
export function RevealBoard({ q, reveal }: { q: PublicQuestion; reveal: Reveal }) {
  return (
    <div className="reveal">
      <RevealStatsView q={q} s={reveal.stats} total={reveal.answered} />
      <div className="reveal__foot">
        {reveal.fastest ? (
          <p className="fastest">
            <Avatar seed={reveal.fastest.avatar} size={40} />
            <span>
              Fastest right answer: <b>{reveal.fastest.name}</b> in {seconds(reveal.fastest.timeMs)}
            </span>
          </p>
        ) : (
          <span />
        )}
        <p className="reveal__count">
          {reveal.answered} of {reveal.total} answered
        </p>
      </div>
    </div>
  );
}

function RevealStatsView({ q, s, total }: { q: PublicQuestion; s: RevealStats; total: number }) {
  const max = Math.max(1, total);
  switch (s.type) {
    case "choice": {
      if (q.type !== "choice") return null;
      return (
        <ul className="bars">
          {q.options.map((o, i) => {
            const n = s.counts[o.id] ?? 0;
            const right = s.correct.includes(o.id);
            const dim = !s.isPoll && !right;
            return (
              <li key={o.id} className={`bar${dim ? " is-dim" : ""}`}>
                <span className="bar__count">{n}</span>
                <span className="bar__fill" style={{ height: `${(n / max) * 100}%`, background: OPTION_COLORS[i] }} />
                <span className="bar__label" style={{ background: OPTION_COLORS[i] }}>
                  <Shape i={i} size={20} />
                  <span>{o.text}</span>
                  {right && <Tick />}
                </span>
              </li>
            );
          })}
        </ul>
      );
    }
    case "truefalse": {
      const rows = [
        { label: "True", n: s.counts.true, right: s.correct === true, cls: "tile--true", shape: 0 },
        { label: "False", n: s.counts.false, right: s.correct === false, cls: "tile--false", shape: 2 },
      ];
      return (
        <ul className="bars bars--2">
          {rows.map((r) => (
            <li key={r.label} className={`bar ${r.cls}${r.right ? "" : " is-dim"}`}>
              <span className="bar__count">{r.n}</span>
              <span className="bar__fill" style={{ height: `${(r.n / max) * 100}%` }} />
              <span className="bar__label">
                <Shape i={r.shape} size={20} />
                <span>{r.label}</span>
                {r.right && <Tick />}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "slider": {
      const span = s.max - s.min || 1;
      const pos = (v: number) => ((v - s.min) / span) * 100;
      // Stack guesses that land on top of each other.
      const stacks = new Map<number, number>();
      const dots = s.guesses.map((g) => {
        const key = Math.round(pos(g) / 2);
        const h = stacks.get(key) ?? 0;
        stacks.set(key, h + 1);
        return { x: pos(g), level: h };
      });
      return (
        <div className="numline">
          <div className="numline__dots">
            {dots.map((d, i) => (
              <span key={i} className="numline__dot" style={{ left: `${d.x}%`, bottom: `${d.level * 16}px` }} />
            ))}
            <span className="numline__flag" style={{ left: `${pos(s.correct)}%` }}>
              <b>
                {fmt(s.correct)}
                {s.unit ? ` ${s.unit}` : ""}
              </b>
            </span>
          </div>
          <div className="numline__axis">
            <span>{fmt(s.min)}</span>
            <span>{fmt(s.max)}</span>
          </div>
        </div>
      );
    }
    case "order":
      return (
        <ol className="orderlist">
          {s.correctOrder.map((it, i) => (
            <li key={it.id}>
              <span className="orderlist__n">{i + 1}</span>
              <span className="orderlist__t">{it.text}</span>
              <span className="orderlist__pct">{pct(s.perItemRight[it.id] ?? 0, total)} got this spot</span>
            </li>
          ))}
        </ol>
      );
    case "type":
      return (
        <div className="typed">
          <p className="typed__answer">{s.accepted[0]}</p>
          {s.accepted.length > 1 && <p className="typed__also">Also accepted: {s.accepted.slice(1).join(", ")}</p>}
          {s.top.length > 0 && (
            <ul className="typed__list">
              {s.top.map((t) => (
                <li key={t.text} className={t.ok ? "is-ok" : ""}>
                  <span>{t.text}</span>
                  <b>{t.count}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "pin":
      if (q.type !== "pin" || !q.image) return null;
      return (
        <div className="pinboard pinboard--stage" style={{ aspectRatio: String(q.imageAspect ?? 1.5) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="" />
          <span
            className="pinboard__target"
            style={{
              left: `${s.target.x * 100}%`,
              top: `${s.target.y * 100}%`,
              width: `${s.radius * 200}%`,
            }}
          />
          {s.pins.map((p, i) => (
            <span key={i} className={`pinboard__pin${p.hit ? " is-hit" : ""}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
          ))}
        </div>
      );
  }
}

/** One line telling a player what the right answer was. */
export function rightAnswerText(q: PublicQuestion, s: RevealStats): string | null {
  switch (s.type) {
    case "choice":
      if (s.isPoll || q.type !== "choice") return null;
      return q.options
        .filter((o) => s.correct.includes(o.id))
        .map((o) => o.text)
        .join(" or ");
    case "truefalse":
      return s.correct ? "True" : "False";
    case "slider":
      return `${fmt(s.correct)}${s.unit ? ` ${s.unit}` : ""}`;
    case "order":
      return s.correctOrder.map((i) => i.text).join(", ");
    case "type":
      return s.accepted[0] ?? null;
    case "pin":
      return null;
  }
}

function Tick() {
  return (
    <svg className="tick" viewBox="0 0 24 24" width="22" height="22" aria-label="Right answer" role="img">
      <circle cx="12" cy="12" r="11" fill="#0E1A3D" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)}%` : "0%";
}
