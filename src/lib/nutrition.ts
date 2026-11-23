import type { Doc } from "../../convex/_generated/dataModel";

export type Food = Doc<"foods">;
export type FoodUnit = Food["unit"];
export type FoodKind = Food["kind"];
export type MealItem = NonNullable<Doc<"events">["items"]>[number];
export type StoolColor = NonNullable<Doc<"events">["stoolColor"]>;
export type StoolFlag = NonNullable<Doc<"events">["stoolFlags"]>[number];
export type Appetite = NonNullable<Doc<"events">["appetite"]>;

/** Purina-style 1–7 fecal score. 2 is ideal. */
export const STOOL_SCORES = [
  { score: 1, label: "Hard", hint: "Hard, dry pellets", tone: "amber" },
  { score: 2, label: "Firm", hint: "Firm, segmented, easy to pick up (ideal)", tone: "green" },
  { score: 3, label: "Moist", hint: "Log-shaped, moist surface, holds shape", tone: "green" },
  { score: 4, label: "Soggy", hint: "Very moist, loses shape when picked up", tone: "yellow" },
  { score: 5, label: "Piles", hint: "Very moist piles, some shape", tone: "orange" },
  { score: 6, label: "Mushy", hint: "Texture but no shape", tone: "red" },
  { score: 7, label: "Watery", hint: "Watery, no texture", tone: "red" },
] as const;

export const TONE: Record<(typeof STOOL_SCORES)[number]["tone"], string> = {
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

export const stoolMeta = (score?: number) => STOOL_SCORES.find((s) => s.score === score);

export const STOOL_COLORS: { id: StoolColor; label: string; swatch: string }[] = [
  { id: "brown", label: "Brown", swatch: "#7a4b25" },
  { id: "yellow", label: "Yellow", swatch: "#d9a521" },
  { id: "green", label: "Green", swatch: "#5f7d2c" },
  { id: "black", label: "Black / tarry", swatch: "#1d1b19" },
  { id: "red", label: "Red streaks", swatch: "#b3261e" },
  { id: "grey", label: "Grey / greasy", swatch: "#9a958e" },
];

export const STOOL_FLAGS: { id: StoolFlag; label: string; warn?: boolean }[] = [
  { id: "mucus", label: "Mucus" },
  { id: "blood", label: "Blood", warn: true },
  { id: "worms", label: "Worms", warn: true },
  { id: "straining", label: "Straining" },
  { id: "foreign", label: "Foreign object" },
];

const LEGACY_QUALITY = { hard: 1, normal: 2, soft: 4, diarrhea: 7 } as const;

/** Score for an event, falling back to the old 4-step quality field. */
export function stoolScoreOf(e: Pick<Doc<"events">, "stoolScore" | "poopQuality">) {
  return e.stoolScore ?? (e.poopQuality ? LEGACY_QUALITY[e.poopQuality] : undefined);
}

/** Things worth a vet's attention: very loose, black, red, blood or worms. */
export function stoolWarning(e: Doc<"events">) {
  const s = stoolScoreOf(e);
  return (
    (s !== undefined && s >= 6) ||
    e.stoolColor === "black" ||
    e.stoolColor === "red" ||
    !!e.stoolFlags?.some((f) => STOOL_FLAGS.find((x) => x.id === f)?.warn)
  );
}

export const UNITS: { id: FoodUnit; label: string; short: string }[] = [
  { id: "g", label: "grams", short: "g" },
  { id: "piece", label: "pieces", short: "pc" },
  { id: "cup", label: "cups", short: "cup" },
  { id: "can", label: "cans", short: "can" },
  { id: "scoop", label: "scoops", short: "scoop" },
];
export const unitShort = (u?: FoodUnit) => UNITS.find((x) => x.id === u)?.short ?? "";

export const KINDS: { id: FoodKind; label: string; emoji: string }[] = [
  { id: "dry", label: "Dry / kibble", emoji: "🥣" },
  { id: "wet", label: "Wet / canned", emoji: "🥫" },
  { id: "raw", label: "Raw / BARF", emoji: "🥩" },
  { id: "fresh", label: "Fresh / home-cooked", emoji: "🍲" },
  { id: "treat", label: "Treat / chew", emoji: "🦴" },
  { id: "supplement", label: "Supplement / topper", emoji: "🧂" },
  { id: "other", label: "Other", emoji: "🍽️" },
];
export const kindMeta = (k: FoodKind) => KINDS.find((x) => x.id === k)!;

export const APPETITE: { id: Appetite; label: string }[] = [
  { id: "all", label: "Ate all" },
  { id: "most", label: "Most" },
  { id: "some", label: "A little" },
  { id: "none", label: "Refused" },
];

/** kcal for an amount of a food: kcalPer is per 100 g for grams, otherwise per unit. */
export function kcalFor(food: Pick<Food, "unit" | "kcalPer"> | undefined, qty: number | undefined) {
  if (!food?.kcalPer || qty === undefined || !Number.isFinite(qty)) return undefined;
  return Math.round(food.unit === "g" ? (qty * food.kcalPer) / 100 : qty * food.kcalPer);
}

export function itemText(i: MealItem) {
  const amt = i.qty !== undefined ? `${i.qty}${i.unit === "g" ? " g" : ` ${unitShort(i.unit)}`}` : "";
  return [i.name, amt].filter(Boolean).join(" ");
}

/** Calories for one day: meals + treats, counting only items with known kcal. */
export function kcalOf(events: Doc<"events">[]) {
  return events.reduce((s, e) => s + (e.type === "meal" ? (e.kcal ?? 0) : 0), 0);
}
