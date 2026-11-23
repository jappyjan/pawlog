import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Share, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { downloadFile, FILE_ICON, fileKind, shareFile, type ViewerFile } from "../../lib/files";
import { bytes, errorMessage } from "../../lib/format";
import { useToast } from "../Toast";

const PdfView = lazy(() => import("./PdfView"));
const DocxView = lazy(() => import("./DocxView"));

const ZOOMS = [1, 1.5, 2, 3];

/** Full-screen in-app viewer for a document's files (swipe / arrows between them). */
export function FileViewer({
  files,
  index,
  title,
  onIndex,
  onClose,
}: {
  files: ViewerFile[];
  index: number | null;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const open = index !== null && files.length > 0;
  const i = Math.min(index ?? 0, files.length - 1);
  const file = files[i];
  const kind = file ? fileKind(file) : "other";
  const many = files.length > 1;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // New file → back to fit.
  useEffect(() => setZoom(1), [i, file?.storageId]);

  const go = (delta: number) => many && onIndex((i + delta + files.length) % files.length);

  // Horizontal swipe between files (only when not zoomed in, so panning still works).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const canSwipe = many && zoom === 1 && kind !== "pdf" && kind !== "docx" && kind !== "text";

  const zoomable = kind === "image" || kind === "pdf";
  const step = (d: number) => setZoom((z) => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + d))] ?? 1);

  return createPortal(
    <dialog
      ref={ref}
      className="viewer"
      aria-label={title}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      {open && file && (
        <div className="flex h-full flex-col">
          <header className="pt-safe flex shrink-0 items-center gap-1 bg-black/70 px-2 pb-2 text-white backdrop-blur">
            <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={t("common.close")} onClick={() => ref.current?.close()}>
              <X className="size-6" />
            </button>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-sm font-bold">{title}</p>
              <p className="truncate text-xs text-white/70">
                {many && `${i + 1} / ${files.length} · `}
                {file.name}
                {file.size ? ` · ${bytes(file.size)}` : ""}
              </p>
            </div>
            {zoomable && (
              <>
                <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40" aria-label={t("viewer.zoomOut")} disabled={zoom === ZOOMS[0]} onClick={() => step(-1)}>
                  <ZoomOut className="size-5" />
                </button>
                <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40" aria-label={t("viewer.zoomIn")} disabled={zoom === ZOOMS.at(-1)} onClick={() => step(1)}>
                  <ZoomIn className="size-5" />
                </button>
              </>
            )}
            {"share" in navigator ? (
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full hover:bg-white/10"
                aria-label={t("common.share")}
                onClick={() =>
                  void shareFile(file, title)
                    .then(async (ok) => {
                      if (!ok) await downloadFile(file);
                    })
                    .catch((e) => toast({ text: errorMessage(e), error: true }))
                }
              >
                <Share className="size-5" />
              </button>
            ) : (
              <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label={t("viewer.download")} onClick={() => void downloadFile(file).catch((e) => toast({ text: errorMessage(e), error: true }))}>
                <Download className="size-5" />
              </button>
            )}
            {file.url && (
              <a className="grid size-10 place-items-center rounded-full hover:bg-white/10" href={file.url} target="_blank" rel="noreferrer" aria-label={t("viewer.openNewTab")}>
                <ExternalLink className="size-5" />
              </a>
            )}
          </header>

          <div
            className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
            onPointerDown={(e) => canSwipe && (swipe.current = { x: e.clientX, y: e.clientY })}
            onPointerUp={(e) => {
              const s = swipe.current;
              swipe.current = null;
              if (!s) return;
              const dx = e.clientX - s.x;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
            }}
          >
            {!file.url ? (
              <Fallback file={file} />
            ) : kind === "image" ? (
              <div className={`flex min-h-full ${zoom === 1 ? "items-center justify-center" : ""}`}>
                <img
                  key={file.storageId}
                  src={file.url}
                  alt={file.name}
                  draggable={false}
                  className={zoom === 1 ? "max-h-full max-w-full object-contain" : "max-w-none"}
                  style={zoom === 1 ? undefined : { width: `${zoom * 100}%` }}
                  onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                />
              </div>
            ) : kind === "pdf" ? (
              <Suspense fallback={<p className="p-6 text-center text-white/70">{t("common.loading")}</p>}>
                <PdfView key={file.storageId} url={file.url} zoom={zoom} />
              </Suspense>
            ) : kind === "video" ? (
              <div className="grid min-h-full place-items-center">
                <video key={file.storageId} src={file.url} controls playsInline className="max-h-full max-w-full" />
              </div>
            ) : kind === "audio" ? (
              <div className="grid min-h-full place-items-center p-6">
                <audio key={file.storageId} src={file.url} controls className="w-full max-w-md" />
              </div>
            ) : kind === "text" ? (
              <TextView key={file.storageId} url={file.url} />
            ) : kind === "docx" ? (
              <Suspense fallback={<p className="p-6 text-center text-white/70">{t("common.loading")}</p>}>
                <DocxView key={file.storageId} url={file.url} />
              </Suspense>
            ) : (
              <Fallback file={file} />
            )}
          </div>

          {many && (
            <footer className="pb-safe flex shrink-0 items-center justify-between gap-2 bg-black/70 px-2 pt-2 text-white backdrop-blur">
              <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={t("viewer.prev")} onClick={() => go(-1)}>
                <ChevronLeft className="size-6" />
              </button>
              <div className="flex min-w-0 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
                {files.map((f, j) => (
                  <button
                    key={f.storageId}
                    type="button"
                    aria-label={f.name}
                    aria-current={j === i}
                    onClick={() => onIndex(j)}
                    className={`grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border-2 text-lg ${j === i ? "border-white" : "border-transparent opacity-60"}`}
                  >
                    {fileKind(f) === "image" && f.url ? <img src={f.url} alt="" className="size-full object-cover" loading="lazy" /> : FILE_ICON[fileKind(f)]}
                  </button>
                ))}
              </div>
              <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={t("viewer.next")} onClick={() => go(1)}>
                <ChevronRight className="size-6" />
              </button>
            </footer>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  );
}

function TextView({ url }: { url: string }) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(url)
      .then((r) => r.text())
      .then((s) => !cancelled && setText(s))
      .catch(() => !cancelled && setText(t("viewer.cantPreview")));
    return () => {
      cancelled = true;
    };
  }, [url, t]);
  return (
    <pre className="min-h-full whitespace-pre-wrap break-words bg-white p-4 font-mono text-sm text-neutral-900">{text ?? t("common.loading")}</pre>
  );
}

function Fallback({ file }: { file: ViewerFile }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <div className="grid min-h-full place-items-center p-6 text-center text-white">
      <div className="space-y-3">
        <div className="text-6xl" aria-hidden>{FILE_ICON[fileKind(file)]}</div>
        <p className="font-semibold">{file.name}</p>
        <p className="text-sm text-white/70">{t("viewer.noPreview")}</p>
        <div className="flex justify-center gap-2">
          {file.url && (
            <a className="btn bg-white text-neutral-900" href={file.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> {t("docs.open")}
            </a>
          )}
          <button type="button" className="btn bg-white/15 text-white" onClick={() => void downloadFile(file).catch((e) => toast({ text: errorMessage(e), error: true }))}>
            <Download className="size-4" /> {t("viewer.download")}
          </button>
        </div>
      </div>
    </div>
  );
}
