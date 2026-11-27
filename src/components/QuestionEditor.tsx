"use client";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { PointsMode, Question, QuestionType } from "@/shared/types";
import { LIMITS, questionProblem, TIME_CHOICES } from "@/shared/validate";
import { loadImage } from "@/lib/image";
import { convertQuestion, uid } from "@/lib/quizzes";
import { OPTION_COLORS, Shape, TYPE_INFO, TypeIcon } from "./Marks";

const TYPES: QuestionType[] = ["choice", "truefalse", "slider", "order", "type", "pin"];

interface Props {
  q: Question;
  index: number;
  count: number;
  onChange: (q: Question) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function QuestionEditor({ q, index, count, onChange, onMove, onDuplicate, onDelete }: Props) {
  const problem = questionProblem(q);
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch } as Question);

  return (
    <div className="qedit">
      <div className="qedit__head">
        <h2 className="qedit__num">Question {index + 1}</h2>
        <div className="qedit__tools">
          <button type="button" className="btn btn--quiet" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up">
            ↑
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move question down">
            ↓
          </button>
          <button type="button" className="btn btn--quiet" onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" className="btn btn--quiet qedit__delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <fieldset className="typeswitch">
        <legend className="label">Question type</legend>
        <div className="typeswitch__row">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`typeswitch__opt${q.type === t ? " is-on" : ""}`}
              aria-pressed={q.type === t}
              onClick={() => onChange(convertQuestion(q, t))}
            >
              <TypeIcon type={t} size={18} />
              <span>{TYPE_INFO[t].name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="prompt">
          Question
        </label>
        <textarea
          id="prompt"
          className="field qedit__prompt"
          rows={2}
          maxLength={LIMITS.promptLength}
          placeholder={PROMPT_PLACEHOLDER[q.type]}
          value={q.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </div>

      {q.type !== "pin" && <PictureField q={q} onChange={onChange} />}

      <div className="qedit__answers">
        {q.type === "choice" && <ChoiceFields q={q} onChange={onChange} />}
        {q.type === "truefalse" && <TrueFalseFields q={q} onChange={onChange} />}
        {q.type === "slider" && <SliderFields q={q} onChange={onChange} />}
        {q.type === "order" && <OrderFields q={q} onChange={onChange} />}
        {q.type === "type" && <TypeFields q={q} onChange={onChange} />}
        {q.type === "pin" && <PinFields q={q} onChange={onChange} />}
      </div>

      <div className="qedit__settings">
        <fieldset className="seg">
          <legend className="label">Time to answer</legend>
          <div className="seg__row">
            {TIME_CHOICES.map((t) => (
              <button key={t} type="button" className={`seg__opt${q.timeLimit === t ? " is-on" : ""}`} aria-pressed={q.timeLimit === t} onClick={() => set({ timeLimit: t })}>
                {t < 60 ? `${t}s` : `${t / 60}m`}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="seg">
          <legend className="label">Points</legend>
          <div className="seg__row">
            {(["standard", "double", "none"] as PointsMode[]).map((p) => (
              <button key={p} type="button" className={`seg__opt${q.points === p ? " is-on" : ""}`} aria-pressed={q.points === p} onClick={() => set({ points: p })}>
                {p === "standard" ? "Normal" : p === "double" ? "Double" : "None"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <p className={`qedit__status${problem ? " is-problem" : ""}`} role="status">
        {problem ?? "Ready to play."}
      </p>
    </div>
  );
}

const PROMPT_PLACEHOLDER: Record<QuestionType, string> = {
  choice: "Which planet has the most moons?",
  truefalse: "Lightning never strikes the same place twice.",
  slider: "How many bones are in the human body?",
  order: "Sort these animals from smallest to biggest.",
  type: "What's the chemical symbol for gold?",
  pin: "Tap on the country where the Olympics started.",
};

/* ---------- picture ---------- */

function usePicturePicker(onPicked: (src: string, aspect: number) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { src, aspect } = await loadImage(file);
      onPicked(src, aspect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That picture couldn't be used.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const field = (
    <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => handle(e.target.files?.[0])} />
  );
  return { open: () => input.current?.click(), handle, field, error, busy };
}

function PictureField({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const pick = usePicturePicker((src, aspect) => onChange({ ...q, image: src, imageAspect: aspect } as Question));
  const [over, setOver] = useState(false);
  return (
    <div>
      <span className="label">Picture (optional)</span>
      {q.image ? (
        <div className="picture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="Question picture" />
          <div className="picture__tools">
            <button type="button" className="btn btn--quiet" onClick={pick.open}>
              Replace
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => onChange({ ...q, image: undefined, imageAspect: undefined } as Question)}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`dropzone${over ? " is-over" : ""}`}
          onClick={pick.open}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick.handle(e.dataTransfer.files?.[0]);
          }}
        >
          {pick.busy ? "Adding picture…" : "Add a picture, or drop one here"}
        </button>
      )}
      {pick.field}
      {pick.error && <p className="error">{pick.error}</p>}
    </div>
  );
}

/* ---------- choice ---------- */

function ChoiceFields({ q, onChange }: { q: Extract<Question, { type: "choice" }>; onChange: (q: Question) => void }) {
  const toggle = (id: string) =>
    onChange({ ...q, correct: q.correct.includes(id) ? q.correct.filter((c) => c !== id) : [...q.correct, id] });
  return (
    <div>
      <span className="label">Answers</span>
      <ul className="opts">
        {q.options.map((o, i) => {
          const right = q.correct.includes(o.id);
          return (
            <li key={o.id} className={`opt${right ? " is-right" : ""}`}>
              <span className="opt__swatch" style={{ background: OPTION_COLORS[i] }}>
                <Shape i={i} size={18} />
              </span>
              <input
                className="field opt__text"
                value={o.text}
                maxLength={LIMITS.optionLength}
                placeholder={`Answer ${i + 1}`}
                aria-label={`Answer ${i + 1}`}
                onChange={(e) => onChange({ ...q, options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
              />
              <button type="button" className={`opt__mark${right ? " is-on" : ""}`} aria-pressed={right} onClick={() => toggle(o.id)}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{right ? "Right" : "Mark right"}</span>
              </button>
              <button
                type="button"
                className="opt__x"
                aria-label={`Remove answer ${i + 1}`}
                disabled={q.options.length <= 2}
                onClick={() => onChange({ ...q, options: q.options.filter((x) => x.id !== o.id), correct: q.correct.filter((c) => c !== o.id) })}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {q.options.length < LIMITS.options && (
        <button type="button" className="btn btn--quiet addrow" onClick={() => onChange({ ...q, options: [...q.options, { id: uid(), text: "" }] })}>
          + Add answer
        </button>
      )}
      <p className="hint">
        {q.correct.length === 0
          ? "No answer is marked right, so this works as a poll: players vote and nobody gets points."
          : q.correct.length > 1
            ? "Any of the marked answers counts."
            : "Players tap one answer. Faster right answers get more points."}
      </p>
    </div>
  );
}

/* ---------- true / false ---------- */

function TrueFalseFields({ q, onChange }: { q: Extract<Question, { type: "truefalse" }>; onChange: (q: Question) => void }) {
  return (
    <fieldset className="tfpick">
      <legend className="label">Which one is right?</legend>
      <div className="tfpick__row">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" className={`tfpick__opt ${v ? "tile--true" : "tile--false"}${q.correct === v ? " is-on" : ""}`} aria-pressed={q.correct === v} onClick={() => onChange({ ...q, correct: v })}>
            <Shape i={v ? 0 : 2} size={22} />
            {v ? "True" : "False"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- slider ---------- */

function SliderFields({ q, onChange }: { q: Extract<Question, { type: "slider" }>; onChange: (q: Question) => void }) {
  const num = (k: "min" | "max" | "step" | "correct") => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...q, [k]: e.target.value === "" ? Number.NaN : Number(e.target.value) });
  const val = (n: number) => (Number.isFinite(n) ? n : "");
  const share = Number.isFinite(q.correct) && q.max > q.min ? ((q.correct - q.min) / (q.max - q.min)) * 100 : 50;
  return (
    <div className="sliderf">
      <div className="sliderf__grid">
        <Num label="Lowest" value={val(q.min)} onChange={num("min")} />
        <Num label="Highest" value={val(q.max)} onChange={num("max")} />
        <Num label="Steps of" value={val(q.step)} onChange={num("step")} />
        <div>
          <label className="label" htmlFor="unit">
            Unit (optional)
          </label>
          <input id="unit" className="field" value={q.unit ?? ""} maxLength={12} placeholder="km, %, years" onChange={(e) => onChange({ ...q, unit: e.target.value })} />
        </div>
      </div>
      <div className="sliderf__right">
        <Num label="Right answer" value={val(q.correct)} onChange={num("correct")} big />
        <div className="sliderf__preview" aria-hidden="true">
          <div className="sliderf__line">
            <span className="sliderf__mark" style={{ left: `${Math.max(0, Math.min(100, share))}%` }} />
          </div>
          <div className="sliderf__ends">
            <span>{val(q.min)}</span>
            <span>{val(q.max)}</span>
          </div>
        </div>
      </div>
      <p className="hint">Exactly right gets full points. Close guesses still get some, and anything a quarter of the scale away gets none.</p>
    </div>
  );
}

function Num({ label, value, onChange, big }: { label: string; value: number | ""; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; big?: boolean }) {
  const id = `n-${label.replace(/\W/g, "")}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className={`field${big ? " field--num" : ""}`} type="number" inputMode="decimal" value={value} onChange={onChange} />
    </div>
  );
}

/* ---------- order ---------- */

function OrderFields({ q, onChange }: { q: Extract<Question, { type: "order" }>; onChange: (q: Question) => void }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= q.items.length) return;
    const items = q.items.slice();
    [items[i], items[j]] = [items[j], items[i]];
    onChange({ ...q, items });
  };
  return (
    <div>
      <span className="label">Items, in the right order</span>
      <ol className="opts">
        {q.items.map((it, i) => (
          <li key={it.id} className="opt">
            <span className="opt__n">{i + 1}</span>
            <input
              className="field opt__text"
              value={it.text}
              maxLength={LIMITS.optionLength}
              placeholder={i === 0 ? "First" : i === q.items.length - 1 ? "Last" : `Item ${i + 1}`}
              aria-label={`Item ${i + 1}`}
              onChange={(e) => onChange({ ...q, items: q.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })}
            />
            <span className="opt__arrows">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === q.items.length - 1} aria-label={`Move item ${i + 1} down`}>
                ↓
              </button>
            </span>
            <button type="button" className="opt__x" aria-label={`Remove item ${i + 1}`} disabled={q.items.length <= 3} onClick={() => onChange({ ...q, items: q.items.filter((x) => x.id !== it.id) })}>
              ×
            </button>
          </li>
        ))}
      </ol>
      {q.items.length < LIMITS.orderItems && (
        <button type="button" className="btn btn--quiet addrow" onClick={() => onChange({ ...q, items: [...q.items, { id: uid(), text: "" }] })}>
          + Add item
        </button>
      )}
      <p className="hint">Players get these shuffled. Each item in the right spot earns part of the points.</p>
    </div>
  );
}

/* ---------- type it ---------- */

function TypeFields({ q, onChange }: { q: Extract<Question, { type: "type" }>; onChange: (q: Question) => void }) {
  return (
    <div>
      <span className="label">Accepted answers</span>
      <ul className="opts">
        {q.answers.map((a, i) => (
          <li key={i} className="opt">
            <input
              className="field opt__text"
              value={a}
              maxLength={LIMITS.optionLength}
              placeholder={i === 0 ? "Au" : "Another way to write it"}
              aria-label={`Accepted answer ${i + 1}`}
              onChange={(e) => onChange({ ...q, answers: q.answers.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <button type="button" className="opt__x" aria-label={`Remove accepted answer ${i + 1}`} disabled={q.answers.length <= 1} onClick={() => onChange({ ...q, answers: q.answers.filter((_, j) => j !== i) })}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {q.answers.length < 8 && (
        <button type="button" className="btn btn--quiet addrow" onClick={() => onChange({ ...q, answers: [...q.answers, ""] })}>
          + Add another spelling
        </button>
      )}
      <p className="hint">Capital letters, accents and small typos don&apos;t matter. Add other spellings, like Ulaanbaatar and Улаанбаатар.</p>
    </div>
  );
}

/* ---------- tap the spot ---------- */

const RADII = [
  { v: 0.035, name: "Tight" },
  { v: 0.06, name: "Normal" },
  { v: 0.1, name: "Loose" },
];

function PinFields({ q, onChange }: { q: Extract<Question, { type: "pin" }>; onChange: (q: Question) => void }) {
  const pick = usePicturePicker((src, aspect) => onChange({ ...q, image: src, imageAspect: aspect }));
  const place = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({
      ...q,
      target: {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      },
    });
  };
  return (
    <div className="pinf">
      <span className="label">Picture and right spot</span>
      {q.image ? (
        <>
          <div className="pinboard pinboard--edit" style={{ aspectRatio: String(q.imageAspect ?? 1.5) }} onPointerDown={place} role="application" aria-label="Tap where the right spot is">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.image} alt="" draggable={false} />
            <span className="pinboard__target" style={{ left: `${q.target.x * 100}%`, top: `${q.target.y * 100}%`, width: `${q.radius * 200}%` }} />
          </div>
          <p className="hint">Tap the picture to set the right spot. Pins inside the circle get full points.</p>
          <div className="pinf__row">
            <fieldset className="seg">
              <legend className="label">How close counts</legend>
              <div className="seg__row">
                {RADII.map((r) => (
                  <button key={r.v} type="button" className={`seg__opt${q.radius === r.v ? " is-on" : ""}`} aria-pressed={q.radius === r.v} onClick={() => onChange({ ...q, radius: r.v })}>
                    {r.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="btn btn--quiet" onClick={pick.open}>
              Change picture
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="dropzone dropzone--tall" onClick={pick.open}>
          {pick.busy ? "Adding picture…" : "Add the picture players will tap on: a map, a diagram, a photo"}
        </button>
      )}
      {pick.field}
      {pick.error && <p className="error">{pick.error}</p>}
    </div>
  );
}
