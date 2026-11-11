/**
 * Board-style question generators.
 *
 * Format follows the NCC WHNP-BC exam (see QUESTION_FORMAT.md): a stem and
 * exactly THREE options (A, B, C), one correct and two distractors, with the
 * options alphabetized by their first word.
 *
 * Content rule: every fact shown (the clue in the stem, every option, the
 * rationale) is verbatim text from data/disorders.json: a whole cell, a line
 * of a cell, a semicolon-separated fragment of a line, or a condition label.
 * The only non-source words are the fixed stem templates below, which carry no
 * medical content of their own. Condition names that appear inside a clue are
 * masked with ▢▢▢ so the clue doesn't give the answer away.
 */
import { conditionLabel, fieldOf, filledCells, rowsWithImages } from "./data";
import { pickOne, shuffle } from "./random";
import type { Field, ImageRef, QuizItem, RowRef } from "./types";

export type BoardKind = "diagnosis" | "management" | "image" | "redflag" | "lookalike";

export type BoardOption = { text: string; correct: boolean };

export type BoardItem = {
  kind: BoardKind;
  /** Stem = pre + quote + post. `quote` is verbatim source text (or a condition label). */
  pre: string;
  quote: string;
  post: string;
  image?: ImageRef;
  /** Set when the clue is assembled from several cells of the row (e.g. TSH / Free T4 / Free T3). */
  clueCells?: { column: string; text: string }[];
  /** Exactly 3, already alphabetized. */
  options: BoardOption[];
  /** Where the correct answer comes from, for the rationale shown after answering. */
  source: {
    rowId: string;
    sectionId: string;
    sectionTitle: string;
    condition: string;
    column: string;
    cell: string;
  };
};

export type BoardQuizItem = QuizItem<BoardItem>;

export const MASK = "▢▢▢";

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verbatim fragments of a cell: each line, split again at semicolons.
 * Every fragment is a substring of the cell. Label-only fragments ("Viral:")
 * and symbol-only fragments are dropped.
 */
export function fragments(cell: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Lines the doc breaks mid-phrase ("Inflammation of paranasal sinuses +") stay
  // joined to the next line. The join keeps the original "\n", so the fragment
  // is still an exact substring of the cell.
  const lines: string[] = [];
  for (const line of cell.split("\n")) {
    const prev = lines[lines.length - 1];
    if (prev !== undefined && line.trim() && /([+,→(/&:-]|\b(and|or|with|to|for|of|in|the|a|an))\s*$/i.test(prev)) {
      lines[lines.length - 1] = `${prev}\n${line}`;
    } else {
      lines.push(line);
    }
  }
  for (const line of lines) {
    for (const part of line.split(";")) {
      const t = part.trim();
      if (t.length < 4) continue;
      if (/:$/.test(t)) continue;
      if (!/[A-Za-z]{2}/.test(t)) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

/** Name tokens for a condition label: "URI (Common Cold)" → ["URI", "Common Cold"]. */
function nameTokens(label: string): string[] {
  return label
    .split(/[()/,;:]|\bvs\.?\b|\band\b|&/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && !/^(disease|disorder|acute|chronic|type|infection|syndrome)$/i.test(s));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if any token of `label` appears in `text` (case-insensitive, whole-word). */
export function mentions(text: string, label: string): boolean {
  return nameTokens(label).some((tok) => new RegExp(`(^|[^A-Za-z])${escapeRe(tok)}(?![A-Za-z])`, "i").test(text));
}

/** Replace every mention of the given labels with the mask. */
export function maskNames(text: string, labels: string[]): string {
  let out = text;
  for (const label of labels) {
    for (const tok of nameTokens(label)) {
      out = out.replace(new RegExp(`(^|[^A-Za-z])${escapeRe(tok)}(?![A-Za-z])`, "gi"), `$1${MASK}`);
    }
  }
  return out.replace(new RegExp(`${MASK}(\\s*${MASK})+`, "g"), MASK);
}

function firstWord(s: string): string {
  return (
    s
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .split(/\s+/)[0]
      ?.toLowerCase() ?? ""
  );
}

/** NCC alphabetizes options by their first word. Ties fall back to the whole text. */
export function alphabetize(options: BoardOption[]): BoardOption[] {
  return options
    .slice()
    .sort((a, b) => firstWord(a.text).localeCompare(firstWord(b.text)) || a.text.localeCompare(b.text));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const STOP = new Set(
  "with from that this then than into over under after before when where which while also only most more less very some such other each both upon about their there these those will should could would have been being does than".split(
    " ",
  ),
);

function sigWords(s: string): string[] {
  return [...new Set((s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter((w) => !STOP.has(w)))];
}

/**
 * True if `frag` is (mostly) already stated in `cell`: either a literal substring,
 * or ≥60% of its significant words occur in the cell. Used to reject distractors
 * that would also be true for the correct row (e.g. "Clinical" vs "Clinical dx").
 */
export function mostlyContained(frag: string, cell: string): boolean {
  const lc = cell.toLowerCase();
  if (lc.includes(frag.toLowerCase())) return true;
  const w = sigWords(frag);
  if (!w.length) return false;
  return w.filter((x) => lc.includes(x)).length / w.length >= 0.6;
}

/** One option must never be a substring of another (A. Clinical / B. Clinical diagnosis). */
function overlapping(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.includes(y) || y.includes(x);
}

/** First pair in `list` whose members don't overlap, in list order. */
function firstValidPair(list: string[]): string[] {
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) if (!overlapping(list[i], list[j])) return [list[i], list[j]];
  return [];
}

/**
 * Pick `n` distinct distractors, none overlapping with the answer or each other.
 * Whether `n` can be found never depends on the seed: if the greedy pass fails
 * for n = 2, an exhaustive pair search runs over the same candidates.
 */
function pickNonOverlapping(answer: string, pool: string[], n: number, rng: () => number): string[] {
  const seen = new Set([norm(answer)]);
  const candidates: string[] = [];
  for (const t of shuffle(pool, rng)) {
    const k = norm(t);
    if (!k || seen.has(k) || overlapping(answer, t)) continue;
    seen.add(k);
    candidates.push(t);
  }
  const chosen: string[] = [];
  for (const t of candidates) {
    if (chosen.some((o) => overlapping(o, t))) continue;
    chosen.push(t);
    if (chosen.length === n) return chosen;
  }
  return n === 2 ? firstValidPair(candidates) : chosen;
}

/**
 * Pick `n` distractors with lengths close to the answer's (so length isn't a
 * tell), none overlapping with the answer or each other.
 */
function pickSimilar(answer: string, pool: string[], n: number, rng: () => number): string[] {
  // Candidates: distinct, not overlapping the answer, sorted by length closeness
  // (random tiebreak). The closest few are shuffled so the pick varies per quiz.
  const seen = new Set([norm(answer)]);
  const candidates: string[] = [];
  for (const t of shuffle(pool, rng)) {
    const k = norm(t);
    if (!k || seen.has(k) || overlapping(answer, t)) continue;
    seen.add(k);
    candidates.push(t);
  }
  const byCloseness = candidates
    .map((t) => ({ t, d: Math.abs(t.length - answer.length) / Math.max(answer.length, 24) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.t);
  const nearCount = Math.max(n * 4, 8);
  const ordered = [...shuffle(byCloseness.slice(0, nearCount), rng), ...byCloseness.slice(nearCount)];

  const chosen: string[] = [];
  for (const t of ordered) {
    if (chosen.some((o) => overlapping(o, t))) continue;
    chosen.push(t);
    if (chosen.length === n) return chosen;
  }
  // Greedy can miss a valid pair ("a b" blocks both "a" and "b"); search exhaustively
  // so whether an item exists never depends on the seed.
  return n === 2 ? firstValidPair(byCloseness) : chosen;
}

/**
 * Columns that hold short symbolic values rather than prose (the thyroid table's
 * TSH / Free T4 / Free T3). These become "pattern" questions.
 */
function patternColumns(section: RowRef["section"]): string[] {
  return section.columns
    .slice(1)
    .filter(
      (c) =>
        fieldOf(c) === "other" &&
        !/notes|consideration/i.test(c) &&
        section.rows.every((r) => (r.cells[c] ?? "").trim().length <= 32),
    );
}

function patternSignature(ref: RowRef, cols: string[]): string {
  return cols.map((c) => `${c}=${norm(ref.row.cells[c] ?? "")}`).join("|");
}

/** Rationale cell for a pattern item: the row's Notes cell if it has one. */
function patternSource(ref: RowRef, cols: string[]): BoardItem["source"] {
  const notes = ref.section.columns.find((c) => /notes|consideration/i.test(c));
  const col = notes && (ref.row.cells[notes] ?? "").trim() ? notes : cols[0];
  return source(ref, col, ref.row.cells[col] ?? "");
}

function finish(correct: string, distractors: string[]): BoardOption[] | null {
  if (distractors.length < 2) return null;
  return alphabetize([
    { text: correct, correct: true },
    { text: distractors[0], correct: false },
    { text: distractors[1], correct: false },
  ]);
}

function source(ref: RowRef, column: string, cell: string): BoardItem["source"] {
  return {
    rowId: ref.row.id,
    sectionId: ref.section.id,
    sectionTitle: ref.section.title,
    condition: conditionLabel(ref.row),
    column,
    cell,
  };
}

/**
 * Rows that can serve as wrong answers for `ref`: not the row itself, and not a
 * row whose name contains / is contained in it ("COPD" vs "Group A, Group B,
 * Group E COPD" are the same disease, so both can't be options at once).
 */
function otherRows(ref: RowRef, pool: RowRef[]): RowRef[] {
  const label = conditionLabel(ref.row);
  return pool.filter((r) => r.row.id !== ref.row.id && !overlapping(conditionLabel(r.row), label));
}

/** Labels of other rows in the same section (fallback: everywhere). */
function labelPool(ref: RowRef, rows: RowRef[], all: RowRef[]): string[] {
  const same = otherRows(ref, rows.filter((r) => r.section.id === ref.section.id));
  const pool = same.length >= 2 ? same : otherRows(ref, all);
  return pool.map((r) => conditionLabel(r.row));
}

/* ------------------------------------------------------------------ */
/* Stem templates (fixed wording; no medical content)                  */
/* ------------------------------------------------------------------ */

/** clue → condition. */
const TO_CONDITION: Record<Field, [string, string]> = {
  definition: ["The condition described as ", " is"],
  etiology: ["The condition whose etiology includes ", " is"],
  risk: ["The condition whose risk factors include ", " is"],
  pathophysiology: ["The pathophysiology described as ", " corresponds to"],
  presentation: ["A patient presents with ", ". The most likely diagnosis is"],
  diagnostics: ["A diagnostic work-up consisting of ", " is appropriate for suspected"],
  treatment: ["Management consisting of ", " is indicated for"],
  nonpharm: ["Non-pharmacologic management consisting of ", " is indicated for"],
  education: ["Patient education that includes ", " is appropriate for a patient with"],
  complications: ["A complication or referral consideration described as ", " is associated with"],
  differentials: ["A differential diagnosis list that includes ", " is considered when evaluating for"],
  other: ["The notes describe ", " for"],
};

/** condition → field fragment. */
const FROM_CONDITION: Record<Field, [string, string]> = {
  definition: ["", " is best described as"],
  etiology: ["The etiology of ", " includes"],
  risk: ["Risk factors for ", " include"],
  pathophysiology: ["The pathophysiology of ", " involves"],
  presentation: ["The clinical presentation of ", " characteristically includes"],
  diagnostics: ["The diagnostic work-up for ", " includes"],
  treatment: ["Treatment / management of ", " includes"],
  nonpharm: ["Non-pharmacologic management of ", " includes"],
  education: ["Patient education for ", " includes"],
  complications: ["Complications or referral considerations for ", " include"],
  differentials: ["The differential diagnosis for ", " includes"],
  other: ["The notes for ", " state"],
};

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

type Ctx = { rng: () => number; rows: RowRef[]; allRows: RowRef[] };

/**
 * "A patient presents with <clue>. The most likely diagnosis is" → 3 conditions.
 * One item per verbatim fragment of each filled cell (not just presentation).
 */
export function buildDiagnosis({ rng, rows, allRows }: Ctx): BoardQuizItem[] {
  const items: BoardQuizItem[] = [];
  for (const ref of rows) {
    const label = conditionLabel(ref.row);
    const pool = labelPool(ref, rows, allRows);

    // Pattern rows: "Testing shows TSH ↑, Free T4 ↓, Free T3 ↓/Normal. The most likely diagnosis is"
    const pcols = patternColumns(ref.section);
    const parts = pcols.map((c) => ({ column: c, text: (ref.row.cells[c] ?? "").trim() })).filter((p) => p.text);
    if (pcols.length >= 2 && parts.length >= 2) {
      const sig = patternSignature(ref, pcols);
      const distinct = otherRows(ref, allRows)
        .filter((r) => r.section.id === ref.section.id && patternSignature(r, pcols) !== sig)
        .map((r) => conditionLabel(r.row));
      const options = finish(label, pickNonOverlapping(label, distinct, 2, rng));
      if (options) {
        items.push({
          id: `bp:${ref.row.id}`,
          rowId: ref.row.id,
          sectionId: ref.section.id,
          data: {
            kind: "diagnosis",
            pre: "Testing shows ",
            quote: parts.map((p) => `${p.column} ${p.text}`).join(", "),
            post: ". The most likely diagnosis is",
            clueCells: parts,
            options,
            source: patternSource(ref, pcols),
          },
        });
      }
    }

    for (const { column, field, text } of filledCells(ref)) {
      if (field === "other") continue;
      const frags = fragments(text);
      frags.forEach((frag, i) => {
        if (frag.length < 12) return; // too little to diagnose from
        const distractors = pickNonOverlapping(label, pool, 2, rng);
        const options = finish(label, distractors);
        if (!options) return;
        const [pre, post] = TO_CONDITION[field];
        items.push({
          id: `bd:${ref.row.id}:${column}:${i}`,
          rowId: ref.row.id,
          sectionId: ref.section.id,
          data: {
            kind: "diagnosis",
            pre,
            quote: maskNames(frag, options.map((o) => o.text)),
            post,
            options,
            source: source(ref, column, text),
          },
        });
      });
    }
  }
  return items;
}

const MANAGEMENT_FIELDS: Field[] = [
  "treatment",
  "diagnostics",
  "presentation",
  "etiology",
  "risk",
  "education",
  "complications",
  "nonpharm",
  "definition",
];

/**
 * "Treatment / management of <condition> includes" → 3 verbatim fragments from
 * the same field: the row's own, and two from other rows in the section.
 */
export function buildManagement({ rng, rows, allRows }: Ctx): BoardQuizItem[] {
  const items: BoardQuizItem[] = [];
  // fragment pools by section + field, tagged with their row so we can exclude self
  const pools = new Map<string, { frag: string; rowId: string }[]>();
  const key = (sectionId: string, field: Field) => `${sectionId}|${field}`;
  for (const ref of allRows) {
    for (const { field, text } of filledCells(ref)) {
      const k = key(ref.section.id, field);
      const arr = pools.get(k) ?? [];
      for (const frag of fragments(text)) arr.push({ frag, rowId: ref.row.id });
      pools.set(k, arr);
    }
  }
  for (const ref of rows) {
    const label = conditionLabel(ref.row);

    // Pattern columns: "In Primary Hypothyroidism, TSH is" → ↑ / ↓ / Normal
    for (const c of patternColumns(ref.section)) {
      const v = (ref.row.cells[c] ?? "").trim();
      if (!v) continue;
      const pool = allRows
        .filter((r) => r.section.id === ref.section.id && r.row.id !== ref.row.id)
        .map((r) => (r.row.cells[c] ?? "").trim())
        .filter((t) => t && norm(t) !== norm(v));
      const options = finish(v, pickNonOverlapping(v, pool, 2, rng));
      if (!options) continue;
      items.push({
        id: `bm:${ref.row.id}:${c}:p`,
        rowId: ref.row.id,
        sectionId: ref.section.id,
        data: { kind: "management", pre: "In ", quote: label, post: `, ${c} is`, options, source: source(ref, c, v) },
      });
    }

    for (const { column, field, text } of filledCells(ref)) {
      if (!MANAGEMENT_FIELDS.includes(field)) continue;
      const frags = fragments(text);
      frags.forEach((frag, i) => {
        if (frag.length < 6) return;
        const pool = (pools.get(key(ref.section.id, field)) ?? [])
          .filter((p) => p.rowId !== ref.row.id && !mentions(p.frag, label) && !mostlyContained(p.frag, text))
          .map((p) => p.frag);
        const distractors = pickSimilar(frag, pool, 2, rng);
        const options = finish(frag, distractors);
        if (!options) return;
        const [pre, post] = FROM_CONDITION[field];
        items.push({
          id: `bm:${ref.row.id}:${column}:${i}`,
          rowId: ref.row.id,
          sectionId: ref.section.id,
          data: { kind: "management", pre, quote: label, post, options, source: source(ref, column, text) },
        });
      });
    }
  }
  return items;
}

/** Picture → "The condition pictured is" → 3 conditions. */
export function buildImage({ rng, rows, allRows }: Ctx): BoardQuizItem[] {
  const items: BoardQuizItem[] = [];
  const withImages = rowsWithImages(allRows);
  for (const ref of rowsWithImages(rows)) {
    const label = conditionLabel(ref.row);
    const sameSection = otherRows(ref, withImages.filter((r) => r.section.id === ref.section.id));
    const pool = (sameSection.length >= 2 ? sameSection : otherRows(ref, allRows)).map((r) => conditionLabel(r.row));
    ref.row.images.forEach((image, i) => {
      const options = finish(label, pickNonOverlapping(label, pool, 2, rng));
      if (!options) return;
      const col = ref.section.columns.find((c) => fieldOf(c) === "presentation") ?? ref.section.columns[0];
      items.push({
        id: `bi:${ref.row.id}:${i}`,
        rowId: ref.row.id,
        sectionId: ref.section.id,
        data: {
          kind: "image",
          pre: "The condition pictured is",
          quote: "",
          post: "",
          image,
          options,
          source: source(ref, col, ref.row.cells[col] ?? ""),
        },
      });
    });
  }
  return items;
}

const RED_FLAG = /\b(refer(ral|red)?|urgent(ly)?|emergen(cy|t)|hospital(ize|ization|ized)?|immediate(ly)?|admit|surgical|surgery|life.threatening|911)\b/i;
const RED_FLAG_CAPS = /\b(ED|ER|ICU)\b/; // case-sensitive on purpose: "ED" ≠ "infected"

export function isRedFlag(text: string): boolean {
  return RED_FLAG.test(text) || RED_FLAG_CAPS.test(text);
}

/** Red-flag / referral lines → "…is associated with" → 3 conditions. */
export function buildRedFlags(ctx: Ctx): BoardQuizItem[] {
  const { rng, rows, allRows } = ctx;
  const items: BoardQuizItem[] = [];
  for (const ref of rows) {
    const label = conditionLabel(ref.row);
    const pool = labelPool(ref, rows, allRows);
    for (const { column, field, text } of filledCells(ref)) {
      if (!["complications", "education", "treatment", "diagnostics", "presentation"].includes(field)) continue;
      fragments(text).forEach((frag, i) => {
        if (!isRedFlag(frag) || frag.length < 10) return;
        const options = finish(label, pickNonOverlapping(label, pool, 2, rng));
        if (!options) return;
        items.push({
          id: `br:${ref.row.id}:${column}:${i}`,
          rowId: ref.row.id,
          sectionId: ref.section.id,
          data: {
            kind: "redflag",
            pre: "The following red flag or referral guidance applies to a patient with which condition? ",
            quote: maskNames(frag, options.map((o) => o.text)),
            post: "",
            options,
            source: source(ref, column, text),
          },
        });
      });
    }
  }
  return items;
}

/**
 * Look-alike pairs: neighbouring rows in the source table (the notes group
 * similar conditions together). A fragment from one of the pair, from a field
 * BOTH rows have filled, with options = the pair + one more same-section row.
 */
export function buildLookalike({ rng, rows, allRows }: Ctx): BoardQuizItem[] {
  const items: BoardQuizItem[] = [];
  const bySection = new Map<string, RowRef[]>();
  for (const r of rows) bySection.set(r.section.id, [...(bySection.get(r.section.id) ?? []), r]);
  for (const sectionRows of bySection.values()) {
    for (let i = 0; i + 1 < sectionRows.length; i++) {
      const pair = [sectionRows[i], sectionRows[i + 1]];
      const labels = pair.map((p) => conditionLabel(p.row));
      if (overlapping(labels[0], labels[1])) continue; // same disease split over two rows
      const others = otherRows(pair[0], otherRows(pair[1], allRows))
        .filter((r) => r.section.id === pair[0].section.id)
        .map((r) => conditionLabel(r.row));
      const third = pickOne(pickNonOverlapping(labels[0], others, 5, rng).filter((t) => t !== labels[1]), rng);
      if (!third) continue;
      for (const [which, ref] of pair.entries()) {
        const other = pair[1 - which];
        for (const { column, field, text } of filledCells(ref)) {
          if (field === "other" || !(other.row.cells[column] ?? "").trim()) continue;
          fragments(text).forEach((frag, k) => {
            if (frag.length < 12) return;
            const options = alphabetize([
              { text: labels[which], correct: true },
              { text: labels[1 - which], correct: false },
              { text: third, correct: false },
            ]);
            const [pre, post] = TO_CONDITION[field];
            items.push({
              id: `bl:${ref.row.id}:${other.row.id}:${column}:${k}`,
              rowId: ref.row.id,
              sectionId: ref.section.id,
              data: {
                kind: "lookalike",
                pre,
                quote: maskNames(frag, options.map((o) => o.text)),
                post,
                options,
                source: source(ref, column, text),
              },
            });
          });
        }
      }
    }
  }
  return items;
}

export const GENERATORS: Record<BoardKind, (ctx: Ctx) => BoardQuizItem[]> = {
  diagnosis: buildDiagnosis,
  management: buildManagement,
  image: buildImage,
  redflag: buildRedFlags,
  lookalike: buildLookalike,
};

/** Every kind together. The same clue can come from two generators; keep one. */
export function buildMixed(ctx: Ctx): BoardQuizItem[] {
  const seen = new Set<string>();
  return Object.values(GENERATORS)
    .flatMap((g) => g(ctx))
    .filter((it) => {
      const k = `${it.rowId}|${it.data.pre}|${it.data.quote}|${it.data.post}|${it.data.image?.file ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/**
 * Exam-style selection: `n` items spread evenly across sections (round-robin
 * over shuffled per-section lists), at most one item per row where possible.
 */
export function selectBalanced(items: BoardQuizItem[], n: number, rng: () => number): BoardQuizItem[] {
  const bySection = new Map<string, BoardQuizItem[]>();
  for (const it of shuffle(items, rng)) bySection.set(it.sectionId, [...(bySection.get(it.sectionId) ?? []), it]);
  const queues = shuffle([...bySection.values()], rng);
  const out: BoardQuizItem[] = [];
  const usedRows = new Set<string>();
  // pass 1: distinct rows; pass 2: anything left
  for (const pass of [0, 1]) {
    let progress = true;
    while (out.length < n && progress) {
      progress = false;
      for (const q of queues) {
        if (out.length >= n) break;
        const idx = q.findIndex((it) => pass === 1 || !usedRows.has(it.rowId));
        if (idx === -1) continue;
        const [it] = q.splice(idx, 1);
        usedRows.add(it.rowId);
        out.push(it);
        progress = true;
      }
    }
  }
  return shuffle(out, rng);
}
