import { memo } from "react";

/** Small deterministic random generator, so a seed always draws the same runner. */
function rng(seed: number) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const BODY_COLORS = ["#FF6B57", "#FFCE1F", "#2ED19A", "#B79CFF", "#FF9A3D", "#7CC4FF", "#FF8FC7", "#C6F04D"];
const BAND_COLORS = ["#FFFFFF", "#0E1A3D", "#FF4B3E", "#1E40C8"];

const BODIES = [
  // round
  "M50 10c24 0 38 17 38 42 0 24-16 38-38 38S12 76 12 52c0-25 14-42 38-42z",
  // bean
  "M50 8c20 0 32 14 32 34v14c0 22-14 36-32 36S18 78 18 56V42C18 22 30 8 50 8z",
  // soft square
  "M28 14h44c10 0 16 6 16 16v40c0 10-6 18-16 18H28c-10 0-16-8-16-18V30c0-10 6-16 16-16z",
  // ghost with feet
  "M50 10c22 0 36 16 36 38v40l-9-6-9 6-9-6-9 6-9-6-9 6-9-6V48c0-22 14-38 36-38z",
  // pear
  "M50 10c14 0 22 10 22 22 0 6 16 14 16 32 0 16-14 26-38 26S12 80 12 64c0-18 16-26 16-32 0-12 8-22 22-22z",
];

interface Props {
  seed: number;
  size?: number;
  /** Shown to screen readers. */
  label?: string;
  className?: string;
}

function AvatarImpl({ seed, size = 56, label, className }: Props) {
  const r = rng(seed);
  const body = BODIES[Math.floor(r() * BODIES.length)];
  const color = BODY_COLORS[Math.floor(r() * BODY_COLORS.length)];
  const eyes = Math.floor(r() * 5);
  const mouth = Math.floor(r() * 4);
  const extra = Math.floor(r() * 5);
  const band = BAND_COLORS[Math.floor(r() * BAND_COLORS.length)];
  const lookX = (r() - 0.5) * 4;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={body} fill={color} stroke="#0E1A3D" strokeWidth="4" strokeLinejoin="round" />

      {extra === 0 && (
        // sweatband
        <path d="M17 36c20-8 46-8 66 0v9c-20-8-46-8-66 0z" fill={band === "#FFFFFF" ? "#FF4B3E" : band} stroke="#0E1A3D" strokeWidth="3" />
      )}
      {extra === 1 && (
        // antenna
        <g stroke="#0E1A3D" strokeWidth="3.5" strokeLinecap="round">
          <path d="M50 10V2" />
          <circle cx="50" cy="2" r="4" fill={band} />
        </g>
      )}
      {extra === 2 && (
        // racing bib
        <g>
          <rect x="36" y="62" width="28" height="18" rx="3" fill="#fff" stroke="#0E1A3D" strokeWidth="3" />
          <path d="M42 71h16" stroke="#0E1A3D" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {extra === 3 && (
        // cheeks
        <g fill="#FF4B3E" opacity=".35">
          <circle cx="28" cy="58" r="6" />
          <circle cx="72" cy="58" r="6" />
        </g>
      )}

      <g transform={`translate(${lookX} 0)`}>
        {eyes === 0 && (
          <g fill="#0E1A3D">
            <circle cx="38" cy="50" r="5" />
            <circle cx="62" cy="50" r="5" />
          </g>
        )}
        {eyes === 1 && (
          <g>
            <circle cx="37" cy="49" r="9" fill="#fff" stroke="#0E1A3D" strokeWidth="3" />
            <circle cx="63" cy="49" r="9" fill="#fff" stroke="#0E1A3D" strokeWidth="3" />
            <circle cx="39" cy="50" r="4" fill="#0E1A3D" />
            <circle cx="65" cy="50" r="4" fill="#0E1A3D" />
          </g>
        )}
        {eyes === 2 && (
          <g stroke="#0E1A3D" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M31 50q6-6 12 0" />
            <path d="M57 50q6-6 12 0" />
          </g>
        )}
        {eyes === 3 && (
          <g>
            <circle cx="50" cy="48" r="13" fill="#fff" stroke="#0E1A3D" strokeWidth="3" />
            <circle cx="52" cy="49" r="6" fill="#0E1A3D" />
          </g>
        )}
        {eyes === 4 && (
          <g stroke="#0E1A3D" strokeWidth="3" fill="#fff">
            <rect x="27" y="42" width="20" height="15" rx="5" />
            <rect x="53" y="42" width="20" height="15" rx="5" />
            <path d="M47 48h6" fill="none" />
            <circle cx="38" cy="50" r="3" fill="#0E1A3D" stroke="none" />
            <circle cx="64" cy="50" r="3" fill="#0E1A3D" stroke="none" />
          </g>
        )}

        {mouth === 0 && <path d="M41 64q9 8 18 0" stroke="#0E1A3D" strokeWidth="4" fill="none" strokeLinecap="round" />}
        {mouth === 1 && <ellipse cx="50" cy="66" rx="5" ry="6" fill="#0E1A3D" />}
        {mouth === 2 && <path d="M43 66h14" stroke="#0E1A3D" strokeWidth="4" strokeLinecap="round" />}
        {mouth === 3 && (
          <g>
            <path d="M40 63q10 10 20 0z" fill="#0E1A3D" />
            <path d="M46 66q4 4 8 0" fill="#FF6B8B" />
          </g>
        )}
      </g>
    </svg>
  );
}

export const Avatar = memo(AvatarImpl);

export function randomSeed(): number {
  return Math.floor(Math.random() * 100000);
}
