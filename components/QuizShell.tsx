"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getRow } from "@/lib/data";
import { recordResult } from "@/lib/progress";
import type { QuizItem, QuizMode } from "@/lib/types";

/**
 * Generic runner for any QuizMode: progress header, one item at a time, score,
 * end-of-quiz summary with "retry missed". Modes never touch progress storage;
 * the shell records each answer.
 */
export function QuizShell({
  mode,
  items: initialItems,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mode: QuizMode<any>;
  items: QuizItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [round, setRound] = useState(1);

  const item = items[index];
  const done = index >= items.length;
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;
  const missed = useMemo(() => items.filter((it) => results[it.id] === false), [items, results]);

  if (!items.length) {
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center">
        <p className="font-serif text-xl font-semibold">No questions</p>
        <p className="text-muted">No questions match the selected topics and filter.</p>
        <Link href="/" className="btn-primary">Back to dashboard</Link>
      </div>
    );
  }

  function answer(isCorrect: boolean) {
    if (!item || item.id in results) return;
    recordResult(item.id, isCorrect);
    setResults((r) => ({ ...r, [item.id]: isCorrect }));
  }

  function retryMissed() {
    setItems(missed);
    setResults({});
    setIndex(0);
    setRound((n) => n + 1);
  }

  if (done) {
    const pct = answered ? Math.round((correct / answered) * 100) : 0;
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card text-center">
          <p className="eyebrow">{mode.name}{round > 1 ? ` · retry ${round - 1}` : ""}</p>
          <p className={`mt-2 font-serif text-6xl font-semibold tabular-nums ${pct >= 70 ? "text-hit" : "text-miss"}`}>{pct}%</p>
          <p className="mt-1 text-muted">{correct} of {answered} correct</p>
          <div className="bar mx-auto mt-5 max-w-md"><span style={{ width: `${pct}%` }} /></div>
        </div>
        {missed.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold">Missed ({missed.length})</h3>
            <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {uniqueRows(missed).map((rowId) => {
                const ref = getRow(rowId);
                if (!ref) return null;
                return (
                  <li key={rowId}>
                    <Link className="link font-medium" href={`/browse/${ref.section.id}#${rowId}`}>
                      {ref.row.condition.split("\n")[0]}
                    </Link>
                    <span className="text-muted"> · {ref.section.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {missed.length > 0 && <button onClick={retryMissed} className="btn-primary">Retry missed</button>}
          <Link href="/" className="btn-secondary">New quiz</Link>
        </div>
      </div>
    );
  }

  const Mode = mode.Component;
  const result = item.id in results ? results[item.id] : null;
  const pctDone = Math.round((index / items.length) * 100);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div className="card p-5! sm:p-8!">
          {/* key resets per-item state inside the mode component */}
          <Mode key={`${round}:${item.id}`} item={item} onAnswer={answer} result={result} />
        </div>

        {result !== null && (
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${result ? "text-hit" : "text-miss"}`}>
              {result ? "Correct" : "Marked as missed"}
            </p>
            <button onClick={() => setIndex((i) => i + 1)} className="btn-primary min-h-12! px-8!">
              {index + 1 < items.length ? "Next question →" : "See results"}
            </button>
          </div>
        )}
      </div>

      <aside className="card space-y-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <div>
          <p className="eyebrow">{mode.name}</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">
            {index + 1}<span className="text-muted"> / {items.length}</span>
          </p>
          <div className="bar mt-3"><span style={{ width: `${pctDone}%` }} /></div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[2px] bg-surface-2 p-3 ring-1 ring-line">
            <dt className="text-muted">Correct</dt>
            <dd className="text-xl font-semibold tabular-nums text-hit">{correct}</dd>
          </div>
          <div className="rounded-[2px] bg-surface-2 p-3 ring-1 ring-line">
            <dt className="text-muted">Missed</dt>
            <dd className="text-xl font-semibold tabular-nums text-miss">{answered - correct}</dd>
          </div>
        </dl>
        <p className="hidden text-xs text-muted lg:block">Keyboard: A, B, C or 1, 2, 3 select an answer.</p>
        <Link href="/" className="link block text-sm font-medium">← End and return to dashboard</Link>
      </aside>
    </div>
  );
}

function uniqueRows(items: QuizItem[]): string[] {
  return [...new Set(items.map((i) => i.rowId))];
}
