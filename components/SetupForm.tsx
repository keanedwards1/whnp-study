"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SECONDS_PER_QUESTION } from "@/components/ExamShell";
import { quizzableSections } from "@/lib/data";
import { modes } from "@/lib/modes";
import { randomSeed } from "@/lib/random";
import {
  exportProgress,
  importProgress,
  isDue,
  loadProgress,
  resetProgress,
  subscribe,
  type Progress,
} from "@/lib/progress";

const PREFS_KEY = "disorder-quiz-setup-v1";
const COUNTS = [10, 20, 50, 0] as const; // 0 = all
const EXAM_SIZES = [25, 50, 100, 175] as const;
const SERVER_PROGRESS: Progress = { version: 1, items: {} };

type Prefs = {
  sections: string[];
  mode: string;
  count: number;
  filter: "all" | "missed" | "due";
  examSize: number;
  hideStats: boolean;
};

export function SetupForm({ totalConditions }: { totalConditions: number }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>({
    sections: quizzableSections.map((s) => s.id),
    mode: modes[0].id,
    count: 20,
    filter: "all",
    examSize: 50,
    hideStats: false,
  });

  // Restore last setup (per-browser convenience only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Prefs | null;
      if (saved) {
        // Topics are deliberately not restored: every visit starts with all topics selected.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
        setPrefs((p) => ({
          ...p,
          ...saved,
          sections: p.sections,
          mode: modes.some((m) => m.id === saved.mode) ? saved.mode : p.mode,
        }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const progress = useSyncExternalStore(subscribe, loadProgress, () => SERVER_PROGRESS);
  const entries = Object.entries(progress.items);
  const seen = entries.reduce((n, [, s]) => n + s.seen, 0);
  const right = entries.reduce((n, [, s]) => n + s.correct, 0);
  const missedCount = entries.filter(([, s]) => !s.lastCorrect).length;
  const dueCount = entries.filter(([id]) => isDue(id)).length;
  const accuracy = seen ? Math.round((right / seen) * 100) : null;

  function update(p: Partial<Prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleSection(id: string) {
    update({
      sections: prefs.sections.includes(id) ? prefs.sections.filter((x) => x !== id) : [...prefs.sections, id],
    });
  }

  const allSelected = prefs.sections.length === quizzableSections.length;
  const sectionParam = allSelected ? "all" : prefs.sections.join(",");
  const selectedConditions = quizzableSections
    .filter((s) => prefs.sections.includes(s.id))
    .reduce((n, s) => n + s.rows.length, 0);
  const mode = modes.find((m) => m.id === prefs.mode) ?? modes[0];
  const minutes = Math.round((prefs.examSize * SECONDS_PER_QUESTION) / 60);

  function startQuiz() {
    const q = new URLSearchParams({
      mode: prefs.mode,
      s: sectionParam,
      n: String(prefs.count),
      filter: prefs.filter,
      seed: String(randomSeed()), // unique per start, so an earlier quiz page is never reused
    });
    router.push(`/quiz?${q}`);
  }

  function startExam() {
    router.push(`/exam?${new URLSearchParams({ s: sectionParam, n: String(prefs.examSize), seed: String(randomSeed()) })}`);
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="hero">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <h1 className="font-serif text-[2.1rem] font-semibold leading-[1.1] sm:text-5xl">WHNP Board Prep</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              {quizzableSections.length} topics, {totalConditions} conditions. Questions have three options (A, B, C),
              matching NCC WHNP-BC exam format.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button onClick={startExam} disabled={!prefs.sections.length} className="btn-hero disabled:opacity-50">
              Start practice exam
            </button>
            <Link href="/browse" className="btn-hero-ghost">
              Review study tables
            </Link>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column */}
        <div className="space-y-6">
          <section className="card">
            <h2 className="text-lg font-semibold">1 · Choose a quiz type</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {modes.map((m) => {
                const on = prefs.mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => update({ mode: m.id })}
                    aria-pressed={on}
                    className={`tile ${on ? "tile-on" : ""}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{m.name}</span>
                      <span className="check rounded-[2px]!" aria-hidden>
                        ✓
                      </span>
                    </span>
                    <span className="mt-1 text-sm leading-snug text-muted">{m.description}</span>
                    <span className="mt-3 inline-flex w-fit rounded-[2px] bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted ring-1 ring-line">
                      {m.id === "flashcard" ? "Self-graded" : "A · B · C"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHead
                title="2 · Pick your topics"
                sub={`${prefs.sections.length} of ${quizzableSections.length} selected · ${selectedConditions} conditions`}
              />
              <button
                className="link text-sm font-medium"
                onClick={() => update({ sections: allSelected ? [] : quizzableSections.map((s) => s.id) })}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {quizzableSections.map((s) => {
                const on = prefs.sections.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSection(s.id)}
                    aria-pressed={on}
                    className={`tile flex-row! items-center gap-3 p-3! ${on ? "tile-on" : ""}`}
                  >
                    <span className="check" aria-hidden>
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{s.title}</span>
                      <span className="block text-xs text-muted">{s.rows.length} conditions</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column */}
        <aside className="space-y-6 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)]">
          <section className="card space-y-5">
            <div>
              <p className="eyebrow">Your session</p>
              <h2 className="mt-1 font-serif text-xl font-semibold">{mode.name}</h2>
            </div>

            <Field label="Number of questions">
              <div className="flex flex-wrap gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ count: c })}
                    aria-pressed={prefs.count === c}
                    className={`chip ${prefs.count === c ? "chip-on" : ""}`}
                  >
                    {c || "All"}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Which questions">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Everything"],
                    ["missed", `Missed (${missedCount})`],
                    ["due", "Due for review"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => update({ filter: v })}
                    aria-pressed={prefs.filter === v}
                    className={`chip ${prefs.filter === v ? "chip-on" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <button onClick={startQuiz} disabled={!prefs.sections.length} className="btn-primary w-full min-h-12! text-base">
              Start quiz
            </button>
          </section>

          <section className="card space-y-4">
            <div>
              <p className="eyebrow">Timed</p>
              <h2 className="mt-1 font-serif text-xl font-semibold">Practice exam</h2>
              <p className="mt-1 text-sm leading-snug text-muted">
                The real exam has 175 questions in 3 hours; time here scales with length. Answers are shown at the end.
              </p>
            </div>
            <Field label="Length">
              <div className="flex flex-wrap items-center gap-2">
                {EXAM_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => update({ examSize: size })}
                    aria-pressed={prefs.examSize === size}
                    className={`chip ${prefs.examSize === size ? "chip-on" : ""}`}
                  >
                    {size}
                  </button>
                ))}
                <span className="text-sm text-muted">≈ {minutes} min</span>
              </div>
            </Field>
            <button onClick={startExam} disabled={!prefs.sections.length} className="btn-secondary w-full">
              Start practice exam
            </button>
          </section>

          <ProgressTools answered={entries.length} />
        </aside>
      </div>

      {/* Progress (bottom, collapsible) */}
      <section aria-label="Your progress" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Progress</h2>
          <button
            className="btn-secondary min-h-9! px-3! text-sm!"
            aria-expanded={!prefs.hideStats}
            onClick={() => update({ hideStats: !prefs.hideStats })}
          >
            {prefs.hideStats ? "Show" : "Hide"}
          </button>
        </div>
        {!prefs.hideStats && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Questions answered" value={entries.length ? String(entries.length) : "—"} hint="unique questions" />
            <Stat
              label="Accuracy"
              value={accuracy === null ? "—" : `${accuracy}%`}
              hint={seen ? `${right} of ${seen} answers` : "no answers yet"}
              tone={accuracy !== null && accuracy < 70 ? "miss" : "hit"}
            />
            <Stat label="Missed" value={entries.length ? String(missedCount) : "—"} hint="last answer incorrect" tone="miss" />
            <Stat label="Due for review" value={entries.length ? String(dueCount) : "—"} hint="past review interval" />
          </div>
        )}
      </section>

      {/* Phones/tablets: the session card sits below the topic list, so keep Start in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <p className="truncate font-semibold">{mode.name}</p>
            <p className="truncate text-muted">
              {prefs.count || "All"} questions · {prefs.sections.length} topics
            </p>
          </div>
          <button onClick={startQuiz} disabled={!prefs.sections.length} className="btn-primary shrink-0">
            Start quiz
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "hit" | "miss";
}) {
  return (
    <div className="stat">
      <p className="eyebrow">{label}</p>
      <p className={`stat-num mt-1 ${value === "—" ? "text-muted" : tone === "miss" ? "text-miss" : tone === "hit" ? "text-hit" : ""}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{sub}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function ProgressTools({ answered }: { answered: number }) {
  const [msg, setMsg] = useState("");
  return (
    <details className="card p-4! text-sm sm:p-5!">
      <summary className="cursor-pointer font-medium">Save or move your progress ({answered} answered)</summary>
      <p className="mt-3 text-muted">
        Progress is saved in this browser only. To use another device, copy the code here and paste it there.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn-secondary min-h-10! px-3! text-sm!"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(exportProgress());
              setMsg("Progress code copied.");
            } catch {
              setMsg("Couldn't copy. Clipboard access is blocked.");
            }
          }}
        >
          Copy progress code
        </button>
        <button
          className="btn-secondary min-h-10! px-3! text-sm!"
          onClick={() => {
            const code = prompt("Paste a progress code:");
            if (code) setMsg(importProgress(code) ? "Progress imported." : "That code didn't work.");
          }}
        >
          Import code
        </button>
        <button
          className="btn-secondary min-h-10! px-3! text-sm!"
          onClick={() => {
            if (confirm("Erase all saved progress in this browser?")) {
              resetProgress();
              setMsg("Progress reset.");
            }
          }}
        >
          Reset
        </button>
      </div>
      {msg && <p className="mt-2 text-muted">{msg}</p>}
    </details>
  );
}
