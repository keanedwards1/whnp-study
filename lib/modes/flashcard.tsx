"use client";

/**
 * REFERENCE MODE: the minimal pattern every quiz mode follows.
 *   1. buildItems(): turn rows into deterministic QuizItems (stable ids, verbatim text).
 *   2. Component: render the question; call onAnswer(correct) once; render the
 *      revealed state when `result !== null`.
 * Front: condition + column name. Back: the verbatim cell. Self-graded.
 */
import { useState } from "react";
import { CellText } from "@/components/CellText";
import { RowImages } from "@/components/RowImages";
import { conditionLabel, fieldOf, filledCells } from "@/lib/data";
import type { ImageRef, QuizItemProps, QuizMode } from "@/lib/types";

type FlashcardData = {
  sectionTitle: string;
  condition: string;
  column: string;
  answer: string;
  images: ImageRef[];
};

function Flashcard({ item, onAnswer, result }: QuizItemProps<FlashcardData>) {
  const [revealed, setRevealed] = useState(false);
  const d = item.data;
  const show = revealed || result !== null;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{d.sectionTitle}</p>
        <h2 className="stem mt-2 font-semibold">{d.condition}</h2>
        <p className="mt-2 text-lg font-medium text-accent">{d.column}?</p>
      </div>

      {!show ? (
        <button onClick={() => setRevealed(true)} className="btn-primary w-full min-h-12!">
          Show answer
        </button>
      ) : (
        <>
          <div className="rounded-[2px] border-l-4 border-l-accent bg-surface-2 p-5 text-[1.05rem] leading-relaxed ring-1 ring-line">
            <CellText text={d.answer} />
          </div>
          <RowImages images={d.images} />
          {result === null && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onAnswer(false)} className="btn-miss">
                Missed it
              </button>
              <button onClick={() => onAnswer(true)} className="btn-hit">
                Got it
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const flashcardMode: QuizMode<FlashcardData> = {
  id: "flashcard",
  name: "Flashcards",
  description: "A condition and a column name are shown. Reveal the answer, then mark it correct or missed.",
  buildItems: ({ rows }) =>
    rows.flatMap((ref) =>
      filledCells(ref).map(({ column, text }) => ({
        id: `flashcard:${ref.row.id}:${column}`,
        rowId: ref.row.id,
        sectionId: ref.section.id,
        data: {
          sectionTitle: ref.section.title,
          condition: conditionLabel(ref.row),
          column,
          answer: text,
          // Every image in the doc sits in the condition column (it pictures the condition),
          // so show them on the back of the Clinical Presentation card, plus any in this column.
          images: ref.row.images.filter(
            (img) =>
              img.column === column ||
              (fieldOf(column) === "presentation" && img.column === ref.section.columns[0]),
          ),
        },
      })),
    ),
  Component: Flashcard,
};
