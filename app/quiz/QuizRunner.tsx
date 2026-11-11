"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QuizShell } from "@/components/QuizShell";
import { allRows, quizzableSections, rowsForSections } from "@/lib/data";
import { getMode } from "@/lib/modes";
import { isDue, missedItemIds } from "@/lib/progress";
import { makeRng, randomSeed, shuffle } from "@/lib/random";
import type { QuizItem } from "@/lib/types";

/**
 * URL params:
 *   mode   quiz mode id (see lib/modes)
 *   s      comma-separated section ids, or "all"
 *   n      number of questions (0 or missing = all)
 *   filter "all" | "missed" | "due"
 *   seed   optional; same seed + params = same quiz
 */
export function QuizRunner() {
  const params = useSearchParams();
  // Items are stored with the URL they were built for, so a stale list is never shown for a new URL.
  const [built, setBuilt] = useState<{ key: string; items: QuizItem[] } | null>(null);

  const mode = getMode(params.get("mode"));
  const key = params.toString();

  useEffect(() => {
    if (!mode) return;
    const s = params.get("s") ?? "all";
    const sectionIds = s === "all" ? quizzableSections.map((x) => x.id) : s.split(",");
    const n = Number(params.get("n") ?? 0);
    const filter = params.get("filter") ?? "all";
    const seed = Number(params.get("seed")) || randomSeed();
    const rng = makeRng(seed);

    let list = mode.buildItems({ rng, rows: rowsForSections(sectionIds), allRows: allRows() });
    if (filter === "missed") {
      const missed = missedItemIds();
      list = list.filter((it) => missed.has(it.id));
    } else if (filter === "due") {
      list = list.filter((it) => isDue(it.id));
    }
    list = shuffle(list, rng);
    // Built after mount: it reads localStorage and uses a random seed, neither of
    // which exists during prerendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuilt({ key, items: n > 0 ? list.slice(0, n) : list });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!mode) {
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center">
        <p className="font-serif text-xl font-semibold">Unknown quiz mode</p>
        <Link href="/" className="btn-primary">Back to dashboard</Link>
      </div>
    );
  }
  if (!built || built.key !== key) return <p className="text-center text-muted">Building your quiz…</p>;
  return <QuizShell key={key} mode={mode} items={built.items} />;
}
