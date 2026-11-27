import type { Quiz } from "@/shared/types";

/** A picture drawn in code, so the sample "tap the spot" round works without uploads. */
function solarSystemSvg(): string {
  const stars = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 137.5) % 1000;
    const y = (i * 71.3 + (i % 7) * 37) % 500;
    const r = i % 5 === 0 ? 1.8 : 1;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${0.35 + (i % 3) * 0.2}"/>`;
  }).join("");
  const planet = (x: number, r: number, fill: string, extra = "") =>
    `<circle cx="${x}" cy="250" r="${r}" fill="${fill}"/>${extra}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500">
<rect width="1000" height="500" fill="#0b1640"/>${stars}
<circle cx="-70" cy="250" r="190" fill="#ffb627"/><circle cx="-70" cy="250" r="150" fill="#ffcf4a"/>
${planet(185, 8, "#a9a29b")}
${planet(245, 15, "#e8c07a")}
${planet(315, 16, "#3d8bff", '<circle cx="311" cy="245" r="6" fill="#39c27a"/>')}
${planet(385, 11, "#e0553b")}
${planet(500, 58, "#d9a26a", '<rect x="442" y="232" width="116" height="9" fill="#b9784a" opacity=".7"/><rect x="442" y="258" width="116" height="7" fill="#f0d2a8" opacity=".7"/>')}
<ellipse cx="665" cy="250" rx="92" ry="20" fill="none" stroke="#e9d9a4" stroke-width="8" opacity=".9"/>
${planet(665, 46, "#e6c77d")}
<path d="M573 250 a92 20 0 0 0 184 0" fill="none" stroke="#e9d9a4" stroke-width="8" opacity=".9"/>
${planet(805, 28, "#8fe3e6")}
${planet(910, 27, "#4561ff")}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function sampleQuiz(): Quiz {
  return {
    id: "sample",
    title: "Warm-up race",
    updatedAt: 0,
    questions: [
      {
        id: "s1",
        type: "choice",
        prompt: "Which planet is the hottest?",
        timeLimit: 20,
        points: "standard",
        options: [
          { id: "a", text: "Mercury" },
          { id: "b", text: "Venus" },
          { id: "c", text: "Mars" },
          { id: "d", text: "Jupiter" },
        ],
        correct: ["b"],
      },
      {
        id: "s2",
        type: "truefalse",
        prompt: "A Rubik's Cube can be scrambled into more than 43 quintillion different positions.",
        timeLimit: 10,
        points: "standard",
        correct: true,
      },
      {
        id: "s3",
        type: "slider",
        prompt: "In what year did people first walk on the Moon?",
        timeLimit: 20,
        points: "standard",
        min: 1950,
        max: 2000,
        step: 1,
        correct: 1969,
        unit: "",
      },
      {
        id: "s4",
        type: "order",
        prompt: "Put these inventions in order, oldest first.",
        timeLimit: 30,
        points: "standard",
        items: [
          { id: "p", text: "Printing press" },
          { id: "t", text: "Telephone" },
          { id: "v", text: "Television" },
          { id: "m", text: "Smartphone" },
        ],
      },
      {
        id: "s5",
        type: "type",
        prompt: "What is the capital of Mongolia?",
        timeLimit: 20,
        points: "standard",
        answers: ["Ulaanbaatar", "Ulan Bator", "Улаанбаатар"],
      },
      {
        id: "s6",
        type: "pin",
        prompt: "Tap on Mars.",
        image: solarSystemSvg(),
        imageAspect: 2,
        timeLimit: 20,
        points: "double",
        target: { x: 0.385, y: 0.5 },
        radius: 0.035,
      },
      {
        id: "s7",
        type: "choice",
        prompt: "Which round did you like most?",
        timeLimit: 15,
        points: "none",
        options: [
          { id: "r1", text: "Guess the year" },
          { id: "r2", text: "Put in order" },
          { id: "r3", text: "Type it" },
          { id: "r4", text: "Tap on Mars" },
        ],
        correct: [],
      },
    ],
  };
}
