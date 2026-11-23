import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight, Pause, Play, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { ago, dayLabel, startOfLocalDay, time } from "../lib/format";
import { EventSheet } from "../components/EventSheet";
import { MedicationSheet } from "../components/MedicationSheet";
import { useToast } from "../components/Toast";
import type { EventType } from "../lib/events";
import { FoodSheet } from "../components/FoodSheet";
import { kindMeta, stoolMeta, stoolScoreOf, stoolWarning, unitShort, type Food } from "../lib/nutrition";

const tooltipStyle = {
  contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 12, color: "var(--color-ink)", fontSize: 13 },
  labelStyle: { color: "var(--color-muted)" },
  cursor: { fill: "var(--color-line)", opacity: 0.5, stroke: "var(--color-line)" },
};
const axis = { stroke: "var(--color-muted)", fontSize: 11, tickLine: false, axisLine: false };

export function Health() {
  const { dog } = useApp();
  const weights = useQuery(api.events.weights, { dogId: dog._id });
  const since = useMemo(() => startOfLocalDay(Date.now() - 13 * 86_400_000), []);
  const recent = useQuery(api.events.range, { dogId: dog._id, from: since });
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const vetVisits = useQuery(api.events.list, { dogId: dog._id, type: "vet", paginationOpts: { numItems: 10, cursor: null } });
  const [sheet, setSheet] = useState<EventType | null>(null);
  const [medOpen, setMedOpen] = useState(false);
  const foods = useQuery(api.foods.list);
  const [foodSheet, setFoodSheet] = useState<{ food?: Food } | null>(null);

  const activity = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = since + i * 86_400_000;
      return { day: startOfLocalDay(d + 3_600_000 * 3), minutes: 0, walks: 0, pee: 0, poop: 0, kcal: 0, stoolSum: 0, stoolN: 0, warn: 0 };
    });
    for (const e of recent ?? []) {
      const slot = days.find((d) => d.day === startOfLocalDay(e.at));
      if (!slot) continue;
      if (e.type === "walk") {
        slot.minutes += e.durationMin ?? 0;
        slot.walks++;
      }
      if (e.type === "pee" || e.pee) slot.pee++;
      if (e.type === "poop" || e.poop) {
        slot.poop++;
        const score = stoolScoreOf(e);
        if (score !== undefined) {
          slot.stoolSum += score;
          slot.stoolN++;
        }
        if (stoolWarning(e)) slot.warn++;
      }
      if (e.type === "meal") slot.kcal += e.kcal ?? 0;
    }
    return days.map((d) => ({
      ...d,
      label: format(d.day, "EEEEE d"),
      stool: d.stoolN ? Math.round((d.stoolSum / d.stoolN) * 10) / 10 : null,
    }));
  }, [recent, since]);

  const avg = (k: "walks" | "minutes" | "poop") => (activity.reduce((s, d) => s + d[k], 0) / 14).toFixed(1);
  const kcalDays = activity.filter((d) => d.kcal > 0);
  const kcalAvg = kcalDays.length ? Math.round(kcalDays.reduce((s, d) => s + d.kcal, 0) / kcalDays.length) : null;
  const stoolN = activity.reduce((s, d) => s + d.stoolN, 0);
  const stoolAvg = stoolN ? activity.reduce((s, d) => s + d.stoolSum, 0) / stoolN : null;
  const scored = (recent ?? []).filter((e) => (e.type === "poop" || e.poop) && stoolScoreOf(e) !== undefined);
  const idealPct = scored.length ? Math.round((scored.filter((e) => [2, 3].includes(stoolScoreOf(e)!)).length / scored.length) * 100) : null;
  const warnings = activity.reduce((s, d) => s + d.warn, 0);
  const activeFoods = foods?.filter((f) => !f.archived) ?? [];
  const archivedFoods = foods?.filter((f) => f.archived) ?? [];
  const latest = weights?.at(-1);
  const prev = weights?.at(-2);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Health</h1>

      {/* Weight */}
      <section className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold">Weight</h2>
            {latest ? (
              <p>
                <span className="text-3xl font-extrabold tabular-nums">{latest.weightKg}</span> <span className="text-muted">kg</span>
                {prev && (
                  <span className={`ml-2 text-sm font-semibold ${latest.weightKg >= prev.weightKg ? "text-muted" : "text-muted"}`}>
                    {latest.weightKg - prev.weightKg >= 0 ? "▲" : "▼"} {Math.abs(latest.weightKg - prev.weightKg).toFixed(1)} kg
                  </span>
                )}
                <span className="block text-xs text-muted">{dayLabel(latest.at)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted">No weigh-ins yet.</p>
            )}
          </div>
          <button type="button" className="btn-soft" onClick={() => setSheet("weight")}>
            <Plus className="size-4" /> Weigh-in
          </button>
        </div>
        {weights && weights.length > 1 && (
          <div className="mt-3 h-44" role="img" aria-label={`Weight chart, ${weights.length} weigh-ins from ${weights[0].weightKg} to ${latest!.weightKg} kg`}>
            <ResponsiveContainer>
              <LineChart data={weights} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="at" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => format(t, "d MMM")} {...axis} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => Number(v).toFixed(0)} {...axis} />
                <Tooltip {...tooltipStyle} labelFormatter={(t) => format(Number(t), "d MMM yyyy")} formatter={(v) => [`${v} kg`, "Weight"]} />
                <Line type="monotone" dataKey="weightKg" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-brand)", stroke: "var(--color-card)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="card p-4">
        <h2 className="font-bold">Last 14 days</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ["Walks/day", avg("walks")],
            ["Walk min/day", avg("minutes")],
            ["Poops/day", avg("poop")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg py-2">
              <dd className="text-xl font-extrabold tabular-nums">{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm font-semibold text-muted">Walk minutes per day</p>
        <div className="h-36" role="img" aria-label="Bar chart of walk minutes per day for the last 14 days">
          <ResponsiveContainer>
            <BarChart data={activity} margin={{ top: 8, right: 0, bottom: 0, left: -28 }} barCategoryGap={3}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="label" interval={1} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(_, p) => (p?.[0] ? format(p[0].payload.day, "EEE d MMM") : "")}
                formatter={(v, _n, p) => [`${v} min · ${p.payload.walks} walks · 💧${p.payload.pee} 💩${p.payload.poop}`, ""]}
              />
              <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Food & calories */}
      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold">Food</h2>
            {kcalAvg ? (
              <p>
                <span className="text-3xl font-extrabold tabular-nums">{kcalAvg.toLocaleString()}</span> <span className="text-muted">kcal/day</span>
                <span className="block text-xs text-muted">
                  avg of {kcalDays.length} logged day{kcalDays.length === 1 ? "" : "s"}
                  {dog.kcalGoalPerDay ? ` · goal ${dog.kcalGoalPerDay.toLocaleString()}` : ""}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">Log meals with a food from your list to see calories here.</p>
            )}
          </div>
          <button type="button" className="btn-soft" onClick={() => setSheet("meal")}>
            <Plus className="size-4" /> Meal
          </button>
        </div>
        {kcalAvg !== null && (
          <div className="mt-3 h-36" role="img" aria-label={`Bar chart of calories per day for the last 14 days, average ${kcalAvg} kcal`}>
            <ResponsiveContainer>
              <BarChart data={activity} margin={{ top: 8, right: 0, bottom: 0, left: -20 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" interval={1} {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tooltipStyle} labelFormatter={(_, p) => (p?.[0] ? format(p[0].payload.day, "EEE d MMM") : "")} formatter={(v) => [`${v} kcal`, ""]} />
                {dog.kcalGoalPerDay ? <ReferenceLine y={dog.kcalGoalPerDay} stroke="var(--color-muted)" strokeDasharray="4 4" /> : null}
                <Bar dataKey="kcal" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Food list</h3>
          <button type="button" className="btn-ghost -mr-2 text-sm" onClick={() => setFoodSheet({})}>
            <Plus className="size-4" /> Add food
          </button>
        </div>
        {foods?.length === 0 && (
          <p className="text-sm text-muted">Add your dog's food and treats with their calories once. Then logging a meal fills in the kcal for you.</p>
        )}
        <ul className="divide-y divide-line">
          {[...activeFoods, ...archivedFoods].map((f) => (
            <li key={f._id}>
              <button type="button" className={`flex w-full items-center gap-3 py-2.5 text-left ${f.archived ? "opacity-50" : ""}`} onClick={() => setFoodSheet({ food: f })}>
                <span className="text-xl" aria-hidden>{kindMeta(f.kind).emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.name}{f.brand && <span className="font-normal text-muted"> · {f.brand}</span>}</span>
                  <span className="block text-sm text-muted">
                    {[
                      f.kcalPer !== undefined && `${f.kcalPer} kcal / ${f.unit === "g" ? "100 g" : unitShort(f.unit)}`,
                      f.defaultQty !== undefined && `portion ${f.defaultQty} ${unitShort(f.unit)}`,
                      f.archived && "archived",
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

      {/* Digestion */}
      <section className="card p-4">
        <h2 className="font-bold">Digestion · 14 days</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ["Avg score", stoolAvg ? `${stoolAvg.toFixed(1)}` : "–", stoolAvg ? stoolMeta(Math.round(stoolAvg))?.label : undefined],
            ["Ideal (2–3)", idealPct !== null ? `${idealPct}%` : "–"],
            ["Check", String(warnings), warnings ? "blood, worms, very loose…" : undefined],
          ].map(([k, v, sub]) => (
            <div key={k} className={`rounded-xl py-2 ${k === "Check" && warnings ? "bg-red-500/10" : "bg-bg"}`}>
              <dd className={`text-xl font-extrabold tabular-nums ${k === "Check" && warnings ? "text-red-600 dark:text-red-400" : ""}`}>{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
              {sub && <dd className="text-[11px] text-muted">{sub}</dd>}
            </div>
          ))}
        </dl>
        {stoolN > 1 ? (
          <div className="mt-3 h-44" role="img" aria-label={`Average stool score per day, overall ${stoolAvg?.toFixed(1)}; 2 to 3 is ideal`}>
            <ResponsiveContainer>
              <LineChart data={activity} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <ReferenceArea y1={2} y2={3} fill="#10b981" fillOpacity={0.12} />
                <XAxis dataKey="label" interval={1} {...axis} />
                <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} interval={0} reversed {...axis} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(_, p) => (p?.[0] ? format(p[0].payload.day, "EEE d MMM") : "")}
                  formatter={(v) => [`${v} · ${stoolMeta(Math.round(Number(v)))?.label ?? ""}`, "Score"]}
                />
                <Line type="monotone" dataKey="stool" connectNulls stroke="#a16207" strokeWidth={2} dot={{ r: 3.5, fill: "#a16207", stroke: "var(--color-card)", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Tap a 1–7 score when you log a poop to see the trend. 2 is a firm, ideal stool, 7 is watery.</p>
        )}
      </section>

      {/* Medications */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Medications</h2>
          <button type="button" className="btn-soft" onClick={() => setMedOpen(true)}>
            <Plus className="size-4" /> Add
          </button>
        </div>
        {meds?.length === 0 && <p className="text-sm text-muted">Flea/tick, dewormer, daily pills… add them here to get reminders.</p>}
        <ul className="divide-y divide-line">
          {meds?.map((m) => <MedRow key={m._id} m={m} />)}
        </ul>
      </section>

      {/* Vet visits */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Vet visits</h2>
          <button type="button" className="btn-soft" onClick={() => setSheet("vet")}>
            <Plus className="size-4" /> Log visit
          </button>
        </div>
        {vetVisits?.page.length === 0 && <p className="text-sm text-muted">No vet visits logged.</p>}
        <ul className="space-y-3">
          {vetVisits?.page.map((v) => (
            <li key={v._id} className="rounded-xl bg-bg p-3">
              <p className="text-sm font-bold">{format(v.at, "d MMM yyyy")}</p>
              {v.notes && <p className="whitespace-pre-wrap text-sm">{v.notes}</p>}
            </li>
          ))}
        </ul>
        {(dog.vetName || dog.vetPhone) && (
          <p className="mt-3 text-sm text-muted">
            {dog.vetName} {dog.vetPhone && <a className="font-semibold text-brand" href={`tel:${dog.vetPhone}`}>{dog.vetPhone}</a>}
          </p>
        )}
      </section>

      <EventSheet open={sheet !== null} onClose={() => setSheet(null)} initialType={sheet ?? undefined} />
      <MedicationSheet open={medOpen} onClose={() => setMedOpen(false)} />
      <FoodSheet open={foodSheet !== null} onClose={() => setFoodSheet(null)} food={foodSheet?.food} />
    </div>
  );
}

type Med = NonNullable<ReturnType<typeof useQuery<typeof api.medications.list>>>[number];

function MedRow({ m }: { m: Med }) {
  const give = useMutation(api.medications.giveDose);
  const setActive = useMutation(api.medications.setActive);
  const remove = useMutation(api.medications.remove);
  const toast = useToast();
  const next = m.reminders.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt)[0];
  return (
    <li className={`py-3 ${m.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>💊</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{m.name} {m.dosage && <span className="font-normal text-muted">· {m.dosage}</span>}</span>
          <span className="block text-sm text-muted">
            Last given {ago(m.lastDoseAt)}
            {m.active && next && <> · next {dayLabel(next.dueAt).toLowerCase()} {time(next.dueAt)}</>}
            {!m.active && " · paused"}
          </span>
          {m.notes && <span className="block text-sm text-muted">{m.notes}</span>}
        </span>
        {m.active && (
          <button type="button" className="btn-primary py-2" onClick={() => void give({ medicationId: m._id }).then(() => toast({ text: `${m.name} given 💊` }))}>
            Give
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2 pl-9">
        <button type="button" className="chip text-xs" onClick={() => void setActive({ medicationId: m._id, active: !m.active })}>
          {m.active ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5" /> Resume</>}
        </button>
        <button
          type="button"
          className="chip text-xs text-red-600"
          onClick={() => {
            if (confirm(`Delete ${m.name} and its reminders? Logged doses stay in history.`)) void remove({ medicationId: m._id });
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>
    </li>
  );
}
