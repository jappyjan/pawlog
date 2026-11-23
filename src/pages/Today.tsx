import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import { Check, Footprints, Pill, Plus, Scale, Thermometer, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { useNow } from "../lib/useNow";
import { ago, errorMessage, startOfLocalDay, time } from "../lib/format";
import { EventSheet } from "../components/EventSheet";
import { FinishWalkSheet } from "../components/WalkSheet";
import { EventRow } from "../components/EventRow";
import { useToast } from "../components/Toast";
import { Sheet } from "../components/Sheet";
import type { EventType } from "../lib/events";
import { itemText, kcalOf } from "../lib/nutrition";

export function Today() {
  const { dog, memberName } = useApp();
  const now = useNow(15_000);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const dayStart = useMemo(() => startOfLocalDay(now), [now]);

  const last = useQuery(api.events.lastTimes, { dogId: dog._id });
  const today = useQuery(api.events.range, { dogId: dog._id, from: dayStart });
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const reminders = useQuery(api.reminders.list);
  const lastMeal = useQuery(api.events.lastMeal, { dogId: dog._id });

  const log = useMutation(api.events.log);
  const remove = useMutation(api.events.remove);
  const startWalk = useMutation(api.dogs.startWalk);
  const cancelWalk = useMutation(api.dogs.cancelWalk);
  const complete = useMutation(api.reminders.complete);

  const [sheet, setSheet] = useState<{ type?: EventType; treat?: boolean; event?: Doc<"events"> } | null>(null);
  const [editId, setEditId] = useState<Doc<"events">["_id"] | null>(null);
  const editing = editId ? today?.find((e) => e._id === editId) : undefined;
  const [finishOpen, setFinishOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);

  // PWA shortcut: /?quick=walk
  useEffect(() => {
    if (params.get("quick") === "walk" && !dog.walkStartedAt) {
      void startWalk({ dogId: dog._id });
      setParams({}, { replace: true });
    }
  }, [params, dog, startWalk, setParams]);

  const quick = async (type: EventType, label: string) => {
    try {
      // Meal = same as last time (if there was one), editable from the toast.
      const items = type === "meal" ? lastMeal?.items : undefined;
      const id = await log({ dogId: dog._id, type, ...(items && { mealKind: "meal" as const, items }) });
      const detail = items ? ` · ${items.map(itemText).join(" + ")}${lastMeal?.kcal ? ` · ${lastMeal.kcal} kcal` : ""}` : "";
      toast({
        text: `${label} logged${detail}`,
        actions: [
          { label: "Undo", run: () => void remove({ eventId: id }) },
          ...(type === "poop" || type === "meal" ? [{ label: items ? "Edit" : "Details", run: () => setEditId(id) }] : []),
        ],
      });
      navigator.vibrate?.(15);
    } catch (e) {
      toast({ text: errorMessage(e), error: true });
    }
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
        <section className="card flex flex-wrap items-center gap-3 border-emerald-500/40 bg-emerald-500/10 p-4" aria-label="Walk in progress">
          <span className="grid size-12 animate-pulse place-items-center rounded-full bg-emerald-500 text-white">
            <Footprints className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Walking · {Math.max(0, Math.floor((now - dog.walkStartedAt) / 60000))} min</p>
            <p className="text-sm text-muted">Started {time(dog.walkStartedAt)} by {memberName(dog.walkStartedBy)}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => void cancelWalk({ dogId: dog._id })}>
              <X className="size-4" /> Cancel
            </button>
            <button type="button" className="btn-primary flex-[2] bg-emerald-600" onClick={() => setFinishOpen(true)}>
              <Check className="size-4" /> Walk done
            </button>
          </div>
        </section>
      ) : null}

      {/* Since-last tiles */}
      <section className="grid grid-cols-4 gap-2" aria-label="Time since">
        {[
          { label: "Pee", emoji: "💧", t: last?.pee },
          { label: "Poop", emoji: "💩", t: last?.poop },
          { label: "Walk", emoji: "🦮", t: last?.walk },
          { label: "Meal", emoji: "🍖", t: last?.meal },
        ].map((x) => (
          <div key={x.label} className="card px-2 py-3 text-center">
            <div className="text-xl" aria-hidden>{x.emoji}</div>
            <div className="mt-1 text-[13px] font-bold leading-tight tabular-nums">{last === undefined ? "…" : ago(x.t, now).replace(" ago", "")}</div>
            <div className="text-[11px] text-muted">{x.label}</div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section aria-label="Quick log">
        <div className="grid grid-cols-4 gap-2">
          {!dog.walkStartedAt ? (
            <button type="button" className="col-span-4 flex items-center justify-center gap-3 rounded-2xl bg-brand py-4 text-lg font-bold text-white shadow-md shadow-brand/30 transition active:scale-[.98]" onClick={() => void startWalk({ dogId: dog._id })}>
              <Footprints className="size-6" /> Start walk
            </button>
          ) : null}
          <QuickButton emoji="💧" label="Pee" onClick={() => void quick("pee", "Pee")} />
          <QuickButton emoji="💩" label="Poop" onClick={() => void quick("poop", "Poop")} />
          <QuickButton emoji="🍖" label="Meal" onClick={() => void quick("meal", "Meal")} />
          <QuickButton emoji="🦴" label="Treat" onClick={() => setSheet({ type: "meal", treat: true })} />
          <QuickButton icon={<Pill className="size-6" />} label="Meds" onClick={() => setMedsOpen(true)} />
          <QuickButton icon={<Scale className="size-6" />} label="Weight" onClick={() => setSheet({ type: "weight" })} />
          <QuickButton icon={<Thermometer className="size-6" />} label="Symptom" onClick={() => setSheet({ type: "symptom" })} />
          <QuickButton icon={<Plus className="size-6" />} label="More…" onClick={() => setSheet({ type: "walk" })} />
        </div>
      </section>

      {/* Walk goal */}
      <section className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold">Walks today</h2>
          <span className="text-sm text-muted">{walksToday.length}/{goal} · {walkMinutes} min</span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: Math.max(goal, walksToday.length) }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < walksToday.length ? "bg-emerald-500" : "bg-line"}`} />
          ))}
        </div>
      </section>

      {/* Food & calories */}
      {(kcalToday > 0 || kcalGoal) && (
        <section className="card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-bold">Food today</h2>
            <span className="text-sm text-muted tabular-nums">
              {plural(mealsToday.filter((e) => e.mealKind !== "treat").length, "meal")} · {plural(mealsToday.filter((e) => e.mealKind === "treat").length, "treat")} ·{" "}
              <span className="font-semibold text-ink">{kcalToday.toLocaleString()}</span>
              {kcalGoal ? ` / ${kcalGoal.toLocaleString()}` : ""} kcal
            </span>
          </div>
          {kcalGoal ? (
            <div className="h-2.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={kcalGoal} aria-valuenow={kcalToday} aria-label="Calories today">
              <div
                className={`h-full rounded-full ${kcalToday > kcalGoal * 1.1 ? "bg-red-500" : "bg-orange-500"}`}
                style={{ width: `${Math.min(100, (kcalToday / kcalGoal) * 100)}%` }}
              />
            </div>
          ) : null}
        </section>
      )}

      {/* Due reminders */}
      {dueToday.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">Due today</h2>
            <Link to="/reminders" className="text-sm font-semibold text-brand">All</Link>
          </div>
          <ul className="divide-y divide-line">
            {dueToday.map((r) => (
              <li key={r._id} className="flex items-center gap-3 py-2">
                <span className="text-lg" aria-hidden>{r.medicationId ? "💊" : "⏰"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className={`text-sm ${r.dueAt < now ? "font-semibold text-red-600" : "text-muted"}`}>
                    {r.dueAt < now ? `Overdue · ${time(r.dueAt)}` : time(r.dueAt)}
                  </span>
                </span>
                <button type="button" className="btn-soft py-1.5" onClick={() => void complete({ reminderId: r._id }).then(() => toast({ text: "Done ✓" }))}>
                  <Check className="size-4" /> Done
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="card p-2">
        <h2 className="px-2 pb-1 pt-2 font-bold">Today's log</h2>
        {today === undefined ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : today.length === 0 ? (
          <p className="p-4 text-sm text-muted">Nothing yet today. Tap a button above to log.</p>
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

      <Sheet open={medsOpen} onClose={() => setMedsOpen(false)} title="Give medication">
        <MedsQuick meds={activeMeds} onDone={() => setMedsOpen(false)} />
      </Sheet>
    </div>
  );
}

function QuickButton({ emoji, icon, label, onClick }: { emoji?: string; icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card flex flex-col items-center gap-1 py-3.5 font-semibold transition active:scale-95 active:bg-brand-soft">
      {emoji ? <span className="text-2xl leading-none" aria-hidden>{emoji}</span> : <span className="text-brand">{icon}</span>}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function MedsQuick({ meds, onDone }: { meds: { _id: Doc<"medications">["_id"]; name: string; dosage?: string; lastDoseAt: number | null }[]; onDone: () => void }) {
  const give = useMutation(api.medications.giveDose);
  const toast = useToast();
  if (meds.length === 0)
    return (
      <div className="space-y-3 text-center">
        <p className="text-muted">No active medications.</p>
        <Link to="/health" className="btn-soft" onClick={onDone}>Add one in Health</Link>
      </div>
    );
  return (
    <ul className="space-y-2">
      {meds.map((m) => (
        <li key={m._id} className="flex items-center gap-3 rounded-xl border border-line p-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{m.name} {m.dosage && <span className="font-normal text-muted">· {m.dosage}</span>}</span>
            <span className="text-sm text-muted">Last: {ago(m.lastDoseAt)}</span>
          </span>
          <button
            type="button"
            className="btn-primary py-2"
            onClick={async () => {
              await give({ medicationId: m._id });
              toast({ text: `${m.name} given 💊` });
              onDone();
            }}
          >
            Give
          </button>
        </li>
      ))}
    </ul>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
