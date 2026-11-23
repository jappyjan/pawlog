import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlarmClockOff, Check, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { useNow } from "../lib/useNow";
import { dayLabel, errorMessage, fromLocalInput, time, toLocalInput, tz } from "../lib/format";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { PushCard } from "../components/PushCard";

type R = Doc<"reminders">;
const REPEAT_LABEL: Record<R["repeat"], string> = {
  none: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  everyNDays: "Every N days",
};

const TEMPLATES: { title: string; repeat: R["repeat"]; intervalDays?: number; inDays: number }[] = [
  { title: "Flea & tick treatment", repeat: "monthly", inDays: 30 },
  { title: "Deworming", repeat: "everyNDays", intervalDays: 90, inDays: 90 },
  { title: "Vaccination booster", repeat: "yearly", inDays: 365 },
  { title: "Vet check-up", repeat: "yearly", inDays: 365 },
  { title: "Trim nails", repeat: "everyNDays", intervalDays: 21, inDays: 21 },
  { title: "Grooming / bath", repeat: "everyNDays", intervalDays: 42, inDays: 42 },
  { title: "Buy food", repeat: "none", inDays: 14 },
];

export function Reminders() {
  const reminders = useQuery(api.reminders.list);
  const done = useQuery(api.reminders.recentlyDone);
  const now = useNow();
  const [edit, setEdit] = useState<{ r?: R; template?: (typeof TEMPLATES)[number] } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const endToday = new Date(now).setHours(23, 59, 59, 999);
  const endWeek = endToday + 6 * 86_400_000;
  const groups = [
    { title: "Overdue", items: reminders?.filter((r) => r.dueAt <= now) ?? [] },
    { title: "Today", items: reminders?.filter((r) => r.dueAt > now && r.dueAt <= endToday) ?? [] },
    { title: "This week", items: reminders?.filter((r) => r.dueAt > endToday && r.dueAt <= endWeek) ?? [] },
    { title: "Later", items: reminders?.filter((r) => r.dueAt > endWeek) ?? [] },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Reminders</h1>
        <button type="button" className="btn-primary" onClick={() => setEdit({})}>
          <Plus className="size-4" /> New
        </button>
      </div>

      <PushCard compact />

      {reminders?.length === 0 && (
        <section className="card p-4">
          <p className="mb-3 text-muted">No reminders yet. Quick start:</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.title} type="button" className="chip" onClick={() => setEdit({ template: t })}>
                <Plus className="size-3.5" /> {t.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.title}>
              <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${g.title === "Overdue" ? "text-red-600" : "text-muted"}`}>{g.title}</h2>
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
          {TEMPLATES.filter((t) => !reminders.some((r) => r.title === t.title)).slice(0, 4).map((t) => (
            <button key={t.title} type="button" className="chip text-xs" onClick={() => setEdit({ template: t })}>
              <Plus className="size-3.5" /> {t.title}
            </button>
          ))}
        </div>
      )}

      {done && done.length > 0 && (
        <section>
          <button type="button" className="text-sm font-semibold text-muted" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? "Hide" : "Show"} completed ({done.length})
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
  const dog = dogs.find((d) => d._id === r.dogId);
  return (
    <li className={`card flex items-center gap-3 p-3 ${overdue ? "border-red-500/40" : ""}`}>
      <button
        type="button"
        aria-label={`Mark ${r.title} done`}
        className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-brand text-brand transition hover:bg-brand hover:text-white"
        onClick={async () => {
          await complete({ reminderId: r._id });
          toast({ text: r.repeat === "none" ? "Done ✓" : `Done ✓ — next one scheduled` });
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
              <Repeat className="size-3" /> {r.repeat === "everyNDays" ? `every ${r.intervalDays} d` : REPEAT_LABEL[r.repeat].toLowerCase()}
            </span>
          )}
          {dogs.length > 1 && dog && <span className="font-normal text-muted">· {dog.name}</span>}
        </span>
        {r.notes && <span className="block truncate text-sm text-muted">{r.notes}</span>}
        <span className="sr-only">created by {memberName(r.createdBy)}</span>
      </button>
      {overdue && (
        <button type="button" className="btn-ghost size-9 p-0" aria-label="Snooze 1 hour" title="Snooze 1 hour" onClick={() => void snooze({ reminderId: r._id, minutes: 60 }).then(() => toast({ text: "Snoozed 1 h" }))}>
          <AlarmClockOff className="size-5" />
        </button>
      )}
    </li>
  );
}

function DoneRow({ r }: { r: R }) {
  const reopen = useMutation(api.reminders.reopen);
  const remove = useMutation(api.reminders.remove);
  return (
    <li className="card flex items-center gap-3 p-3 opacity-70">
      <span className="min-w-0 flex-1 line-through">{r.title}</span>
      <button type="button" className="btn-ghost size-9 p-0" aria-label="Reopen" onClick={() => void reopen({ reminderId: r._id })}>
        <RotateCcw className="size-4" />
      </button>
      <button type="button" className="btn-ghost size-9 p-0" aria-label="Delete" onClick={() => void remove({ reminderId: r._id })}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function ReminderSheet({ state, onClose }: { state: { r?: R; template?: (typeof TEMPLATES)[number] } | null; onClose: () => void }) {
  const { dog, dogs } = useApp();
  const create = useMutation(api.reminders.create);
  const update = useMutation(api.reminders.update);
  const remove = useMutation(api.reminders.remove);
  const toast = useToast();
  const r = state?.r;
  const t = state?.template;
  const [repeat, setRepeat] = useState<R["repeat"]>("none");
  const key = r?._id ?? t?.title ?? "new";
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (state && lastKey !== key) {
    setLastKey(key);
    setRepeat(r?.repeat ?? t?.repeat ?? "none");
  }
  const defaultDue = r?.dueAt ?? (t ? addDays(new Date().setHours(9, 0, 0, 0), t.inDays).getTime() : new Date().setHours(new Date().getHours() + 1, 0, 0, 0));

  return (
    <Sheet open={state !== null} onClose={onClose} title={r ? "Edit reminder" : "New reminder"}>
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
              toast({ text: "Reminder saved ⏰" });
              onClose();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          <div>
            <label className="label" htmlFor="r-title">What</label>
            <input id="r-title" name="title" className="input" required defaultValue={r?.title ?? t?.title ?? ""} placeholder="e.g. Flea & tick treatment" autoFocus={!r && !t} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="r-due">{repeat === "none" ? "When" : "Next on"}</label>
              <input id="r-due" name="dueAt" type="datetime-local" className="input" required defaultValue={toLocalInput(defaultDue)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="r-dog">For</label>
              <select id="r-dog" name="dogId" className="input" defaultValue={r ? (r.dogId ?? "") : dog._id}>
                {dogs.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                <option value="">Everyone / household</option>
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="label">Repeat</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REPEAT_LABEL) as R["repeat"][]).map((k) => (
                <button key={k} type="button" onClick={() => setRepeat(k)} className={`chip ${repeat === k ? "chip-on" : ""}`} aria-pressed={repeat === k}>
                  {REPEAT_LABEL[k]}
                </button>
              ))}
            </div>
            {repeat === "everyNDays" && (
              <div className="mt-3 flex items-center gap-2">
                <span>Every</span>
                <input name="intervalDays" type="number" min={1} aria-label="Interval in days" className="input w-24" defaultValue={r?.intervalDays ?? t?.intervalDays ?? 30} />
                <span>days</span>
              </div>
            )}
          </fieldset>
          <div>
            <label className="label" htmlFor="r-notes">Notes</label>
            <input id="r-notes" name="notes" className="input" defaultValue={r?.notes ?? ""} />
          </div>
          {r && <p className="text-xs text-muted">Created {format(r._creationTime, "d MMM yyyy")}</p>}
          <div className="flex gap-2">
            {r && (
              <button type="button" className="btn-danger" onClick={() => void remove({ reminderId: r._id }).then(onClose)}>
                <Trash2 className="size-4" /> Delete
              </button>
            )}
            <button className="btn-primary flex-1">Save</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
