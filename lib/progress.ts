/**
 * Per-browser quiz progress, stored in localStorage. No backend.
 * Every access is wrapped in try/catch: storage can be blocked (private mode,
 * cleared site data), and the app must still work without it.
 */

export type ItemStats = {
  seen: number;
  correct: number;
  missed: number;
  /** Was the most recent answer correct? */
  lastCorrect: boolean;
  /** ms since epoch */
  lastSeen: number;
  /** Leitner box 0–5 for simple spaced repetition: +1 on correct, reset to 0 on miss. */
  box: number;
};

export type Progress = {
  version: 1;
  items: Record<string, ItemStats>;
};

const KEY = "disorder-quiz-progress-v1";
const EMPTY: Progress = { version: 1, items: {} };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

export function loadProgress(): Progress {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Progress) : null;
    cache = parsed?.version === 1 && parsed.items ? parsed : { ...EMPTY, items: {} };
  } catch {
    cache = { ...EMPTY, items: {} };
  }
  return cache;
}

function save(p: Progress) {
  cache = p;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: keep in memory for this session */
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStats(itemId: string): ItemStats | undefined {
  return loadProgress().items[itemId];
}

export function recordResult(itemId: string, correct: boolean): void {
  const p = loadProgress();
  const prev = p.items[itemId] ?? { seen: 0, correct: 0, missed: 0, lastCorrect: false, lastSeen: 0, box: 0 };
  const next: ItemStats = {
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    missed: prev.missed + (correct ? 0 : 1),
    lastCorrect: correct,
    lastSeen: Date.now(),
    box: correct ? Math.min(prev.box + 1, 5) : 0,
  };
  save({ ...p, items: { ...p.items, [itemId]: next } });
}

/** Item ids whose most recent answer was wrong. */
export function missedItemIds(): Set<string> {
  const items = loadProgress().items;
  return new Set(Object.keys(items).filter((id) => !items[id].lastCorrect));
}

/** Days until an item in each Leitner box is due again. */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];

/** True if never seen or past its review interval. */
export function isDue(itemId: string, now = Date.now()): boolean {
  const s = getStats(itemId);
  if (!s) return true;
  return now - s.lastSeen >= BOX_INTERVAL_DAYS[s.box] * 86_400_000;
}

export function resetProgress(): void {
  save({ ...EMPTY, items: {} });
}

/** Opaque string she can copy to move progress to another device. */
export function exportProgress(): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(loadProgress()))));
}

/** Returns false if the code is invalid. Merges, keeping the most recent stats per item. */
export function importProgress(code: string): boolean {
  try {
    const incoming = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as Progress;
    if (incoming?.version !== 1 || typeof incoming.items !== "object") return false;
    const p = loadProgress();
    const items = { ...p.items };
    for (const [id, s] of Object.entries(incoming.items)) {
      if (!items[id] || s.lastSeen > items[id].lastSeen) items[id] = s;
    }
    save({ ...p, items });
    return true;
  } catch {
    return false;
  }
}
