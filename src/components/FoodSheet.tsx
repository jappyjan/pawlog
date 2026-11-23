import { useState } from "react";
import { useMutation } from "convex/react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { errorMessage } from "../lib/format";
import { KINDS, kindMeta, UNITS, unitLong, unitShort, type Food, type FoodKind, type FoodUnit } from "../lib/nutrition";
import { useTranslation } from "react-i18next";

export function FoodSheet({
  open,
  onClose,
  food,
  defaultKind,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  food?: Food;
  defaultKind?: FoodKind;
  onSaved?: (id: Id<"foods">, defaultQty?: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={food ? t("food.editTitle", { name: food.name }) : t("food.new")}>
      {open && <FoodForm key={food?._id ?? "new"} food={food} defaultKind={defaultKind} onDone={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function FoodForm({ food, defaultKind, onDone, onSaved }: { food?: Food; defaultKind?: FoodKind; onDone: () => void; onSaved?: (id: Id<"foods">, defaultQty?: number) => void }) {
  const create = useMutation(api.foods.create);
  const update = useMutation(api.foods.update);
  const setArchived = useMutation(api.foods.setArchived);
  const remove = useMutation(api.foods.remove);
  const toast = useToast();
  const { t } = useTranslation();
  const [kind, setKind] = useState<FoodKind>(food?.kind ?? defaultKind ?? "dry");
  const [unit, setUnit] = useState<FoodUnit>(food?.unit ?? (defaultKind === "treat" ? "piece" : "g"));
  const [busy, setBusy] = useState(false);
  const num = (v: FormDataEntryValue | null) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        // This form can sit inside the meal form (nested sheet); React would bubble submit to it.
        e.stopPropagation();
        const fd = new FormData(e.currentTarget);
        const fields = {
          name: String(fd.get("name") ?? ""),
          brand: String(fd.get("brand") ?? ""),
          kind,
          unit,
          kcalPer: num(fd.get("kcalPer")),
          defaultQty: num(fd.get("defaultQty")),
          notes: String(fd.get("notes") ?? ""),
        };
        setBusy(true);
        try {
          if (food) await update({ foodId: food._id, ...fields });
          const id = food?._id ?? (await create(fields));
          toast({ text: food ? t("common.saved") : t("food.added", { name: fields.name }) });
          onSaved?.(id, fields.defaultQty);
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label" htmlFor="f-name">{t("common.name")} *</label>
          <input id="f-name" name="name" className="input" defaultValue={food?.name} required autoFocus={!food} placeholder={t("food.namePh")} />
        </div>
        <div>
          <label className="label" htmlFor="f-brand">{t("food.brand")}</label>
          <input id="f-brand" name="brand" className="input" defaultValue={food?.brand} placeholder={t("common.optional")} />
        </div>
        <div>
          <label className="label" htmlFor="f-kind">{t("log.type")}</label>
          <select id="f-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as FoodKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{kindMeta(k).emoji} {kindMeta(k).label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">{t("food.measuredIn")}</legend>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`chip ${unit === u ? "chip-on" : ""}`}>
              {unitLong(u)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-kcal">{t("food.kcalPer", { unit: unit === "g" ? "100 g" : unitShort(unit) })}</label>
          <input id="f-kcal" name="kcalPer" inputMode="decimal" className="input" defaultValue={food?.kcalPer ?? ""} placeholder={t("common.optional")} />
        </div>
        <div>
          <label className="label" htmlFor="f-qty">{t("food.portion", { unit: unit === "g" ? "g" : unitLong(unit) })}</label>
          <input id="f-qty" name="defaultQty" inputMode="decimal" className="input" defaultValue={food?.defaultQty ?? ""} placeholder={t("common.optional")} />
        </div>
      </div>
      {unit === "g" && <p className="-mt-2 text-xs text-muted">{t("food.kcalHint")}</p>}

      <div>
        <label className="label" htmlFor="f-notes">{t("common.notes")}</label>
        <input id="f-notes" name="notes" className="input" defaultValue={food?.notes} placeholder={t("food.notesPh")} />
      </div>

      <div className="flex flex-wrap gap-2">
        {food && (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await setArchived({ foodId: food._id, archived: !food.archived });
                toast({ text: food.archived ? t("food.restored") : t("food.archivedToast") });
                onDone();
              }}
            >
              {food.archived ? <><ArchiveRestore className="size-4" /> {t("food.restore")}</> : <><Archive className="size-4" /> {t("food.archive")}</>}
            </button>
            <button
              type="button"
              className="btn-danger"
              aria-label={t("common.delete")}
              onClick={async () => {
                if (!confirm(t("food.deleteConfirm", { name: food.name }))) return;
                await remove({ foodId: food._id });
                onDone();
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{food ? t("common.save") : t("food.add")}</button>
      </div>
    </form>
  );
}
