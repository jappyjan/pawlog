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
import { APPETITE, itemText, STOOL_COLORS, STOOL_FLAGS, stoolMeta, stoolScoreOf } from "./nutrition";

export type EventType = Doc<"events">["type"];

export const EVENT_META: Record<EventType, { label: string; icon: LucideIcon | null; emoji: string; tint: string }> = {
  walk: { label: "Walk", icon: Footprints, emoji: "🦮", tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pee: { label: "Pee", icon: Droplet, emoji: "💧", tint: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300" },
  poop: { label: "Poop", icon: null, emoji: "💩", tint: "bg-amber-700/15 text-amber-800 dark:text-amber-300" },
  meal: { label: "Meal", icon: Utensils, emoji: "🍖", tint: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  weight: { label: "Weight", icon: Scale, emoji: "⚖️", tint: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  medication: { label: "Medication", icon: Pill, emoji: "💊", tint: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  vet: { label: "Vet visit", icon: Stethoscope, emoji: "🩺", tint: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  symptom: { label: "Symptom", icon: Thermometer, emoji: "🤒", tint: "bg-red-500/15 text-red-700 dark:text-red-300" },
  note: { label: "Note", icon: NotebookPen, emoji: "📝", tint: "bg-stone-500/15 text-stone-700 dark:text-stone-300" },
};

export function EventIcon({ type, treat, className = "" }: { type: EventType; treat?: boolean; className?: string }) {
  const m = EVENT_META[type];
  const Icon = treat ? Bone : m.icon;
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${m.tint} ${className}`} aria-hidden>
      {Icon ? <Icon className="size-5" /> : <span className="text-lg leading-none">{m.emoji}</span>}
    </span>
  );
}

export function eventLabel(e: Doc<"events">) {
  return e.type === "meal" && e.mealKind === "treat" ? "Treat" : EVENT_META[e.type].label;
}

function stoolText(e: Doc<"events">) {
  const s = stoolMeta(stoolScoreOf(e));
  return [
    s && `${s.score} ${s.label.toLowerCase()}`,
    e.stoolColor && e.stoolColor !== "brown" && STOOL_COLORS.find((c) => c.id === e.stoolColor)?.label.toLowerCase(),
    ...(e.stoolFlags ?? []).map((f) => STOOL_FLAGS.find((x) => x.id === f)?.label.toLowerCase()),
  ]
    .filter(Boolean)
    .join(", ");
}

export function describe(e: Doc<"events">, medName?: (id: string) => string | undefined) {
  const parts: string[] = [];
  if (e.type === "walk") {
    if (e.durationMin) parts.push(`${e.durationMin} min`);
    if (e.distanceKm) parts.push(`${e.distanceKm} km`);
    if (e.pee) parts.push("💧 pee");
    if (e.poop) {
      const st = stoolText(e);
      parts.push(st ? `💩 ${st}` : "💩 poop");
    }
  }
  if (e.type === "poop") parts.push(stoolText(e));
  if (e.type === "meal") {
    if (e.items?.length) parts.push(e.items.map(itemText).join(" + "));
    if (e.kcal) parts.push(`${e.kcal} kcal`);
    if (e.appetite && e.appetite !== "all") parts.push(APPETITE.find((a) => a.id === e.appetite)!.label.toLowerCase());
  }
  if (e.type === "weight" && e.weightKg) parts.push(`${e.weightKg} kg`);
  if (e.type === "medication" && e.medicationId) parts.push(medName?.(e.medicationId) ?? "");
  if (e.amount) parts.push(e.amount);
  return parts.filter(Boolean).join(" · ");
}
