"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Marks";
import { request } from "@/lib/socket";

const RUNNERS = [
  { seed: 412, stop: 72 },
  { seed: 9031, stop: 48 },
  { seed: 27, stop: 86 },
  { seed: 5560, stop: 31 },
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const digits = code.replace(/\D/g, "").slice(0, 6);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length !== 6) {
      setError("Game codes have 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await request("player:check", { code: digits });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.push(`/play?code=${digits}`);
  }

  return (
    <main className="home on-blue">
      <header className="home__bar">
        <Logo size={34} />
        <Link className="btn btn--ghost btn--small" href="/host">
          Host a game
        </Link>
      </header>

      <section className="home__hero">
        <h1 className="home__title">Race to the right answer.</h1>
        <form className="join" onSubmit={join} noValidate>
          <label className="join__label" htmlFor="code">
            Game code
          </label>
          <div className="join__row">
            <input
              id="code"
              className="join__code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000"
              value={digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              aria-describedby={error ? "code-error" : "code-hint"}
              aria-invalid={!!error}
            />
            <button className="btn btn--go join__btn" disabled={busy}>
              {busy ? "Checking" : "Join"}
            </button>
          </div>
          {error ? (
            <p id="code-error" className="error" role="alert">
              {error}
            </p>
          ) : (
            <p id="code-hint" className="hint">
              It&apos;s on the host&apos;s screen.
            </p>
          )}
        </form>
      </section>

      <div className="home__track" aria-hidden="true">
        {RUNNERS.map((r, i) => (
          <div className="home__lane" key={r.seed}>
            <span className="home__laneno">{i + 1}</span>
            <div className="home__runner" style={{ ["--stop" as string]: `${r.stop}%`, animationDelay: `${0.15 + i * 0.12}s` }}>
              <Avatar seed={r.seed} size={54} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
