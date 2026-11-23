import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronRight, Footprints, Pill, Plus, Scale, Thermometer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { useNow } from "../lib/useNow";
import { ago, errorMessage, since, startOfLocalDay, time } from "../lib/format";
import { EventSheet } from "../components/EventSheet";
import { FinishWalkSheet } from "../components/WalkSheet";
import { EventRow } from "../components/EventRow";
import { useToast } from "../components/Toast";
import { Sheet } from "../components/Sheet";
import { eventTypeLabel, type EventType } from "../lib/events";
import { itemText, kcalOf } from "../lib/nutrition";
import { useLogMeal } from "../lib/useLogMeal";

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
  const lastMeal = useQuery(api.events.lastMeal, { dogId: dog._id });
  const savedMeals = useQuery(api.meals.list, { dogId: dog._id });

  const log = useMutation(api.events.log);
  const remove = useMutation(api.events.remove);
  const startWalk = useMutation(api.dogs.startWalk);
  const cancelWalk = useMutation(api.dogs.cancelWalk);
  const complete = useMutation(api.reminders.complete);

  const [sheet, setSheet] = useState<{ type?: EventType; treat?: boolean; event?: Doc<"events"> } | null>(null);
  const [editId, setEditId] = useState<Id<"events"> | null>(null);
  const editing = editId ? today?.find((e) => e._id === editId) : undefined;
  const [finishOpen, setFinishOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const logMeal = useLogMeal(setEditId);

  // PWA shortcut: /?quick=walk
  useEffect(() => {
    if (params.get("quick") === "walk" && !dog.walkStartedAt) {
      void startWalk({ dogId: dog._id });
      setParams({}, { replace: true });
    }
  }, [params, dog, startWalk, setParams]);

  const quick = async (type: "pee" | "poop") => {
    try {
      const id = await log({ dogId: dog._id, type });
      toast({
        text: t("log.logged", { what: eventTypeLabel(type) }),
        actions: [
          { label: t("common.undo"), run: () => void remove({ eventId: id }) },
          ...(type === "poop" ? [{ label: t("common.details"), run: () => setEditId(id) }] : []),
        ],
      });
      navigator.vibrate?.(15);
    } catch (e) {
      toast({ text: errorMessage(e), error: true });
    }
  };

  // Meal: pick a saved meal if there are any, otherwise repeat the last meal in one tap.
  const onMeal = () => {
    if (savedMeals?.length) setMealsOpen(true);
    else void logMeal({ items: lastMeal?.items, kcal: lastMeal?.kcal });
  };

  const walksToday = today?.filter((e) => e.type === "walk") ?? [];
  const walkMinutes = walksToday.reduce((s, e) => s + (e.durationMin ?? 0), 0);
  const goal = dog.walkGoalPerDay ?? 3;
  const medName = (id: string) => meds?.find((m) => m._id === id)?.name;
  const endOfToday = dayStart + 86_400_000;
  const dueToday = (reminders ?? []).filter((r) => r.dueAt < endOfToday && (!r.dogId || r.dogId === dog._id));
  const activeMeds = meds?.filter((m) => m.active) ?? [];
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

      {/* Quick actions */}
      <section aria-label={t("today.quickLog")}>
        <div className="grid grid-cols-4 gap-2">
          {!dog.walkStartedAt ? (
            <button type="button" className="col-span-4 flex items-center justify-center gap-3 rounded-2xl bg-brand py-4 text-lg font-bold text-white shadow-md shadow-brand/30 transition active:scale-[.98]" onClick={() => void startWalk({ dogId: dog._id })}>
              <Footprints className="size-6" /> {t("today.startWalk")}
            </button>
          ) : null}
          <QuickButton emoji="💧" label={t("events.pee")} onClick={() => void quick("pee")} />
          <QuickButton emoji="💩" label={t("events.poop")} onClick={() => void quick("poop")} />
          <QuickButton emoji="🍖" label={t("events.meal")} onClick={onMeal} />
          <QuickButton emoji="🦴" label={t("events.treat")} onClick={() => setSheet({ type: "meal", treat: true })} />
          <QuickButton icon={<Pill className="size-6" />} label={t("today.meds")} onClick={() => setMedsOpen(true)} />
          <QuickButton icon={<Scale className="size-6" />} label={t("events.weight")} onClick={() => setSheet({ type: "weight" })} />
          <QuickButton icon={<Thermometer className="size-6" />} label={t("events.symptom")} onClick={() => setSheet({ type: "symptom" })} />
          <QuickButton icon={<Plus className="size-6" />} label={t("today.more")} onClick={() => setSheet({ type: "walk" })} />
        </div>
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

      <EventSheet open={sheet !== null} onClose={() => setSheet(null)} initialType={sheet?.type} treat={sheet?.treat} event={sheet?.event} />
      <EventSheet open={!!editing} onClose={() => setEditId(null)} event={editing} />
      <FinishWalkSheet open={finishOpen} onClose={() => setFinishOpen(false)} />

      <Sheet open={medsOpen} onClose={() => setMedsOpen(false)} title={t("today.giveMed")}>
        <MedsQuick meds={activeMeds} onDone={() => setMedsOpen(false)} />
      </Sheet>

      <Sheet open={mealsOpen} onClose={() => setMealsOpen(false)} title={t("today.whatEat", { name: dog.name })}>
        <ul className="space-y-2">
          {savedMeals?.map((m) => (
            <li key={m._id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition active:bg-brand-soft"
                onClick={() => {
                  setMealsOpen(false);
                  void logMeal({ name: m.name, items: m.items, kcal: m.kcal });
                }}
              >
                <span className="text-2xl" aria-hidden>🍖</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {m.items.map(itemText).join(" + ")}
                    {m.kcal ? ` · ${m.kcal} kcal` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-soft"
            onClick={() => {
              setMealsOpen(false);
              setSheet({ type: "meal" });
            }}
          >
            {t("today.somethingElse")}
          </button>
          <Link to="/food" className="btn-ghost" onClick={() => setMealsOpen(false)}>
            {t("today.editMeals")}
          </Link>
        </div>
      </Sheet>
    </div>
  );
}

function QuickButton({ emoji, icon, label, onClick }: { emoji?: string; icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card flex min-w-0 flex-col items-center gap-1 px-1 py-3.5 font-semibold transition active:scale-95 active:bg-brand-soft">
      {emoji ? <span className="text-2xl leading-none" aria-hidden>{emoji}</span> : <span className="text-brand">{icon}</span>}
      <span className="line-clamp-2 max-w-full hyphens-auto break-words text-center text-[13px] leading-tight">{label}</span>
    </button>
  );
}

function MedsQuick({ meds, onDone }: { meds: { _id: Doc<"medications">["_id"]; name: string; dosage?: string; lastDoseAt: number | null }[]; onDone: () => void }) {
  const give = useMutation(api.medications.giveDose);
  const toast = useToast();
  const { t } = useTranslation();
  if (meds.length === 0)
    return (
      <div className="space-y-3 text-center">
        <p className="text-muted">{t("today.noMeds")}</p>
        <Link to="/health" className="btn-soft" onClick={onDone}>{t("today.addMedInHealth")}</Link>
      </div>
    );
  return (
    <ul className="space-y-2">
      {meds.map((m) => (
        <li key={m._id} className="flex items-center gap-3 rounded-xl border border-line p-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{m.name} {m.dosage && <span className="font-normal text-muted">· {m.dosage}</span>}</span>
            <span className="text-sm text-muted">{t("today.lastDose", { ago: ago(m.lastDoseAt) })}</span>
          </span>
          <button
            type="button"
            className="btn-primary py-2"
            onClick={async () => {
              await give({ medicationId: m._id });
              toast({ text: t("meds.given", { name: m.name }) });
              onDone();
            }}
          >
            {t("meds.give")}
          </button>
        </li>
      ))}
    </ul>
  );
}
