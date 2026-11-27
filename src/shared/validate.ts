import type { Question, Quiz } from "./types";

export const LIMITS = {
  questions: 100,
  options: 6,
  orderItems: 6,
  promptLength: 200,
  optionLength: 80,
  nameLength: 16,
  imageBytes: 1_500_000,
} as const;

export const TIME_CHOICES = [5, 10, 20, 30, 45, 60, 90, 120] as const;

/** Returns a plain-language problem with this question, or null when it's ready to play. */
export function questionProblem(q: Question): string | null {
  if (!q.prompt.trim()) return "Write the question.";
  if (q.prompt.length > LIMITS.promptLength) return `Keep the question under ${LIMITS.promptLength} characters.`;
  if (q.image && q.image.length > LIMITS.imageBytes * 1.4) return "That picture is too big. Use a smaller one.";
  switch (q.type) {
    case "choice": {
      const filled = q.options.filter((o) => o.text.trim());
      if (filled.length < 2) return "Add at least two answers.";
      if (filled.length !== q.options.length) return "Fill in every answer or remove the empty ones.";
      return null;
    }
    case "truefalse":
      return null;
    case "slider": {
      if (![q.min, q.max, q.step, q.correct].every(Number.isFinite)) return "Fill in every number.";
      if (q.max <= q.min) return "The highest value must be bigger than the lowest.";
      if (q.step <= 0) return "The step must be bigger than 0.";
      if ((q.max - q.min) / q.step > 100000) return "The step is too small for this range.";
      if (q.correct < q.min || q.correct > q.max) return "The right answer must sit between the lowest and highest value.";
      return null;
    }
    case "order": {
      const filled = q.items.filter((o) => o.text.trim());
      if (filled.length < 3) return "Add at least three items to put in order.";
      if (filled.length !== q.items.length) return "Fill in every item or remove the empty ones.";
      return null;
    }
    case "type":
      if (!q.answers.some((a) => a.trim())) return "Add at least one accepted answer.";
      return null;
    case "pin":
      if (!q.image) return "Add a picture for players to tap on.";
      return null;
  }
}

export function quizProblem(quiz: Quiz): string | null {
  if (!quiz.questions.length) return "Add a question to start.";
  if (quiz.questions.length > LIMITS.questions) return `A game can have up to ${LIMITS.questions} questions.`;
  for (let i = 0; i < quiz.questions.length; i++) {
    const p = questionProblem(quiz.questions[i]);
    if (p) return `Question ${i + 1}: ${p}`;
  }
  return null;
}

/** Defensive check for anything arriving over the network. */
export function looksLikeQuiz(x: unknown): x is Quiz {
  if (!x || typeof x !== "object") return false;
  const q = x as Quiz;
  return typeof q.title === "string" && Array.isArray(q.questions) && q.questions.every(looksLikeQuestion);
}

function looksLikeQuestion(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const q = x as Question;
  if (typeof q.id !== "string" || typeof q.prompt !== "string") return false;
  if (typeof q.timeLimit !== "number" || q.timeLimit < 3 || q.timeLimit > 300) return false;
  if (!["standard", "double", "none"].includes(q.points)) return false;
  switch (q.type) {
    case "choice":
      return Array.isArray(q.options) && Array.isArray(q.correct) && q.options.length <= LIMITS.options;
    case "truefalse":
      return typeof q.correct === "boolean";
    case "slider":
      return [q.min, q.max, q.step, q.correct].every((n) => typeof n === "number");
    case "order":
      return Array.isArray(q.items) && q.items.length <= LIMITS.orderItems;
    case "type":
      return Array.isArray(q.answers);
    case "pin":
      return !!q.target && typeof q.radius === "number";
    default:
      return false;
  }
}
