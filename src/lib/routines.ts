import type { TFunction } from "i18next";
import i18n from "../i18n";
import type { Doc } from "../../convex/_generated/dataModel";

export type Routine = Doc<"routines">;
export type RoutineType = Routine["type"];

export const ROUTINE_TYPES: { type: RoutineType; emoji: string }[] = [
  { type: "meal", emoji: "🍖" },
  { type: "walk", emoji: "🦮" },
  { type: "potty", emoji: "💧" },
  { type: "other", emoji: "⏰" },
];
export const routineEmoji = (type: RoutineType) => ROUTINE_TYPES.find((r) => r.type === type)?.emoji ?? "⏰";

export const NOTIFY_OPTIONS = [0, 5, 10, 15, 30, 45, 60, 90, 120];

/** "On time", "30 min before", "1 hour before", … */
export function notifyLabel(t: TFunction, minutes: number) {
  if (minutes === 0) return t("routines.atTime");
  if (minutes % 60 === 0) return t("routines.hBefore", { count: minutes / 60 });
  if (minutes > 60) return t("routines.hMinBefore", { h: Math.floor(minutes / 60), m: minutes % 60 });
  return t("routines.minBefore", { m: minutes });
}

/** Weekdays Monday first, as JS day numbers (0 = Sunday). */
export const WEEK = [1, 2, 3, 4, 5, 6, 0];
export const weekdayShort = (day: number) =>
  new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(new Date(2024, 0, 7 + day)); // 2024-01-07 was a Sunday

/** "Every day", "Weekdays", "Weekends" or "Mon, Wed, Fri". */
export function daysLabel(t: TFunction, days?: number[]) {
  if (!days?.length || days.length === 7) return t("routines.everyDay");
  const key = [...days].sort().join();
  if (key === "1,2,3,4,5") return t("routines.weekdays");
  if (key === "0,6") return t("routines.weekends");
  return WEEK.filter((d) => days.includes(d)).map(weekdayShort).join(", ");
}

/** What the routine is called: its saved meal, its own label, or the type's name. */
export function routineName(t: TFunction, r: Routine, mealName?: string) {
  return mealName ?? r.label ?? t(`routines.type.${r.type}`);
}
