/**
 * Checks every board-style generator against the NCC format rules and the
 * verbatim-content rule. Run:  npm run verify
 *
 * Asserts, for every generator on every section and on all sections:
 *  - no exceptions; unique ids; ids identical across different RNG seeds
 *  - exactly 3 options, exactly 1 correct, alphabetized by first word
 *  - no duplicate option text; no option is a substring of another
 *  - clue text is verbatim from the source row; options are verbatim cells,
 *    lines/fragments of cells, or condition labels
 */
import { allRows, conditionLabel, quizzableSections, rowsForSections } from "@/lib/data";
import { GENERATORS, MASK, buildMixed, selectBalanced, type BoardQuizItem } from "@/lib/questions";
import { makeRng } from "@/lib/random";

const all = allRows();
const labels = new Set(all.map((r) => conditionLabel(r.row)));
const rowById = new Map(all.map((r) => [r.row.id, r]));
const firstWord = (s: string) => (s.replace(/^[^\p{L}\p{N}]+/u, "").split(/\s+/)[0] ?? "").toLowerCase();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

let failures = 0;
const fail = (m: string) => {
  failures++;
  if (failures <= 30) console.log("FAIL", m);
};

function verbatim(it: BoardQuizItem) {
  const ref = rowById.get(it.rowId)!;
  const d = it.data;
  if (ref.row.cells[d.source.column] !== d.source.cell) fail(`${it.id}: source cell mismatch`);
  if (d.clueCells) {
    for (const c of d.clueCells) if (ref.row.cells[c.column]?.trim() !== c.text) fail(`${it.id}: clue cell mismatch ${c.column}`);
  } else if (d.quote && !labels.has(d.quote)) {
    for (const piece of d.quote.split(MASK)) if (piece && !d.source.cell.includes(piece)) fail(`${it.id}: clue not in source: ${piece.slice(0, 60)}`);
  }
  for (const o of d.options) {
    if (labels.has(o.text)) continue;
    if (!all.some((r) => Object.values(r.row.cells).some((c) => c.includes(o.text)))) fail(`${it.id}: option not verbatim: ${o.text.slice(0, 60)}`);
  }
}

function check(items: BoardQuizItem[], tag: string) {
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) fail(`${tag}: duplicate id ${it.id}`);
    ids.add(it.id);
    const o = it.data.options;
    if (o.length !== 3) fail(`${it.id}: ${o.length} options`);
    if (o.filter((x) => x.correct).length !== 1) fail(`${it.id}: not exactly one correct`);
    if (new Set(o.map((x) => norm(x.text))).size !== o.length) fail(`${it.id}: duplicate option text`);
    for (let i = 0; i < o.length; i++)
      for (let j = 0; j < o.length; j++)
        if (i !== j && norm(o[i].text).includes(norm(o[j].text))) fail(`${it.id}: option is a substring of another: ${o[j].text.slice(0, 40)}`);
    for (let i = 1; i < o.length; i++) if (firstWord(o[i - 1].text).localeCompare(firstWord(o[i].text)) > 0) fail(`${it.id}: not alphabetized`);
    if (it.data.kind !== "image" && !it.data.quote) fail(`${it.id}: empty clue`);
    verbatim(it);
  }
  return ids;
}

const totals: Record<string, number> = {};
const zero: string[] = [];
for (const [kind, gen] of Object.entries(GENERATORS)) {
  const a = gen({ rng: makeRng(1), rows: all, allRows: all });
  const b = gen({ rng: makeRng(2), rows: all, allRows: all });
  const idsA = check(a, kind);
  const idsB = check(b, kind);
  const onlyA = [...idsA].filter((id) => !idsB.has(id));
  const onlyB = [...idsB].filter((id) => !idsA.has(id));
  if (onlyA.length || onlyB.length) fail(`${kind}: ids differ between seeds: ${[...onlyA, ...onlyB].slice(0, 5).join(", ")}`);
  totals[kind] = a.length;
  for (const s of quizzableSections) {
    const items = gen({ rng: makeRng(3), rows: rowsForSections([s.id]), allRows: all });
    check(items, `${kind}/${s.id}`);
    if (!items.length) zero.push(`${kind}: ${s.title}`);
  }
}
const mixed = buildMixed({ rng: makeRng(5), rows: all, allRows: all });
check(mixed, "mixed");
const exam = selectBalanced(mixed, 175, makeRng(9));

console.log("items per generator:", totals, "| mixed (deduped):", mixed.length);
console.log(`175-question exam covers ${new Set(exam.map((i) => i.sectionId)).size}/${quizzableSections.length} topics, ${new Set(exam.map((i) => i.rowId)).size} distinct conditions`);
console.log("topics with no items (image/red-flag are expected to be sparse):");
for (const z of zero) console.log("  -", z);

const show = (it: BoardQuizItem) =>
  console.log(
    `\n[${it.data.kind}] ${it.data.pre}${it.data.quote}${it.data.post}\n  ` +
      it.data.options.map((o, i) => `${"ABC"[i]}. ${o.text.replace(/\n/g, " ⏎ ").slice(0, 100)}${o.correct ? "  ✔" : ""}`).join("\n  "),
  );
const r = makeRng(Number(process.argv[2]) || 42);
for (let k = 0; k < 6; k++) show(exam[Math.floor(r() * exam.length)]);

console.log(`\n${failures ? `FAILURES: ${failures}` : "All checks passed."}`);
process.exit(failures ? 1 : 0);
