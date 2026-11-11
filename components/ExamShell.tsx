"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardQuestion } from "@/components/BoardQuestion";
import { recordResult } from "@/lib/progress";
import type { BoardQuizItem } from "@/lib/questions";

/** NCC: 175 questions in 3 hours → the same pace for any length. */
export const SECONDS_PER_QUESTION = (3 * 60 * 60) / 175;

function clock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Exam simulation that mirrors how the NCC/PSI test runs: one item at a time,
 * move forward and back, flag items for review, change answers freely, no
 * feedback until the exam ends, timer visible (can be hidden), unanswered
 * items count as wrong. Results then show every item with its answer.
 */
export function ExamShell({ items }: { items: BoardQuizItem[] }) {
  const total = items.length;
  const totalSeconds = Math.round(total * SECONDS_PER_QUESTION);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Set<number>>(() => new Set());
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [showTimer, setShowTimer] = useState(true);
  const [finished, setFinished] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const recorded = useRef(false);

  const finish = useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    items.forEach((it, i) => recordResult(it.id, it.data.options[answers[i] ?? -1]?.correct === true));
    setFinished(true);
  }, [items, answers]);

  // Countdown. Ends the exam when time runs out. Refs keep the interval callback
  // pointed at the latest `finish` without restarting the timer on every answer.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);
  const secondsRef = useRef(totalSeconds);
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => {
      secondsRef.current -= 1;
      setSecondsLeft(secondsRef.current);
      if (secondsRef.current <= 0) {
        clearInterval(t);
        finishRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [finished]);

  const select = useCallback(
    (i: number) => {
      if (finished) return;
      setAnswers((a) => ({ ...a, [index]: i }));
    },
    [finished, index],
  );

  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () => items.filter((it, i) => it.data.options[answers[i] ?? -1]?.correct).length,
    [items, answers],
  );

  if (!total) {
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center">
        <p className="font-serif text-xl font-semibold">No questions</p>
        <Link href="/" className="btn-primary">Back to dashboard</Link>
      </div>
    );
  }

  /* ------------------------------ Results ------------------------------ */
  if (finished) {
    const pct = Math.round((score / total) * 100);
    const bySection = new Map<string, { title: string; right: number; n: number }>();
    items.forEach((it, i) => {
      const s = bySection.get(it.sectionId) ?? { title: it.data.source.sectionTitle, right: 0, n: 0 };
      s.n += 1;
      if (it.data.options[answers[i] ?? -1]?.correct) s.right += 1;
      bySection.set(it.sectionId, s);
    });
    const topics = [...bySection.values()].sort((a, b) => a.right / a.n - b.right / b.n);
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="card text-center">
            <p className="eyebrow">Practice exam complete</p>
            <p className={`mt-3 font-serif text-7xl font-semibold tabular-nums ${pct >= 70 ? "text-hit" : "text-miss"}`}>{pct}%</p>
            <p className="mt-1 text-lg">{score} of {total} correct</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <Mini label="Answered" value={`${answeredCount}`} />
              <Mini label="Blank" value={`${total - answeredCount}`} />
              <Mini label="Time used" value={clock(totalSeconds - Math.max(0, secondsLeft))} />
            </dl>
            <p className="mt-4 text-xs text-muted">
              NCC does not publish a passing percentage; it scores by ability level.
            </p>
            <Link href="/" className="btn-primary mt-5 w-full">Back to dashboard</Link>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold">Results by topic</h3>
            <p className="text-sm text-muted">Sorted by lowest score.</p>
            <ul className="mt-4 space-y-3">
              {topics.map((s) => {
                const p = Math.round((s.right / s.n) * 100);
                return (
                  <li key={s.title}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{s.title}</span>
                      <span className={`tabular-nums ${p < 60 ? "text-miss" : "text-muted"}`}>
                        {s.right}/{s.n}
                      </span>
                    </div>
                    <div className="bar mt-1"><span style={{ width: `${p}%`, background: p < 60 ? "var(--miss)" : undefined }} /></div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold">Review every question</h3>
          <div className="grid gap-5 2xl:grid-cols-2">
            {items.map((it, i) => {
              const sel = answers[i] ?? null;
              const right = sel !== null && it.data.options[sel].correct;
              return (
                <div key={it.id} className={`card border-l-4 ${right ? "border-l-hit" : "border-l-miss"}`}>
                  <BoardQuestion item={it.data} number={i + 1} selected={sel} onSelect={() => {}} revealed keyboard={false} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ Test screen ------------------------------ */
  const item = items[index];
  const lowTime = secondsLeft < 300;
  const pctDone = Math.round((answeredCount / total) * 100);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="testbar">
        <div className="min-w-0">
          <p className="eyebrow">Practice exam</p>
          <p className="font-semibold tabular-nums">
            Question {index + 1} <span className="font-normal text-muted">of {total}</span>
          </p>
        </div>
        <div className="mx-2 hidden max-w-xs flex-1 sm:block">
          <div className="bar"><span style={{ width: `${pctDone}%` }} /></div>
          <p className="mt-1 text-xs text-muted">{answeredCount} answered</p>
        </div>
        <button
          onClick={() => setShowTimer((v) => !v)}
          title="Show or hide the clock"
          className={`ml-auto rounded-[2px] border border-line px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
            lowTime && showTimer ? "text-miss" : ""
          }`}
        >
          {showTimer ? clock(secondsLeft) : "Show time"}
        </button>
        <button
          className="btn-secondary min-h-10! px-3! lg:hidden"
          onClick={() => setShowNav((v) => !v)}
          aria-expanded={showNav}
        >
          All
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="card p-5! sm:p-8!">
            <BoardQuestion item={item.data} number={index + 1} selected={answers[index] ?? null} onSelect={select} revealed={false} />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="btn-secondary px-4! sm:px-5!" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
              ←<span className="hidden sm:inline">&nbsp;Previous</span>
            </button>
            <button
              className={`btn-secondary ${flags.has(index) ? "border-[#e8a317]! bg-[#e8a31720]!" : ""}`}
              aria-pressed={flags.has(index)}
              onClick={() =>
                setFlags((f) => {
                  const n = new Set(f);
                  if (n.has(index)) n.delete(index);
                  else n.add(index);
                  return n;
                })
              }
            >
              {flags.has(index) ? "⚑ Flagged" : (
                <>
                  ⚐ Flag<span className="hidden sm:inline">&nbsp;for review</span>
                </>
              )}
            </button>
            {index < total - 1 ? (
              <button className="btn-primary ml-auto px-5! sm:px-8!" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
                Next →
              </button>
            ) : (
              <button
                className="btn-primary ml-auto px-5! sm:px-8!"
                onClick={() => {
                  const left = total - answeredCount;
                  if (confirm(left ? `${left} unanswered (counted wrong). End the exam?` : "End the exam and see results?")) finish();
                }}
              >
                Finish exam
              </button>
            )}
          </div>
        </div>

        {/* Navigator */}
        <aside
          className={`card space-y-4 lg:sticky lg:top-[calc(var(--header-h)+6rem)] ${showNav ? "block" : "hidden lg:block"}`}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Questions</h2>
            {flags.size > 0 && <span className="text-xs text-muted">{flags.size} flagged</span>}
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIndex(i);
                  setShowNav(false);
                }}
                aria-label={`Question ${i + 1}${i in answers ? ", answered" : ", unanswered"}${flags.has(i) ? ", flagged" : ""}`}
                className={`qnum ${i in answers ? "qnum-answered" : ""} ${i === index ? "qnum-current" : ""} ${flags.has(i) ? "qnum-flag" : ""}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-muted">
            <li><span className="qnum-answered mr-2 inline-block h-3 w-3 rounded-[2px] align-middle" /> Answered</li>
            <li><span className="mr-2 inline-block h-3 w-3 rounded-[2px] border border-line align-middle" /> Unanswered</li>
            <li><span className="qnum-flag mr-2 inline-block h-3 w-3 rounded-[2px] border border-line align-middle" /> Flagged</li>
          </ul>
          <button
            className="btn-secondary w-full"
            onClick={() => {
              const left = total - answeredCount;
              if (confirm(left ? `${left} unanswered (counted wrong). End the exam?` : "End the exam and see results?")) finish();
            }}
          >
            End exam
          </button>
        </aside>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] bg-surface-2 p-3 ring-1 ring-line">
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
