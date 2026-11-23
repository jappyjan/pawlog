import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useApp } from "../lib/app";
import { EVENT_META, eventLabel, type EventType } from "../lib/events";
import { errorMessage, fromLocalInput, toLocalInput } from "../lib/format";
import { useToast } from "./Toast";
import { StoolDetails, stoolArgs, useStool } from "./StoolDetails";
import { initialMeal, mealArgs, MealFields, type Meal } from "./MealFields";

const PICKABLE: EventType[] = ["walk", "pee", "poop", "meal", "weight", "medication", "vet", "symptom", "note"];

export function EventSheet({
  open,
  onClose,
  initialType,
  treat,
  event,
}: {
  open: boolean;
  onClose: () => void;
  initialType?: EventType;
  /** Start a meal entry as a treat. */
  treat?: boolean;
  event?: Doc<"events">;
}) {
  const { dog } = useApp();
  const last = useQuery(api.events.lastMeal, open ? { dogId: dog._id } : "skip");
  const foods = useQuery(api.foods.list, open ? {} : "skip");
  const ready = (last !== undefined && foods !== undefined) || !open;
  return (
    <Sheet open={open} onClose={onClose} title={event ? `Edit ${eventLabel(event).toLowerCase()}` : "Log something"}>
      {open && ready && (
        <EventForm key={event?._id ?? `${initialType}${treat}`} initialType={initialType} event={event} onDone={onClose} meal0={initialMeal(event, last, foods, treat)} />
      )}
    </Sheet>
  );
}

function EventForm({ initialType, event, onDone, meal0 }: { initialType?: EventType; event?: Doc<"events">; onDone: () => void; meal0: Meal }) {
  const { dog } = useApp();
  const toast = useToast();
  const log = useMutation(api.events.log);
  const update = useMutation(api.events.update);
  const remove = useMutation(api.events.remove);
  const meds = useQuery(api.medications.list, { dogId: dog._id });
  const [type, setType] = useState<EventType>(event?.type ?? initialType ?? "walk");
  const [pee, setPee] = useState(event?.pee ?? false);
  const [poop, setPoop] = useState(event?.poop ?? false);
  const [stool, setStool] = useStool(event);
  const [meal, setMeal] = useState(meal0);
  const foods = useQuery(api.foods.list);
  const [busy, setBusy] = useState(false);

  const num = (v: FormDataEntryValue | null) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const at = fromLocalInput(String(fd.get("at")));
        const fields = {
          at,
          notes: String(fd.get("notes") ?? ""),
          ...(type === "walk" && { durationMin: num(fd.get("durationMin")), distanceKm: num(fd.get("distanceKm")), pee, poop }),
          ...(((type === "walk" && poop) || type === "poop") && stoolArgs(stool)),
          ...(type === "weight" && { weightKg: num(fd.get("weightKg")) }),
          ...(type === "meal" && mealArgs(meal, foods)),
          ...(type === "medication" && { amount: String(fd.get("amount") ?? "") }),
          ...(type === "medication" && fd.get("medicationId") ? { medicationId: fd.get("medicationId") as Doc<"medications">["_id"] } : {}),
        };
        if (type === "weight" && !fields.weightKg) return toast({ text: "Enter a weight", error: true });
        setBusy(true);
        try {
          if (event) await update({ eventId: event._id, ...fields });
          else await log({ dogId: dog._id, type, ...fields });
          toast({ text: event ? "Saved" : `${type === "meal" && meal.mealKind === "treat" ? "Treat" : EVENT_META[type].label} logged` });
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      {!event && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type">
          {PICKABLE.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`chip ${type === t ? "chip-on" : ""}`}
            >
              <span aria-hidden>{EVENT_META[t].emoji}</span> {EVENT_META[t].label}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="label" htmlFor="ev-at">When</label>
        <input id="ev-at" name="at" type="datetime-local" className="input" defaultValue={toLocalInput(event?.at ?? Date.now())} required />
      </div>

      {type === "walk" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ev-dur">Duration (min)</label>
              <input id="ev-dur" name="durationMin" type="number" inputMode="numeric" min={1} className="input" defaultValue={event?.durationMin ?? 30} />
            </div>
            <div>
              <label className="label" htmlFor="ev-km">Distance (km)</label>
              <input id="ev-km" name="distanceKm" inputMode="decimal" className="input" defaultValue={event?.distanceKm ?? ""} placeholder="optional" />
            </div>
          </div>
          <PottyToggles pee={pee} poop={poop} setPee={setPee} setPoop={setPoop} />
          {poop && <StoolDetails value={stool} onChange={setStool} />}
        </>
      )}

      {type === "poop" && <StoolDetails value={stool} onChange={setStool} />}

      {type === "weight" && (
        <div>
          <label className="label" htmlFor="ev-kg">Weight (kg)</label>
          <input id="ev-kg" name="weightKg" inputMode="decimal" className="input text-2xl font-bold" defaultValue={event?.weightKg ?? ""} autoFocus required />
        </div>
      )}

      {type === "medication" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ev-med">Medication</label>
            <select id="ev-med" name="medicationId" className="input" defaultValue={event?.medicationId ?? ""}>
              <option value="">Other / one-off</option>
              {meds?.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ev-amt">Dose</label>
            <input id="ev-amt" name="amount" className="input" defaultValue={event?.amount ?? ""} placeholder="e.g. 1 tablet" />
          </div>
        </div>
      )}

      {type === "meal" && (
        <>
          <MealFields value={meal} onChange={setMeal} dogFood={dog.food} />
          {event?.amount && <p className="text-sm text-muted">Earlier note: {event.amount}</p>}
        </>
      )}

      <div>
        <label className="label" htmlFor="ev-notes">
          {type === "vet" ? "What happened at the vet?" : type === "symptom" ? "Symptoms" : "Notes"}
        </label>
        <textarea id="ev-notes" name="notes" rows={type === "vet" || type === "symptom" || type === "note" ? 4 : 2} className="input" defaultValue={event?.notes ?? ""} />
      </div>

      <div className="flex gap-2">
        {event && (
          <button
            type="button"
            className="btn-danger"
            onClick={async () => {
              await remove({ eventId: event._id });
              toast({ text: "Deleted" });
              onDone();
            }}
          >
            <Trash2 className="size-4" /> Delete
          </button>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{event ? "Save" : "Log it"}</button>
      </div>
    </form>
  );
}

export function PottyToggles({ pee, poop, setPee, setPoop }: { pee: boolean; poop: boolean; setPee: (b: boolean) => void; setPoop: (b: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { on: pee, set: setPee, label: "Pee", emoji: "💧" },
        { on: poop, set: setPoop, label: "Poop", emoji: "💩" },
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
