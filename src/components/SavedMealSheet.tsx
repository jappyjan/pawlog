import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { mealArgs, mealFromItems, MealFields } from "./MealFields";
import { useApp } from "../lib/app";
import { errorMessage } from "../lib/format";

/** Create or edit a saved meal like "Breakfast" = 120 g kibble + 1 scoop topper. */
export function SavedMealSheet({ open, onClose, meal }: { open: boolean; onClose: () => void; meal?: Doc<"meals"> }) {
  const { t } = useTranslation();
  const foods = useQuery(api.foods.list, open ? {} : "skip");
  return (
    <Sheet open={open} onClose={onClose} title={meal ? t("meals.editTitle", { name: meal.name }) : t("meals.new")}>
      {open && foods !== undefined && <Form key={meal?._id ?? "new"} meal={meal} foods={foods} onDone={onClose} />}
    </Sheet>
  );
}

function Form({ meal, foods, onDone }: { meal?: Doc<"meals">; foods: Doc<"foods">[]; onDone: () => void }) {
  const { t } = useTranslation();
  const { dog } = useApp();
  const toast = useToast();
  const create = useMutation(api.meals.create);
  const update = useMutation(api.meals.update);
  const remove = useMutation(api.meals.remove);
  const [value, setValue] = useState(() => mealFromItems(meal?.items, foods));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = String(new FormData(e.currentTarget).get("name") ?? "");
        const { items } = mealArgs(value, foods);
        setBusy(true);
        try {
          if (meal) await update({ mealId: meal._id, name, items });
          else await create({ dogId: dog._id, name, items });
          toast({ text: t("common.saved") });
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="sm-name">{t("common.name")} *</label>
        <input id="sm-name" name="name" className="input" defaultValue={meal?.name} placeholder={t("meals.namePh")} required autoFocus={!meal} />
      </div>
      <MealFields value={value} onChange={setValue} dogFood={dog.food} preset />
      <div className="flex gap-2">
        {meal && (
          <button
            type="button"
            className="btn-danger"
            aria-label={t("common.delete")}
            onClick={async () => {
              if (!confirm(t("meals.deleteConfirm", { name: meal.name }))) return;
              await remove({ mealId: meal._id });
              onDone();
            }}
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{meal ? t("common.save") : t("meals.add")}</button>
      </div>
    </form>
  );
}
