import type { Doc } from "../../convex/_generated/dataModel";

export type DogFormValues = {
  name: string;
  breed: string;
  sex?: "male" | "female";
  neutered?: boolean;
  birthDate: string;
  color: string;
  microchip: string;
  registrationNo: string;
  insurance: string;
  vetName: string;
  vetPhone: string;
  food: string;
  notes: string;
  walkGoalPerDay?: number;
  kcalGoalPerDay?: number;
};

export function readDogForm(form: HTMLFormElement): DogFormValues {
  const fd = new FormData(form);
  const s = (k: string) => String(fd.get(k) ?? "");
  const sex = s("sex");
  const goal = Number(s("walkGoalPerDay"));
  return {
    name: s("name"),
    breed: s("breed"),
    sex: sex === "male" || sex === "female" ? sex : undefined,
    neutered: fd.get("neutered") === "on",
    birthDate: s("birthDate"),
    color: s("color"),
    microchip: s("microchip"),
    registrationNo: s("registrationNo"),
    insurance: s("insurance"),
    vetName: s("vetName"),
    vetPhone: s("vetPhone"),
    food: s("food"),
    notes: s("notes"),
    walkGoalPerDay: goal > 0 ? goal : undefined,
    kcalGoalPerDay: Number(s("kcalGoalPerDay")) > 0 ? Math.round(Number(s("kcalGoalPerDay"))) : undefined,
  };
}

function F({ name, label, d, ...rest }: { name: keyof Doc<"dogs">; label: string; d?: Partial<Doc<"dogs">> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={`dog-${name}`}>{label}</label>
      <input id={`dog-${name}`} name={name} className="input" defaultValue={(d?.[name] as string | number | undefined) ?? ""} {...rest} />
    </div>
  );
}

export function DogFields({ dog, compact }: { dog?: Partial<Doc<"dogs">>; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <F name="name" label="Name *" d={dog} required autoFocus={!dog?.name} />
      <div className="grid grid-cols-2 gap-3">
        <F name="breed" label="Breed" d={dog} />
        <F name="birthDate" label="Birthday" type="date" d={dog} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="dog-sex">Sex</label>
          <select id="dog-sex" name="sex" className="input" defaultValue={dog?.sex ?? ""}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium">
          <input type="checkbox" name="neutered" defaultChecked={dog?.neutered} className="size-5 accent-brand" />
          Neutered / spayed
        </label>
      </div>
      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <F name="color" label="Color / markings" d={dog} />
            <F name="walkGoalPerDay" label="Walks per day goal" type="number" min={0} max={10} d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">Papers & IDs</h3>
          <F name="microchip" label="Microchip number" d={dog} inputMode="numeric" />
          <div className="grid grid-cols-2 gap-3">
            <F name="registrationNo" label="Registration / tax no." d={dog} />
            <F name="insurance" label="Insurance policy" d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">Vet</h3>
          <div className="grid grid-cols-2 gap-3">
            <F name="vetName" label="Vet / clinic" d={dog} />
            <F name="vetPhone" label="Vet phone" type="tel" d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">Care</h3>
          <div className="grid grid-cols-2 gap-3">
            <F name="food" label="Food & portions" d={dog} placeholder="e.g. 2× 120 g kibble" />
            <F name="kcalGoalPerDay" label="Calories per day goal" type="number" min={0} max={10000} inputMode="numeric" d={dog} placeholder="e.g. 900" />
          </div>
          <div>
            <label className="label" htmlFor="dog-notes">Notes (allergies, quirks…)</label>
            <textarea id="dog-notes" name="notes" rows={3} className="input" defaultValue={dog?.notes ?? ""} />
          </div>
        </>
      )}
    </div>
  );
}
