import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "./app";
import { useToast } from "../components/Toast";
import { errorMessage } from "./format";
import { itemText, type MealItem } from "./nutrition";

/** Log a meal in one tap (saved meal or "same as last time"), with Undo/Edit in the toast. */
export function useLogMeal(onEdit?: (id: Id<"events">) => void) {
  const { dog } = useApp();
  const { t } = useTranslation();
  const toast = useToast();
  const log = useMutation(api.events.log);
  const remove = useMutation(api.events.remove);
  return async (m: { name?: string; items?: MealItem[]; kcal?: number | null }) => {
    try {
      const id = await log({ dogId: dog._id, type: "meal", mealKind: "meal", mealName: m.name, items: m.items });
      const what = m.name ?? m.items?.map(itemText).join(" + ");
      toast({
        text: [t("log.logged", { what: t("events.meal") }), what, m.kcal ? `${m.kcal} kcal` : null].filter(Boolean).join(" · "),
        actions: [
          { label: t("common.undo"), run: () => void remove({ eventId: id }) },
          ...(onEdit ? [{ label: m.items ? t("common.edit") : t("common.details"), run: () => onEdit(id) }] : []),
        ],
      });
      navigator.vibrate?.(15);
    } catch (e) {
      toast({ text: errorMessage(e), error: true });
    }
  };
}
