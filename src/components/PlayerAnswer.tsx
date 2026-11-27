"use client";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Answer, PublicQuestion } from "@/shared/types";
import { OPTION_COLORS, Shape } from "./Marks";
import { fmt } from "./Stage";

interface Props {
  q: PublicQuestion;
  onAnswer: (a: Answer) => void;
  busy: boolean;
  /** Hit by a banana: answer tiles keep sliding around. */
  slippery?: boolean;
}

/** New positions for the tiles every so often while slippery. */
function useSlipOrder(n: number, slippery: boolean): number[] {
  const [order, setOrder] = useState(() => Array.from({ length: n }, (_, i) => i));
  useEffect(() => {
    if (!slippery) return;
    const shuffle = () =>
      setOrder((prev) => {
        const a = prev.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      });
    shuffle();
    const t = setInterval(shuffle, 1300);
    return () => clearInterval(t);
  }, [slippery]);
  return order;
}

/** The answer controls on a player's phone, one per question type. */
export function PlayerAnswer({ q, onAnswer, busy, slippery = false }: Props) {
  const slots = useSlipOrder(q.type === "choice" ? q.options.length : 2, slippery && (q.type === "choice" || q.type === "truefalse"));
  const slip = (i: number) => (slippery ? { order: slots[i] } : undefined);
  switch (q.type) {
    case "choice":
      return (
        <ul className={`tiles tiles--${q.options.length} tiles--play${slippery ? " is-slippery" : ""}`}>
          {q.options.map((o, i) => (
            <li key={o.id} style={slip(i)}>
              <button
                type="button"
                className="tile"
                style={{ background: OPTION_COLORS[i] }}
                disabled={busy}
                onClick={() => onAnswer({ type: "choice", optionId: o.id })}
              >
                <Shape i={i} />
                <span>{o.text}</span>
              </button>
            </li>
          ))}
        </ul>
      );
    case "truefalse":
      return (
        <ul className={`tiles tiles--2 tiles--play${slippery ? " is-slippery" : ""}`}>
          <li style={slip(0)}>
            <button type="button" className="tile tile--true" disabled={busy} onClick={() => onAnswer({ type: "truefalse", value: true })}>
              <Shape i={0} />
              <span>True</span>
            </button>
          </li>
          <li style={slip(1)}>
            <button type="button" className="tile tile--false" disabled={busy} onClick={() => onAnswer({ type: "truefalse", value: false })}>
              <Shape i={2} />
              <span>False</span>
            </button>
          </li>
        </ul>
      );
    case "slider":
      return <SliderAnswer q={q} onAnswer={onAnswer} busy={busy} />;
    case "order":
      return <OrderAnswer q={q} onAnswer={onAnswer} busy={busy} />;
    case "type":
      return <TypeAnswer onAnswer={onAnswer} busy={busy} />;
    case "pin":
      return <PinAnswer q={q} onAnswer={onAnswer} busy={busy} />;
  }
}

function SliderAnswer({ q, onAnswer, busy }: Props) {
  if (q.type !== "slider") return null;
  const mid = snap(q.min + (q.max - q.min) / 2, q.min, q.step);
  const [v, setV] = useState(mid);
  const [touched, setTouched] = useState(false);
  const share = ((v - q.min) / (q.max - q.min)) * 100;
  return (
    <div className="answer-slider">
      <output className="answer-slider__value" htmlFor="guess">
        {fmt(v)}
        {q.unit ? <small> {q.unit}</small> : null}
      </output>
      <input
        id="guess"
        type="range"
        className="range"
        min={q.min}
        max={q.max}
        step={q.step}
        value={v}
        style={{ ["--fill" as string]: `${share}%` }}
        onChange={(e) => {
          setV(Number(e.target.value));
          setTouched(true);
        }}
        aria-label="Your guess"
      />
      <div className="answer-slider__ends" aria-hidden="true">
        <span>{fmt(q.min)}</span>
        <span>{fmt(q.max)}</span>
      </div>
      <div className="nudge">
        <button type="button" className="btn btn--ghost" onClick={() => setV((x) => Math.max(q.min, snap(x - q.step, q.min, q.step)))} aria-label="Lower">
          −
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setV((x) => Math.min(q.max, snap(x + q.step, q.min, q.step)))} aria-label="Higher">
          +
        </button>
      </div>
      <button type="button" className="btn btn--go btn--block" disabled={busy} onClick={() => onAnswer({ type: "slider", value: v })}>
        {touched ? "Lock in" : "Lock in the middle"}
      </button>
    </div>
  );
}

function snap(v: number, min: number, step: number) {
  const n = Math.round((v - min) / step) * step + min;
  return Number(n.toFixed(6));
}

function OrderAnswer({ q, onAnswer, busy }: Props) {
  if (q.type !== "order") return null;
  const [items, setItems] = useState(q.items);
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const rowH = useRef(64);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((list) => {
      const next = list.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  const onDown = (e: RPointerEvent<HTMLButtonElement>, id: string) => {
    const row = (e.currentTarget.closest("li") as HTMLElement | null)?.getBoundingClientRect();
    if (row) rowH.current = row.height + 8;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, startY: e.clientY, dy: 0 });
  };
  const onMove = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const idx = items.findIndex((i) => i.id === drag.id);
    const shift = Math.round(dy / rowH.current);
    if (shift !== 0) {
      const to = Math.max(0, Math.min(items.length - 1, idx + shift));
      if (to !== idx) {
        move(idx, to);
        setDrag({ id: drag.id, startY: drag.startY + (to - idx) * rowH.current, dy: dy - (to - idx) * rowH.current });
        return;
      }
    }
    setDrag({ ...drag, dy });
  };
  const onUp = () => setDrag(null);

  return (
    <div className="answer-order">
      <p className="hint">Drag to reorder, or use the arrows. Top is first.</p>
      <ol className="sortable" ref={listRef}>
        {items.map((it, i) => (
          <li
            key={it.id}
            className={`sortable__row${drag?.id === it.id ? " is-dragging" : ""}`}
            style={drag?.id === it.id ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <span className="sortable__n">{i + 1}</span>
            <button
              type="button"
              className="sortable__grip"
              onPointerDown={(e) => onDown(e, it.id)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label={`Drag ${it.text}`}
            >
              <span>{it.text}</span>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
            </button>
            <span className="sortable__arrows">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${it.text} up`}>
                ▲
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${it.text} down`}>
                ▼
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn--go btn--block" disabled={busy} onClick={() => onAnswer({ type: "order", order: items.map((i) => i.id) })}>
        Lock in this order
      </button>
    </div>
  );
}

function TypeAnswer({ onAnswer, busy }: Omit<Props, "q">) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <form
      className="answer-type"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAnswer({ type: "type", text: text.trim() });
      }}
    >
      <label className="sr-only" htmlFor="typed">
        Your answer
      </label>
      <input
        id="typed"
        ref={ref}
        className="field field--big"
        value={text}
        maxLength={80}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Your answer"
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn btn--go btn--block" disabled={busy || !text.trim()}>
        Send answer
      </button>
    </form>
  );
}

function PinAnswer({ q, onAnswer, busy }: Props) {
  if (q.type !== "pin" || !q.image) return null;
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const place = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPin({
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };
  return (
    <div className="answer-pin">
      <p className="hint">{pin ? "Tap again to move your pin." : "Tap the picture to drop your pin."}</p>
      <div
        className="pinboard pinboard--play"
        style={{ aspectRatio: String(q.imageAspect ?? 1.5) }}
        onPointerDown={place}
        role="application"
        aria-label="Picture. Tap to place your pin."
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={q.image} alt="" draggable={false} />
        {pin && <span className="pinboard__mine" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} />}
      </div>
      <button type="button" className="btn btn--go btn--block" disabled={busy || !pin} onClick={() => pin && onAnswer({ type: "pin", ...pin })}>
        {pin ? "Lock in my pin" : "Drop a pin first"}
      </button>
    </div>
  );
}
