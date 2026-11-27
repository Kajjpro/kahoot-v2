"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { HostView } from "@/shared/types";
import { Avatar } from "@/components/Avatar";
import { ItemFeed, ReactionLayer, TurboReel } from "@/components/Items";
import { Logo, TYPE_INFO, TypeIcon } from "@/components/Marks";
import { Podium } from "@/components/Podium";
import { RaceBoard } from "@/components/RaceBoard";
import { QuestionStage, RevealBoard } from "@/components/Stage";
import { StartLights } from "@/components/StartLights";
import { TimerBar } from "@/components/TimerBar";
import { hostKeyFor } from "@/lib/launch";
import { getSocket, request } from "@/lib/socket";
import { isMuted, setMuted, sfx, unlock } from "@/lib/sound";
import type { ItemEvent } from "@/shared/types";

export default function LivePage() {
  return (
    <Suspense fallback={<main className="on-blue center"><div className="spinner" /></main>}>
      <Live />
    </Suspense>
  );
}

function Live() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const [view, setView] = useState<HostView | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    const on = () => unlock();
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);

  const resume = useCallback(async () => {
    const hostKey = sessionStorage.getItem(hostKeyFor(code));
    if (!hostKey) {
      setLost("This game was started in another tab or has ended.");
      return;
    }
    const res = await request("host:resume", { code, hostKey });
    if (!res.ok) setLost(res.error);
  }, [code]);

  useEffect(() => {
    const s = getSocket();
    const onState = (v: HostView) => {
      setView(v);
      setOffline(false);
    };
    const onConnect = () => {
      setOffline(false);
      resume();
    };
    const onDisconnect = () => setOffline(true);
    s.on("host:state", onState);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) resume();
    return () => {
      s.off("host:state", onState);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [resume]);

  const act = useCallback(async (event: string) => {
    setActionError(null);
    const res = await request(event, {});
    if (!res.ok) setActionError(res.error);
  }, []);

  // Space, Enter or → moves the game on, so a host can drive it from a keyboard or clicker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, button, a")) return;
      if (!view) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        if (view.phase === "lobby") {
          if (view.players.length) act("host:start");
        } else if (view.phase !== "podium") act("host:next");
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, act]);

  const close = () => {
    if (view && view.phase !== "podium" && view.players.length > 0 && !confirm("Close this game for everyone?")) return;
    getSocket().emit("host:close");
    sessionStorage.removeItem(hostKeyFor(code));
    router.push("/host");
  };

  if (lost) {
    return (
      <main className="on-blue center stack">
        <h1 className="big-title">{lost}</h1>
        <Link className="btn btn--go" href="/host">
          Back to my quizzes
        </Link>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="on-blue center">
        <div className="spinner" aria-label="Loading game" />
      </main>
    );
  }

  return (
    <main className={`host on-blue phase-${view.phase}`}>
      {offline && (
        <p className="offline" role="status">
          Reconnecting to the game server…
        </p>
      )}
      <header className="host__bar">
        <Logo size={26} />
        <span className="host__title">{view.title || "Untitled quiz"}</span>
        {view.phase !== "lobby" && view.phase !== "podium" && (
          <span className="host__progress">
            {view.questionIndex + 1} / {view.questionCount}
          </span>
        )}
        <span className="host__code" aria-label={`Game code ${view.code}`}>
          {view.phase !== "lobby" && <>Code {spaced(view.code)}</>}
        </span>
        <button
          type="button"
          className="btn btn--quiet host__mute"
          onClick={() => {
            unlock();
            setMuted(!muted);
            setMutedState(!muted);
          }}
          aria-pressed={muted}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button type="button" className="btn btn--quiet" onClick={close}>
          {view.phase === "podium" ? "Done" : "Close game"}
        </button>
      </header>
      <SoundDirector view={view} />
      <ReactionLayer />
      <ItemFeed feed={view.feed} onNew={playItem} />

      {actionError && (
        <p className="error host__error" role="alert">
          {actionError}
        </p>
      )}

      <HostScreen view={view} act={act} onDone={close} />
    </main>
  );
}

function HostScreen({ view, act, onDone }: { view: HostView; act: (e: string) => void; onDone: () => void }) {
  const q = view.question;
  switch (view.phase) {
    case "lobby":
      return <Lobby view={view} onStart={() => act("host:start")} />;

    case "countdown":
      if (!q) return null;
      return (
        <section className="h-ready">
          <p className="h-ready__meta">
            <TypeIcon type={q.type} size={26} />
            <span>
              Question {view.questionIndex + 1}, {TYPE_INFO[q.type].name.toLowerCase()}
            </span>
            {q.points === "double" && <span className="tag tag--double">Double points</span>}
            {q.points === "none" && <span className="tag">No points</span>}
          </p>
          {view.turbo > 1 && <TurboReel value={view.turbo} />}
          <h1 className="h-ready__prompt">{q.prompt}</h1>
          <StartLights endsAt={view.endsAt} serverNow={view.serverNow} />
        </section>
      );

    case "question":
      if (!q) return null;
      return (
        <section className="h-q">
          <TimerBar endsAt={view.endsAt} serverNow={view.serverNow} limit={q.timeLimit} />
          {view.turbo > 1 && <span className="tag tag--double h-q__turbo">Turbo ×{view.turbo}</span>}
          <h1 className="h-q__prompt">{q.prompt}</h1>
          <QuestionStage q={q} />
          <footer className="h-foot">
            <AnsweredStrip view={view} />
            <button type="button" className="btn btn--ghost btn--small" onClick={() => act("host:next")}>
              Stop the timer
            </button>
          </footer>
        </section>
      );

    case "reveal":
      if (!q || !view.reveal) return null;
      return (
        <section className="h-reveal">
          <h1 className="h-reveal__prompt">{q.prompt}</h1>
          <RevealBoard q={q} reveal={view.reveal} />
          <footer className="h-foot h-foot--end">
            <button type="button" className="btn btn--go" onClick={() => act("host:next")}>
              {view.questionIndex >= view.questionCount - 1 ? "Show the podium" : "Show standings"}
            </button>
          </footer>
        </section>
      );

    case "leaderboard":
      return (
        <section className="h-board">
          <h1 className="h-board__title">Standings after question {view.questionIndex + 1}</h1>
          <RaceBoard entries={view.leaderboard.slice(0, 5)} />
          <footer className="h-foot h-foot--end">
            <button type="button" className="btn btn--go" onClick={() => act("host:next")}>
              Next question
            </button>
          </footer>
        </section>
      );

    case "podium":
      return <Finale view={view} onRestart={() => act("host:restart")} onDone={onDone} />;
  }
}

function Lobby({ view, onStart }: { view: HostView; onStart: () => void }) {
  const [qr, setQr] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [confirmKick, setConfirmKick] = useState<string | null>(null);

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o.replace(/^https?:\/\//, ""));
    QRCode.toString(`${o}/play?code=${view.code}`, { type: "svg", margin: 0, color: { dark: "#0E1A3D", light: "#FFFFFF" } }).then(setQr);
  }, [view.code]);

  const kick = (id: string) => {
    getSocket().emit("host:kick", { playerId: id });
    setConfirmKick(null);
  };

  const n = view.players.length;

  return (
    <section className="lobby">
      <div className="lobby__join">
        <p className="lobby__how">
          Go to <b>{origin || "this site"}</b> and type
        </p>
        <p className="lobby__code" aria-label={`Game code ${view.code}`}>
          {spaced(view.code)}
        </p>
        <div className="lobby__qr" aria-label="Or scan this code with your phone camera" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="hint">Or scan with your phone camera</p>
      </div>

      <div className="lobby__grid">
        <div className="lobby__head">
          <h2 className="lobby__count" aria-live="polite">
            {n === 0 ? "Waiting for players" : `${n} ${n === 1 ? "player" : "players"} at the start line`}
          </h2>
          <button type="button" className="btn btn--go" onClick={onStart} disabled={n === 0}>
            Start the race
          </button>
        </div>
        {n === 0 ? (
          <p className="lobby__empty">Players show up here as they join.</p>
        ) : (
          <ul className="lineup">
            {view.players.map((p) => (
              <li key={p.id} className="lineup__p">
                <Avatar seed={p.avatar} size={64} />
                <span className="lineup__name">{p.name}</span>
                {confirmKick === p.id ? (
                  <span className="lineup__confirm">
                    <button type="button" className="btn btn--danger btn--small" onClick={() => kick(p.id)}>
                      Remove
                    </button>
                    <button type="button" className="btn btn--quiet" onClick={() => setConfirmKick(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" className="lineup__x" onClick={() => setConfirmKick(p.id)} aria-label={`Remove ${p.name}`}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AnsweredStrip({ view }: { view: HostView }) {
  const done = new Set(view.answeredIds);
  const active = view.players.filter((p) => p.connected);
  return (
    <div className="answered">
      <p className="answered__count" aria-live="polite">
        <b>{view.answeredCount}</b> of {view.playerCount} answered
      </p>
      <ul className="answered__faces" aria-hidden="true">
        {active.slice(0, 24).map((p) => (
          <li key={p.id} className={done.has(p.id) ? "is-in" : ""}>
            <Avatar seed={p.avatar} size={30} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Finale({ view, onRestart, onDone }: { view: HostView; onRestart: () => void; onDone: () => void }) {
  const [landed, setLanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  return (
    <section className="h-podium">
      <Podium top={view.leaderboard.slice(0, 3)} onDone={() => setLanded(true)} />
      <div className={`h-podium__after${landed ? " is-shown" : ""}`}>
        <div className="h-podium__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Hide full results" : "Full results"}
          </button>
          <button type="button" className="btn btn--go btn--small" onClick={onRestart}>
            Play again with the same players
          </button>
          <button type="button" className="btn btn--quiet" onClick={onDone}>
            Back to my quizzes
          </button>
        </div>
        {showAll && (
          <ol className="results">
            {view.leaderboard.map((p) => (
              <li key={p.id}>
                <span className="results__n">{p.rank}</span>
                <Avatar seed={p.avatar} size={32} />
                <span className="results__name">{p.name}</span>
                <span className="results__score">{p.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function spaced(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function playItem(e: ItemEvent) {
  if (e.blocked || e.kind === "shield") sfx.shield();
  else if (e.kind === "nitro") sfx.nitro();
  else sfx.splat();
}

/** Plays the right sounds as the game moves from step to step. */
function SoundDirector({ view }: { view: HostView }) {
  const key = `${view.phase}:${view.questionIndex}`;
  const lastAnswered = useRef(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const offset = view.serverNow - Date.now();
    const left = (view.endsAt ?? 0) - (Date.now() + offset);

    switch (view.phase) {
      case "countdown": {
        const elapsed = 4000 - left;
        for (let i = 0; i < 5; i++) if (i * 600 >= elapsed - 50) at(i * 600 - elapsed, sfx.light);
        at(3300 - elapsed, sfx.go);
        if (view.turbo > 1) {
          for (let i = 0; i < 10; i++) at(i * 120, sfx.reel);
          at(1300, sfx.turbo);
        }
        break;
      }
      case "question":
        for (let s = 5; s >= 1; s--) {
          const when = left - s * 1000;
          if (when > 0) at(when, sfx.tick);
        }
        break;
      case "reveal":
        sfx.reveal();
        break;
      case "leaderboard":
        sfx.whoosh();
        break;
      case "podium":
        at(700, sfx.third);
        at(2100, sfx.second);
        at(3500, () => sfx.drumroll(1.6));
        at(5200, sfx.fanfare);
        break;
    }
    lastAnswered.current = 0;
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (view.phase === "question" && view.answeredCount > lastAnswered.current) sfx.lockIn();
    lastAnswered.current = view.answeredCount;
  }, [view.answeredCount, view.phase]);

  return null;
}
