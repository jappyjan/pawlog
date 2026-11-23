import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { FoodSheet } from "../components/FoodSheet";
import { SavedMealSheet } from "../components/SavedMealSheet";
import { RoutineList } from "../components/RoutineList";
import { itemText, kindMeta, unitShort, type Food } from "../lib/nutrition";
import { useLogMeal } from "../lib/useLogMeal";

/** Saved meals + the food list, managed without opening the log sheet. */
export function FoodPage() {
  const { dog } = useApp();
  const { t } = useTranslation();
  const meals = useQuery(api.meals.list, { dogId: dog._id });
  const foods = useQuery(api.foods.list);
  const logMeal = useLogMeal();
  const [mealSheet, setMealSheet] = useState<{ meal?: Doc<"meals"> } | null>(null);
  const [foodSheet, setFoodSheet] = useState<{ food?: Food } | null>(null);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("foodPage.title")}</h1>

      <section className="card p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("foodPage.meals", { name: dog.name })}</h2>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setMealSheet({})}>
            <Plus className="size-4" /> {t("meals.new")}
          </button>
        </div>
        {meals?.length === 0 && <p className="text-sm text-muted">{t("foodPage.mealsEmpty")}</p>}
        <ul className="divide-y divide-line">
          {meals?.map((m) => (
            <li key={m._id} className="flex items-center gap-2 py-2.5">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMealSheet({ meal: m })}>
                <span className="block truncate font-semibold">{m.name}</span>
                <span className="block text-sm text-muted">
                  {m.items.map(itemText).join(" + ")}
                  {m.kcal ? ` · ${m.kcal} kcal` : ""}
                </span>
              </button>
              <button type="button" className="btn-primary py-2" onClick={() => void logMeal({ name: m.name, items: m.items, kcal: m.kcal })}>
                {t("foodPage.logNow")}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          {dog.kcalGoalPerDay ? t("foodPage.goal", { kcal: dog.kcalGoalPerDay.toLocaleString() }) : t("foodPage.noGoal")}{" "}
          <Link to="/dog" className="font-semibold text-brand">{t("foodPage.setGoal")}</Link>
        </p>
      </section>

      <RoutineList type="meal" title={t("routines.feedingTitle")} empty={t("routines.feedingEmpty", { name: dog.name })} />

      <section className="card p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("foodPage.foods")}</h2>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setFoodSheet({})}>
            <Plus className="size-4" /> {t("food.add")}
          </button>
        </div>
        {foods?.length === 0 && <p className="text-sm text-muted">{t("foodPage.foodsEmpty")}</p>}
        <ul className="divide-y divide-line">
          {[...(foods ?? [])].map((f) => (
            <li key={f._id}>
              <button type="button" className={`flex w-full items-center gap-3 py-2.5 text-left ${f.archived ? "opacity-50" : ""}`} onClick={() => setFoodSheet({ food: f })}>
                <span className="text-xl" aria-hidden>{kindMeta(f.kind).emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.name}{f.brand && <span className="font-normal text-muted"> · {f.brand}</span>}</span>
                  <span className="block text-sm text-muted">
                    {[
                      f.kcalPer !== undefined && t("food.kcalPerShort", { kcal: f.kcalPer, unit: f.unit === "g" ? "100 g" : unitShort(f.unit) }),
                      f.defaultQty !== undefined && t("food.portionShort", { qty: f.defaultQty, unit: unitShort(f.unit) }),
                      f.archived && t("food.archived"),
                    ]
                      .filter(Boolean)
                      .join(" · ") || kindMeta(f.kind).label}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <SavedMealSheet open={mealSheet !== null} onClose={() => setMealSheet(null)} meal={mealSheet?.meal} />
      <FoodSheet open={foodSheet !== null} onClose={() => setFoodSheet(null)} food={foodSheet?.food} />
    </div>
  );
}
