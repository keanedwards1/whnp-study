"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CellText } from "@/components/CellText";
import { RowImages } from "@/components/RowImages";
import type { BoardItem } from "@/lib/questions";

const LETTERS = ["A", "B", "C"] as const;

/**
 * Renders one NCC-format item: stem, three alphabetized options A/B/C, and
 * (when revealed) the correct answer plus the verbatim source cell.
 *
 * Controlled: the parent owns `selected` and `revealed`, so the same component
 * serves the immediate-feedback quiz and the no-feedback-until-the-end exam.
 */
export function BoardQuestion({
  item,
  number,
  selected,
  onSelect,
  revealed,
  keyboard = true,
}: {
  item: BoardItem;
  number?: number;
  selected: number | null;
  onSelect: (index: number) => void;
  revealed: boolean;
  keyboard?: boolean;
}) {
  useEffect(() => {
    if (!keyboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const idx = LETTERS.indexOf(e.key.toUpperCase() as (typeof LETTERS)[number]);
      const num = ["1", "2", "3"].indexOf(e.key);
      const i = idx !== -1 ? idx : num;
      if (i !== -1) onSelect(i);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboard, onSelect]);

  const correctIndex = item.options.findIndex((o) => o.correct);
  const gotIt = selected !== null && item.options[selected]?.correct;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {number !== undefined && (
          <span className="rounded-[2px] bg-accent-soft px-2 py-0.5 text-xs font-bold tabular-nums text-accent-strong">
            Q{number}
          </span>
        )}
        <span className="eyebrow">{item.source.sectionTitle}</span>
      </div>

      <p className="stem">
        {item.pre}
        {item.quote && <span className="stem-quote">{item.quote}</span>}
        {item.post}
      </p>

      {item.image && <RowImages images={[item.image]} showCaption={revealed} />}

      <ol className="space-y-3" role="radiogroup" aria-label="Answer options">
        {item.options.map((opt, i) => {
          const isSel = selected === i;
          const state = !revealed ? (isSel ? "sel" : "idle") : opt.correct ? "right" : isSel ? "wrong" : "dim";
          return (
            <li key={i}>
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={revealed}
                onClick={() => onSelect(i)}
                className={`option option-${state}`}
              >
                <span className="option-letter">{LETTERS[i]}</span>
                <span className="whitespace-pre-line pt-0.5">{opt.text}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {revealed && (
        <div
          className={`rounded-[2px] border-l-4 bg-surface-2 p-4 text-[0.95rem] leading-relaxed ring-1 ring-line ${
            gotIt ? "border-l-hit" : "border-l-miss"
          }`}
        >
          <p className="font-semibold">
            <span className={gotIt ? "text-hit" : "text-miss"}>
              {selected === null ? "Not answered" : gotIt ? "Correct" : "Incorrect"}
            </span>
            <span className="text-muted"> · Answer: {LETTERS[correctIndex]}</span>
          </p>
          {item.clueCells && (
            <p className="mt-1 text-muted">
              {item.source.condition}: {item.clueCells.map((c) => `${c.column} ${c.text}`).join(" · ")}
            </p>
          )}
          <p className="eyebrow mt-3">
            {item.source.condition} · {item.source.column}
          </p>
          <p className="mt-1">
            <CellText text={item.source.cell} />
          </p>
          <Link href={`/browse/${item.source.sectionId}#${item.source.rowId}`} className="link mt-3 inline-block font-medium">
            See full row →
          </Link>
        </div>
      )}
    </div>
  );
}
