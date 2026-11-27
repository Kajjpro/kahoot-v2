import { randomBytes, randomInt } from "node:crypto";
import { accuracyOf, isPoll, normalizeText, pointsFor, RIGHT_THRESHOLD, textMatches } from "../shared/scoring";
import type {
  Answer,
  Fastest,
  ItemEvent,
  ItemKind,
  HostView,
  MyResult,
  Phase,
  PlayerSummary,
  PlayerView,
  PublicQuestion,
  Question,
  Quiz,
  RankedPlayer,
  Reveal,
  RevealStats,
} from "../shared/types";

/** How long the start lights take before answers open. */
export const COUNTDOWN_MS = 4000;
/** Small pause after the last answer, so the final "locked in" lands before the reveal. */
const ALL_IN_GRACE_MS = 700;

interface AnswerRecord {
  answer: Answer;
  timeMs: number;
  accuracy: number;
  points: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: number;
  socketId: string | null;
  connected: boolean;
  score: number;
  streak: number;
  joinedAt: number;
  answers: Map<number, AnswerRecord>;
  /** Snapshot taken when the previous leaderboard was shown. */
  prevRank: number | null;
  prevScore: number;
  /* power-ups */
  item: ItemKind | null;
  shield: boolean;
  /** Question index Nitro is lit for. */
  nitroQ: number | null;
  hits: { kind: "banana" | "smoke"; from: string; q: number }[];
  /** Question index at which the current item was picked up. */
  gotItemAt: number | null;
  lastReactAt: number;
}

/** Weighted bag the item box draws from. */
const ITEM_BAG: ItemKind[] = ["nitro", "nitro", "nitro", "banana", "banana", "banana", "smoke", "smoke", "smoke", "shield", "shield"];
const drawItem = (): ItemKind => (process.env.FORCE_ITEM as ItemKind) || ITEM_BAG[randomInt(ITEM_BAG.length)];

/** Chances in percent. Override with env vars to test (e.g. TURBO_CHANCE=100). */
const TURBO_CHANCE = Number(process.env.TURBO_CHANCE ?? 25);
const COMEBACK_ITEM_CHANCE = Number(process.env.COMEBACK_ITEM_CHANCE ?? 60);

export interface RoomHooks {
  /** Something changed that everyone should see. */
  changed(room: Room): void;
  /** Only the host and one player need an update. */
  answered(room: Room, player: Player): void;
}

export class Room {
  readonly code: string;
  readonly hostKey = randomBytes(16).toString("hex");
  hostSocketId: string | null = null;
  quiz: Quiz;
  players = new Map<string, Player>();
  phase: Phase = "lobby";
  qIndex = -1;
  /** When answers opened (server clock). */
  openedAt = 0;
  endsAt: number | null = null;
  lastActivity = Date.now();
  private timer: NodeJS.Timeout | null = null;
  /** Same shuffle for every player, per order question. */
  private shuffles = new Map<number, string[]>();
  private reveal: Reveal | null = null;
  /** Turbo multiplier per question index. */
  private turbos = new Map<number, number>();
  private feed: ItemEvent[] = [];
  private eventSeq = 0;

  constructor(code: string, quiz: Quiz, private hooks: RoomHooks) {
    this.code = code;
    this.quiz = quiz;
  }

  get question(): Question | null {
    return this.quiz.questions[this.qIndex] ?? null;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  /* ---------------- players ---------------- */

  addPlayer(name: string, avatar: number, socketId: string): Player | string {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 16);
    if (!clean) return "Type a name to join.";
    if (this.phase === "podium") return "This game has finished.";
    if (this.players.size >= 200) return "This game is full.";
    const taken = [...this.players.values()].some((p) => normalizeText(p.name) === normalizeText(clean));
    if (taken) return "Someone already has that name in this game. Try another.";
    const p: Player = {
      id: randomBytes(8).toString("hex"),
      name: clean,
      avatar: Math.abs(Math.floor(avatar)) % 100000,
      socketId,
      connected: true,
      score: 0,
      streak: 0,
      joinedAt: Date.now(),
      answers: new Map(),
      prevRank: null,
      prevScore: 0,
      item: null,
      shield: false,
      nitroQ: null,
      hits: [],
      gotItemAt: null,
      lastReactAt: 0,
    };
    this.players.set(p.id, p);
    this.touch();
    this.hooks.changed(this);
    return p;
  }

  reattach(playerId: string, socketId: string): Player | null {
    const p = this.players.get(playerId);
    if (!p) return null;
    p.socketId = socketId;
    p.connected = true;
    this.touch();
    this.hooks.changed(this);
    return p;
  }

  disconnect(socketId: string) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        p.socketId = null;
        // In the lobby a player who leaves is simply gone.
        if (this.phase === "lobby") this.players.delete(p.id);
        this.hooks.changed(this);
        this.maybeEndEarly();
      }
    }
    if (this.hostSocketId === socketId) this.hostSocketId = null;
  }

  kick(playerId: string): Player | null {
    const p = this.players.get(playerId);
    if (!p) return null;
    this.players.delete(playerId);
    this.hooks.changed(this);
    this.maybeEndEarly();
    return p;
  }

  /* ---------------- flow ---------------- */

  start(): string | null {
    if (this.phase !== "lobby") return "The game has already started.";
    if (this.players.size === 0) return "Wait for at least one player to join.";
    this.goToQuestion(0);
    return null;
  }

  /** Host pressed the big "next" button. */
  next() {
    this.touch();
    switch (this.phase) {
      case "countdown":
        this.openAnswers();
        break;
      case "question":
        this.closeAnswers();
        break;
      case "reveal":
        if (this.qIndex >= this.quiz.questions.length - 1) this.toPodium();
        else this.toLeaderboard();
        break;
      case "leaderboard":
        this.goToQuestion(this.qIndex + 1);
        break;
      default:
        break;
    }
  }

  end() {
    if (this.phase === "lobby" || this.phase === "podium") return;
    this.clearTimer();
    if (this.phase === "question") this.scoreQuestion();
    this.toPodium();
  }

  /** Same players, scores reset, back to the lobby. */
  restart() {
    this.clearTimer();
    for (const [id, p] of this.players) {
      if (!p.connected) {
        this.players.delete(id);
        continue;
      }
      p.score = 0;
      p.streak = 0;
      p.answers.clear();
      p.prevRank = null;
      p.prevScore = 0;
      p.item = null;
      p.shield = false;
      p.nitroQ = null;
      p.hits = [];
      p.gotItemAt = null;
    }
    this.turbos.clear();
    this.feed = [];
    this.phase = "lobby";
    this.qIndex = -1;
    this.endsAt = null;
    this.reveal = null;
    this.shuffles.clear();
    this.hooks.changed(this);
  }

  private goToQuestion(i: number) {
    this.clearTimer();
    this.qIndex = i;
    this.reveal = null;
    this.phase = "countdown";
    this.endsAt = Date.now() + COUNTDOWN_MS;
    const q = this.question;
    if (q?.type === "order") this.shuffles.set(i, shuffleNotSolved(q.items.map((x) => x.id)));
    // Turbo round: after the first question, about one in four scoring questions gets a multiplier.
    if (q && i > 0 && q.points !== "none" && !isPoll(q) && !this.turbos.has(i)) {
      this.turbos.set(i, randomInt(100) < TURBO_CHANCE ? (randomInt(100) < 70 ? 2 : 3) : 1);
    }
    this.timer = setTimeout(() => this.openAnswers(), COUNTDOWN_MS);
    this.hooks.changed(this);
  }

  private openAnswers() {
    const q = this.question;
    if (!q) return;
    this.clearTimer();
    this.phase = "question";
    this.openedAt = Date.now();
    this.endsAt = this.openedAt + q.timeLimit * 1000;
    this.timer = setTimeout(() => this.closeAnswers(), q.timeLimit * 1000 + 250);
    this.hooks.changed(this);
  }

  submit(playerId: string, qIndex: number, answer: Answer): string | null {
    const q = this.question;
    const p = this.players.get(playerId);
    if (!q || !p) return "You're not in this game.";
    if (this.phase !== "question" || qIndex !== this.qIndex) return "Answers are closed.";
    if (p.answers.has(qIndex)) return "You already answered.";
    if (!answer || answer.type !== q.type) return "That answer doesn't fit this question.";
    const clean = sanitizeAnswer(q, answer);
    if (!clean) return "That answer doesn't fit this question.";
    const limitMs = q.timeLimit * 1000;
    const timeMs = Math.min(Math.max(Date.now() - this.openedAt, 0), limitMs);
    p.answers.set(qIndex, { answer: clean, timeMs, accuracy: 0, points: 0 });
    this.touch();
    this.hooks.answered(this, p);
    this.maybeEndEarly();
    return null;
  }

  private maybeEndEarly() {
    if (this.phase !== "question") return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length === 0) return;
    if (active.every((p) => p.answers.has(this.qIndex))) {
      this.clearTimer();
      this.timer = setTimeout(() => this.closeAnswers(), ALL_IN_GRACE_MS);
    }
  }

  private closeAnswers() {
    if (this.phase !== "question") return;
    this.clearTimer();
    this.scoreQuestion();
    this.phase = "reveal";
    this.endsAt = null;
    this.hooks.changed(this);
  }

  private scoreQuestion() {
    const q = this.question;
    if (!q) return;
    const limitMs = q.timeLimit * 1000;
    const poll = isPoll(q);
    for (const p of this.players.values()) {
      const rec = p.answers.get(this.qIndex);
      if (poll || q.points === "none") {
        // Nitro lit for a no-points question carries over to the next one.
        if (p.nitroQ === this.qIndex) p.nitroQ = this.qIndex + 1;
        if (rec) rec.accuracy = poll ? 0 : accuracyOf(q, rec.answer);
        continue; // polls and no-points rounds don't touch scores or streaks
      }
      if (!rec) {
        p.streak = 0;
        continue;
      }
      rec.accuracy = accuracyOf(q, rec.answer);
      p.streak = rec.accuracy >= RIGHT_THRESHOLD ? p.streak + 1 : 0;
      rec.points =
        pointsFor({
          accuracy: rec.accuracy,
          timeMs: rec.timeMs,
          limitMs,
          mode: q.points,
          streakAfter: p.streak,
        }) * this.multiplierFor(p);
      p.score += rec.points;
    }
    this.reveal = this.buildReveal(q);
    if (!poll && q.points !== "none") this.handOutItems();
  }

  turboFor(i: number): number {
    return this.turbos.get(i) ?? 1;
  }

  private multiplierFor(p: Player): number {
    return this.turboFor(this.qIndex) * (p.nitroQ === this.qIndex ? 2 : 1);
  }

  /**
   * Item boxes: three right in a row always earns one, and anyone in the
   * bottom half has a good chance of one, so the back of the pack can fight back.
   */
  private handOutItems() {
    const ranked = this.ranked();
    const half = Math.ceil(ranked.length / 2);
    ranked.forEach((r, idx) => {
      const p = this.players.get(r.id);
      if (!p || p.item) return;
      const streakBox = p.streak > 0 && p.streak % 3 === 0;
      const comeback = ranked.length > 1 && idx >= half && randomInt(100) < COMEBACK_ITEM_CHANCE;
      if (streakBox || comeback) {
        p.item = drawItem();
        p.gotItemAt = this.qIndex;
      }
    });
  }

  /** Who an attack from this player lands on: the runner right ahead, or second place if you lead. */
  private targetOf(p: Player): Player | null {
    const ranked = this.ranked();
    const idx = ranked.findIndex((r) => r.id === p.id);
    if (idx < 0 || ranked.length < 2) return null;
    const t = idx === 0 ? ranked[1] : ranked[idx - 1];
    return this.players.get(t.id) ?? null;
  }

  private canUseItems(): boolean {
    if (this.phase === "countdown") return true;
    if (this.phase === "reveal" || this.phase === "leaderboard") return this.qIndex < this.quiz.questions.length - 1;
    return false;
  }

  /** The question an item used right now will affect. */
  private itemQuestion(): number {
    return this.phase === "countdown" ? this.qIndex : this.qIndex + 1;
  }

  useItem(playerId: string): string | null {
    const p = this.players.get(playerId);
    if (!p || !p.item) return "You don't have an item.";
    if (!this.canUseItems()) return "Items work between questions.";
    const kind = p.item;
    const qi = this.itemQuestion();
    let to: Player | null = null;
    let blocked = false;
    if (kind === "nitro") {
      p.nitroQ = qi;
    } else if (kind === "shield") {
      p.shield = true;
    } else {
      to = this.targetOf(p);
      if (!to) return "There's nobody to throw it at yet.";
      if (to.shield) {
        to.shield = false;
        blocked = true;
      } else {
        to.hits.push({ kind, from: p.name, q: qi });
      }
    }
    p.item = null;
    p.gotItemAt = null;
    this.feed.push({
      id: ++this.eventSeq,
      kind,
      from: { name: p.name, avatar: p.avatar },
      to: to ? { name: to.name, avatar: to.avatar } : null,
      blocked,
    });
    this.feed = this.feed.slice(-6);
    this.touch();
    this.hooks.changed(this);
    return null;
  }

  /** Rate-limited emoji reactions. Returns false when the player is spamming. */
  react(playerId: string): Player | null {
    const p = this.players.get(playerId);
    if (!p) return null;
    const now = Date.now();
    if (now - p.lastReactAt < 600) return null;
    p.lastReactAt = now;
    return p;
  }

  private toLeaderboard() {
    this.phase = "leaderboard";
    this.hooks.changed(this);
    // Remember where everyone stood, so the next board can show who moved.
    this.ranked().forEach((r) => {
      const p = this.players.get(r.id);
      if (p) {
        p.prevRank = r.rank;
        p.prevScore = p.score;
      }
    });
  }

  private toPodium() {
    this.clearTimer();
    this.phase = "podium";
    this.endsAt = null;
    this.hooks.changed(this);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose() {
    this.clearTimer();
  }

  /* ---------------- results ---------------- */

  /** Highest score first; ties go to whoever joined first. */
  ranked(): RankedPlayer[] {
    const list = [...this.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    let lastScore = Number.NaN;
    let lastRank = 0;
    return list.map((p, i) => {
      const rank = p.score === lastScore ? lastRank : i + 1;
      lastScore = p.score;
      lastRank = rank;
      return {
        ...summary(p),
        rank,
        prevRank: p.prevRank,
        prevScore: p.prevScore,
        streak: p.streak,
      };
    });
  }

  private buildReveal(q: Question): Reveal {
    const recs = [...this.players.values()]
      .map((p) => ({ p, rec: p.answers.get(this.qIndex) }))
      .filter((x): x is { p: Player; rec: AnswerRecord } => !!x.rec);

    let stats: RevealStats;
    switch (q.type) {
      case "choice": {
        const counts: Record<string, number> = {};
        q.options.forEach((o) => (counts[o.id] = 0));
        recs.forEach(({ rec }) => {
          if (rec.answer.type === "choice") counts[rec.answer.optionId] = (counts[rec.answer.optionId] ?? 0) + 1;
        });
        stats = { type: "choice", counts, correct: q.correct, isPoll: q.correct.length === 0 };
        break;
      }
      case "truefalse": {
        const counts = { true: 0, false: 0 };
        recs.forEach(({ rec }) => {
          if (rec.answer.type === "truefalse") counts[rec.answer.value ? "true" : "false"]++;
        });
        stats = { type: "truefalse", counts, correct: q.correct };
        break;
      }
      case "slider":
        stats = {
          type: "slider",
          guesses: recs.flatMap(({ rec }) => (rec.answer.type === "slider" ? [rec.answer.value] : [])),
          correct: q.correct,
          min: q.min,
          max: q.max,
          unit: q.unit,
        };
        break;
      case "order": {
        const perItemRight: Record<string, number> = {};
        q.items.forEach((it) => (perItemRight[it.id] = 0));
        let perfect = 0;
        recs.forEach(({ rec }) => {
          if (rec.answer.type !== "order") return;
          const order = rec.answer.order;
          q.items.forEach((it, i) => {
            if (order[i] === it.id) perItemRight[it.id]++;
          });
          if (rec.accuracy === 1) perfect++;
        });
        stats = { type: "order", correctOrder: q.items, perItemRight, perfect };
        break;
      }
      case "type": {
        const groups = new Map<string, { text: string; count: number; ok: boolean }>();
        recs.forEach(({ rec }) => {
          if (rec.answer.type !== "type") return;
          const key = normalizeText(rec.answer.text);
          if (!key) return;
          const g = groups.get(key) ?? { text: rec.answer.text.trim(), count: 0, ok: textMatches(rec.answer.text, q.answers) };
          g.count++;
          groups.set(key, g);
        });
        const top = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 6);
        stats = { type: "type", accepted: q.answers.filter((a) => a.trim()), top };
        break;
      }
      case "pin":
        stats = {
          type: "pin",
          pins: recs.flatMap(({ rec }) =>
            rec.answer.type === "pin" ? [{ x: rec.answer.x, y: rec.answer.y, hit: rec.accuracy === 1 }] : [],
          ),
          target: q.target,
          radius: q.radius,
        };
        break;
    }

    let fastest: Fastest | null = null;
    if (!isPoll(q)) {
      const best = recs
        .filter(({ rec }) => rec.accuracy >= RIGHT_THRESHOLD)
        .sort((a, b) => a.rec.timeMs - b.rec.timeMs)[0];
      if (best) fastest = { name: best.p.name, avatar: best.p.avatar, timeMs: best.rec.timeMs };
    }

    return { stats, fastest, answered: recs.length, total: this.players.size };
  }

  /* ---------------- views ---------------- */

  private publicQuestion(): PublicQuestion | null {
    const q = this.question;
    if (!q) return null;
    switch (q.type) {
      case "choice": {
        const { correct, ...rest } = q;
        return { ...rest, multiCorrect: correct.length > 1, isPoll: correct.length === 0 };
      }
      case "truefalse": {
        const { correct: _c, ...rest } = q;
        return rest;
      }
      case "slider": {
        const { correct: _c, ...rest } = q;
        return rest;
      }
      case "order": {
        const ids = this.shuffles.get(this.qIndex) ?? q.items.map((i) => i.id);
        const byId = new Map(q.items.map((i) => [i.id, i]));
        return { ...q, items: ids.map((id) => byId.get(id)!).filter(Boolean) };
      }
      case "type": {
        const { answers: _a, ...rest } = q;
        return rest;
      }
      case "pin": {
        const { target: _t, radius: _r, ...rest } = q;
        return rest;
      }
    }
  }

  private answeredIds(): string[] {
    if (this.qIndex < 0) return [];
    return [...this.players.values()].filter((p) => p.answers.has(this.qIndex)).map((p) => p.id);
  }

  private common() {
    const showQuestion = this.phase === "countdown" || this.phase === "question" || this.phase === "reveal";
    const answered = this.answeredIds();
    return {
      code: this.code,
      phase: this.phase,
      title: this.quiz.title,
      questionIndex: this.qIndex,
      questionCount: this.quiz.questions.length,
      serverNow: Date.now(),
      endsAt: this.endsAt,
      question: showQuestion ? this.publicQuestion() : null,
      answeredCount: answered.length,
      playerCount: [...this.players.values()].filter((p) => p.connected).length,
      turbo: this.qIndex >= 0 && this.phase !== "lobby" && this.phase !== "podium" ? this.turboFor(this.qIndex) : 1,
    };
  }

  hostView(): HostView {
    const showBoard = this.phase === "leaderboard" || this.phase === "podium" || this.phase === "reveal";
    return {
      role: "host",
      ...this.common(),
      players: [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(summary),
      answeredIds: this.answeredIds(),
      reveal: this.phase === "reveal" ? this.reveal : null,
      leaderboard: showBoard ? this.ranked() : [],
      feed: this.feed,
    };
  }

  playerView(p: Player): PlayerView {
    const ranked = this.ranked();
    const myIdx = ranked.findIndex((r) => r.id === p.id);
    const me = ranked[myIdx];
    const rec = this.qIndex >= 0 ? p.answers.get(this.qIndex) : undefined;

    let result: MyResult | null = null;
    if (this.phase === "reveal" && me) {
      const above = myIdx > 0 ? ranked[myIdx - 1] : null;
      result = {
        answered: !!rec,
        accuracy: rec?.accuracy ?? 0,
        correct: (rec?.accuracy ?? 0) >= RIGHT_THRESHOLD,
        points: rec?.points ?? 0,
        timeMs: rec?.timeMs ?? null,
        streak: p.streak,
        rank: me.rank,
        score: p.score,
        multiplier: this.multiplierFor(p),
        behind: above && above.score > p.score ? { name: above.name, gap: above.score - p.score } : null,
      };
    }

    let leaderboard: RankedPlayer[] = [];
    if (this.phase === "leaderboard") leaderboard = ranked.slice(0, 5);
    if (this.phase === "podium") leaderboard = ranked.slice(0, 3);

    return {
      role: "player",
      ...this.common(),
      me: summary(p),
      myAnswer: rec?.answer ?? null,
      result,
      reveal: this.phase === "reveal" ? this.reveal : null,
      leaderboard,
      myRank: me?.rank ?? 0,
      lobbyPlayers:
        this.phase === "lobby"
          ? [...this.players.values()].map((x) => ({ id: x.id, name: x.name, avatar: x.avatar })).slice(-40)
          : [],
      item: p.item,
      shield: p.shield,
      nitro: p.nitroQ != null && p.nitroQ >= this.qIndex && this.phase !== "podium",
      target: (() => {
        if (!p.item || (p.item !== "banana" && p.item !== "smoke")) return null;
        const t = this.targetOf(p);
        return t ? { name: t.name, avatar: t.avatar } : null;
      })(),
      hits:
        this.phase === "question" || this.phase === "countdown"
          ? p.hits.filter((h) => h.q === this.qIndex).map(({ kind, from }) => ({ kind, from }))
          : [],
      gotItem: this.phase === "reveal" && p.gotItemAt === this.qIndex ? p.item : null,
      canUseItem: !!p.item && this.canUseItems(),
    };
  }
}

function summary(p: Player): PlayerSummary {
  return { id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: p.connected };
}

/** Shuffle, but never hand players the answer already sorted. */
function shuffleNotSolved(ids: string[]): string[] {
  if (ids.length < 2) return ids.slice();
  for (let tries = 0; tries < 20; tries++) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((id, i) => id !== ids[i])) return a;
  }
  return ids.slice().reverse();
}

function sanitizeAnswer(q: Question, a: Answer): Answer | null {
  switch (a.type) {
    case "choice":
      return q.type === "choice" && q.options.some((o) => o.id === a.optionId) ? { type: "choice", optionId: a.optionId } : null;
    case "truefalse":
      return typeof a.value === "boolean" ? { type: "truefalse", value: a.value } : null;
    case "slider": {
      if (q.type !== "slider" || typeof a.value !== "number" || !Number.isFinite(a.value)) return null;
      return { type: "slider", value: Math.min(q.max, Math.max(q.min, a.value)) };
    }
    case "order": {
      if (q.type !== "order" || !Array.isArray(a.order)) return null;
      const want = new Set(q.items.map((i) => i.id));
      if (a.order.length !== want.size || !a.order.every((id) => want.has(id)) || new Set(a.order).size !== want.size)
        return null;
      return { type: "order", order: a.order.slice() };
    }
    case "type":
      return typeof a.text === "string" ? { type: "type", text: a.text.slice(0, 80) } : null;
    case "pin": {
      if (typeof a.x !== "number" || typeof a.y !== "number" || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
      return { type: "pin", x: clamp01(a.x), y: clamp01(a.y) };
    }
    default:
      return null;
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
