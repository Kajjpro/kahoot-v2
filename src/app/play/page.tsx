"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Answer, PlayerView } from "@/shared/types";
import { Avatar, randomSeed } from "@/components/Avatar";
import { Flame, Logo, ordinal, seconds, TYPE_INFO } from "@/components/Marks";
import { ItemIcon, ItemPocket, ReactionBar, SmokeOverlay, TurboReel } from "@/components/Items";
import { PlayerAnswer } from "@/components/PlayerAnswer";
import { Podium } from "@/components/Podium";
import { rightAnswerText } from "@/components/Stage";
import { StartLights } from "@/components/StartLights";
import { TimerBar } from "@/components/TimerBar";
import { useCountUp } from "@/lib/clock";
import { getSocket, request } from "@/lib/socket";

const sessionKey = (code: string) => `dash.player.${code}`;

function nameSeed(name: string) {
  let h = 2166136261;
  for (const ch of name.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return Math.abs(h) % 100000;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<main className="on-blue center"><div className="spinner" /></main>}>
      <Play />
    </Suspense>
  );
}

function Play() {
  const params = useSearchParams();
  const router = useRouter();
  const code = (params.get("code") ?? "").replace(/\D/g, "").slice(0, 6);

  const [view, setView] = useState<PlayerView | null>(null);
  const [ended, setEnded] = useState<null | "kicked" | "closed">(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  // True while we try to slot a returning player back into their game.
  const [restoring, setRestoring] = useState(true);

  // Rejoin automatically after a refresh or a dropped connection.
  const rejoin = useCallback(async () => {
    const saved = sessionStorage.getItem(sessionKey(code));
    if (!saved) {
      setRestoring(false);
      return;
    }
    const { playerId } = JSON.parse(saved) as { playerId: string };
    const res = await request<{ playerId: string }>("player:join", { code, playerId });
    if (res.ok) setJoinedId(res.playerId);
    else {
      sessionStorage.removeItem(sessionKey(code));
      setJoinedId(null);
      setView(null);
    }
    setRestoring(false);
  }, [code]);

  useEffect(() => {
    if (!code) return;
    if (!sessionStorage.getItem(sessionKey(code))) setRestoring(false);
    const s = getSocket();
    const onState = (v: PlayerView) => {
      setView(v);
      setOffline(false);
    };
    const onAnswered = (c: { answeredCount: number; playerCount: number }) =>
      setView((v) => (v ? { ...v, ...c } : v));
    const onKicked = () => {
      sessionStorage.removeItem(sessionKey(code));
      setEnded("kicked");
    };
    const onClosed = () => {
      sessionStorage.removeItem(sessionKey(code));
      setEnded("closed");
    };
    const onConnect = () => {
      setOffline(false);
      rejoin();
    };
    const onDisconnect = () => setOffline(true);
    s.on("player:state", onState);
    s.on("answered", onAnswered);
    s.on("kicked", onKicked);
    s.on("closed", onClosed);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) rejoin();
    return () => {
      s.off("player:state", onState);
      s.off("answered", onAnswered);
      s.off("kicked", onKicked);
      s.off("closed", onClosed);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [code, rejoin]);

  // Clear a stale error when a new question appears.
  useEffect(() => {
    setAnswerError(null);
  }, [view?.questionIndex, view?.phase]);

  const answer = async (a: Answer) => {
    if (!view) return;
    setBusy(true);
    setAnswerError(null);
    // Show "locked in" right away; the server confirms in a moment.
    setView({ ...view, myAnswer: a });
    const res = await request("player:answer", { questionIndex: view.questionIndex, answer: a });
    setBusy(false);
    if (!res.ok) {
      setAnswerError(res.error);
      setView((v) => (v ? { ...v, myAnswer: null } : v));
    }
  };

  const leave = () => {
    getSocket().emit("player:leave");
    sessionStorage.removeItem(sessionKey(code));
    router.push("/");
  };

  if (!code) {
    return (
      <main className="on-blue center stack">
        <p>This link is missing a game code.</p>
        <Link className="btn btn--go" href="/">
          Enter a code
        </Link>
      </main>
    );
  }

  if (ended) {
    return (
      <main className="on-blue center stack">
        <h1 className="big-title">{ended === "kicked" ? "The host removed you from this game." : "The host closed this game."}</h1>
        <Link className="btn btn--go" href="/">
          Join another game
        </Link>
      </main>
    );
  }

  if (restoring && !view) {
    return (
      <main className="on-blue center">
        <div className="spinner" aria-label="Joining" />
      </main>
    );
  }

  if (!view || !joinedId) {
    return (
      <JoinForm
        code={code}
        onJoined={(id) => {
          sessionStorage.setItem(sessionKey(code), JSON.stringify({ playerId: id }));
          setJoinedId(id);
        }}
      />
    );
  }

  return (
    <main className={`player on-blue phase-${view.phase}`}>
      {offline && (
        <p className="offline" role="status">
          Reconnecting…
        </p>
      )}
      <PlayerHeader view={view} />
      <div className="player__body">
        <PlayerScreen view={view} busy={busy} onAnswer={answer} answerError={answerError} onLeave={leave} />
      </div>
    </main>
  );
}

function PlayerHeader({ view }: { view: PlayerView }) {
  return (
    <header className="player__bar">
      <span className="player__me">
        <Avatar seed={view.me.avatar} size={34} />
        <span>{view.me.name}</span>
      </span>
      {view.phase !== "lobby" && <span className="player__score">{view.me.score.toLocaleString()}</span>}
    </header>
  );
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (id: string) => void }) {
  const [name, setName] = useState("");
  const [reroll, setReroll] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    request<{ title: string }>("player:check", { code }).then((res) => {
      if (res.ok) setTitle(res.title);
      else setFatal(res.error);
    });
    input.current?.focus();
  }, [code]);

  const seed = reroll ?? nameSeed(name.trim() || "dash");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Type a name so the host knows who you are.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await request<{ playerId: string }>("player:join", { code, name: name.trim(), avatar: seed });
    setBusy(false);
    if (res.ok) onJoined(res.playerId);
    else setError(res.error);
  };

  if (fatal) {
    return (
      <main className="on-blue center stack">
        <h1 className="big-title">{fatal}</h1>
        <Link className="btn btn--go" href="/">
          Try another code
        </Link>
      </main>
    );
  }

  return (
    <main className="on-blue joinname">
      <header className="home__bar">
        <Link href="/" className="logo-link" aria-label="Dash home">
          <Logo size={30} />
        </Link>
      </header>
      <form className="joinname__card" onSubmit={submit} noValidate>
        <p className="joinname__game">{title ?? " "}</p>
        <button
          type="button"
          className="joinname__avatar"
          onClick={() => setReroll(randomSeed())}
          aria-label="Change my runner"
        >
          <Avatar seed={seed} size={120} />
          <span className="joinname__shuffle">Tap for a new runner</span>
        </button>
        <label className="sr-only" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          ref={input}
          className="field field--big"
          placeholder="Your name"
          maxLength={16}
          autoComplete="nickname"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "name-error" : undefined}
        />
        {error && (
          <p id="name-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--go btn--block" disabled={busy}>
          {busy ? "Joining" : "Join game"}
        </button>
      </form>
    </main>
  );
}

function PlayerScreen({
  view,
  busy,
  onAnswer,
  answerError,
  onLeave,
}: {
  view: PlayerView;
  busy: boolean;
  onAnswer: (a: Answer) => void;
  answerError: string | null;
  onLeave: () => void;
}) {
  const q = view.question;
  const [itemBusy, setItemBusy] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [smokeGone, setSmokeGone] = useState<number | null>(null);

  useEffect(() => setItemError(null), [view.phase, view.questionIndex]);

  const fireItem = async () => {
    setItemBusy(true);
    setItemError(null);
    const res = await request("player:item", {});
    setItemBusy(false);
    if (!res.ok) setItemError(res.error);
  };

  const pocket = (
    <ItemPocket
      item={view.item}
      shield={view.shield}
      nitro={view.nitro}
      target={view.target}
      fresh={!!view.gotItem}
      canUse={view.canUseItem}
      onUse={fireItem}
      busy={itemBusy}
      error={itemError}
    />
  );

  const banana = view.hits.find((h) => h.kind === "banana");
  const smoke = view.hits.find((h) => h.kind === "smoke");

  switch (view.phase) {
    case "lobby":
      return (
        <section className="p-lobby">
          <Avatar seed={view.me.avatar} size={150} className="p-lobby__me" />
          <h1 className="big-title">You&apos;re in.</h1>
          <p className="hint">Look at the host&apos;s screen. The race starts when they press start.</p>
          {view.lobbyPlayers.length > 1 && (
            <ul className="crowd" aria-label={`${view.lobbyPlayers.length} players in the lobby`}>
              {view.lobbyPlayers
                .filter((p) => p.id !== view.me.id)
                .slice(-14)
                .map((p) => (
                  <li key={p.id} title={p.name}>
                    <Avatar seed={p.avatar} size={36} />
                  </li>
                ))}
            </ul>
          )}
          <ReactionBar />
          <button type="button" className="btn btn--quiet" onClick={onLeave}>
            Leave game
          </button>
        </section>
      );

    case "countdown":
      if (!q) return null;
      return (
        <section className="p-ready">
          <p className="p-ready__meta">
            Question {view.questionIndex + 1} of {view.questionCount}, {TYPE_INFO[q.type].name.toLowerCase()}
            {q.points === "double" ? ", double points" : ""}
          </p>
          {view.turbo > 1 && <TurboReel value={view.turbo} compact />}
          <h1 className="p-ready__prompt">{q.prompt}</h1>
          <StartLights endsAt={view.endsAt} serverNow={view.serverNow} compact />
          {view.hits.map((h, i) => (
            <p key={i} className="p-ready__hit">
              <ItemIcon kind={h.kind} size={28} />
              {h.from} {h.kind === "banana" ? "threw a banana at you" : "smoked you"}
            </p>
          ))}
          {pocket}
        </section>
      );

    case "question":
      if (!q) return null;
      if (view.myAnswer) {
        return (
          <section className="p-wait">
            <div className="p-wait__badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="56" height="56">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="big-title">Locked in</h1>
            <p className="hint" aria-live="polite">
              {view.answeredCount} of {view.playerCount} have answered
            </p>
            <ReactionBar />
          </section>
        );
      }
      return (
        <section className={`p-q p-q--${q.type}${view.nitro ? " is-nitro" : ""}${banana && q.type !== "choice" && q.type !== "truefalse" ? " is-wobbly" : ""}`}>
          <TimerBar endsAt={view.endsAt} serverNow={view.serverNow} limit={q.timeLimit} />
          {(view.nitro || view.turbo > 1 || banana) && (
            <p className="p-q__boosts">
              {view.turbo > 1 && <span className="boost boost--turbo">Turbo ×{view.turbo}</span>}
              {view.nitro && <span className="boost boost--nitro">Nitro ×2</span>}
              {banana && <span className="boost boost--banana">Slippery! ({banana.from})</span>}
            </p>
          )}
          <h1 className="p-q__prompt">{q.prompt}</h1>
          {q.image && q.type !== "pin" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="p-q__img" src={q.image} alt="" />
          )}
          {q.type === "choice" && q.multiCorrect && <p className="hint">More than one answer is right. Pick one.</p>}
          {answerError && (
            <p className="error" role="alert">
              {answerError}
            </p>
          )}
          <PlayerAnswer key={`${view.questionIndex}-${q.id}`} q={q} onAnswer={onAnswer} busy={busy} slippery={!!banana} />
          {smoke && smokeGone !== view.questionIndex && (
            <SmokeOverlay key={view.questionIndex} from={smoke.from} onClear={() => setSmokeGone(view.questionIndex)} />
          )}
        </section>
      );

    case "reveal":
      return (
        <>
          <PlayerResult view={view} />
          <div className="p-after">
            {pocket}
            <ReactionBar />
          </div>
        </>
      );

    case "leaderboard":
      return (
        <>
          <PlayerStanding view={view} />
          <div className="p-after">
            {pocket}
            <ReactionBar />
          </div>
        </>
      );

    case "podium":
      return (
        <>
          <PlayerFinish view={view} />
          <div className="p-after">
            <ReactionBar />
          </div>
        </>
      );
  }
}

function PlayerResult({ view }: { view: PlayerView }) {
  const r = view.result;
  const q = view.question;
  const pts = useCountUp(r?.points ?? 0, 700);
  if (!r || !q || !view.reveal) return null;
  const poll = view.reveal.stats.type === "choice" && view.reveal.stats.isPoll;
  const noPoints = q.points === "none";
  const answerText = rightAnswerText(q, view.reveal.stats);

  let tone: "right" | "close" | "wrong" | "none" | "poll" = "wrong";
  let headline = "Not this time";
  if (poll) {
    tone = "poll";
    headline = r.answered ? "Vote counted" : "No vote this time";
  } else if (!r.answered) {
    tone = "none";
    headline = "Time ran out";
  } else if (r.correct && r.accuracy >= 0.999) {
    tone = "right";
    headline = "Right!";
  } else if (r.correct || r.accuracy > 0) {
    tone = "close";
    headline = r.correct ? "So close" : "Partly right";
  }

  return (
    <section className={`p-result p-result--${tone}`}>
      <h1 className="p-result__head">{headline}</h1>
      {!poll && !noPoints && (
        <p className="p-result__pts" aria-label={`${r.points} points`}>
          +{pts.toLocaleString()}
        </p>
      )}
      {!poll && r.multiplier > 1 && r.points > 0 && (
        <p className="p-result__mult">
          ×{r.multiplier} {view.turbo > 1 && view.nitro ? "turbo + nitro" : view.turbo > 1 ? "turbo" : "nitro"}
        </p>
      )}
      {!poll && r.answered && r.timeMs != null && <p className="hint">Answered in {seconds(r.timeMs)}</p>}
      {r.streak >= 2 && !poll && (
        <p className="p-result__streak">
          <Flame size={22} /> {r.streak} right in a row
        </p>
      )}
      {answerText && tone !== "right" && (
        <p className="p-result__answer">
          The answer: <b>{answerText}</b>
        </p>
      )}
      {!poll && (
        <p className="p-result__rank">
          You&apos;re {ordinal(r.rank)}
          {r.behind ? `, ${r.behind.gap.toLocaleString()} behind ${r.behind.name}` : r.rank === 1 ? " and leading" : ""}
        </p>
      )}
    </section>
  );
}

function PlayerStanding({ view }: { view: PlayerView }) {
  const inTop = view.leaderboard.some((e) => e.id === view.me.id);
  return (
    <section className="p-stand">
      <p className="p-stand__label">Your place</p>
      <p className="p-stand__rank">{ordinal(view.myRank)}</p>
      <ol className="p-stand__list">
        {view.leaderboard.map((e) => (
          <li key={e.id} className={e.id === view.me.id ? "is-me" : ""}>
            <span className="p-stand__n">{e.rank}</span>
            <Avatar seed={e.avatar} size={30} />
            <span className="p-stand__name">{e.name}</span>
            <span className="p-stand__score">{e.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      {!inTop && <p className="hint">Get into the top five and you&apos;ll be on the big screen.</p>}
    </section>
  );
}

function PlayerFinish({ view }: { view: PlayerView }) {
  const [done, setDone] = useState(false);
  const place = view.myRank;
  const onPodium = place >= 1 && place <= 3;
  return (
    <section className="p-finish">
      <Podium top={view.leaderboard} size="small" onDone={() => setDone(true)} />
      <div className={`p-finish__me${done ? " is-shown" : ""}`}>
        <h1 className="big-title">{onPodium ? (place === 1 ? "You won!" : `You took ${ordinal(place)}!`) : `You finished ${ordinal(place)}`}</h1>
        <p className="hint">
          {view.me.score.toLocaleString()} points across {view.questionCount} questions
        </p>
        <Link className="btn btn--go" href="/">
          Play another game
        </Link>
      </div>
    </section>
  );
}
