import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bell, BellOff, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { daysLabel, notifyLabel, routineEmoji, routineName, timesOf, type Routine, type RoutineType } from "../lib/routines";
import { RoutineSheet } from "./RoutineSheet";
import { PushCard } from "./PushCard";

/** The dog's daily routines as a card. With `type`, only that kind (and new ones get it). */
export function RoutineList({ type, title, empty, pushHint = true }: { type?: RoutineType; title: string; empty: string; pushHint?: boolean }) {
  const { dog } = useApp();
  const { t } = useTranslation();
  const all = useQuery(api.routines.list, { dogId: dog._id });
  const meals = useQuery(api.meals.list, { dogId: dog._id });
  const setEnabled = useMutation(api.routines.setEnabled);
  const [sheet, setSheet] = useState<{ routine?: Routine } | null>(null);
  const routines = type ? all?.filter((r) => r.type === type) : all;
  const mealName = (id?: string) => meals?.find((m) => m._id === id)?.name;

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="min-w-0 hyphens-auto break-words font-bold">{title}</h2>
        <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setSheet({})}>
          <Plus className="size-4" /> {t("routines.addShort")}
        </button>
      </div>
      {routines?.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <ul className="divide-y divide-line">
        {routines?.map((r) => (
          <li key={r._id} className={`flex items-center gap-2 py-2.5 ${r.enabled ? "" : "opacity-60"}`}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSheet({ routine: r })}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {!type && <span aria-hidden>{routineEmoji(r.type)} </span>}
                  {routineName(t, r, mealName(r.mealId))}
                </span>
                <span className="flex flex-wrap gap-1 py-0.5">
                  {timesOf(r).map((time) => (
                    <span key={time} className="rounded-md bg-brand-soft px-1.5 text-sm font-bold tabular-nums text-brand-ink">{time}</span>
                  ))}
                </span>
                <span className="block truncate text-sm text-muted">
                  {daysLabel(t, r.days)} · {r.enabled ? notifyLabel(t, r.notifyBefore) : t("routines.off")}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="btn-ghost size-11 shrink-0 p-0"
              aria-pressed={r.enabled}
              aria-label={r.enabled ? t("routines.mute") : t("routines.unmute")}
              title={r.enabled ? t("routines.mute") : t("routines.unmute")}
              onClick={() => void setEnabled({ routineId: r._id, enabled: !r.enabled })}
            >
              {r.enabled ? <Bell className="size-5 text-brand" /> : <BellOff className="size-5 text-muted" />}
            </button>
          </li>
        ))}
      </ul>
      {pushHint && !!routines?.length && (
        <div className="mt-2">
          <PushCard compact />
        </div>
      )}
      <RoutineSheet open={sheet !== null} onClose={() => setSheet(null)} routine={sheet?.routine} type={type} />
    </section>
  );
}
