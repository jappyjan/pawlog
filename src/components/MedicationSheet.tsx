import { useState } from "react";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { addDays, addMonths, format } from "date-fns";
import { api } from "../../convex/_generated/api";
import { Sheet } from "./Sheet";
import { useApp } from "../lib/app";
import { useToast } from "./Toast";
import { errorMessage, tz } from "../lib/format";

type Repeat = "daily" | "weekly" | "monthly" | "everyNDays";

export function MedicationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dog } = useApp();
  const create = useMutation(api.medications.create);
  const toast = useToast();
  const [remind, setRemind] = useState(true);
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [repeat, setRepeat] = useState<Repeat>("daily");

  return (
    <Sheet open={open} onClose={onClose} title="New medication">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const start = String(fd.get("start"));
          const intervalDays = Number(fd.get("intervalDays")) || undefined;
          const step = (d: Date) =>
            repeat === "daily" ? addDays(d, 1) : repeat === "weekly" ? addDays(d, 7) : repeat === "monthly" ? addMonths(d, 1) : addDays(d, intervalDays ?? 1);
          const firstDueAts = times.filter(Boolean).map((t) => {
            let d = new Date(`${start}T${t}`);
            while (d.getTime() < Date.now() - 60_000) d = step(d);
            return d.getTime();
          });
          try {
            await create({
              dogId: dog._id,
              name: String(fd.get("name")),
              dosage: String(fd.get("dosage")),
              notes: String(fd.get("notes")),
              schedule: remind && firstDueAts.length ? { times, repeat, intervalDays, firstDueAts, timezone: tz() } : undefined,
            });
            toast({ text: "Medication added" });
            onClose();
          } catch (err) {
            toast({ text: errorMessage(err), error: true });
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-name">Name *</label>
            <input id="m-name" name="name" className="input" required placeholder="e.g. Bravecto" />
          </div>
          <div>
            <label className="label" htmlFor="m-dose">Dose</label>
            <input id="m-dose" name="dosage" className="input" placeholder="e.g. ½ tablet" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-notes">Notes</label>
          <input id="m-notes" name="notes" className="input" placeholder="with food, for ears…" />
        </div>

        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="size-5 accent-brand" />
          Remind us
        </label>

        {remind && (
          <div className="space-y-3 rounded-xl bg-bg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="m-repeat">Repeat</label>
                <select id="m-repeat" className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                  <option value="everyNDays">Every N days</option>
                </select>
              </div>
              {repeat === "everyNDays" ? (
                <div>
                  <label className="label" htmlFor="m-n">Every … days</label>
                  <input id="m-n" name="intervalDays" type="number" min={1} defaultValue={2} className="input" />
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="m-start">Starting</label>
                  <input id="m-start" name="start" type="date" className="input" defaultValue={format(new Date(), "yyyy-MM-dd")} required />
                </div>
              )}
            </div>
            {repeat === "everyNDays" && (
              <div>
                <label className="label" htmlFor="m-start2">Starting</label>
                <input id="m-start2" name="start" type="date" className="input" defaultValue={format(new Date(), "yyyy-MM-dd")} required />
              </div>
            )}
            <fieldset>
              <legend className="label">Times</legend>
              <div className="flex flex-wrap items-center gap-2">
                {times.map((t, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input
                      type="time"
                      aria-label={`Dose time ${i + 1}`}
                      className="input w-28"
                      value={t}
                      onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {times.length > 1 && (
                      <button type="button" className="btn-ghost size-8 p-0" aria-label="Remove time" onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                        <X className="size-4" />
                      </button>
                    )}
                  </span>
                ))}
                {repeat === "daily" && (
                  <button type="button" className="chip" onClick={() => setTimes([...times, "20:00"])}>
                    <Plus className="size-4" /> time
                  </button>
                )}
              </div>
            </fieldset>
          </div>
        )}
        <button className="btn-primary w-full">Add medication</button>
      </form>
    </Sheet>
  );
}
