import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <F name="name" label={`${t("common.name")} *`} d={dog} required autoFocus={!dog?.name} />
      <div className="grid grid-cols-2 gap-3">
        <F name="breed" label={t("dog.breed")} d={dog} />
        <F name="birthDate" label={t("dog.birthday")} type="date" d={dog} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="dog-sex">{t("dog.sex")}</label>
          <select id="dog-sex" name="sex" className="input" defaultValue={dog?.sex ?? ""}>
            <option value="">—</option>
            <option value="male">{t("dog.male")}</option>
            <option value="female">{t("dog.female")}</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium">
          <input type="checkbox" name="neutered" defaultChecked={dog?.neutered} className="size-5 accent-brand" />
          {t("dog.neutered")}
        </label>
      </div>
      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <F name="color" label={t("dog.color")} d={dog} />
            <F name="walkGoalPerDay" label={t("dog.walkGoal")} type="number" min={0} max={10} d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">{t("dog.papers")}</h3>
          <F name="microchip" label={t("dog.microchip")} d={dog} inputMode="numeric" />
          <div className="grid grid-cols-2 gap-3">
            <F name="registrationNo" label={t("dog.registration")} d={dog} />
            <F name="insurance" label={t("dog.insurance")} d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">{t("dog.vet")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <F name="vetName" label={t("dog.vetName")} d={dog} />
            <F name="vetPhone" label={t("dog.vetPhone")} type="tel" d={dog} />
          </div>
          <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">{t("dog.care")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <F name="food" label={t("dog.food")} d={dog} placeholder={t("dog.foodPh")} />
            <F name="kcalGoalPerDay" label={t("dog.kcalGoal")} type="number" min={0} max={10000} inputMode="numeric" d={dog} placeholder={t("dog.kcalGoalPh")} />
          </div>
          <div>
            <label className="label" htmlFor="dog-notes">{t("dog.notes")}</label>
            <textarea id="dog-notes" name="notes" rows={3} className="input" defaultValue={dog?.notes ?? ""} />
          </div>
        </>
      )}
    </div>
  );
}
