import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { useApp } from "../lib/app";
import { errorMessage, tz } from "../lib/format";
import { NOTIFY_OPTIONS, notifyLabel, ROUTINE_TYPES, WEEK, weekdayShort, type Routine, type RoutineType } from "../lib/routines";

/**
 * Create or edit a daily routine and when the household gets pinged about it.
 * With `type` set (e.g. from the Food page) the type is fixed and not shown as a choice.
 */
export function RoutineSheet({ open, onClose, routine, type }: { open: boolean; onClose: () => void; routine?: Routine; type?: RoutineType }) {
  const { t } = useTranslation();
  const { dog } = useApp();
  const meals = useQuery(api.meals.list, open ? { dogId: dog._id } : "skip");
  return (
    <Sheet open={open} onClose={onClose} title={routine ? t("routines.editTitle") : t("routines.new")}>
      {open && meals !== undefined && <Form key={routine?._id ?? `new-${type}`} routine={routine} fixedType={routine?.type ?? type} meals={meals} onDone={onClose} />}
    </Sheet>
  );
}

function Form({ routine, fixedType, meals, onDone }: { routine?: Routine; fixedType?: RoutineType; meals: Doc<"meals">[]; onDone: () => void }) {
  const { t } = useTranslation();
  const { dog } = useApp();
  const toast = useToast();
  const create = useMutation(api.routines.create);
  const update = useMutation(api.routines.update);
  const remove = useMutation(api.routines.remove);
  const [type, setType] = useState<RoutineType>(fixedType ?? "meal");
  const [mealId, setMealId] = useState<string>(routine?.mealId ?? "");
  const [days, setDays] = useState<number[]>(routine?.days ?? WEEK);
  const [busy, setBusy] = useState(false);
  const notifyOptions =
    routine && !NOTIFY_OPTIONS.includes(routine.notifyBefore) ? [...NOTIFY_OPTIONS, routine.notifyBefore].sort((a, b) => a - b) : NOTIFY_OPTIONS;
  const showLabel = type !== "meal" || !mealId;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (days.length === 0) return toast({ text: t("routines.pickDay"), error: true });
        const fd = new FormData(e.currentTarget);
        const args = {
          type,
          time: String(fd.get("time") ?? ""),
          timezone: tz(),
          days: days.length === 7 ? undefined : days,
          notifyBefore: Number(fd.get("notifyBefore") ?? 0),
          mealId: type === "meal" && mealId ? (mealId as Id<"meals">) : undefined,
          label: showLabel ? String(fd.get("label") ?? "") : undefined,
        };
        setBusy(true);
        try {
          if (routine) await update({ routineId: routine._id, ...args });
          else await create({ dogId: dog._id, ...args });
          toast({ text: t("common.saved") });
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      {!fixedType && (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("routines.what")}>
          {ROUTINE_TYPES.map((r) => (
            <button
              key={r.type}
              type="button"
              role="radio"
              aria-checked={type === r.type}
              onClick={() => setType(r.type)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 px-1 py-3 text-sm font-semibold transition ${
                type === r.type ? "border-brand bg-brand-soft" : "border-line"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>{r.emoji}</span>
              <span className="max-w-full hyphens-auto break-words text-center leading-tight">{t(`routines.type.${r.type}`)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="rt-time">{t("routines.time")}</label>
          <input id="rt-time" name="time" type="time" className="input text-lg font-bold" defaultValue={routine?.time ?? "08:00"} required />
        </div>
        <div>
          <label className="label" htmlFor="rt-notify">{t("routines.notify")}</label>
          <select id="rt-notify" name="notifyBefore" className="input" defaultValue={routine?.notifyBefore ?? 15}>
            {notifyOptions.map((m) => (
              <option key={m} value={m}>{notifyLabel(t, m)}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">{t("routines.days")}</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEK.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                className={`rounded-xl border-2 py-2 text-sm font-semibold transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-muted"}`}
              >
                {weekdayShort(d)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {type === "meal" && (
        <div>
          <label className="label" htmlFor="rt-meal">{t("routines.meal")}</label>
          <select id="rt-meal" className="input" value={mealId} onChange={(e) => setMealId(e.target.value)}>
            <option value="">{t("routines.noMeal")}</option>
            {meals.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {showLabel && (
        <div>
          <label className="label" htmlFor="rt-label">
            {t("common.name")} {type !== "other" && <span className="font-normal text-muted">({t("common.optional")})</span>}
          </label>
          <input
            id="rt-label"
            name="label"
            className="input"
            defaultValue={routine?.label}
            placeholder={t(`routines.labelPh.${type}`)}
            required={type === "other"}
          />
        </div>
      )}

      <p className="text-xs text-muted">{type === "other" ? t("routines.hintOther") : t("routines.hint")}</p>

      <div className="flex gap-2">
        {routine && (
          <button
            type="button"
            className="btn-danger"
            aria-label={t("common.delete")}
            onClick={async () => {
              if (!confirm(t("routines.deleteConfirm", { time: routine.time }))) return;
              await remove({ routineId: routine._id });
              onDone();
            }}
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{routine ? t("common.save") : t("routines.add")}</button>
      </div>
    </form>
  );
}
