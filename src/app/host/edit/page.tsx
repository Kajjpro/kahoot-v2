"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Question, QuestionType, Quiz } from "@/shared/types";
import { questionProblem } from "@/shared/validate";
import { QuestionEditor } from "@/components/QuestionEditor";
import { TYPE_INFO, TypeIcon } from "@/components/Marks";
import { useHostLaunch } from "@/lib/launch";
import { duplicateQuestion, getQuiz, newQuestion, saveQuiz } from "@/lib/quizzes";

const TYPES: QuestionType[] = ["choice", "truefalse", "slider", "order", "type", "pin"];

export default function EditPage() {
  return (
    <Suspense fallback={<main className="on-light" />}>
      <Edit />
    </Suspense>
  );
}

function Edit() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(0);
  const [picker, setPicker] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | string>("saved");
  const { launch, launching, error } = useHostLaunch();
  const first = useRef(true);

  useEffect(() => {
    const q = getQuiz(id);
    if (!q || id === "sample" || id === "general") setMissing(true);
    else setQuiz(q);
  }, [id]);

  // Save a moment after the last change.
  useEffect(() => {
    if (!quiz) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(() => {
      const err = saveQuiz(quiz);
      setSaveState(err ?? "saved");
    }, 400);
    return () => clearTimeout(t);
  }, [quiz]);

  if (missing) {
    return (
      <main className="on-light center stack">
        <p>This quiz isn&apos;t in this browser anymore.</p>
        <Link className="btn btn--go" href="/host">
          Back to my quizzes
        </Link>
      </main>
    );
  }
  if (!quiz) return <main className="on-light" />;

  const questions = quiz.questions;
  const current = questions[Math.min(sel, questions.length - 1)];

  const setQuestions = (fn: (qs: Question[]) => Question[]) => setQuiz((q) => (q ? { ...q, questions: fn(q.questions) } : q));

  const update = (next: Question) => setQuestions((qs) => qs.map((x) => (x.id === next.id ? next : x)));

  const add = (type: QuestionType) => {
    const q = newQuestion(type);
    const at = Math.min(sel + 1, questions.length);
    setQuestions((qs) => [...qs.slice(0, at), q, ...qs.slice(at)]);
    setSel(at);
    setPicker(false);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    setQuestions((qs) => {
      const next = qs.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
    setSel(to);
  };

  const remove = (i: number) => {
    if (questions.length === 1) {
      setQuestions(() => [newQuestion("choice")]);
      setSel(0);
      return;
    }
    if (questions[i].prompt.trim() && !confirm(`Delete question ${i + 1}?`)) return;
    setQuestions((qs) => qs.filter((_, j) => j !== i));
    setSel(Math.max(0, i - 1));
  };

  const duplicate = (i: number) => {
    setQuestions((qs) => [...qs.slice(0, i + 1), duplicateQuestion(qs[i]), ...qs.slice(i + 1)]);
    setSel(i + 1);
  };

  const saveLabel = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : null;

  return (
    <main className="on-light editor">
      <header className="editor__bar">
        <button type="button" className="btn btn--quiet" onClick={() => router.push("/host")}>
          ← Quizzes
        </button>
        <label className="sr-only" htmlFor="quiz-title">
          Quiz name
        </label>
        <input
          id="quiz-title"
          className="editor__title"
          placeholder="Name your quiz"
          value={quiz.title}
          maxLength={60}
          onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
        />
        <span className="editor__saved" role="status">
          {saveLabel}
        </span>
        <button type="button" className="btn btn--go btn--small" onClick={() => launch(quiz)} disabled={launching}>
          {launching ? "Opening" : "Host it"}
        </button>
      </header>

      {(error || (saveLabel === null && saveState)) && (
        <p className="error editor__error" role="alert">
          {error ?? saveState}
        </p>
      )}

      <div className="editor__body">
        <nav className="qlist" aria-label="Questions">
          <ol className="qlist__items">
            {questions.map((q, i) => {
              const problem = questionProblem(q);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`qlist__item${i === sel ? " is-current" : ""}`}
                    onClick={() => setSel(i)}
                    aria-current={i === sel}
                  >
                    <span className="qlist__n">{i + 1}</span>
                    <TypeIcon type={q.type} size={18} />
                    <span className="qlist__text">{q.prompt.trim() || TYPE_INFO[q.type].name}</span>
                    {problem && <span className="qlist__warn" title={problem} aria-label="Needs work" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" className="qlist__add" onClick={() => setPicker(true)}>
            + Add question
          </button>
        </nav>

        <section className="editor__main" aria-label={`Question ${sel + 1}`}>
          {picker ? (
            <TypePicker onPick={add} onCancel={() => setPicker(false)} />
          ) : (
            current && (
              <QuestionEditor
                key={current.id}
                q={current}
                index={sel}
                count={questions.length}
                onChange={update}
                onMove={(dir) => move(sel, sel + dir)}
                onDuplicate={() => duplicate(sel)}
                onDelete={() => remove(sel)}
              />
            )
          )}
        </section>
      </div>
    </main>
  );
}

function TypePicker({ onPick, onCancel }: { onPick: (t: QuestionType) => void; onCancel: () => void }) {
  return (
    <div className="picker">
      <div className="picker__head">
        <h2 className="picker__title">What kind of question?</h2>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <ul className="picker__grid">
        {TYPES.map((t) => (
          <li key={t}>
            <button type="button" className="picker__card" onClick={() => onPick(t)}>
              <span className={`picker__icon picker__icon--${t}`}>
                <TypeIcon type={t} size={30} />
              </span>
              <span className="picker__name">{TYPE_INFO[t].name}</span>
              <span className="picker__hint">{TYPE_INFO[t].hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
