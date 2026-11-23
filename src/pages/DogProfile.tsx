import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { DogAvatar } from "../components/Avatar";
import { DogFields, readDogForm } from "../components/DogForm";
import { useToast } from "../components/Toast";
import { age, errorMessage } from "../lib/format";
import { shrinkImage, uploadToConvex } from "../lib/upload";
import { Sheet } from "../components/Sheet";
import { useTranslation } from "react-i18next";

export function DogProfile() {
  const { dog, dogs, setDogId } = useApp();
  const update = useMutation(api.dogs.update);
  const genUrl = useMutation(api.dogs.generatePhotoUploadUrl);
  const setPhoto = useMutation(api.dogs.setPhoto);
  const removeDog = useMutation(api.dogs.remove);
  const createDog = useMutation(api.dogs.create);
  const toast = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center gap-2 text-center">
        <button type="button" className="relative" onClick={() => fileRef.current?.click()} aria-label={t("profile.changePhoto")}>
          <DogAvatar url={dog.photoUrl} name={dog.name} size="size-28" />
          <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full bg-brand text-white shadow">
            <Camera className="size-4" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              const blob = await shrinkImage(f, 800, 0.85);
              const storageId = await uploadToConvex(await genUrl(), blob);
              await setPhoto({ dogId: dog._id, storageId });
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            } finally {
              setUploading(false);
            }
          }}
        />
        {uploading && <p className="text-sm text-muted">{t("docs.uploading")}</p>}
        <h1 className="text-2xl font-extrabold">{dog.name}</h1>
        <p className="text-muted">{[dog.breed, age(dog.birthDate), dog.sex].filter(Boolean).join(" · ")}</p>
      </section>

      <form
        key={dog._id}
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await update({ dogId: dog._id, ...readDogForm(e.currentTarget) });
            toast({ text: t("profile.saved") });
          } catch (err) {
            toast({ text: errorMessage(err), error: true });
          }
        }}
      >
        <DogFields dog={dog} />
        <button className="btn-primary w-full">{t("profile.save")}</button>
      </form>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">{t("profile.pack")}</h2>
        <ul className="space-y-2">
          {dogs.map((d) => (
            <li key={d._id}>
              <button type="button" className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${d._id === dog._id ? "bg-brand-soft" : ""}`} onClick={() => setDogId(d._id)}>
                <DogAvatar url={d.photoUrl} name={d.name} size="size-9" />
                <span className="font-semibold">{d.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-soft w-full" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> {t("profile.addAnother")}
        </button>
      </section>

      <button
        type="button"
        className="btn-danger w-full"
        onClick={async () => {
          if (!confirm(t("profile.deleteConfirm", { name: dog.name }))) return;
          if (prompt(t("profile.typeToConfirm", { name: dog.name })) !== dog.name) return;
          await removeDog({ dogId: dog._id });
          navigate("/");
        }}
      >
        <Trash2 className="size-4" /> {t("profile.delete", { name: dog.name })}
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t("profile.addDogTitle")}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const id = await createDog(readDogForm(e.currentTarget));
              setDogId(id);
              setAddOpen(false);
              e.currentTarget?.reset();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          <DogFields compact />
          <button className="btn-primary w-full">{t("onboarding.addDog")}</button>
        </form>
      </Sheet>
    </div>
  );
}
