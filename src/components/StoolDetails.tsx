import { useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { STOOL_COLORS, STOOL_FLAGS, STOOL_SCORES, stoolMeta, stoolScoreOf, TONE, type StoolColor, type StoolFlag } from "../lib/nutrition";

export type Stool = { stoolScore?: number; stoolColor?: StoolColor; stoolFlags: StoolFlag[] };

export function useStool(e?: Doc<"events">) {
  return useState<Stool>({
    stoolScore: e ? stoolScoreOf(e) : undefined,
    stoolColor: e?.stoolColor,
    stoolFlags: e?.stoolFlags ?? [],
  });
}

/** Mutation args: send flags only when set, so an empty list doesn't get stored. */
export const stoolArgs = (s: Stool) => ({
  stoolScore: s.stoolScore,
  stoolColor: s.stoolColor,
  stoolFlags: s.stoolFlags.length ? s.stoolFlags : undefined,
});

/** Everything optional: tap a score, tap it again to clear it. */
export function StoolDetails({ value, onChange }: { value: Stool; onChange: (s: Stool) => void }) {
  const meta = stoolMeta(value.stoolScore);
  const extras = (value.stoolColor ? 1 : 0) + value.stoolFlags.length;
  return (
    <fieldset className="space-y-2">
      <legend className="label">Consistency <span className="font-normal text-muted">(optional)</span></legend>
      <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Fecal score 1 to 7">
        {STOOL_SCORES.map((s) => {
          const on = value.stoolScore === s.score;
          return (
            <button
              key={s.score}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${s.score}: ${s.hint}`}
              title={s.hint}
              onClick={() => onChange({ ...value, stoolScore: on ? undefined : s.score })}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 transition ${on ? "border-brand bg-brand-soft" : "border-line"}`}
            >
              <span className={`size-2.5 rounded-full ${TONE[s.tone]}`} aria-hidden />
              <span className="text-base font-extrabold leading-none tabular-nums">{s.score}</span>
              <span className="text-[10px] leading-none text-muted">{s.label}</span>
            </button>
          );
        })}
      </div>
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {meta ? meta.hint : "1 = hard · 2 = ideal · 7 = watery"}
      </p>

      <details className="group rounded-xl border border-line px-3 py-2" open={extras > 0 || undefined}>
        <summary className="cursor-pointer text-sm font-semibold">
          Color & signs{extras > 0 && <span className="ml-1 text-brand">· {extras}</span>}
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {STOOL_COLORS.map((c) => {
              const on = value.stoolColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ ...value, stoolColor: on ? undefined : c.id })}
                  className={`chip ${on ? "chip-on" : ""}`}
                >
                  <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.swatch }} aria-hidden /> {c.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {STOOL_FLAGS.map((f) => {
              const on = value.stoolFlags.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({ ...value, stoolFlags: on ? value.stoolFlags.filter((x) => x !== f.id) : [...value.stoolFlags, f.id] })
                  }
                  className={`chip ${on ? (f.warn ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300" : "chip-on") : ""}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </details>
    </fieldset>
  );
}
