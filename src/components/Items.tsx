"use client";
import { useEffect, useRef, useState } from "react";
import { REACTIONS, type ItemEvent, type ItemKind } from "@/shared/types";
import { getSocket } from "@/lib/socket";
import { Avatar } from "./Avatar";

export const ITEM_INFO: Record<ItemKind, { name: string; does: (target?: string) => string; button: (target?: string) => string }> = {
  nitro: {
    name: "Nitro",
    does: () => "Doubles your points on the next question.",
    button: () => "Light the nitro",
  },
  banana: {
    name: "Banana",
    does: (t) => `${t ?? "The player ahead"}'s answers slip around on the next question.`,
    button: (t) => `Throw at ${t ?? "them"}`,
  },
  smoke: {
    name: "Smoke bomb",
    does: (t) => `${t ?? "The player ahead"} has to wipe smoke off their screen on the next question.`,
    button: (t) => `Throw at ${t ?? "them"}`,
  },
  shield: {
    name: "Shield",
    does: () => "Blocks the next banana or smoke bomb thrown at you.",
    button: () => "Raise the shield",
  },
};

export function ItemIcon({ kind, size = 40 }: { kind: ItemKind; size?: number }) {
  const stroke = { stroke: "#0E1A3D", strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {kind === "banana" && (
        <g {...stroke}>
          <path d="M10 14c2 14 12 24 28 22 3 0 4-3 1-4-12 0-19-8-22-19-1-3-7-3-7 1z" fill="#FFCE1F" />
          <path d="M10 14l-1-5 5 1" fill="#7a5a12" />
          <path d="M16 18c3 7 8 12 15 14" fill="none" stroke="#e0a800" strokeWidth="2" />
        </g>
      )}
      {kind === "smoke" && (
        <g {...stroke}>
          <circle cx="24" cy="30" r="12" fill="#2a3354" />
          <path d="M30 20l6-8" fill="none" />
          <path d="M34 9l5 2M37 6v5" stroke="#FF9A3D" />
          <circle cx="15" cy="16" r="6" fill="#c9cfdf" />
          <circle cx="10" cy="24" r="4" fill="#c9cfdf" />
        </g>
      )}
      {kind === "nitro" && (
        <g {...stroke}>
          <path d="M24 4c3 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-10 6-12 0 5 2 8 5 8-1-8-3-12 1-20z" fill="#FF6B57" />
          <path d="M24 26c2 3 6 5 6 10a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-7z" fill="#FFCE1F" />
        </g>
      )}
      {kind === "shield" && (
        <g {...stroke}>
          <path d="M24 4l16 6v12c0 11-7 19-16 22C15 41 8 33 8 22V10z" fill="#2ED19A" />
          <path d="M24 10v28M14 20h20" stroke="#fff" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

/** The item in a player's pocket, with the button to use it. */
export function ItemPocket({
  item,
  shield,
  nitro,
  target,
  fresh,
  canUse,
  onUse,
  busy,
  error,
}: {
  item: ItemKind | null;
  shield: boolean;
  nitro: boolean;
  target: { name: string; avatar: number } | null;
  fresh: boolean;
  canUse: boolean;
  onUse: () => void;
  busy: boolean;
  error: string | null;
}) {
  if (!item && !shield && !nitro) return null;
  return (
    <div className="pocket">
      {item && (
        <div className={`pocket__item${fresh ? " is-fresh" : ""}`}>
          {fresh && <p className="pocket__got">Item box!</p>}
          <div className="pocket__row">
            <span className={`pocket__icon pocket__icon--${item}`}>
              <ItemIcon kind={item} size={44} />
            </span>
            <span className="pocket__text">
              <b>{ITEM_INFO[item].name}</b>
              <span>{ITEM_INFO[item].does(target?.name)}</span>
            </span>
          </div>
          {canUse ? (
            <button type="button" className="btn btn--go btn--small btn--block" onClick={onUse} disabled={busy}>
              {ITEM_INFO[item].button(target?.name)}
            </button>
          ) : (
            <p className="hint">Save it for between questions.</p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
      {(shield || nitro) && (
        <div className="pocket__status">
          {shield && (
            <span className="pocket__chip">
              <ItemIcon kind="shield" size={20} /> Shield up
            </span>
          )}
          {nitro && (
            <span className="pocket__chip">
              <ItemIcon kind="nitro" size={20} /> Nitro lit
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Smoke over the phone screen. Players wipe it away with a finger; it also clears by itself. */
export function SmokeOverlay({ from, onClear }: { from: string; onClear: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);
  const strokes = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3a4466";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = (40 + Math.random() * 90) * dpr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const shade = 150 + Math.floor(Math.random() * 70);
      g.addColorStop(0, `rgba(${shade},${shade + 5},${shade + 20},0.9)`);
      g.addColorStop(1, `rgba(${shade},${shade + 5},${shade + 20},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const t1 = setTimeout(() => setFading(true), 4500);
    const t2 = setTimeout(onClear, 5700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wipe = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, 42 * dpr, 0, Math.PI * 2);
    ctx.fill();
    // Enough wiping clears the rest, so a hard scrubber isn't stuck waiting.
    if (++strokes.current === 40) {
      setFading(true);
      setTimeout(onClear, 1200);
    }
  };

  return (
    <div className={`smoke${fading ? " is-fading" : ""}`}>
      <canvas ref={ref} onPointerDown={wipe} onPointerMove={(e) => e.buttons && wipe(e)} />
      <p className="smoke__label">
        {from} smoked you!
        <span>Wipe it off</span>
      </p>
    </div>
  );
}

/** Emoji buttons on the phone. */
export function ReactionBar() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="reactbar" aria-label="Send a reaction to the big screen">
      {REACTIONS.map((r) => (
        <button
          key={r}
          type="button"
          className={last === r ? "is-sent" : ""}
          onClick={() => {
            getSocket().emit("player:react", { emoji: r });
            setLast(r);
            setTimeout(() => setLast((x) => (x === r ? null : x)), 300);
          }}
          aria-label={`Send ${r}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

interface Floater {
  id: number;
  emoji: string;
  avatar: number;
  x: number;
  drift: number;
}

/** Reactions floating up the big screen. */
export function ReactionLayer() {
  const [items, setItems] = useState<Floater[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    const s = getSocket();
    const on = (r: { emoji: string; avatar: number }) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-30), { id, emoji: r.emoji, avatar: r.avatar, x: 4 + Math.random() * 88, drift: (Math.random() - 0.5) * 120 }]);
      setTimeout(() => setItems((list) => list.filter((f) => f.id !== id)), 3200);
    };
    s.on("reaction", on);
    return () => {
      s.off("reaction", on);
    };
  }, []);
  return (
    <div className="floaters" aria-hidden="true">
      {items.map((f) => (
        <span key={f.id} className="floater" style={{ left: `${f.x}%`, ["--drift" as string]: `${f.drift}px` }}>
          <span className="floater__emoji">{f.emoji}</span>
          <Avatar seed={f.avatar} size={26} />
        </span>
      ))}
    </div>
  );
}

/** Toasts on the big screen for every item used. Calls onNew for sound. */
export function ItemFeed({ feed, onNew }: { feed: ItemEvent[]; onNew?: (e: ItemEvent) => void }) {
  const seen = useRef<number | null>(null);
  const [shown, setShown] = useState<ItemEvent[]>([]);
  useEffect(() => {
    const maxId = feed.length ? feed[feed.length - 1].id : 0;
    if (seen.current === null) {
      seen.current = maxId; // don't replay old events after a reconnect
      return;
    }
    const fresh = feed.filter((e) => e.id > (seen.current ?? 0));
    if (!fresh.length) return;
    seen.current = maxId;
    fresh.forEach((e) => onNew?.(e));
    setShown((s) => [...s, ...fresh].slice(-4));
    const ids = fresh.map((e) => e.id);
    const t = setTimeout(() => setShown((s) => s.filter((e) => !ids.includes(e.id))), 5500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  return (
    <ul className="feed" aria-live="polite">
      {shown.map((e) => (
        <li key={e.id} className={`feed__item feed__item--${e.kind}${e.blocked ? " is-blocked" : ""}`}>
          <ItemIcon kind={e.blocked ? "shield" : e.kind} size={34} />
          <span>{feedText(e)}</span>
        </li>
      ))}
    </ul>
  );
}

function feedText(e: ItemEvent): string {
  const f = e.from.name;
  const t = e.to?.name ?? "";
  if (e.blocked) return `${t}'s shield blocked ${f}'s ${e.kind === "banana" ? "banana" : "smoke bomb"}`;
  switch (e.kind) {
    case "banana":
      return `${f} threw a banana at ${t}`;
    case "smoke":
      return `${f} smoked ${t}`;
    case "nitro":
      return `${f} lit the nitro`;
    case "shield":
      return `${f} raised a shield`;
  }
}

/** Slot reel that spins and lands on the Turbo multiplier. */
export function TurboReel({ value, compact = false }: { value: number; compact?: boolean }) {
  const [shown, setShown] = useState(1);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      setLanded(true);
      return;
    }
    const faces = [1, 2, 3];
    let i = 0;
    let delay = 60;
    let t: ReturnType<typeof setTimeout>;
    const spin = () => {
      i++;
      setShown(faces[i % 3]);
      delay *= 1.16;
      if (delay < 260) t = setTimeout(spin, delay);
      else {
        setShown(value);
        setLanded(true);
      }
    };
    t = setTimeout(spin, delay);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={`turbo${compact ? " turbo--compact" : ""}${landed ? " is-landed" : ""}`} role="status">
      <span className="turbo__label">Turbo round</span>
      <span className="turbo__window">
        <span key={shown} className="turbo__face">
          ×{shown}
        </span>
      </span>
    </div>
  );
}
