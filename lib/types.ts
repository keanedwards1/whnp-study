import type { ComponentType } from "react";

/* ---------- Source data (mirrors data/disorders.json) ---------- */

export type ImageRef = {
  /** Public path, e.g. "/images/eye-disorders-hordeolum-stye-1.jpg" */
  file: string;
  /** Caption from the source doc (often the site the image came from). May be "". */
  alt: string;
  /** The source column the image sat in. */
  column: string;
};

export type Row = {
  /** Stable id: "<sectionId>--<condition-slug>" */
  id: string;
  /** Verbatim first-column text (may contain line breaks). */
  condition: string;
  /** Verbatim cell text keyed by the section's own column header. "" = empty cell. */
  cells: Record<string, string>;
  images: ImageRef[];
};

export type Section = {
  id: string;
  title: string;
  /** Column headers exactly as in the doc. columns[0] is the condition column. */
  columns: string[];
  /** Loose paragraphs between the heading and the table (rare). */
  notes: string[];
  rows: Row[];
  /** True for headings with no table (e.g. "Nerve Disorders"). */
  empty: boolean;
};

export type DisorderData = {
  source: { title: string; documentId: string; revisionId: string; extractedAt: string };
  sections: Section[];
};

/**
 * Canonical field a column maps to. Sections use different header wording
 * ("Treatment" / "Treatment / Management" / "Management/Treatment" ...), so quiz
 * modes should ask by Field and use `lib/data.ts` helpers to read the cell.
 */
export type Field =
  | "definition"
  | "etiology"
  | "risk"
  | "pathophysiology"
  | "presentation"
  | "diagnostics"
  | "treatment"
  | "nonpharm"
  | "education"
  | "complications"
  | "differentials"
  | "other";

/** A row plus the section it belongs to; what quiz modes receive. */
export type RowRef = { section: Section; row: Row };

/* ---------- Quiz framework ---------- */

export type BuildOptions = {
  /** Seeded RNG in [0, 1). Always use this (not Math.random) so a quiz is reproducible. */
  rng: () => number;
  /** Rows from the user's selected sections (empty sections are excluded). */
  rows: RowRef[];
  /** Every row in the document, e.g. for drawing distractors from other sections if needed. */
  allRows: RowRef[];
};

export type QuizItem<T = unknown> = {
  /**
   * Stable id used for progress tracking. Must be deterministic for the same
   * question (no randomness in it), e.g. "flashcard:<rowId>:<column>".
   */
  id: string;
  /** The row this item mainly tests (used for "review missed" and links to Browse). */
  rowId: string;
  sectionId: string;
  /** Mode-specific payload. */
  data: T;
};

export type QuizItemProps<T = unknown> = {
  item: QuizItem<T>;
  /**
   * Call exactly once when the user has answered (or self-graded).
   * The shell records progress and shows the Next button.
   */
  onAnswer: (correct: boolean) => void;
  /** null until answered; then the graded result. Render the reveal/feedback state from this. */
  result: boolean | null;
};

export interface QuizMode<T = unknown> {
  id: string;
  name: string;
  /** One line shown on the setup screen. */
  description: string;
  /**
   * Build ALL candidate items for the selected rows. The shell shuffles, filters
   * (e.g. to missed items) and trims to the requested count. Return [] if the
   * selection has nothing this mode can ask.
   */
  buildItems: (opts: BuildOptions) => QuizItem<T>[];
  Component: ComponentType<QuizItemProps<T>>;
}
