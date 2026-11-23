import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { FoodSheet } from "./FoodSheet";
import { APPETITE, kcalFor, kindMeta, unitShort, type Appetite, type Food, type MealItem } from "../lib/nutrition";
import { useTranslation } from "react-i18next";

type Row = { key: number; foodId: string; name: string; qty: string; kcal: string };
export type Meal = { mealKind: "meal" | "treat"; rows: Row[]; appetite?: Appetite };

let nextKey = 1;
const fmt = (n?: number) => (n === undefined ? "" : String(n));
export const toRow = (i: MealItem): Row => ({ key: nextKey++, foodId: i.foodId ?? "", name: i.foodId ? "" : i.name, qty: fmt(i.qty), kcal: fmt(i.kcal) });
const emptyRow = (food?: Food): Row => ({ key: nextKey++, foodId: food?._id ?? "", name: "", qty: fmt(food?.defaultQty), kcal: "" });
const parse = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/** Initial state: the event being edited, else a repeat of the last meal, else one empty row. */
export function initialMeal(
  event: Doc<"events"> | undefined,
  last: { items: MealItem[] } | null | undefined,
  foods: Food[] | undefined,
  treat?: boolean,
): Meal {
  if (event) return { mealKind: event.mealKind ?? "meal", rows: event.items?.length ? event.items.map(toRow) : [emptyRow()], appetite: event.appetite };
  const first = foods?.find((f) => !f.archived && (f.kind === "treat") === !!treat);
  if (treat) return { mealKind: "treat", rows: [emptyRow(first)] };
  return { mealKind: "meal", rows: last?.items.length ? last.items.map(toRow) : [emptyRow(first)] };
}

function autoKcal(r: Row, foods: Food[] | undefined) {
  return kcalFor(foods?.find((f) => f._id === r.foodId), parse(r.qty));
}

/** Mutation args from form state; rows with neither a food nor a name are dropped. */
export function mealArgs(m: Meal, foods: Food[] | undefined) {
  const items: MealItem[] = [];
  for (const r of m.rows) {
    const food = foods?.find((f) => f._id === r.foodId);
    const name = food?.name ?? r.name.trim();
    if (!name) continue;
    const qty = parse(r.qty);
    items.push({
      foodId: food?._id,
      name,
      qty,
      unit: qty === undefined ? undefined : (food?.unit ?? "g"),
      kcal: parse(r.kcal) ?? autoKcal(r, foods),
    });
  }
  return { mealKind: m.mealKind, items, appetite: m.appetite };
}

/** Form state for editing a saved meal's foods. */
export const mealFromItems = (items: MealItem[] | undefined, foods?: Food[]): Meal => ({
  mealKind: "meal",
  rows: items?.length ? items.map(toRow) : [emptyRow(foods?.find((f) => !f.archived && f.kind !== "treat"))],
});

export function MealFields({
  value,
  onChange,
  dogFood,
  preset,
}: {
  value: Meal;
  onChange: (m: Meal) => void;
  dogFood?: string;
  /** Editing a saved meal: no meal/treat switch, no appetite. */
  preset?: boolean;
}) {
  const { t } = useTranslation();
  const foods = useQuery(api.foods.list);
  const [newFor, setNewFor] = useState<number | null>(null);
  const active = foods?.filter((f) => !f.archived) ?? [];
  const isTreat = value.mealKind === "treat";
  const sorted = [...active].sort((a, b) => Number((a.kind === "treat") !== isTreat) - Number((b.kind === "treat") !== isTreat));
  const setRow = (key: number, patch: Partial<Row>) => onChange({ ...value, rows: value.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  const total = value.rows.reduce((s, r) => s + (parse(r.kcal) ?? autoKcal(r, foods) ?? 0), 0);

  return (
    <div className="space-y-4">
      {!preset && <div className="grid grid-cols-2 rounded-xl bg-bg p-1" role="radiogroup" aria-label={t("meal.kindLabel")}>
        {(["meal", "treat"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value.mealKind === k}
            onClick={() => {
              if (k === value.mealKind) return;
              const pristine = value.rows.every((r) => !r.name && !r.kcal);
              const first = active.find((f) => (f.kind === "treat") === (k === "treat"));
              onChange({ ...value, mealKind: k, rows: pristine ? [emptyRow(first)] : value.rows });
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${value.mealKind === k ? "bg-card shadow-sm" : "text-muted"}`}
          >
            {k === "meal" ? `🍖 ${t("events.meal")}` : `🦴 ${t("meal.treatSnack")}`}
          </button>
        ))}
      </div>}

      <fieldset className="space-y-2">
        <legend className="label">{isTreat ? t("meal.whatTreat") : t("meal.whatFood")} {!preset && <span className="font-normal text-muted">({t("common.optional")})</span>}</legend>
        {value.rows.map((r) => {
          const food = foods?.find((f) => f._id === r.foodId);
          const auto = autoKcal(r, foods);
          return (
            <div key={r.key} className="space-y-2 rounded-xl border border-line p-2.5">
              <div className="flex gap-2">
                <select
                  className="input min-w-0 flex-1"
                  aria-label={t("meal.food")}
                  value={r.foodId}
                  onChange={(e) => {
                    if (e.target.value === "__new") return setNewFor(r.key);
                    const f = foods?.find((x) => x._id === e.target.value);
                    setRow(r.key, { foodId: e.target.value, kcal: "", qty: r.qty || fmt(f?.defaultQty) });
                  }}
                >
                  <option value="">{t("meal.otherFood")}</option>
                  {sorted.map((f) => (
                    <option key={f._id} value={f._id}>
                      {kindMeta(f.kind).emoji} {f.name}{f.brand ? ` · ${f.brand}` : ""}
                    </option>
                  ))}
                  <option value="__new">＋ {t("food.new")}…</option>
                </select>
                {value.rows.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost size-11 shrink-0 p-0"
                    aria-label={t("meal.removeItem")}
                    onClick={() => onChange({ ...value, rows: value.rows.filter((x) => x.key !== r.key) })}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {!food && (
                <input
                  className="input"
                  aria-label={t("meal.foodName")}
                  value={r.name}
                  onChange={(e) => setRow(r.key, { name: e.target.value })}
                  placeholder={isTreat ? t("meal.treatPh") : dogFood || t("meal.foodPh")}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="relative block">
                  <span className="sr-only">{t("meal.amount")}</span>
                  <input
                    className="input pr-14"
                    inputMode="decimal"
                    value={r.qty}
                    onChange={(e) => setRow(r.key, { qty: e.target.value })}
                    placeholder={t("meal.amount")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">{unitShort(food?.unit ?? "g")}</span>
                </label>
                <label className="relative block">
                  <span className="sr-only">{t("meal.calories")}</span>
                  <input
                    className="input pr-12"
                    inputMode="numeric"
                    value={r.kcal}
                    onChange={(e) => setRow(r.key, { kcal: e.target.value })}
                    placeholder={auto !== undefined ? String(auto) : "kcal"}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">kcal</span>
                </label>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between">
          <button type="button" className="btn-ghost -ml-2 text-sm" onClick={() => onChange({ ...value, rows: [...value.rows, emptyRow()] })}>
            <Plus className="size-4" /> {isTreat ? t("meal.addAnother") : t("meal.addFood")}
          </button>
          {total > 0 && <span className="text-sm font-semibold tabular-nums">≈ {Math.round(total)} kcal</span>}
        </div>
        {foods?.length === 0 && <p className="text-xs text-muted">{t("meal.tip")}</p>}
      </fieldset>

      {!preset && (
        <fieldset>
          <legend className="label">{t("meal.appetiteLabel")} <span className="font-normal text-muted">({t("common.optional")})</span></legend>
          <div className="flex flex-wrap gap-2">
            {APPETITE.map((a) => {
              const on = value.appetite === a;
              return (
                <button key={a} type="button" aria-pressed={on} onClick={() => onChange({ ...value, appetite: on ? undefined : a })} className={`chip ${on ? "chip-on" : ""}`}>
                  {t(`meal.appetite.${a}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <FoodSheet
        open={newFor !== null}
        onClose={() => setNewFor(null)}
        defaultKind={isTreat ? "treat" : "dry"}
        onSaved={(id: Id<"foods">, defaultQty?: number) => {
          const row = value.rows.find((r) => r.key === newFor);
          if (row) setRow(row.key, { foodId: id, name: "", kcal: "", qty: row.qty || fmt(defaultQty) });
        }}
      />
    </div>
  );
}
