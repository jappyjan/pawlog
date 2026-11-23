import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sheet } from "./Sheet";
import { PottyToggles } from "./EventSheet";
import { useApp } from "../lib/app";
import { useToast } from "./Toast";
import { errorMessage } from "../lib/format";
import { StoolDetails, stoolArgs, useStool } from "./StoolDetails";

export function FinishWalkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dog } = useApp();
  const finish = useMutation(api.dogs.finishWalk);
  const toast = useToast();
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  const [stool, setStool] = useStool();
  const mins = dog.walkStartedAt ? Math.max(1, Math.round((Date.now() - dog.walkStartedAt) / 60000)) : 0;
  return (
    <Sheet open={open} onClose={onClose} title={`Walk done · ${mins} min`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const km = parseFloat(String(fd.get("km")).replace(",", "."));
          try {
            await finish({ dogId: dog._id, pee, poop, distanceKm: Number.isFinite(km) ? km : undefined, notes: String(fd.get("notes")), ...(poop && stoolArgs(stool)) });
            toast({ text: "Walk saved 🦮" });
            setPee(true);
            setPoop(false);
            setStool({ stoolFlags: [] });
            onClose();
          } catch (err) {
            toast({ text: errorMessage(err), error: true });
          }
        }}
      >
        <p className="text-sm text-muted">What happened on the walk?</p>
        <PottyToggles pee={pee} poop={poop} setPee={setPee} setPoop={setPoop} />
        {poop && <StoolDetails value={stool} onChange={setStool} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="w-km">Distance (km)</label>
            <input id="w-km" name="km" inputMode="decimal" className="input" placeholder="optional" />
          </div>
          <div>
            <label className="label" htmlFor="w-notes">Notes</label>
            <input id="w-notes" name="notes" className="input" placeholder="optional" />
          </div>
        </div>
        <button className="btn-primary w-full">Save walk</button>
      </form>
    </Sheet>
  );
}
