import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { ago, dayLabel, fmt, startOfLocalDay, time } from "../lib/format";
import { EventSheet } from "../components/EventSheet";
import { MedicationSheet } from "../components/MedicationSheet";
import { useToast } from "../components/Toast";
import { useNow } from "../lib/useNow";
import type { EventType } from "../lib/events";
import { stoolMeta, stoolScoreOf, stoolWarning } from "../lib/nutrition";
import { useTranslation } from "react-i18next";

const tooltipStyle = {
  contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 12, color: "var(--color-ink)", fontSize: 13 },
  labelStyle: { color: "var(--color-muted)" },
  cursor: { fill: "var(--color-line)", opacity: 0.5, stroke: "var(--color-line)" },
};
const axis = { stroke: "var(--color-muted)", fontSize: 11, tickLine: false, axisLine: false };

export function Health() {
  const { dog } = useApp();
  const { t } = useTranslation();
  const weights = useQuery(api.events.weights, { dogId: dog._id });
  const since = useMemo(() => startOfLocalDay(Date.now() - 13 * 86_400_000), []);
  const recent = useQuery(api.events.range, { dogId: dog._id, from: since });
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const vetVisits = useQuery(api.events.list, { dogId: dog._id, type: "vet", paginationOpts: { numItems: 10, cursor: null } });
  const [sheet, setSheet] = useState<EventType | null>(null);
  const [medOpen, setMedOpen] = useState(false);
  const foods = useQuery(api.foods.list);

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
      label: fmt(d.day, "EEEEE d"),
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
  const latest = weights?.at(-1);
  const prev = weights?.at(-2);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("nav.health")}</h1>

      {/* Weight */}
      <section className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("events.weight")}</h2>
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
              <p className="text-sm text-muted">{t("health.noWeights")}</p>
            )}
          </div>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setSheet("weight")}>
            <Plus className="size-4" /> {t("health.weighIn")}
          </button>
        </div>
        {weights && weights.length > 1 && (
          <div className="mt-3 h-44" role="img" aria-label={t("health.weightChart", { n: weights.length, from: weights[0].weightKg, to: latest!.weightKg })}>
            <ResponsiveContainer>
              <LineChart data={weights} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="at" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v) => fmt(v, "d MMM")} {...axis} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => Number(v).toFixed(0)} {...axis} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => fmt(Number(v), "d MMM yyyy")} formatter={(v) => [`${v} kg`, t("events.weight")]} />
                <Line type="monotone" dataKey="weightKg" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-brand)", stroke: "var(--color-card)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="card p-4">
        <h2 className="font-bold">{t("health.last14")}</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            [t("health.walksPerDay"), avg("walks")],
            [t("health.walkMinPerDay"), avg("minutes")],
            [t("health.poopsPerDay"), avg("poop")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg py-2">
              <dd className="text-xl font-extrabold tabular-nums">{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm font-semibold text-muted">{t("health.walkMinutesChart")}</p>
        <div className="h-36" role="img" aria-label={t("health.walkMinutesChart")}>
          <ResponsiveContainer>
            <BarChart data={activity} margin={{ top: 8, right: 0, bottom: 0, left: -28 }} barCategoryGap={3}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="label" interval={1} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(_, p) => (p?.[0] ? fmt(p[0].payload.day, "EEE d MMM") : "")}
                formatter={(v, _n, p) => [`${v} min · ${t("health.walksN", { count: p.payload.walks })} · 💧${p.payload.pee} 💩${p.payload.poop}`, ""]}
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
            <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("health.food")}</h2>
            {kcalAvg ? (
              <p>
                <span className="text-3xl font-extrabold tabular-nums">{kcalAvg.toLocaleString()}</span> <span className="text-muted">{t("health.kcalPerDay")}</span>
                <span className="block text-xs text-muted">
                  {t("health.avgOfDays", { count: kcalDays.length })}
                  {dog.kcalGoalPerDay ? ` · ${t("health.goal", { kcal: dog.kcalGoalPerDay.toLocaleString() })}` : ""}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">{t("health.noKcal")}</p>
            )}
          </div>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setSheet("meal")}>
            <Plus className="size-4" /> {t("events.meal")}
          </button>
        </div>
        {kcalAvg !== null && (
          <div className="mt-3 h-36" role="img" aria-label={t("health.kcalChart", { kcal: kcalAvg })}>
            <ResponsiveContainer>
              <BarChart data={activity} margin={{ top: 8, right: 0, bottom: 0, left: -20 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" interval={1} {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tooltipStyle} labelFormatter={(_, p) => (p?.[0] ? fmt(p[0].payload.day, "EEE d MMM") : "")} formatter={(v) => [`${v} kcal`, ""]} />
                {dog.kcalGoalPerDay ? <ReferenceLine y={dog.kcalGoalPerDay} stroke="var(--color-muted)" strokeDasharray="4 4" /> : null}
                <Bar dataKey="kcal" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <Link to="/food" className="mt-3 flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold">
          <span>🍽️ {t("health.foodsAndMeals", { foods: activeFoods.length })}</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      </section>

      {/* Digestion */}
      <section className="card p-4">
        <h2 className="font-bold">{t("health.digestion")}</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {([
            [t("health.avgScore"), stoolAvg ? `${stoolAvg.toFixed(1)}` : "–", stoolAvg ? stoolMeta(Math.round(stoolAvg))?.label : undefined, false],
            [t("health.ideal"), idealPct !== null ? `${idealPct}%` : "–", undefined, false],
            [t("stool.check"), String(warnings), warnings ? t("health.checkSub") : undefined, warnings > 0],
          ] as [string, string, string | undefined, boolean][]).map(([k, v, sub, warn]) => (
            <div key={String(k)} className={`rounded-xl py-2 ${warn ? "bg-red-500/10" : "bg-bg"}`}>
              <dd className={`text-xl font-extrabold tabular-nums ${warn ? "text-red-600 dark:text-red-400" : ""}`}>{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
              {sub && <dd className="text-[11px] text-muted">{sub}</dd>}
            </div>
          ))}
        </dl>
        {stoolN > 1 ? (
          <div className="mt-3 h-44" role="img" aria-label={t("health.stoolChart", { avg: stoolAvg?.toFixed(1) })}>
            <ResponsiveContainer>
              <LineChart data={activity} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <ReferenceArea y1={2} y2={3} fill="#10b981" fillOpacity={0.12} />
                <XAxis dataKey="label" interval={1} {...axis} />
                <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} interval={0} reversed {...axis} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(_, p) => (p?.[0] ? fmt(p[0].payload.day, "EEE d MMM") : "")}
                  formatter={(v) => [`${v} · ${stoolMeta(Math.round(Number(v)))?.label ?? ""}`, t("health.score")]}
                />
                <Line type="monotone" dataKey="stool" connectNulls stroke="#a16207" strokeWidth={2} dot={{ r: 3.5, fill: "#a16207", stroke: "var(--color-card)", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("health.noStool")}</p>
        )}
      </section>

      {/* Medications */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("meds.title")}</h2>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setMedOpen(true)}>
            <Plus className="size-4" /> {t("common.add")}
          </button>
        </div>
        {meds?.length === 0 && <p className="text-sm text-muted">{t("meds.empty")}</p>}
        <ul className="divide-y divide-line">
          {meds?.map((m) => <MedRow key={m._id} m={m} />)}
        </ul>
      </section>

      {/* Vet visits */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="min-w-0 hyphens-auto break-words font-bold">{t("health.vetVisits")}</h2>
          <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setSheet("vet")}>
            <Plus className="size-4" /> {t("health.logVisit")}
          </button>
        </div>
        {vetVisits?.page.length === 0 && <p className="text-sm text-muted">{t("health.noVet")}</p>}
        <ul className="space-y-3">
          {vetVisits?.page.map((v) => (
            <li key={v._id} className="rounded-xl bg-bg p-3">
              <p className="text-sm font-bold">{fmt(v.at, "d MMM yyyy")}</p>
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
    </div>
  );
}

type Med = NonNullable<ReturnType<typeof useQuery<typeof api.medications.list>>>[number];

function MedRow({ m }: { m: Med }) {
  const give = useMutation(api.medications.giveDose);
  const setActive = useMutation(api.medications.setActive);
  const remove = useMutation(api.medications.remove);
  const toast = useToast();
  const { t } = useTranslation();
  const now = useNow(60_000);
  const next = m.reminders.filter((r) => !r.done).sort((a, b) => a.dueAt - b.dueAt)[0];
  const ended = !!m.endsOn && m.endsOn < fmt(now, "yyyy-MM-dd");
  return (
    <li className={`py-3 ${m.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>💊</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{m.name} {m.dosage && <span className="font-normal text-muted">· {m.dosage}</span>}</span>
          <span className="block text-sm text-muted">
            {t("meds.lastGiven", { ago: ago(m.lastDoseAt) })}
            {m.active && next && <> · {t("meds.next", { when: `${dayLabel(next.dueAt)} ${time(next.dueAt)}` })}</>}
            {!m.active && ` · ${t("meds.paused")}`}
            {m.endsOn && ` · ${ended ? t("meds.ended") : t("meds.ends", { date: fmt(new Date(`${m.endsOn}T00:00`), "d MMM yyyy") })}`}
          </span>
          {m.notes && <span className="block text-sm text-muted">{m.notes}</span>}
        </span>
        {m.active && (
          <button type="button" className="btn-primary py-2" onClick={() => void give({ medicationId: m._id }).then(() => toast({ text: t("meds.given", { name: m.name }) }))}>
            {t("meds.give")}
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2 pl-9">
        <button type="button" className="chip text-xs" onClick={() => void setActive({ medicationId: m._id, active: !m.active })}>
          {m.active ? <><Pause className="size-3.5" /> {t("meds.pause")}</> : <><Play className="size-3.5" /> {t("meds.resume")}</>}
        </button>
        <button
          type="button"
          className="chip text-xs text-red-600"
          onClick={() => {
            if (confirm(t("meds.deleteConfirm", { name: m.name }))) void remove({ medicationId: m._id });
          }}
        >
          <Trash2 className="size-3.5" /> {t("common.delete")}
        </button>
      </div>
    </li>
  );
}
