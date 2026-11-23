import { lazy, Suspense, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUp, Files, FileText, Plus, Trash2, Upload, X, Eye } from "lucide-react";
import { parseISO, differenceInCalendarDays } from "date-fns";
import i18n from "../i18n";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useApp } from "../lib/app";
import { bytes, errorMessage, fmt } from "../lib/format";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { uploadFiles } from "../lib/upload";
import { ACCEPT, FILE_ICON, fileKind } from "../lib/files";
import { FileViewer } from "../components/viewer/FileViewer";
import { useTranslation } from "react-i18next";

type Category = Doc<"documents">["category"];
const CAT_EMOJI: Record<Category, string> = {
  vaccination: "💉",
  vet: "🩺",
  insurance: "🛡️",
  registration: "🪪",
  pedigree: "📜",
  receipt: "🧾",
  other: "📁",
};
const CAT_KEYS = Object.keys(CAT_EMOJI) as Category[];
const catLabel = (c: Category) => `${CAT_EMOJI[c]} ${i18n.t(`docs.cat.${c}`)}`;

type D = NonNullable<FunctionReturnType<typeof api.documents.list>>[number];

export function Docs() {
  const { dog } = useApp();
  const { t } = useTranslation();
  const docs = useQuery(api.documents.list, { dogId: dog._id });
  const [cat, setCat] = useState<Category | null>(null);
  const [edit, setEdit] = useState<{ id?: Id<"documents"> } | null>(null);
  const [view, setView] = useState<{ id: Id<"documents">; index: number } | null>(null);
  const viewing = view ? docs?.find((d) => d._id === view.id) : undefined;
  const editing = edit?.id ? docs?.find((d) => d._id === edit.id) : undefined;
  const shown = docs?.filter((d) => !cat || d.category === cat);
  const used = new Set(docs?.map((d) => d.category));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("nav.papers")}</h1>
        <button type="button" className="btn-primary" onClick={() => setEdit({})}>
          <Upload className="size-4" /> {t("docs.upload")}
        </button>
      </div>

      {(dog.microchip || dog.registrationNo || dog.insurance) && (
        <section className="card grid gap-1 p-4 text-sm">
          {dog.microchip && <IdLine label={t("docs.microchip")} value={dog.microchip} />}
          {dog.registrationNo && <IdLine label={t("docs.registration")} value={dog.registrationNo} />}
          {dog.insurance && <IdLine label={t("docs.insurance")} value={dog.insurance} />}
        </section>
      )}

      {used.size > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <button type="button" className={`chip shrink-0 ${cat === null ? "chip-on" : ""}`} onClick={() => setCat(null)}>{t("history.all")}</button>
          {CAT_KEYS.filter((c) => used.has(c)).map((c) => (
            <button key={c} type="button" className={`chip shrink-0 ${cat === c ? "chip-on" : ""}`} onClick={() => setCat(c)}>{catLabel(c)}</button>
          ))}
        </div>
      )}

      {docs?.length === 0 && (
        <button type="button" onClick={() => setEdit({})} className="card flex w-full flex-col items-center gap-2 border-dashed p-8 text-center text-muted">
          <FileText className="size-8" />
          <span className="font-semibold text-ink">{t("docs.emptyTitle")}</span>
          <span className="text-sm">{t("docs.emptyBody")}</span>
        </button>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown?.map((d) => (
          <DocCard key={d._id} d={d} onOpen={() => setView({ id: d._id, index: 0 })} onEdit={() => setEdit({ id: d._id })} />
        ))}
      </ul>

      <DocSheet open={edit !== null} d={editing} onClose={() => setEdit(null)} onView={(index) => editing && setView({ id: editing._id, index })} />
      <FileViewer
        files={viewing?.files ?? []}
        index={viewing ? view!.index : null}
        title={viewing?.title ?? ""}
        onIndex={(index) => setView((v) => v && { ...v, index })}
        onClose={() => setView(null)}
      />
    </div>
  );
}

function IdLine({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <button type="button" className="font-mono font-semibold" onClick={() => void navigator.clipboard?.writeText(value).then(() => toast({ text: t("common.copied") }))} title={t("common.copy")}>
        {value}
      </button>
    </div>
  );
}

const PdfThumb = lazy(() => import("../components/viewer/PdfThumb"));

function Thumb({ f, className = "" }: { f: D["files"][number]; className?: string }) {
  const kind = fileKind(f);
  if (kind === "image" && f.url) return <img src={f.url} alt="" loading="lazy" className={`object-cover ${className}`} />;
  if (kind === "pdf" && f.url)
    return (
      <Suspense fallback={<span className={`bg-bg ${className}`} />}>
        <PdfThumb url={f.url} className={className} />
      </Suspense>
    );
  return (
    <span className={`grid place-items-center bg-bg ${className}`}>
      <span className="text-3xl" aria-hidden>{FILE_ICON[kind]}</span>
    </span>
  );
}

function DocCard({ d, onOpen, onEdit }: { d: D; onOpen: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const daysLeft = d.expiresOn ? differenceInCalendarDays(parseISO(d.expiresOn), new Date()) : null;
  const first = d.files[0];
  return (
    <li className="card overflow-hidden">
      <button type="button" onClick={onOpen} className="relative block aspect-[4/3] w-full bg-bg" aria-label={`${t("docs.open")} ${d.title}`}>
        {first ? <Thumb f={first} className="size-full" /> : <FileText className="m-auto size-10 text-muted" />}
        {daysLeft !== null && daysLeft <= 30 && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${daysLeft < 0 ? "bg-red-600" : "bg-amber-500"}`}>
            {daysLeft < 0 ? t("docs.expired") : t("docs.expiresIn", { n: daysLeft })}
          </span>
        )}
        {d.files.length > 1 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white">
            <Files className="size-3" /> {d.files.length}
          </span>
        )}
      </button>
      <button type="button" onClick={onEdit} className="block w-full p-3 text-left">
        <span className="block truncate font-semibold">{d.title}</span>
        <span className="block truncate text-xs text-muted">
          {catLabel(d.category)}{d.date ? ` · ${fmt(parseISO(d.date), "d MMM yyyy")}` : ""}
        </span>
      </button>
    </li>
  );
}

const stripExt = (n: string) => n.replace(/\.[^.]+$/, "");

function DocSheet({ open, d, onClose, onView }: { open: boolean; d?: D; onClose: () => void; onView: (index: number) => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={d ? t("docs.editTitle") : t("docs.uploadTitle")}>
      {open && <DocForm key={d?._id ?? "new"} d={d} onDone={onClose} onView={onView} />}
    </Sheet>
  );
}

function DocForm({ d, onDone, onView }: { d?: D; onDone: () => void; onView: (index: number) => void }) {
  const { dog } = useApp();
  const genUrl = useMutation(api.documents.generateUploadUrl);
  const create = useMutation(api.documents.create);
  const update = useMutation(api.documents.update);
  const remove = useMutation(api.documents.remove);
  const addFiles = useMutation(api.documents.addFiles);
  const removeFile = useMutation(api.documents.removeFile);
  const reorder = useMutation(api.documents.reorderFiles);
  const toast = useToast();
  const { t } = useTranslation();
  const [picked, setPicked] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = progress !== null;

  const upload = async (files: File[]) => {
    setProgress({ done: 0, total: files.length });
    try {
      return await uploadFiles(files, () => genUrl(), (done) => setProgress({ done, total: files.length }));
    } finally {
      setProgress(null);
    }
  };

  const fileInput = (onFiles: (fs: File[]) => void, label: string) => (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-4 text-center font-semibold hover:border-brand">
      <Plus className="size-5 text-brand" /> {label}
      <input
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])];
          e.target.value = "";
          if (fs.length) onFiles(fs);
        }}
      />
    </label>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const fields = {
          title: String(fd.get("title")) || (picked[0] ? stripExt(picked[0].name) : "") || d?.title || t("docs.document"),
          category: fd.get("category") as Category,
          date: String(fd.get("date")),
          expiresOn: String(fd.get("expiresOn")),
          notes: String(fd.get("notes")),
        };
        try {
          if (d) await update({ documentId: d._id, ...fields });
          else {
            if (!picked.length) throw new Error(t("docs.pickFile"));
            await create({ dogId: dog._id, files: await upload(picked), ...fields });
          }
          toast({ text: t("docs.saved") });
          onDone();
        } catch (err) {
          toast({ text: errorMessage(err), error: true });
        }
      }}
    >
      {/* Files */}
      <fieldset className="space-y-2">
        <legend className="label">{t("docs.files", { count: d ? d.files.length : picked.length })}</legend>
        {d ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {d.files.map((f, i) => (
              <li key={f.storageId} className="flex items-center gap-2 p-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onView(i)}>
                  <Thumb f={f} className="size-11 shrink-0 rounded-lg" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{f.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted"><Eye className="size-3" /> {bytes(f.size)}</span>
                  </span>
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    className="btn-ghost size-9 shrink-0 p-0"
                    aria-label={t("docs.moveUp")}
                    onClick={() => {
                      const ids = d.files.map((x) => x.storageId);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      void reorder({ documentId: d._id, order: ids });
                    }}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost size-9 shrink-0 p-0 text-red-600"
                  aria-label={t("docs.removeFile", { name: f.name })}
                  onClick={() => {
                    const last = d.files.length === 1;
                    if (!confirm(last ? t("docs.removeLastConfirm") : t("docs.removeFileConfirm", { name: f.name }))) return;
                    void removeFile({ documentId: d._id, storageId: f.storageId }).then(() => last && onDone());
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          picked.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {picked.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2 text-sm">
                  <span className="text-xl" aria-hidden>{FILE_ICON[fileKind({ name: f.name, contentType: f.type })]}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted">{bytes(f.size)}</span>
                  <button type="button" className="btn-ghost size-8 shrink-0 p-0" aria-label={t("docs.removeFile", { name: f.name })} onClick={() => setPicked(picked.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
        {fileInput(
          (fs) =>
            d
              ? void upload(fs)
                  .then((files) => addFiles({ documentId: d._id, files }))
                  .then(() => toast({ text: t("docs.filesAdded", { count: fs.length }) }))
                  .catch((err) => toast({ text: errorMessage(err), error: true }))
              : setPicked([...picked, ...fs]),
          d || picked.length ? t("docs.addFiles") : t("docs.choose"),
        )}
        {!d && !picked.length && <p className="text-center text-xs text-muted">{t("docs.types")}</p>}
        {progress && (
          <p className="text-sm font-semibold text-brand" role="status">
            {t("docs.uploadingN", { done: progress.done, total: progress.total })}
          </p>
        )}
      </fieldset>

      <div>
        <label className="label" htmlFor="d-title">{t("docs.title")}</label>
        <input id="d-title" name="title" className="input" defaultValue={d?.title ?? ""} placeholder={picked[0] ? stripExt(picked[0].name) : t("docs.titlePh")} />
      </div>
      <div>
        <label className="label" htmlFor="d-cat">{t("docs.category")}</label>
        <select id="d-cat" name="category" className="input" defaultValue={d?.category ?? "vaccination"}>
          {CAT_KEYS.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="d-date">{t("docs.issued")}</label>
          <input id="d-date" name="date" type="date" className="input" defaultValue={d?.date ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="d-exp">{t("docs.expires")}</label>
          <input id="d-exp" name="expiresOn" type="date" className="input" defaultValue={d?.expiresOn ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="d-notes">{t("common.notes")}</label>
        <textarea id="d-notes" name="notes" rows={2} className="input" defaultValue={d?.notes ?? ""} />
      </div>
      <div className="flex gap-2">
        {d && (
          <>
            <button
              type="button"
              className="btn-danger"
              aria-label={t("common.delete")}
              onClick={() => {
                if (confirm(t("docs.deleteConfirm", { title: d.title }))) void remove({ documentId: d._id }).then(onDone);
              }}
            >
              <Trash2 className="size-4" />
            </button>
            <button type="button" className="btn-ghost" onClick={() => onView(0)}>
              <Eye className="size-4" /> {t("docs.open")}
            </button>
          </>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{busy ? t("docs.uploading") : t("common.save")}</button>
      </div>
    </form>
  );
}
