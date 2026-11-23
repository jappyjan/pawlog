import type { Doc } from "../../convex/_generated/dataModel";
import i18n from "../i18n";

const t = i18n.t.bind(i18n);

export type Food = Doc<"foods">;
export type FoodUnit = Food["unit"];
export type FoodKind = Food["kind"];
export type MealItem = NonNullable<Doc<"events">["items"]>[number];
export type StoolColor = NonNullable<Doc<"events">["stoolColor"]>;
export type StoolFlag = NonNullable<Doc<"events">["stoolFlags"]>[number];
export type Appetite = NonNullable<Doc<"events">["appetite"]>;

/** Purina-style 1–7 fecal score. 2 is ideal. Labels: stool.score.N / stool.hint.N */
export const STOOL_SCORES = [
  { score: 1, tone: "amber" },
  { score: 2, tone: "green" },
  { score: 3, tone: "green" },
  { score: 4, tone: "yellow" },
  { score: 5, tone: "orange" },
  { score: 6, tone: "red" },
  { score: 7, tone: "red" },
] as const;
export type StoolScore = (typeof STOOL_SCORES)[number]["score"];

export const TONE: Record<(typeof STOOL_SCORES)[number]["tone"], string> = {
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

export const stoolMeta = (score?: number) => {
  const s = STOOL_SCORES.find((x) => x.score === score);
  return s && { ...s, label: t(`stool.score.s${s.score}`), hint: t(`stool.hint.s${s.score}`) };
};

export const STOOL_COLORS: { id: StoolColor; swatch: string }[] = [
  { id: "brown", swatch: "#7a4b25" },
  { id: "yellow", swatch: "#d9a521" },
  { id: "green", swatch: "#5f7d2c" },
  { id: "black", swatch: "#1d1b19" },
  { id: "red", swatch: "#b3261e" },
  { id: "grey", swatch: "#9a958e" },
];

export const STOOL_FLAGS: { id: StoolFlag; warn?: boolean }[] = [
  { id: "mucus" },
  { id: "blood", warn: true },
  { id: "worms", warn: true },
  { id: "straining" },
  { id: "foreign" },
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

export const UNITS: FoodUnit[] = ["g", "piece", "cup", "can", "scoop"];
export const unitShort = (u?: FoodUnit) => (u ? t(`food.unitShort.${u}`) : "");
export const unitLong = (u: FoodUnit) => t(`food.unit.${u}`);

const KIND_EMOJI: Record<FoodKind, string> = {
  dry: "🥣",
  wet: "🥫",
  raw: "🥩",
  fresh: "🍲",
  treat: "🦴",
  supplement: "🧂",
  other: "🍽️",
};
export const KINDS = Object.keys(KIND_EMOJI) as FoodKind[];
export const kindMeta = (k: FoodKind) => ({ id: k, emoji: KIND_EMOJI[k], label: t(`food.kind.${k}`) });

export const APPETITE: Appetite[] = ["all", "most", "some", "none"];

/** kcal for an amount of a food: kcalPer is per 100 g for grams, otherwise per unit. */
export function kcalFor(food: Pick<Food, "unit" | "kcalPer"> | undefined, qty: number | undefined) {
  if (!food?.kcalPer || qty === undefined || !Number.isFinite(qty)) return undefined;
  return Math.round(food.unit === "g" ? (qty * food.kcalPer) / 100 : qty * food.kcalPer);
}

export function itemText(i: MealItem) {
  const amt = i.qty !== undefined ? `${i.qty} ${unitShort(i.unit ?? "g")}` : "";
  return [i.name, amt].filter(Boolean).join(" ");
}

/** Calories for one day: meals + treats, counting only items with known kcal. */
export function kcalOf(events: Doc<"events">[]) {
  return events.reduce((s, e) => s + (e.type === "meal" ? (e.kcal ?? 0) : 0), 0);
}
