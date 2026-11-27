// Shared between the game server and the browser.

export type QuestionType = "choice" | "truefalse" | "slider" | "order" | "type" | "pin";

export type PointsMode = "standard" | "double" | "none";

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Optional picture shown with the question (data URL). Required for pin questions. */
  image?: string;
  /** Width / height of the image, so pins can be measured fairly. */
  imageAspect?: number;
  /** Seconds players get to answer. */
  timeLimit: number;
  points: PointsMode;
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export interface ChoiceQuestion extends BaseQuestion {
  type: "choice";
  options: ChoiceOption[];
  /** Ids of the right options. Empty = poll (no points, no right answer). */
  correct: string[];
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: "truefalse";
  correct: boolean;
}

export interface SliderQuestion extends BaseQuestion {
  type: "slider";
  min: number;
  max: number;
  step: number;
  correct: number;
  unit?: string;
}

export interface OrderQuestion extends BaseQuestion {
  type: "order";
  /** Items in the RIGHT order. Players see them shuffled. */
  items: ChoiceOption[];
}

export interface TypeQuestion extends BaseQuestion {
  type: "type";
  /** Any of these counts. Small typos are forgiven. */
  answers: string[];
}

export interface PinQuestion extends BaseQuestion {
  type: "pin";
  /** Target point, 0..1 across and down the image. */
  target: { x: number; y: number };
  /** How close counts as a perfect hit, as a share of the image width. */
  radius: number;
}

export type Question =
  | ChoiceQuestion
  | TrueFalseQuestion
  | SliderQuestion
  | OrderQuestion
  | TypeQuestion
  | PinQuestion;

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  updatedAt: number;
}

/* ---------- Answers ---------- */

export type Answer =
  | { type: "choice"; optionId: string }
  | { type: "truefalse"; value: boolean }
  | { type: "slider"; value: number }
  | { type: "order"; order: string[] }
  | { type: "type"; text: string }
  | { type: "pin"; x: number; y: number };

/* ---------- What players are allowed to see of a question ---------- */

export type PublicQuestion =
  | (Omit<ChoiceQuestion, "correct"> & { multiCorrect: boolean; isPoll: boolean })
  | Omit<TrueFalseQuestion, "correct">
  | Omit<SliderQuestion, "correct">
  | (Omit<OrderQuestion, "items"> & { items: ChoiceOption[] /* shuffled */ })
  | Omit<TypeQuestion, "answers">
  | Omit<PinQuestion, "target" | "radius">;

/* ---------- Live game state ---------- */

export type Phase = "lobby" | "countdown" | "question" | "reveal" | "leaderboard" | "podium";

export interface PlayerSummary {
  id: string;
  name: string;
  avatar: number;
  score: number;
  connected: boolean;
}

export interface RankedPlayer extends PlayerSummary {
  rank: number;
  prevRank: number | null;
  prevScore: number;
  streak: number;
}

export interface Fastest {
  name: string;
  avatar: number;
  timeMs: number;
}

export type RevealStats =
  | { type: "choice"; counts: Record<string, number>; correct: string[]; isPoll: boolean }
  | { type: "truefalse"; counts: { true: number; false: number }; correct: boolean }
  | { type: "slider"; guesses: number[]; correct: number; min: number; max: number; unit?: string }
  | { type: "order"; correctOrder: ChoiceOption[]; perItemRight: Record<string, number>; perfect: number }
  | {
      type: "type";
      accepted: string[];
      top: { text: string; count: number; ok: boolean }[];
    }
  | {
      type: "pin";
      pins: { x: number; y: number; hit: boolean }[];
      target: { x: number; y: number };
      radius: number;
    };

export interface Reveal {
  stats: RevealStats;
  fastest: Fastest | null;
  answered: number;
  total: number;
}

export interface MyResult {
  answered: boolean;
  accuracy: number; // 0..1
  correct: boolean;
  points: number;
  timeMs: number | null;
  streak: number;
  rank: number;
  score: number;
  /** Points to the player right above, or null when leading. */
  behind: { name: string; gap: number } | null;
}

interface CommonView {
  code: string;
  phase: Phase;
  title: string;
  questionIndex: number;
  questionCount: number;
  serverNow: number;
  /** Countdown or question deadline (server clock). */
  endsAt: number | null;
  question: PublicQuestion | null;
  answeredCount: number;
  playerCount: number;
}

export interface HostView extends CommonView {
  role: "host";
  players: PlayerSummary[];
  answeredIds: string[];
  reveal: Reveal | null;
  leaderboard: RankedPlayer[];
}

export interface PlayerView extends CommonView {
  role: "player";
  me: PlayerSummary;
  myAnswer: Answer | null;
  result: MyResult | null;
  reveal: Reveal | null;
  /** Top 3 for the podium, top 5 for the leaderboard. */
  leaderboard: RankedPlayer[];
  myRank: number;
  lobbyPlayers: { id: string; name: string; avatar: number }[];
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };
