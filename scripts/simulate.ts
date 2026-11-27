// Plays a whole game against a running server with one host and several bots.
// Start the server first (npm run dev), then: npm run sim
import { io, type Socket } from "socket.io-client";
import { sampleQuiz } from "../src/lib/sample";
import type { Answer, HostView, PlayerView, PublicQuestion } from "../src/shared/types";

const URL = process.env.SIM_URL ?? "http://localhost:3000";
const BOTS = Number(process.env.SIM_BOTS ?? 5);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ask<T>(s: Socket, ev: string, payload: unknown): Promise<T> {
  return new Promise((res) => s.emit(ev, payload, res));
}

function botAnswer(q: PublicQuestion, skill: number): Answer {
  const good = Math.random() < skill;
  switch (q.type) {
    case "choice":
      return { type: "choice", optionId: good ? "b" : q.options[0].id };
    case "truefalse":
      return { type: "truefalse", value: good };
    case "slider":
      return { type: "slider", value: good ? 1969 : 1990 };
    case "order":
      return { type: "order", order: good ? ["p", "t", "v", "m"] : q.items.map((i) => i.id) };
    case "type":
      return { type: "type", text: good ? "ulanbaatar" : "Erdenet" };
    case "pin":
      return { type: "pin", x: good ? 0.39 : 0.8, y: 0.5 };
  }
}

async function main() {
  const host = io(URL, { transports: ["websocket"] });
  let hvState: HostView | null = null;
  host.on("host:state", (v: HostView) => (hvState = v));
  const H = () => hvState as HostView;
  await new Promise<void>((r) => host.on("connect", () => r()));

  const created = await ask<{ ok: boolean; code: string; error?: string }>(host, "host:create", { quiz: sampleQuiz() });
  if (!created.ok) throw new Error(created.error);
  console.log("Lobby open with code", created.code);

  const bots: { s: Socket; v: PlayerView | null; skill: number; delay: number }[] = [];
  for (let i = 0; i < BOTS; i++) {
    const s = io(URL, { transports: ["websocket"] });
    const bot = { s, v: null as PlayerView | null, skill: 0.4 + i * 0.12, delay: 300 + i * 500 };
    s.on("player:state", (v: PlayerView) => (bot.v = v));
    await new Promise<void>((r) => s.on("connect", () => r()));
    const j = await ask<{ ok: boolean; error?: string }>(s, "player:join", { code: created.code, name: `Bot ${i + 1}`, avatar: i * 977 });
    if (!j.ok) throw new Error(j.error);
    bots.push(bot);
  }
  // A duplicate name must be refused.
  const dup = io(URL, { transports: ["websocket"] });
  await new Promise<void>((r) => dup.on("connect", () => r()));
  const dupRes = await ask<{ ok: boolean; error?: string }>(dup, "player:join", { code: created.code, name: "bot 1" });
  console.log("Duplicate name refused:", !dupRes.ok, "-", dupRes.error);
  dup.close();

  await sleep(200);
  console.log("Players in lobby:", H().players.length);
  await ask(host, "host:start", {});

  for (let qi = 0; qi < sampleQuiz().questions.length; qi++) {
    // wait for answers to open
    while (H().phase !== "question") await sleep(50);
    await sleep(100);
    for (const b of bots) if (b.v?.hits.length) console.log(`   ${b.v.me.name} is hit by ${b.v.hits.map((h) => h.kind + " from " + h.from).join(", ")}${b.v.nitro ? " (nitro lit)" : ""}`);
    for (const b of bots) if (b.v?.nitro && !b.v.hits.length) console.log(`   ${b.v.me.name} has nitro lit`);
    const opened = Date.now();
    await Promise.all(
      bots.map(async (b) => {
        await sleep(b.delay);
        const q = b.v!.question!;
        const r = await ask<{ ok: boolean; error?: string }>(b.s, "player:answer", { questionIndex: qi, answer: botAnswer(q, b.skill) });
        if (!r.ok) console.log("  answer refused:", r.error);
      }),
    );
    while (H().phase !== "reveal") await sleep(50);
    await sleep(150);
    const took = Date.now() - opened;
    const rv = H().reveal!;
    console.log(
      `Q${qi + 1} ${H().question!.type.padEnd(9)} closed after ${(took / 1000).toFixed(1)}s (limit ${H().question!.timeLimit}s), ${rv.answered}/${rv.total} answered, fastest: ${rv.fastest ? `${rv.fastest.name} ${rv.fastest.timeMs}ms` : "none"}`,
    );
    const r0 = bots[0].v!.result!;
    console.log(`   Bot 1 sees: correct=${r0.correct} +${r0.points} rank ${r0.rank}`);
    if (H().turbo > 1) console.log(`   Turbo round x${H().turbo}`);
    // Bots use any item they picked up, and send a reaction.
    for (const b of bots) {
      b.s.emit("player:react", { emoji: "🔥" });
      if (b.v?.canUseItem && b.v.item) {
        const kind = b.v.item;
        const res = await ask<{ ok: boolean; error?: string }>(b.s, "player:item", {});
        console.log(`   ${b.v.me.name} used ${kind}${b.v.target ? ` on ${b.v.target.name}` : ""}: ${res.ok ? "ok" : res.error}`);
      }
    }
    await sleep(100);
    // Answering again after close must fail.
    const late = await ask<{ ok: boolean }>(bots[0].s, "player:answer", { questionIndex: qi, answer: { type: "truefalse", value: true } });
    if (late.ok) throw new Error("Late answer was accepted");
    await ask(host, "host:next", {}); // to leaderboard or podium
    await sleep(100);
    if (H().phase === "leaderboard") {
      console.log("   Board:", H().leaderboard.slice(0, 3).map((p) => `${p.name} ${p.score}`).join(", "));
      await ask(host, "host:next", {});
    }
  }
  while (H().phase !== "podium") await sleep(50);
  console.log("Item feed on big screen:", H().feed.map((e) => `${e.from.name} ${e.kind}${e.to ? " -> " + e.to.name : ""}${e.blocked ? " (blocked)" : ""}`).join("; "));
  console.log("Podium:", H().leaderboard.slice(0, 3).map((p) => `${p.rank}. ${p.name} ${p.score}`).join("  "));
  console.log("Bot 5 sees podium with", bots[4]?.v?.leaderboard.length, "players, own rank", bots[4]?.v?.myRank);

  // Restart keeps players and zeroes scores.
  await ask(host, "host:restart", {});
  await sleep(100);
  console.log("After restart:", H().phase, H().players.length, "players, scores", H().players.map((p) => p.score).join(","));

  host.close();
  bots.forEach((b) => b.s.close());
  console.log("Simulation finished OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
