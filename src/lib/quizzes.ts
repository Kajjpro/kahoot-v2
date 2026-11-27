"use client";
import type { Question, QuestionType, Quiz } from "@/shared/types";
import { sampleQuiz } from "./sample";

const KEY = "dash.quizzes.v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function listQuizzes(): Quiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Quiz[]) : [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getQuiz(id: string): Quiz | null {
  if (id === "sample") return sampleQuiz();
  return listQuizzes().find((q) => q.id === id) ?? null;
}

/** Returns an error message when the browser has no room left. */
export function saveQuiz(quiz: Quiz): string | null {
  const list = listQuizzes().filter((q) => q.id !== quiz.id);
  list.unshift({ ...quiz, updatedAt: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return null;
  } catch {
    return "Your browser is out of space for quizzes. Remove some pictures or delete an old quiz.";
  }
}

export function deleteQuiz(id: string) {
  const list = listQuizzes().filter((q) => q.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function blankQuiz(): Quiz {
  return { id: uid(), title: "", questions: [newQuestion("choice")], updatedAt: Date.now() };
}

export function newQuestion(type: QuestionType): Question {
  const base = { id: uid(), prompt: "", timeLimit: 20, points: "standard" as const };
  switch (type) {
    case "choice":
      return {
        ...base,
        type,
        options: [
          { id: uid(), text: "" },
          { id: uid(), text: "" },
          { id: uid(), text: "" },
          { id: uid(), text: "" },
        ],
        correct: [],
      };
    case "truefalse":
      return { ...base, type, timeLimit: 10, correct: true };
    case "slider":
      return { ...base, type, min: 0, max: 100, step: 1, correct: 50, unit: "" };
    case "order":
      return {
        ...base,
        type,
        timeLimit: 30,
        items: [
          { id: uid(), text: "" },
          { id: uid(), text: "" },
          { id: uid(), text: "" },
          { id: uid(), text: "" },
        ],
      };
    case "type":
      return { ...base, type, answers: [""] };
    case "pin":
      return { ...base, type, timeLimit: 20, target: { x: 0.5, y: 0.5 }, radius: 0.06 };
  }
}

/** Switch a question to another type, keeping the words and picture. */
export function convertQuestion(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const fresh = newQuestion(type);
  return {
    ...fresh,
    id: q.id,
    prompt: q.prompt,
    image: q.image,
    imageAspect: q.imageAspect,
    points: q.points,
  } as Question;
}

export function duplicateQuestion(q: Question): Question {
  const copy = JSON.parse(JSON.stringify(q)) as Question;
  copy.id = uid();
  return copy;
}
