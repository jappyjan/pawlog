import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { Check, NotebookPen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useApp } from "../lib/app";
import { EventIcon, eventLabel, eventTypeLabel, type EventType } from "../lib/events";
import { ago, errorMessage, fromLocalInput, toLocalInput } from "../lib/format";
import { itemText } from "../lib/nutrition";
import { useToast } from "./Toast";
import { StoolDetails, stoolArgs, useStool } from "./StoolDetails";
import { initialMeal, mealArgs, MealFields, type Meal } from "./MealFields";

/** What the composer can log: every event type, with treats as their own choice. */
type Kind = EventType | "treat";
const PICKER: Kind[] = ["pee", "poop", "walk", "meal", "treat", "medication", "weight", "symptom", "vet", "note"];
const typeOf = (k: Kind): EventType => (k === "treat" ? "meal" : k);
const kindOf = (e: Doc<"events">): Kind => (e.type === "meal" && e.mealKind === "treat" ? "treat" : e.type);
const kindLabel = (k: Kind, t: ReturnType<typeof useTranslation>["t"]) => (k === "treat" ? t("events.treat") : eventTypeLabel(k));

/**
 * The tracking composer. Opened without a type it starts with a type picker; opened with
 * `initialType` (or to edit an `event`) the type is fixed and the picker never shows.
 */
export function EventSheet({
  open,
  onClose,
  initialType,
  treat,
  event,
  past,
}: {
  open: boolean;
  onClose: () => void;
  initialType?: EventType;
  /** Start a meal entry as a treat. */
  treat?: boolean;
  event?: Doc<"events">;
  /** Adding a past entry: start with the date/time field instead of "Now". */
  past?: boolean;
}) {
  const { dog } = useApp();
  const { t } = useTranslation();
  const last = useQuery(api.events.lastMeal, open ? { dogId: dog._id } : "skip");
  const foods = useQuery(api.foods.list, open ? {} : "skip");
  const [picked, setPicked] = useState<Kind | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPicked(null);
  }

  const fixed: Kind | undefined = event ? kindOf(event) : initialType ? (initialType === "meal" && treat ? "treat" : initialType) : undefined;
  const kind = fixed ?? picked;
  const ready = last !== undefined && foods !== undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onBack={!fixed && kind ? () => setPicked(null) : undefined}
      title={event ? t("log.edit", { what: eventLabel(event) }) : kind ? kindLabel(kind, t) : t("log.title")}
    >
      {open &&
        (kind === null ? (
          <TypePicker onPick={setPicked} />
        ) : (
          ready && (
            <EventForm
              key={event?._id ?? kind}
              kind={kind}
              event={event}
              past={past}
              onDone={onClose}
              meal0={initialMeal(event, last, foods, kind === "treat")}
            />
          )
        ))}
    </Sheet>
  );
}

function TypePicker({ onPick }: { onPick: (k: Kind) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="list">
      {PICKER.map((k) => (
        <button
          key={k}
          type="button"
          role="listitem"
          onClick={() => onPick(k)}
          className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-line bg-bg px-1 py-4 font-semibold transition active:scale-95 active:bg-brand-soft ${
            k === "note" ? "col-span-3 flex-row justify-center sm:col-span-1 sm:flex-col" : ""
          }`}
        >
          <EventIcon type={typeOf(k)} treat={k === "treat"} large />
          <span className="max-w-full hyphens-auto break-words text-center text-sm leading-tight">{kindLabel(k, t)}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- When: quick chips for new entries, a date/time field for edits ---------- */

const AGO = [0, 15, 30, 60] as const;
type When = { mode: "ago"; minutes: number } | { mode: "custom"; value: string };
const whenAt = (w: When) => (w.mode === "ago" ? Date.now() - w.minutes * 60_000 : fromLocalInput(w.value));

function WhenField({ value, onChange }: { value: When; onChange: (w: When) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="label">{t("log.when")}</legend>
      <div className="flex flex-wrap gap-2">
        {AGO.map((m) => {
          const on = value.mode === "ago" && value.minutes === m;
          return (
            <button key={m} type="button" aria-pressed={on} className={`chip py-2 ${on ? "chip-on" : ""}`} onClick={() => onChange({ mode: "ago", minutes: m })}>
              {m === 0 ? t("log.now") : m < 60 ? t("log.minAgo", { m }) : t("log.hAgo", { h: m / 60 })}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={value.mode === "custom"}
          className={`chip py-2 ${value.mode === "custom" ? "chip-on" : ""}`}
          onClick={() => value.mode !== "custom" && onChange({ mode: "custom", value: toLocalInput(whenAt(value)) })}
        >
          {t("log.earlier")}
        </button>
      </div>
      {value.mode === "custom" && (
        <input
          type="datetime-local"
          aria-label={t("log.when")}
          className="input mt-2"
          value={value.value}
          onChange={(e) => onChange({ mode: "custom", value: e.target.value })}
          required
        />
      )}
    </fieldset>
  );
}

/* ---------- The form for one type ---------- */

const NOTES_FIRST: Kind[] = ["vet", "symptom", "note"];

function EventForm({ kind, event, past, onDone, meal0 }: { kind: Kind; event?: Doc<"events">; past?: boolean; onDone: () => void; meal0: Meal }) {
  const { dog } = useApp();
  const toast = useToast();
  const { t } = useTranslation();
  const log = useMutation(api.events.log);
  const update = useMutation(api.events.update);
  const remove = useMutation(api.events.remove);
  const meds = useQuery(api.medications.list, kind === "medication" ? { dogId: dog._id } : "skip");
  const savedMeals = useQuery(api.meals.list, kind === "meal" && !event ? { dogId: dog._id } : "skip");
  const foods = useQuery(api.foods.list);
  const type = typeOf(kind);

  const [when, setWhen] = useState<When>(() =>
    event || past ? { mode: "custom", value: toLocalInput(event?.at ?? Date.now()) } : { mode: "ago", minutes: 0 },
  );
  const [pee, setPee] = useState(event?.pee ?? false);
  const [poop, setPoop] = useState(event?.poop ?? false);
  const [stool, setStool] = useStool(event);
  const [meal, setMeal] = useState(meal0);
  // null = untouched: new doses preselect the first active med and its dosage.
  const [medPick, setMedPick] = useState<string | null>(event ? (event.medicationId ?? "") : null);
  const [amountEdit, setAmountEdit] = useState<string | null>(event ? (event.amount ?? "") : null);
  const [notesOpen, setNotesOpen] = useState(NOTES_FIRST.includes(kind) || !!event?.notes);
  const [customMeal, setCustomMeal] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = (v: FormDataEntryValue | null) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };

  const done = (id: Id<"events">, what: string) => {
    toast({
      text: t("log.logged", { what }),
      actions: [{ label: t("common.undo"), run: () => void remove({ eventId: id }) }],
    });
    navigator.vibrate?.(15);
    onDone();
  };

  // Saved meals log in one tap; "Something else" opens the full meal form.
  const showSavedMeals = kind === "meal" && !event && !!savedMeals?.length && !customMeal;
  const activeMeds = meds?.filter((m) => m.active || m._id === medPick) ?? [];
  const medId = medPick ?? activeMeds[0]?._id ?? "";
  const amount = amountEdit ?? activeMeds.find((m) => m._id === medId)?.dosage ?? "";

  if (kind === "meal" && !event && savedMeals === undefined) return null;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const fields = {
          at: whenAt(when),
          notes: String(fd.get("notes") ?? event?.notes ?? ""),
          ...(type === "walk" && { durationMin: num(fd.get("durationMin")), distanceKm: num(fd.get("distanceKm")), pee, poop }),
          ...(((type === "walk" && poop) || type === "poop") && stoolArgs(stool)),
          ...(type === "weight" && { weightKg: num(fd.get("weightKg")) }),
          ...(type === "meal" && mealArgs(meal, foods)),
          ...(type === "medication" && { amount, medicationId: medId ? (medId as Id<"medications">) : undefined }),
        };
        if (!Number.isFinite(fields.at)) return toast({ text: t("log.pickTime"), error: true });
        if (type === "weight" && !fields.weightKg) return toast({ text: t("log.enterWeight"), error: true });
        setBusy(true);
        try {
          if (event) {
            await update({ eventId: event._id, ...fields });
            toast({ text: t("common.saved") });
            onDone();
          } else {
            const id = await log({ dogId: dog._id, type, ...fields });
            done(id, kindLabel(kind, t));
          }
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <WhenField value={when} onChange={setWhen} />

      {type === "walk" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ev-dur">{t("log.duration")}</label>
              <input id="ev-dur" name="durationMin" type="number" inputMode="numeric" min={1} className="input" defaultValue={event?.durationMin ?? 30} />
            </div>
            <div>
              <label className="label" htmlFor="ev-km">{t("walk.distance")}</label>
              <input id="ev-km" name="distanceKm" inputMode="decimal" className="input" defaultValue={event?.distanceKm ?? ""} placeholder={t("common.optional")} />
            </div>
          </div>
          <PottyToggles pee={pee} poop={poop} setPee={setPee} setPoop={setPoop} />
          {poop && <StoolDetails value={stool} onChange={setStool} />}
        </>
      )}

      {type === "poop" && <StoolDetails value={stool} onChange={setStool} />}

      {type === "weight" && (
        <div>
          <label className="label" htmlFor="ev-kg">{t("log.weightKg")}</label>
          <div className="relative">
            <input id="ev-kg" name="weightKg" inputMode="decimal" className="input py-4 pr-14 text-3xl font-extrabold tabular-nums" defaultValue={event?.weightKg ?? ""} placeholder="0.0" autoFocus required />
            <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-lg font-semibold text-muted">kg</span>
          </div>
        </div>
      )}

      {type === "medication" && (
        <>
          <fieldset>
            <legend className="label">{t("events.medication")}</legend>
            <div className="space-y-2" role="radiogroup">
              {activeMeds.map((m) => (
                <ChoiceCard
                  key={m._id}
                  on={medId === m._id}
                  onClick={() => {
                    setMedPick(m._id);
                    setAmountEdit(null);
                  }}
                  title={m.name}
                  sub={[m.dosage, t("today.lastDose", { ago: ago(m.lastDoseAt) })].filter(Boolean).join(" · ")}
                />
              ))}
              <ChoiceCard
                on={medId === ""}
                onClick={() => {
                  setMedPick("");
                  setAmountEdit(null);
                }}
                title={t("log.otherMed")}
              />
            </div>
            {meds?.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                {t("today.noMeds")} <Link to="/health" className="font-semibold text-brand" onClick={onDone}>{t("today.addMedInHealth")}</Link>
              </p>
            )}
          </fieldset>
          <div>
            <label className="label" htmlFor="ev-amt">{t("log.dose")}</label>
            <input id="ev-amt" className="input" value={amount} onChange={(e) => setAmountEdit(e.target.value)} placeholder={t("log.dosePh")} />
          </div>
        </>
      )}

      {type === "meal" &&
        (showSavedMeals ? (
          <div className="space-y-2">
            <p className="label">{t("today.whatEat", { name: dog.name })}</p>
            {savedMeals.map((m) => (
              <button
                key={m._id}
                type="button"
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition active:scale-[.98] active:bg-brand-soft"
                onClick={async () => {
                  const at = whenAt(when);
                  if (!Number.isFinite(at)) return toast({ text: t("log.pickTime"), error: true });
                  setBusy(true);
                  try {
                    const id = await log({ dogId: dog._id, type: "meal", mealKind: "meal", mealName: m.name, items: m.items, at });
                    done(id, m.name);
                  } catch (err) {
                    toast({ text: errorMessage(err), error: true });
                    setBusy(false);
                  }
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
                <span className="btn-primary pointer-events-none px-3 py-1.5 text-sm">{t("foodPage.logNow")}</span>
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" className="btn-soft" onClick={() => setCustomMeal(true)}>
                {t("today.somethingElse")}
              </button>
              <Link to="/food" className="btn-ghost" onClick={onDone}>
                {t("today.editMeals")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <MealFields value={meal} onChange={setMeal} dogFood={dog.food} />
            {event?.amount && <p className="text-sm text-muted">{t("log.earlierNote")}: {event.amount}</p>}
          </>
        ))}

      {!showSavedMeals &&
        (notesOpen ? (
          <div>
            <label className="label" htmlFor="ev-notes">
              {type === "vet" ? t("log.vetNotes") : type === "symptom" ? t("log.symptoms") : t("common.notes")}
            </label>
            <textarea
              id="ev-notes"
              name="notes"
              rows={NOTES_FIRST.includes(kind) ? 4 : 2}
              className="input"
              defaultValue={event?.notes ?? ""}
              autoFocus={!event && kind === "note"}
            />
          </div>
        ) : (
          <button type="button" className="btn-ghost -ml-2 text-sm text-muted" onClick={() => setNotesOpen(true)}>
            <NotebookPen className="size-4" /> {t("log.addNote")}
          </button>
        ))}

      {!showSavedMeals && (
        <div className="sticky bottom-0 -mx-5 -mb-6 flex gap-2 border-t border-line bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {event && (
            <button
              type="button"
              className="btn-danger"
              aria-label={t("common.delete")}
              onClick={async () => {
                await remove({ eventId: event._id });
                toast({ text: t("common.deleted") });
                onDone();
              }}
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn-primary flex-1 py-3.5 text-base" disabled={busy}>
            {event ? t("common.save") : t("log.logWhat", { what: kindLabel(kind, t) })}
          </button>
        </div>
      )}
    </form>
  );
}

function ChoiceCard({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? "border-brand bg-brand-soft" : "border-line"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-line"}`} aria-hidden>
        {on && <Check className="size-4" />}
      </span>
    </button>
  );
}

export function PottyToggles({ pee, poop, setPee, setPoop }: { pee: boolean; poop: boolean; setPee: (b: boolean) => void; setPoop: (b: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { on: pee, set: setPee, label: t("events.pee"), emoji: "💧" },
        { on: poop, set: setPoop, label: t("events.poop"), emoji: "💩" },
      ].map((b) => (
        <button
          key={b.label}
          type="button"
          aria-pressed={b.on}
          onClick={() => b.set(!b.on)}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-semibold transition ${
            b.on ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-muted"
          }`}
        >
          <span className="text-xl" aria-hidden>{b.emoji}</span> {b.label} {b.on ? "✓" : ""}
        </button>
      ))}
    </div>
  );
}
