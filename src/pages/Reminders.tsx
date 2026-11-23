import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlarmClockOff, Check, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react";
import { addDays } from "date-fns";
import i18n from "../i18n";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { useNow } from "../lib/useNow";
import { dayLabel, errorMessage, fmt, fromLocalInput, time, toLocalInput, tz } from "../lib/format";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { PushCard } from "../components/PushCard";
import { RoutineList } from "../components/RoutineList";
import { useTranslation } from "react-i18next";

type R = Doc<"reminders">;
const REPEATS: R["repeat"][] = ["none", "daily", "weekly", "monthly", "yearly", "everyNDays"];
const repeatLabel = (r: R["repeat"]) => i18n.t(`reminders.repeat.${r}`);

type TemplateKey = "flea" | "deworm" | "vaccine" | "checkup" | "nails" | "grooming" | "food";
const TEMPLATE_DEFS: { key: TemplateKey; repeat: R["repeat"]; intervalDays?: number; inDays: number }[] = [
  { key: "flea", repeat: "monthly", inDays: 30 },
  { key: "deworm", repeat: "everyNDays", intervalDays: 90, inDays: 90 },
  { key: "vaccine", repeat: "yearly", inDays: 365 },
  { key: "checkup", repeat: "yearly", inDays: 365 },
  { key: "nails", repeat: "everyNDays", intervalDays: 21, inDays: 21 },
  { key: "grooming", repeat: "everyNDays", intervalDays: 42, inDays: 42 },
  { key: "food", repeat: "none", inDays: 14 },
];
type Template = (typeof TEMPLATE_DEFS)[number] & { title: string };
/** Template titles are saved in the language active when the reminder is created. */
const templates = (): Template[] => TEMPLATE_DEFS.map((d) => ({ ...d, title: i18n.t(`reminders.tpl.${d.key}`) }));

export function Reminders() {
  const reminders = useQuery(api.reminders.list);
  const done = useQuery(api.reminders.recentlyDone);
  const now = useNow();
  const { t } = useTranslation();
  const TEMPLATES = templates();
  const { dog } = useApp();
  const [edit, setEdit] = useState<{ r?: R; template?: Template } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const endToday = new Date(now).setHours(23, 59, 59, 999);
  const endWeek = endToday + 6 * 86_400_000;
  const groups = [
    { id: "overdue", title: t("reminders.overdue"), items: reminders?.filter((r) => r.dueAt <= now) ?? [] },
    { id: "today", title: t("time.today"), items: reminders?.filter((r) => r.dueAt > now && r.dueAt <= endToday) ?? [] },
    { id: "week", title: t("reminders.thisWeek"), items: reminders?.filter((r) => r.dueAt > endToday && r.dueAt <= endWeek) ?? [] },
    { id: "later", title: t("reminders.later"), items: reminders?.filter((r) => r.dueAt > endWeek) ?? [] },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("nav.reminders")}</h1>
        <button type="button" className="btn-primary" onClick={() => setEdit({})}>
          <Plus className="size-4" /> {t("reminders.new")}
        </button>
      </div>

      <PushCard compact />

      <RoutineList title={t("routines.title")} empty={t("routines.empty", { name: dog.name })} pushHint={false} />

      {reminders?.length === 0 && (
        <section className="card p-4">
          <p className="mb-3 text-muted">{t("reminders.empty")}</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.key} type="button" className="chip" onClick={() => setEdit({ template: tpl })}>
                <Plus className="size-3.5" /> {tpl.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.id}>
              <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${g.id === "overdue" ? "text-red-600" : "text-muted"}`}>{g.title}</h2>
              <ul className="space-y-2">
                {g.items.map((r) => (
                  <ReminderRow key={r._id} r={r} overdue={r.dueAt <= now} onEdit={() => setEdit({ r })} />
                ))}
              </ul>
            </section>
          ),
      )}

      {reminders && reminders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.filter((tpl) => !reminders.some((r) => r.title === tpl.title)).slice(0, 4).map((tpl) => (
            <button key={tpl.key} type="button" className="chip text-xs" onClick={() => setEdit({ template: tpl })}>
              <Plus className="size-3.5" /> {tpl.title}
            </button>
          ))}
        </div>
      )}

      {done && done.length > 0 && (
        <section>
          <button type="button" className="text-sm font-semibold text-muted" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? t("reminders.hideDone", { n: done.length }) : t("reminders.showDone", { n: done.length })}
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((r) => <DoneRow key={r._id} r={r} />)}
            </ul>
          )}
        </section>
      )}

      <ReminderSheet state={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function ReminderRow({ r, overdue, onEdit }: { r: R; overdue: boolean; onEdit: () => void }) {
  const { dogs, memberName } = useApp();
  const complete = useMutation(api.reminders.complete);
  const snooze = useMutation(api.reminders.snooze);
  const toast = useToast();
  const { t } = useTranslation();
  const dog = dogs.find((d) => d._id === r.dogId);
  return (
    <li className={`card flex items-center gap-3 p-3 ${overdue ? "border-red-500/40" : ""}`}>
      <button
        type="button"
        aria-label={t("reminders.markDone", { title: r.title })}
        className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-brand text-brand transition hover:bg-brand hover:text-white"
        onClick={async () => {
          await complete({ reminderId: r._id });
          toast({ text: r.repeat === "none" ? t("today.doneToast") : t("reminders.doneNext") });
        }}
      >
        <Check className="size-4" />
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <span className="block truncate font-semibold">{r.medicationId ? "💊 " : ""}{r.title}</span>
        <span className={`flex flex-wrap items-center gap-x-2 text-sm ${overdue ? "font-semibold text-red-600" : "text-muted"}`}>
          {dayLabel(r.dueAt)} · {time(r.dueAt)}
          {r.repeat !== "none" && (
            <span className="inline-flex items-center gap-1 font-normal text-muted">
              <Repeat className="size-3" /> {r.repeat === "everyNDays" ? t("reminders.everyNShort", { n: r.intervalDays }) : repeatLabel(r.repeat).toLowerCase()}
            </span>
          )}
          {dogs.length > 1 && dog && <span className="font-normal text-muted">· {dog.name}</span>}
        </span>
        {r.notes && <span className="block truncate text-sm text-muted">{r.notes}</span>}
        <span className="sr-only">{t("reminders.createdBy", { who: memberName(r.createdBy) })}</span>
      </button>
      {overdue && (
        <button type="button" className="btn-ghost size-9 p-0" aria-label={t("reminders.snooze")} title={t("reminders.snooze")} onClick={() => void snooze({ reminderId: r._id, minutes: 60 }).then(() => toast({ text: t("reminders.snoozed") }))}>
          <AlarmClockOff className="size-5" />
        </button>
      )}
    </li>
  );
}

function DoneRow({ r }: { r: R }) {
  const reopen = useMutation(api.reminders.reopen);
  const remove = useMutation(api.reminders.remove);
  const { t } = useTranslation();
  return (
    <li className="card flex items-center gap-3 p-3 opacity-70">
      <span className="min-w-0 flex-1 line-through">{r.title}</span>
      <button type="button" className="btn-ghost size-9 p-0" aria-label={t("reminders.reopen")} onClick={() => void reopen({ reminderId: r._id })}>
        <RotateCcw className="size-4" />
      </button>
      <button type="button" className="btn-ghost size-9 p-0" aria-label={t("common.delete")} onClick={() => void remove({ reminderId: r._id })}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function ReminderSheet({ state, onClose }: { state: { r?: R; template?: Template } | null; onClose: () => void }) {
  const { dog, dogs } = useApp();
  const create = useMutation(api.reminders.create);
  const update = useMutation(api.reminders.update);
  const remove = useMutation(api.reminders.remove);
  const toast = useToast();
  const { t } = useTranslation();
  const r = state?.r;
  const tpl = state?.template;
  const [repeat, setRepeat] = useState<R["repeat"]>("none");
  const key = r?._id ?? tpl?.key ?? "new";
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (state && lastKey !== key) {
    setLastKey(key);
    setRepeat(r?.repeat ?? tpl?.repeat ?? "none");
  }
  const defaultDue = r?.dueAt ?? (tpl ? addDays(new Date().setHours(9, 0, 0, 0), tpl.inDays).getTime() : new Date().setHours(new Date().getHours() + 1, 0, 0, 0));

  return (
    <Sheet open={state !== null} onClose={onClose} title={r ? t("reminders.editTitle") : t("reminders.newTitle")}>
      {state && (
        <form
          key={key}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const dogId = String(fd.get("dogId"));
            const fields = {
              title: String(fd.get("title")),
              notes: String(fd.get("notes")),
              dueAt: fromLocalInput(String(fd.get("dueAt"))),
              timezone: tz(),
              repeat,
              intervalDays: repeat === "everyNDays" ? Math.max(1, Number(fd.get("intervalDays")) || 1) : undefined,
              dogId: dogId ? (dogId as R["dogId"]) : undefined,
            };
            try {
              if (r) await update({ reminderId: r._id, ...fields });
              else await create(fields);
              toast({ text: t("reminders.saved") });
              onClose();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          <div>
            <label className="label" htmlFor="r-title">{t("reminders.what")}</label>
            <input id="r-title" name="title" className="input" required defaultValue={r?.title ?? tpl?.title ?? ""} placeholder={t("reminders.whatPh")} autoFocus={!r && !tpl} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="r-due">{repeat === "none" ? t("log.when") : t("reminders.nextOn")}</label>
              <input id="r-due" name="dueAt" type="datetime-local" className="input" required defaultValue={toLocalInput(defaultDue)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="r-dog">{t("reminders.for")}</label>
              <select id="r-dog" name="dogId" className="input" defaultValue={r ? (r.dogId ?? "") : dog._id}>
                {dogs.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                <option value="">{t("reminders.everyone")}</option>
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="label">{t("reminders.repeatLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {REPEATS.map((k) => (
                <button key={k} type="button" onClick={() => setRepeat(k)} className={`chip ${repeat === k ? "chip-on" : ""}`} aria-pressed={repeat === k}>
                  {repeatLabel(k)}
                </button>
              ))}
            </div>
            {repeat === "everyNDays" && (
              <div className="mt-3 flex items-center gap-2">
                <span>{t("reminders.every")}</span>
                <input name="intervalDays" type="number" min={1} aria-label={t("reminders.intervalLabel")} className="input w-24" defaultValue={r?.intervalDays ?? tpl?.intervalDays ?? 30} />
                <span>{t("reminders.days")}</span>
              </div>
            )}
          </fieldset>
          <div>
            <label className="label" htmlFor="r-notes">{t("common.notes")}</label>
            <input id="r-notes" name="notes" className="input" defaultValue={r?.notes ?? ""} />
          </div>
          {r && <p className="text-xs text-muted">{t("reminders.created", { date: fmt(r._creationTime, "d MMM yyyy") })}</p>}
          <div className="flex gap-2">
            {r && (
              <button type="button" className="btn-danger" onClick={() => void remove({ reminderId: r._id }).then(onClose)}>
                <Trash2 className="size-4" /> {t("common.delete")}
              </button>
            )}
            <button className="btn-primary flex-1">{t("common.save")}</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
