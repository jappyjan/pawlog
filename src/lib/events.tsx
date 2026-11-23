import {
  Bone,
  Droplet,
  Footprints,
  NotebookPen,
  Pill,
  Scale,
  Stethoscope,
  Thermometer,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { itemText, stoolScoreOf } from "./nutrition";
import i18n from "../i18n";

const t = i18n.t.bind(i18n);

export type EventType = Doc<"events">["type"];

export const EVENT_META: Record<EventType, { icon: LucideIcon | null; emoji: string; tint: string }> = {
  walk: { icon: Footprints, emoji: "🦮", tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pee: { icon: Droplet, emoji: "💧", tint: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300" },
  poop: { icon: null, emoji: "💩", tint: "bg-amber-700/15 text-amber-800 dark:text-amber-300" },
  meal: { icon: Utensils, emoji: "🍖", tint: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  weight: { icon: Scale, emoji: "⚖️", tint: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  medication: { icon: Pill, emoji: "💊", tint: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  vet: { icon: Stethoscope, emoji: "🩺", tint: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  symptom: { icon: Thermometer, emoji: "🤒", tint: "bg-red-500/15 text-red-700 dark:text-red-300" },
  note: { icon: NotebookPen, emoji: "📝", tint: "bg-stone-500/15 text-stone-700 dark:text-stone-300" },
};

export function EventIcon({ type, treat, large, className = "" }: { type: EventType; treat?: boolean; large?: boolean; className?: string }) {
  const m = EVENT_META[type];
  const Icon = treat ? Bone : m.icon;
  return (
    <span className={`grid shrink-0 place-items-center ${large ? "size-12 rounded-2xl" : "size-10 rounded-xl"} ${m.tint} ${className}`} aria-hidden>
      {Icon ? <Icon className={large ? "size-6" : "size-5"} /> : <span className={`${large ? "text-2xl" : "text-lg"} leading-none`}>{m.emoji}</span>}
    </span>
  );
}

export const eventTypeLabel = (type: EventType) => t(`events.${type}`);

export function eventLabel(e: Doc<"events">) {
  return e.type === "meal" && e.mealKind === "treat" ? t("events.treat") : eventTypeLabel(e.type);
}

function stoolText(e: Doc<"events">) {
  const s = stoolScoreOf(e);
  return [
    s && `${s} ${t(`stool.score.s${s as 1}`).toLowerCase()}`,
    e.stoolColor && e.stoolColor !== "brown" && t(`stool.color.${e.stoolColor}`).toLowerCase(),
    ...(e.stoolFlags ?? []).map((f) => t(`stool.flag.${f}`).toLowerCase()),
  ]
    .filter(Boolean)
    .join(", ");
}

export function describe(e: Doc<"events">, medName?: (id: string) => string | undefined) {
  const parts: string[] = [];
  if (e.type === "walk") {
    if (e.durationMin) parts.push(`${e.durationMin} min`);
    if (e.distanceKm) parts.push(`${e.distanceKm} km`);
    if (e.pee) parts.push(`💧 ${t("events.pee").toLowerCase()}`);
    if (e.poop) {
      const st = stoolText(e);
      parts.push(`💩 ${st || t("events.poop").toLowerCase()}`);
    }
  }
  if (e.type === "poop") parts.push(stoolText(e));
  if (e.type === "meal") {
    if (e.mealName) parts.push(e.mealName);
    else if (e.items?.length) parts.push(e.items.map(itemText).join(" + "));
    if (e.kcal) parts.push(`${e.kcal} kcal`);
    if (e.appetite && e.appetite !== "all") parts.push(t(`meal.appetite.${e.appetite}`).toLowerCase());
  }
  if (e.type === "weight" && e.weightKg) parts.push(`${e.weightKg} kg`);
  if (e.type === "medication" && e.medicationId) parts.push(medName?.(e.medicationId) ?? "");
  if (e.amount) parts.push(e.amount);
  return parts.filter(Boolean).join(" · ");
}
