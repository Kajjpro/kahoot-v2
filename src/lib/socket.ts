"use client";
import { io, type Socket } from "socket.io-client";
import type { Ack } from "@/shared/types";

let socket: Socket | null = null;

/** One connection per tab, shared by every screen. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ["websocket", "polling"], reconnectionDelayMax: 3000 });
  }
  return socket;
}

/** Emit and wait for the server's reply. Never hangs: fails after `timeoutMs`. */
export function request<T = object>(event: string, payload: unknown, timeoutMs = 8000): Promise<Ack<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack<T>) => {
      if (err) resolve({ ok: false, error: "The game server didn't answer. Check your connection and try again." });
      else resolve(res);
    });
  });
}
