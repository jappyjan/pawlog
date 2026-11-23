import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { Doc } from "./_generated/dataModel";

type Rule = Pick<Doc<"reminders">, "dueAt" | "timezone" | "repeat" | "intervalDays">;

/** The first occurrence of a repeating rule strictly after `after`, or null for one-offs.
 *  Computed from the anchor (dueAt) in the reminder's own timezone so DST and
 *  month-end don't drift. */
export function nextOccurrence(rule: Rule, after: number): number | null {
  if (rule.repeat === "none") return null;
  const anchor = new TZDate(rule.dueAt, rule.timezone);
  const step = (n: number): Date => {
    switch (rule.repeat) {
      case "daily":
        return addDays(anchor, n);
      case "weekly":
        return addWeeks(anchor, n);
      case "monthly":
        return addMonths(anchor, n);
      case "yearly":
        return addYears(anchor, n);
      default: // "everyNDays"
        return addDays(anchor, n * Math.max(1, rule.intervalDays ?? 1));
    }
  };
  // Jump close first (cheap estimate), then walk forward.
  const approxDays = ({ daily: 1, weekly: 7, monthly: 31, yearly: 366, everyNDays: Math.max(1, rule.intervalDays ?? 1) } as const)[rule.repeat as Exclude<typeof rule.repeat, "none">];
  let n = Math.max(1, Math.floor((after - rule.dueAt) / (approxDays * 86_400_000)) - 1);
  for (let i = 0; i < 10_000; i++, n++) {
    const t = step(n).getTime();
    if (t > after) return t;
  }
  return null;
}
