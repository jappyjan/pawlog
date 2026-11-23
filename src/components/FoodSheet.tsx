import { useState } from "react";
import { useMutation } from "convex/react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { errorMessage } from "../lib/format";
import { KINDS, UNITS, type Food, type FoodKind, type FoodUnit } from "../lib/nutrition";

export function FoodSheet({
  open,
  onClose,
  food,
  defaultKind,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  food?: Food;
  defaultKind?: FoodKind;
  onSaved?: (id: Id<"foods">) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={food ? `Edit ${food.name}` : "New food"}>
      {open && <FoodForm key={food?._id ?? "new"} food={food} defaultKind={defaultKind} onDone={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function FoodForm({ food, defaultKind, onDone, onSaved }: { food?: Food; defaultKind?: FoodKind; onDone: () => void; onSaved?: (id: Id<"foods">) => void }) {
  const create = useMutation(api.foods.create);
  const update = useMutation(api.foods.update);
  const setArchived = useMutation(api.foods.setArchived);
  const remove = useMutation(api.foods.remove);
  const toast = useToast();
  const [kind, setKind] = useState<FoodKind>(food?.kind ?? defaultKind ?? "dry");
  const [unit, setUnit] = useState<FoodUnit>(food?.unit ?? (defaultKind === "treat" ? "piece" : "g"));
  const [busy, setBusy] = useState(false);
  const unitLabel = UNITS.find((u) => u.id === unit)!;
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
        const fields = {
          name: String(fd.get("name") ?? ""),
          brand: String(fd.get("brand") ?? ""),
          kind,
          unit,
          kcalPer: num(fd.get("kcalPer")),
          defaultQty: num(fd.get("defaultQty")),
          notes: String(fd.get("notes") ?? ""),
        };
        setBusy(true);
        try {
          if (food) await update({ foodId: food._id, ...fields });
          const id = food?._id ?? (await create(fields));
          toast({ text: food ? "Saved" : `${fields.name} added` });
          onSaved?.(id);
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label" htmlFor="f-name">Name *</label>
          <input id="f-name" name="name" className="input" defaultValue={food?.name} required autoFocus={!food} placeholder="e.g. Adult Lamb & Rice" />
        </div>
        <div>
          <label className="label" htmlFor="f-brand">Brand</label>
          <input id="f-brand" name="brand" className="input" defaultValue={food?.brand} placeholder="optional" />
        </div>
        <div>
          <label className="label" htmlFor="f-kind">Type</label>
          <select id="f-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as FoodKind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Measured in</legend>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <button key={u.id} type="button" aria-pressed={unit === u.id} onClick={() => setUnit(u.id)} className={`chip ${unit === u.id ? "chip-on" : ""}`}>
              {u.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-kcal">kcal per {unit === "g" ? "100 g" : unitLabel.short}</label>
          <input id="f-kcal" name="kcalPer" inputMode="decimal" className="input" defaultValue={food?.kcalPer ?? ""} placeholder="optional" />
        </div>
        <div>
          <label className="label" htmlFor="f-qty">Usual portion ({unit === "g" ? "g" : unitLabel.label})</label>
          <input id="f-qty" name="defaultQty" inputMode="decimal" className="input" defaultValue={food?.defaultQty ?? ""} placeholder="optional" />
        </div>
      </div>
      {unit === "g" && <p className="-mt-2 text-xs text-muted">Pack says “3,600 kcal/kg”? Enter 360.</p>}

      <div>
        <label className="label" htmlFor="f-notes">Notes</label>
        <input id="f-notes" name="notes" className="input" defaultValue={food?.notes} placeholder="where to buy, protein %, …" />
      </div>

      <div className="flex flex-wrap gap-2">
        {food && (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await setArchived({ foodId: food._id, archived: !food.archived });
                toast({ text: food.archived ? "Restored" : "Archived. Past meals keep it." });
                onDone();
              }}
            >
              {food.archived ? <><ArchiveRestore className="size-4" /> Restore</> : <><Archive className="size-4" /> Archive</>}
            </button>
            <button
              type="button"
              className="btn-danger"
              aria-label="Delete food"
              onClick={async () => {
                if (!confirm(`Delete ${food.name}? Meals already logged keep their entries.`)) return;
                await remove({ foodId: food._id });
                onDone();
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{food ? "Save" : "Add food"}</button>
      </div>
    </form>
  );
}
