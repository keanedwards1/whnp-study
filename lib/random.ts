/** Seeded RNG (mulberry32). Returns a function producing floats in [0, 1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Returns a shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Up to `n` random distinct items. */
export function sample<T>(items: readonly T[], n: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, n);
}

export function pickOne<T>(items: readonly T[], rng: () => number): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

/**
 * Pick `n` distractors from `pool`, excluding anything equal to `answer` by `key`
 * and de-duplicating by key, so two choices never show identical text.
 */
export function pickDistractors<T>(
  answer: T,
  pool: readonly T[],
  n: number,
  rng: () => number,
  key: (x: T) => string = (x) => String(x),
): T[] {
  const answerKey = normalize(key(answer));
  const seen = new Set([answerKey]);
  const out: T[] = [];
  for (const x of shuffle(pool, rng)) {
    const k = normalize(key(x));
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length === n) break;
  }
  return out;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
