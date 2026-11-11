"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExamShell } from "@/components/ExamShell";
import { allRows, quizzableSections, rowsForSections } from "@/lib/data";
import { buildMixed, selectBalanced, type BoardQuizItem } from "@/lib/questions";
import { makeRng, randomSeed } from "@/lib/random";

/**
 * URL params:  s = comma-separated section ids or "all";  n = question count;  seed = optional.
 */
export function ExamRunner() {
  const params = useSearchParams();
  const key = params.toString();
  // Stored with the URL they were built for, so a stale exam is never shown for a new URL.
  const [built, setBuilt] = useState<{ key: string; items: BoardQuizItem[] } | null>(null);

  useEffect(() => {
    const s = params.get("s") ?? "all";
    const sectionIds = s === "all" ? quizzableSections.map((x) => x.id) : s.split(",");
    const n = Number(params.get("n")) || 50;
    const rng = makeRng(Number(params.get("seed")) || randomSeed());
    const all = buildMixed({ rng, rows: rowsForSections(sectionIds), allRows: allRows() });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needs a random seed, which must not run during prerender
    setBuilt({ key, items: selectBalanced(all, n, rng) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!built || built.key !== key) return <p className="text-center text-muted">Preparing exam…</p>;
  return <ExamShell key={key} items={built.items} />;
}
