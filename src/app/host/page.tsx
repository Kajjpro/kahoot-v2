"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Quiz } from "@/shared/types";
import { quizProblem } from "@/shared/validate";
import { Logo, TYPE_INFO, TypeIcon } from "@/components/Marks";
import { blankQuiz, deleteQuiz, listQuizzes, saveQuiz } from "@/lib/quizzes";
import { sampleQuiz } from "@/lib/sample";
import { useHostLaunch } from "@/lib/launch";

export default function HostHome() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const { launch, launching, error } = useHostLaunch();

  useEffect(() => setQuizzes(listQuizzes()), []);

  const create = () => {
    const q = blankQuiz();
    saveQuiz(q);
    router.push(`/host/edit?id=${q.id}`);
  };

  const remove = (q: Quiz) => {
    if (!confirm(`Delete "${q.title || "Untitled quiz"}"? This can't be undone.`)) return;
    deleteQuiz(q.id);
    setQuizzes(listQuizzes());
  };

  const sample = sampleQuiz();

  return (
    <main className="on-light library">
      <header className="topbar">
        <Link href="/" className="logo-link" aria-label="Dash home">
          <Logo size={30} />
        </Link>
        <button type="button" className="btn btn--go btn--small" onClick={create}>
          New quiz
        </button>
      </header>

      <div className="library__inner">
        <h1 className="library__title">Your quizzes</h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <ul className="library__list">
          <li className="qcard qcard--sample">
            <div className="qcard__main">
              <h2 className="qcard__title">{sample.title}</h2>
              <p className="qcard__meta">A ready-made quiz with every question type. Good for a first try.</p>
              <TypeStrip quiz={sample} />
            </div>
            <div className="qcard__actions">
              <button type="button" className="btn btn--go btn--small" onClick={() => launch(sample)} disabled={launching}>
                Host it
              </button>
            </div>
          </li>

          {quizzes?.map((q) => {
            const problem = quizProblem(q);
            return (
              <li key={q.id} className="qcard">
                <div className="qcard__main">
                  <h2 className="qcard__title">{q.title || "Untitled quiz"}</h2>
                  <p className="qcard__meta">
                    {q.questions.length} {q.questions.length === 1 ? "question" : "questions"}, edited{" "}
                    {new Date(q.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                  <TypeStrip quiz={q} />
                  {problem && <p className="qcard__problem">{problem}</p>}
                </div>
                <div className="qcard__actions">
                  <Link className="btn btn--ghost btn--small" href={`/host/edit?id=${q.id}`}>
                    Edit
                  </Link>
                  <button type="button" className="btn btn--go btn--small" onClick={() => launch(q)} disabled={launching || !!problem}>
                    Host it
                  </button>
                  <button type="button" className="btn btn--quiet qcard__delete" onClick={() => remove(q)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {quizzes && quizzes.length === 0 && (
          <div className="library__empty">
            <p>You haven&apos;t made a quiz yet. Start one and add your first question in a minute.</p>
            <button type="button" className="btn btn--go" onClick={create}>
              New quiz
            </button>
          </div>
        )}
        <p className="hint library__note">Quizzes are saved in this browser.</p>
      </div>
    </main>
  );
}

function TypeStrip({ quiz }: { quiz: Quiz }) {
  const types = [...new Set(quiz.questions.map((q) => q.type))];
  return (
    <ul className="typestrip" aria-label="Question types">
      {types.map((t) => (
        <li key={t} title={TYPE_INFO[t].name}>
          <TypeIcon type={t} size={18} />
          <span>{TYPE_INFO[t].name}</span>
        </li>
      ))}
    </ul>
  );
}
