import { randomInt } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { Ack, Answer, Quiz } from "../shared/types";
import { looksLikeQuiz, quizProblem } from "../shared/validate";
import { Room, type Player } from "./room";

type Reply<T = object> = (res: Ack<T>) => void;

const ROOM_IDLE_MS = 3 * 60 * 60 * 1000; // forget games nobody touched for 3 hours

/** Wires Socket.io events to game rooms. One process holds every room in memory. */
export function attachGameServer(io: Server) {
  const rooms = new Map<string, Room>();

  const hooks = {
    changed(room: Room) {
      emitHost(room);
      for (const p of room.players.values()) emitPlayer(room, p);
    },
    answered(room: Room, p: Player) {
      emitHost(room);
      emitPlayer(room, p);
      // Everyone else only needs the "12 of 20 answered" counter.
      io.to(`players:${room.code}`).except(p.socketId ?? "").emit("answered", {
        answeredCount: room.hostView().answeredCount,
        playerCount: room.hostView().playerCount,
      });
    },
  };

  function emitHost(room: Room) {
    if (room.hostSocketId) io.to(room.hostSocketId).emit("host:state", room.hostView());
  }
  function emitPlayer(room: Room, p: Player) {
    if (p.socketId) io.to(p.socketId).emit("player:state", room.playerView(p));
  }

  function newCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = String(randomInt(100000, 1000000));
      if (!rooms.has(code)) return code;
    }
    throw new Error("No free game codes");
  }

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > ROOM_IDLE_MS) {
        room.dispose();
        rooms.delete(code);
      }
    }
  }, 10 * 60 * 1000).unref();

  io.on("connection", (socket: Socket) => {
    // What this socket is, so we can clean up on disconnect.
    let hostOf: Room | null = null;
    let playerOf: { room: Room; id: string } | null = null;

    const hostRoom = (): Room | null => (hostOf && rooms.get(hostOf.code) === hostOf ? hostOf : null);

    socket.on("host:create", (raw: { quiz: Quiz }, reply: Reply<{ code: string; hostKey: string }>) => {
      if (typeof reply !== "function") return;
      const quiz = raw?.quiz;
      if (!looksLikeQuiz(quiz)) return reply({ ok: false, error: "That quiz couldn't be read. Try saving it again." });
      const problem = quizProblem(quiz);
      if (problem) return reply({ ok: false, error: problem });
      const room = new Room(newCode(), quiz, hooks);
      room.hostSocketId = socket.id;
      rooms.set(room.code, room);
      hostOf = room;
      reply({ ok: true, code: room.code, hostKey: room.hostKey });
      emitHost(room);
    });

    socket.on("host:resume", (raw: { code: string; hostKey: string }, reply: Reply) => {
      if (typeof reply !== "function") return;
      const room = rooms.get(String(raw?.code ?? ""));
      if (!room || room.hostKey !== raw?.hostKey) return reply({ ok: false, error: "This game has ended or the link is old." });
      room.hostSocketId = socket.id;
      hostOf = room;
      room.touch();
      reply({ ok: true });
      emitHost(room);
    });

    const hostAction = (name: string, fn: (room: Room) => string | null | void) => {
      socket.on(name, (_: unknown, reply?: Reply) => {
        const room = hostRoom();
        if (!room || room.hostSocketId !== socket.id) {
          if (typeof reply === "function") reply({ ok: false, error: "You're not hosting this game." });
          return;
        }
        room.touch();
        const err = fn(room);
        if (typeof reply === "function") reply(err ? { ok: false, error: err } : { ok: true });
      });
    };

    hostAction("host:start", (room) => room.start());
    hostAction("host:next", (room) => room.next());
    hostAction("host:end", (room) => room.end());
    hostAction("host:restart", (room) => room.restart());

    socket.on("host:kick", (raw: { playerId: string }) => {
      const room = hostRoom();
      if (!room || room.hostSocketId !== socket.id) return;
      const p = room.kick(String(raw?.playerId ?? ""));
      if (p?.socketId) {
        io.to(p.socketId).emit("kicked");
        io.sockets.sockets.get(p.socketId)?.leave(`players:${room.code}`);
      }
    });

    socket.on("host:close", () => {
      const room = hostRoom();
      if (!room || room.hostSocketId !== socket.id) return;
      io.to(`players:${room.code}`).emit("closed");
      room.dispose();
      rooms.delete(room.code);
      hostOf = null;
    });

    socket.on("player:check", (raw: { code: string }, reply: Reply<{ title: string }>) => {
      if (typeof reply !== "function") return;
      const room = rooms.get(String(raw?.code ?? "").trim());
      if (!room) return reply({ ok: false, error: "No game with that code. Check the code on the host's screen." });
      if (room.phase === "podium") return reply({ ok: false, error: "This game has finished." });
      reply({ ok: true, title: room.quiz.title });
    });

    socket.on(
      "player:join",
      (
        raw: { code: string; name?: string; avatar?: number; playerId?: string },
        reply: Reply<{ playerId: string }>,
      ) => {
        if (typeof reply !== "function") return;
        const room = rooms.get(String(raw?.code ?? "").trim());
        if (!room) return reply({ ok: false, error: "No game with that code. Check the code on the host's screen." });

        // Coming back after a refresh or a dropped connection.
        if (raw.playerId) {
          const p = room.reattach(String(raw.playerId), socket.id);
          if (p) {
            playerOf = { room, id: p.id };
            socket.join(`players:${room.code}`);
            reply({ ok: true, playerId: p.id });
            emitPlayer(room, p);
            return;
          }
          if (!raw.name) return reply({ ok: false, error: "Your spot in this game is gone. Join again with your name." });
        }

        const res = room.addPlayer(String(raw.name ?? ""), Number(raw.avatar) || 0, socket.id);
        if (typeof res === "string") return reply({ ok: false, error: res });
        playerOf = { room, id: res.id };
        socket.join(`players:${room.code}`);
        reply({ ok: true, playerId: res.id });
        emitPlayer(room, res);
      },
    );

    socket.on("player:answer", (raw: { questionIndex: number; answer: Answer }, reply: Reply) => {
      if (typeof reply !== "function") return;
      if (!playerOf) return reply({ ok: false, error: "You're not in a game." });
      const err = playerOf.room.submit(playerOf.id, Number(raw?.questionIndex), raw?.answer);
      reply(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on("player:leave", () => {
      if (!playerOf) return;
      const { room, id } = playerOf;
      room.kick(id);
      socket.leave(`players:${room.code}`);
      playerOf = null;
    });

    socket.on("disconnect", () => {
      if (playerOf) playerOf.room.disconnect(socket.id);
      const r = hostRoom();
      if (r && r.hostSocketId === socket.id) r.hostSocketId = null;
    });
  });

  return { rooms };
}
