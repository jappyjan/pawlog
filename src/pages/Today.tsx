import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronRight, Footprints, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { useNow } from "../lib/useNow";
import { since, startOfLocalDay, time } from "../lib/format";
import { EventSheet } from "../components/EventSheet";
import { FinishWalkSheet } from "../components/WalkSheet";
import { EventRow } from "../components/EventRow";
import { useToast } from "../components/Toast";
import { EVENT_META, type EventType } from "../lib/events";
import { kcalOf } from "../lib/nutrition";

export function Today() {
  const { dog, memberName } = useApp();
  const { t } = useTranslation();
  const now = useNow(15_000);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const dayStart = useMemo(() => startOfLocalDay(now), [now]);

  const last = useQuery(api.events.lastTimes, { dogId: dog._id });
  const today = useQuery(api.events.range, { dogId: dog._id, from: dayStart });
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const reminders = useQuery(api.reminders.list);

  const startWalk = useMutation(api.dogs.startWalk);
  const cancelWalk = useMutation(api.dogs.cancelWalk);
  const complete = useMutation(api.reminders.complete);

  const [sheet, setSheet] = useState<{ type?: EventType; event?: Doc<"events"> } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  // PWA shortcut /?quick=walk starts a walk; /?log=<type> (e.g. from a routine push) opens the composer.
  useEffect(() => {
    const quick = params.get("quick");
    const logType = params.get("log");
    if (!quick && !logType) return;
    if (quick === "walk" && !dog.walkStartedAt) void startWalk({ dogId: dog._id });
    if (logType && logType in EVENT_META) setSheet({ type: logType as EventType });
    setParams({}, { replace: true });
  }, [params, dog, startWalk, setParams]);

  const walksToday = today?.filter((e) => e.type === "walk") ?? [];
  const walkMinutes = walksToday.reduce((s, e) => s + (e.durationMin ?? 0), 0);
  const goal = dog.walkGoalPerDay ?? 3;
  const medName = (id: string) => meds?.find((m) => m._id === id)?.name;
  const endOfToday = dayStart + 86_400_000;
  const dueToday = (reminders ?? []).filter((r) => r.dueAt < endOfToday && (!r.dogId || r.dogId === dog._id));
  const mealsToday = today?.filter((e) => e.type === "meal") ?? [];
  const kcalToday = kcalOf(mealsToday);
  const kcalGoal = dog.kcalGoalPerDay;

  return (
    <div className="space-y-5">
      {dog.walkStartedAt ? (
        <section className="card flex flex-wrap items-center gap-3 border-emerald-500/40 bg-emerald-500/10 p-4" aria-label={t("today.walkInProgress")}>
          <span className="grid size-12 animate-pulse place-items-center rounded-full bg-emerald-500 text-white">
            <Footprints className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t("today.walking", { mins: Math.max(0, Math.floor((now - dog.walkStartedAt) / 60000)) })}</p>
            <p className="text-sm text-muted">{t("today.startedBy", { time: time(dog.walkStartedAt), who: memberName(dog.walkStartedBy) })}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => void cancelWalk({ dogId: dog._id })}>
              <X className="size-4" /> {t("common.cancel")}
            </button>
            <button type="button" className="btn-primary flex-[2] bg-emerald-600" onClick={() => setFinishOpen(true)}>
              <Check className="size-4" /> {t("today.walkDone")}
            </button>
          </div>
        </section>
      ) : null}

      {/* Since-last tiles */}
      <section className="grid grid-cols-4 gap-2" aria-label={t("today.timeSince")}>
        {[
          { label: t("events.pee"), emoji: "💧", ts: last?.pee },
          { label: t("events.poop"), emoji: "💩", ts: last?.poop },
          { label: t("events.walk"), emoji: "🦮", ts: last?.walk },
          { label: t("events.meal"), emoji: "🍖", ts: last?.meal },
        ].map((x) => (
          <div key={x.emoji} className="card min-w-0 px-1.5 py-3 text-center">
            <div className="text-xl" aria-hidden>{x.emoji}</div>
            <div className="mt-1 text-[13px] font-bold leading-tight tabular-nums">{last === undefined ? "…" : since(x.ts, now)}</div>
            <div className="truncate text-[11px] text-muted">{x.label}</div>
          </div>
        ))}
      </section>

      {/* Log + start walk */}
      <section className="flex gap-2" aria-label={t("today.quickLog")}>
        <button
          type="button"
          className="flex flex-[3] items-center justify-center gap-2.5 rounded-2xl bg-brand py-5 text-lg font-bold text-white shadow-md shadow-brand/30 transition active:scale-[.98]"
          onClick={() => setSheet({})}
        >
          <Plus className="size-6" strokeWidth={2.75} /> {t("today.logButton")}
        </button>
        {!dog.walkStartedAt && (
          <button
            type="button"
            className="flex flex-[2] flex-col items-center justify-center gap-0.5 rounded-2xl bg-emerald-500/15 px-2 py-3 font-bold text-emerald-700 transition active:scale-[.98] dark:text-emerald-300"
            onClick={() => void startWalk({ dogId: dog._id })}
          >
            <Footprints className="size-6" />
            <span className="text-sm leading-tight">{t("today.startWalk")}</span>
          </button>
        )}
      </section>

      {/* Walk goal */}
      <section className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold">{t("today.walksToday")}</h2>
          <span className="text-sm text-muted">{walksToday.length}/{goal} · {walkMinutes} min</span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: Math.max(goal, walksToday.length) }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < walksToday.length ? "bg-emerald-500" : "bg-line"}`} />
          ))}
        </div>
      </section>

      {/* Food & calories */}
      <section className="card p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="font-bold">{t("today.foodToday")}</h2>
          <Link to="/food" className="flex items-center text-sm font-semibold text-brand">
            {t("today.manageFood")} <ChevronRight className="size-4" />
          </Link>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {t("today.mealsCount", { count: mealsToday.filter((e) => e.mealKind !== "treat").length })} ·{" "}
          {t("today.treatsCount", { count: mealsToday.filter((e) => e.mealKind === "treat").length })}
          {(kcalToday > 0 || kcalGoal) && (
            <>
              {" · "}
              <span className="font-semibold text-ink">{kcalToday.toLocaleString()}</span>
              {kcalGoal ? ` / ${kcalGoal.toLocaleString()}` : ""} kcal
            </>
          )}
        </p>
        {kcalGoal ? (
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={kcalGoal} aria-valuenow={kcalToday} aria-label={t("today.kcalToday")}>
            <div
              className={`h-full rounded-full ${kcalToday > kcalGoal * 1.1 ? "bg-red-500" : "bg-orange-500"}`}
              style={{ width: `${Math.min(100, (kcalToday / kcalGoal) * 100)}%` }}
            />
          </div>
        ) : null}
      </section>

      {/* Due reminders */}
      {dueToday.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">{t("today.dueToday")}</h2>
            <Link to="/reminders" className="text-sm font-semibold text-brand">{t("today.all")}</Link>
          </div>
          <ul className="divide-y divide-line">
            {dueToday.map((r) => (
              <li key={r._id} className="flex items-center gap-3 py-2">
                <span className="text-lg" aria-hidden>{r.medicationId ? "💊" : "⏰"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className={`text-sm ${r.dueAt < now ? "font-semibold text-red-600" : "text-muted"}`}>
                    {r.dueAt < now ? t("today.overdue", { time: time(r.dueAt) }) : time(r.dueAt)}
                  </span>
                </span>
                <button type="button" className="btn-soft py-1.5" onClick={() => void complete({ reminderId: r._id }).then(() => toast({ text: t("today.doneToast") }))}>
                  <Check className="size-4" /> {t("today.done")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="card p-2">
        <h2 className="px-2 pb-1 pt-2 font-bold">{t("today.log")}</h2>
        {today === undefined ? (
          <p className="p-4 text-sm text-muted">{t("common.loading")}</p>
        ) : today.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t("today.empty")}</p>
        ) : (
          <ul>
            {today.map((e) => (
              <EventRow key={e._id} e={e} medName={medName} onClick={() => setSheet({ event: e })} />
            ))}
          </ul>
        )}
      </section>

      <EventSheet open={sheet !== null} onClose={() => setSheet(null)} initialType={sheet?.type} event={sheet?.event} />
      <FinishWalkSheet open={finishOpen} onClose={() => setFinishOpen(false)} />
    </div>
  );
}
