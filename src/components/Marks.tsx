import type { QuestionType } from "@/shared/types";

export const APP_NAME = "Dash";

/** Wordmark: the name with speed lines trailing behind. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }} aria-label={APP_NAME}>
      <svg className="logo__lines" viewBox="0 0 30 20" aria-hidden="true">
        <path d="M2 5h18M8 10h20M2 15h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span aria-hidden="true">{APP_NAME}</span>
    </span>
  );
}

/** Each answer gets a shape as well as a colour, so it works for colour-blind players. */
export const OPTION_COLORS = ["var(--o1)", "var(--o2)", "var(--o3)", "var(--o4)", "var(--o5)", "var(--o6)"];

export function Shape({ i, size = 28 }: { i: number; size?: number }) {
  const common = { fill: "currentColor" } as const;
  const shapes = [
    <circle key="c" cx="12" cy="12" r="9" {...common} />,
    <path key="t" d="M12 3l10 17H2z" {...common} />,
    <rect key="s" x="3.5" y="3.5" width="17" height="17" rx="2" {...common} />,
    <path key="d" d="M12 2l10 10-10 10L2 12z" {...common} />,
    <path key="p" d="M12 2l9.5 7-3.6 11H6.1L2.5 9z" {...common} />,
    <path key="st" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" {...common} />,
  ];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shape">
      {shapes[i % shapes.length]}
    </svg>
  );
}

export const TYPE_INFO: Record<QuestionType, { name: string; hint: string }> = {
  choice: { name: "Multiple choice", hint: "Pick the right answer from up to six. Mark none to make it a poll." },
  truefalse: { name: "True or false", hint: "One statement, two buttons." },
  slider: { name: "Guess the number", hint: "Slide to a number. Closer gets more points." },
  order: { name: "Put in order", hint: "Drag items into the right order." },
  type: { name: "Type it", hint: "Players type the answer. Small typos still count." },
  pin: { name: "Tap the spot", hint: "Players tap the right place on a picture." },
};

export function TypeIcon({ type, size = 22 }: { type: QuestionType; size?: number }) {
  const s = { stroke: "currentColor", strokeWidth: 2.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {type === "choice" && (
        <g {...s}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" />
        </g>
      )}
      {type === "truefalse" && (
        <g {...s}>
          <path d="M3 12l3 3 6-7" />
          <path d="M15 8l6 6M21 8l-6 6" />
        </g>
      )}
      {type === "slider" && (
        <g {...s}>
          <path d="M3 12h18" />
          <circle cx="15" cy="12" r="3.5" fill="currentColor" />
          <path d="M3 7v0M21 7v0" strokeWidth="3" />
        </g>
      )}
      {type === "order" && (
        <g {...s}>
          <path d="M9 6h12M9 12h12M9 18h12" />
          <path d="M3 5l2-1v4M3 11h2.5L3 14h2.5M3 17h2.5l-1 1.5 1 1.5H3" strokeWidth="1.6" />
        </g>
      )}
      {type === "type" && (
        <g {...s}>
          <rect x="2.5" y="6" width="19" height="12" rx="3" />
          <path d="M7 10v4M10 12h6" />
        </g>
      )}
      {type === "pin" && (
        <g {...s}>
          <path d="M12 21s-6-5.4-6-10.5A6 6 0 0 1 18 10.5C18 15.6 12 21 12 21z" />
          <circle cx="12" cy="10.5" r="2.2" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}

export function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3.5 2.5 3.5C11.5 8 10 6 12 2z"
        fill="#FF9A3D"
        stroke="#0E1A3D"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function seconds(ms: number): string {
  return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + "s";
}
