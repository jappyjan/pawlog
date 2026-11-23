import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileText, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useApp } from "../lib/app";
import { bytes, errorMessage } from "../lib/format";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { shrinkImage, uploadToConvex } from "../lib/upload";

type Category = Doc<"documents">["category"];
const CATS: Record<Category, string> = {
  vaccination: "💉 Vaccination",
  vet: "🩺 Vet records",
  insurance: "🛡️ Insurance",
  registration: "🪪 Registration / tax",
  pedigree: "📜 Pedigree",
  receipt: "🧾 Receipts",
  other: "📁 Other",
};

type D = Doc<"documents"> & { url: string | null };

export function Docs() {
  const { dog } = useApp();
  const docs = useQuery(api.documents.list, { dogId: dog._id });
  const [cat, setCat] = useState<Category | null>(null);
  const [edit, setEdit] = useState<{ d?: D } | null>(null);
  const shown = docs?.filter((d) => !cat || d.category === cat);
  const used = new Set(docs?.map((d) => d.category));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Papers</h1>
        <button type="button" className="btn-primary" onClick={() => setEdit({})}>
          <Upload className="size-4" /> Upload
        </button>
      </div>

      {(dog.microchip || dog.registrationNo || dog.insurance) && (
        <section className="card grid gap-1 p-4 text-sm">
          {dog.microchip && <IdLine label="Microchip" value={dog.microchip} />}
          {dog.registrationNo && <IdLine label="Registration" value={dog.registrationNo} />}
          {dog.insurance && <IdLine label="Insurance" value={dog.insurance} />}
        </section>
      )}

      {used.size > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <button type="button" className={`chip shrink-0 ${cat === null ? "chip-on" : ""}`} onClick={() => setCat(null)}>All</button>
          {(Object.keys(CATS) as Category[]).filter((c) => used.has(c)).map((c) => (
            <button key={c} type="button" className={`chip shrink-0 ${cat === c ? "chip-on" : ""}`} onClick={() => setCat(c)}>{CATS[c]}</button>
          ))}
        </div>
      )}

      {docs?.length === 0 && (
        <button type="button" onClick={() => setEdit({})} className="card flex w-full flex-col items-center gap-2 border-dashed p-8 text-center text-muted">
          <FileText className="size-8" />
          <span className="font-semibold text-ink">Keep your dog's papers here</span>
          <span className="text-sm">Vaccination pass, pedigree, insurance, vet bills — snap a photo or upload a PDF.</span>
        </button>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown?.map((d) => <DocCard key={d._id} d={d} onEdit={() => setEdit({ d })} />)}
      </ul>

      <DocSheet state={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function IdLine({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <button type="button" className="font-mono font-semibold" onClick={() => void navigator.clipboard?.writeText(value).then(() => toast({ text: "Copied" }))} title="Copy">
        {value}
      </button>
    </div>
  );
}

function DocCard({ d, onEdit }: { d: D; onEdit: () => void }) {
  const isImage = d.contentType?.startsWith("image/");
  const daysLeft = d.expiresOn ? differenceInCalendarDays(parseISO(d.expiresOn), new Date()) : null;
  return (
    <li className="card overflow-hidden">
      <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-bg">
        {isImage && d.url ? (
          <img src={d.url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted">
            <FileText className="size-10" />
            <span className="sr-only">Open {d.title}</span>
          </span>
        )}
        {daysLeft !== null && daysLeft <= 30 && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${daysLeft < 0 ? "bg-red-600" : "bg-amber-500"}`}>
            {daysLeft < 0 ? "Expired" : `Expires in ${daysLeft} d`}
          </span>
        )}
      </a>
      <button type="button" onClick={onEdit} className="block w-full p-3 text-left">
        <span className="block truncate font-semibold">{d.title}</span>
        <span className="block truncate text-xs text-muted">
          {CATS[d.category]}{d.date ? ` · ${format(parseISO(d.date), "d MMM yyyy")}` : ""}
        </span>
      </button>
    </li>
  );
}

function DocSheet({ state, onClose }: { state: { d?: D } | null; onClose: () => void }) {
  const { dog } = useApp();
  const genUrl = useMutation(api.documents.generateUploadUrl);
  const create = useMutation(api.documents.create);
  const update = useMutation(api.documents.update);
  const remove = useMutation(api.documents.remove);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const d = state?.d;

  return (
    <Sheet open={state !== null} onClose={() => { setFile(null); onClose(); }} title={d ? "Edit document" : "Upload document"}>
      {state && (
        <form
          key={d?._id ?? "new"}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const fields = {
              title: String(fd.get("title")) || file?.name.replace(/\.[^.]+$/, "") || "Document",
              category: fd.get("category") as Category,
              date: String(fd.get("date")),
              expiresOn: String(fd.get("expiresOn")),
              notes: String(fd.get("notes")),
            };
            setBusy(true);
            try {
              if (d) {
                await update({ documentId: d._id, ...fields });
              } else {
                if (!file) throw new Error("Pick a file first");
                const blob = await shrinkImage(file, 2400, 0.88);
                const storageId = await uploadToConvex(await genUrl(), blob);
                await create({ dogId: dog._id, storageId, contentType: blob.type || file.type, size: blob.size, ...fields });
              }
              toast({ text: "Saved 📄" });
              setFile(null);
              onClose();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            } finally {
              setBusy(false);
            }
          }}
        >
          {!d && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-brand">
              <Plus className="size-6 text-brand" />
              <span className="font-semibold">{file ? file.name : "Take a photo or choose a file"}</span>
              <span className="text-xs text-muted">{file ? bytes(file.size) : "Images or PDF"}</span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <div>
            <label className="label" htmlFor="d-title">Title</label>
            <input id="d-title" name="title" className="input" defaultValue={d?.title ?? ""} placeholder={file?.name ?? "e.g. EU pet passport"} />
          </div>
          <div>
            <label className="label" htmlFor="d-cat">Category</label>
            <select id="d-cat" name="category" className="input" defaultValue={d?.category ?? "vaccination"}>
              {(Object.keys(CATS) as Category[]).map((c) => <option key={c} value={c}>{CATS[c]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="d-date">Issued</label>
              <input id="d-date" name="date" type="date" className="input" defaultValue={d?.date ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="d-exp">Expires / valid until</label>
              <input id="d-exp" name="expiresOn" type="date" className="input" defaultValue={d?.expiresOn ?? ""} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="d-notes">Notes</label>
            <textarea id="d-notes" name="notes" rows={2} className="input" defaultValue={d?.notes ?? ""} />
          </div>
          <div className="flex gap-2">
            {d && (
              <>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (confirm(`Delete “${d.title}”?`)) void remove({ documentId: d._id }).then(onClose);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
                {d.url && (
                  <a className="btn-ghost" href={d.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open
                  </a>
                )}
              </>
            )}
            <button className="btn-primary flex-1" disabled={busy}>{busy ? "Uploading…" : "Save"}</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
