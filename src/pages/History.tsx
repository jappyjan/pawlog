import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { EVENT_META, eventTypeLabel, type EventType } from "../lib/events";
import { dayLabel, startOfLocalDay } from "../lib/format";
import { EventRow } from "../components/EventRow";
import { EventSheet } from "../components/EventSheet";
import { useTranslation } from "react-i18next";

const FILTERS: (EventType | undefined)[] = [undefined, "walk", "pee", "poop", "meal", "medication", "weight", "vet", "symptom", "note"];

export function History() {
  const { dog } = useApp();
  const { t } = useTranslation();
  const [type, setType] = useState<EventType | undefined>();
  const [sheet, setSheet] = useState<{ event?: Doc<"events"> } | null>(null);
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const { results, status, loadMore } = usePaginatedQuery(api.events.list, { dogId: dog._id, type }, { initialNumItems: 50 });
  const medName = (id: string) => meds?.find((m) => m._id === id)?.name;

  const groups: { day: number; items: Doc<"events">[] }[] = [];
  for (const e of results) {
    const day = startOfLocalDay(e.at);
    const g = groups.at(-1);
    if (g?.day === day) g.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="min-w-0 text-2xl font-extrabold">{t("nav.history")}</h1>
        <button type="button" className="btn-soft shrink-0 px-3 py-2 text-sm" onClick={() => setSheet({})}>
          <Plus className="size-4" /> {t("history.addPast")}
        </button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button key={f ?? "all"} type="button" onClick={() => setType(f)} className={`chip shrink-0 ${type === f ? "chip-on" : ""}`} aria-pressed={type === f}>
            {f ? <>{EVENT_META[f].emoji} {eventTypeLabel(f)}</> : t("history.all")}
          </button>
        ))}
      </div>

      {status === "LoadingFirstPage" && <p className="text-muted">{t("common.loading")}</p>}
      {status !== "LoadingFirstPage" && results.length === 0 && <p className="card p-6 text-center text-muted">{t("history.empty")}</p>}

      {groups.map((g) => (
        <section key={g.day} className="card p-2">
          <h2 className="flex justify-between px-2 pb-1 pt-2 text-sm font-bold text-muted">
            <span>{dayLabel(g.day)}</span>
            <span className="font-medium">{summary(g.items)}</span>
          </h2>
          <ul>
            {g.items.map((e) => (
              <EventRow key={e._id} e={e} medName={medName} onClick={() => setSheet({ event: e })} />
            ))}
          </ul>
        </section>
      ))}

      {status === "CanLoadMore" && (
        <button type="button" className="btn-ghost w-full" onClick={() => loadMore(50)}>{t("history.loadMore")}</button>
      )}
      {status === "LoadingMore" && <p className="text-center text-muted">{t("common.loading")}</p>}

      <EventSheet open={sheet !== null} onClose={() => setSheet(null)} event={sheet?.event} />
    </div>
  );
}

function summary(items: Doc<"events">[]) {
  const walks = items.filter((e) => e.type === "walk");
  const pee = items.filter((e) => e.type === "pee" || e.pee).length;
  const poop = items.filter((e) => e.type === "poop" || e.poop).length;
  const kcal = items.reduce((s, e) => s + (e.type === "meal" ? (e.kcal ?? 0) : 0), 0);
  return [walks.length && `🦮 ${walks.length}`, pee && `💧 ${pee}`, poop && `💩 ${poop}`, kcal && `🍖 ${kcal.toLocaleString()} kcal`].filter(Boolean).join("  ");
}
