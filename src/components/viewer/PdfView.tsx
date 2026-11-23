import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useTranslation } from "react-i18next";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** All pages stacked, rendered lazily when they scroll into view; `zoom` 1 = fit width. */
export default function PdfView({ url, zoom }: { url: string; zoom: number }) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ url });
    task.promise.then(
      async (d) => {
        const s = [];
        for (let i = 1; i <= d.numPages; i++) {
          const vp = (await d.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        if (!cancelled) {
          setSizes(s);
          setDoc(d);
        }
      },
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);

  if (error) return <p className="p-6 text-center text-white/80">{t("viewer.pdfError")}</p>;
  if (!doc) return <p className="p-6 text-center text-white/70">{t("common.loading")}</p>;
  return (
    <div className="mx-auto flex flex-col items-center gap-3 p-3" style={{ width: `${zoom * 100}%` }}>
      {sizes.map((s, i) => (
        <Page key={i} doc={doc} n={i + 1} ratio={s.h / s.w} zoom={zoom} label={t("viewer.page", { n: i + 1, total: sizes.length })} />
      ))}
    </div>
  );
}

function Page({ doc, n, ratio, zoom, label }: { doc: PDFDocumentProxy; n: number; ratio: number; zoom: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !box.current || !canvas.current) return;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;
    let cancelled = false;
    void doc.getPage(n).then((page) => {
      if (cancelled || !box.current || !canvas.current) return;
      const cssWidth = box.current.clientWidth;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      task = page.render({ canvas: c, viewport });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, n, zoom]);

  return (
    <div ref={box} className="relative w-full bg-white shadow-lg" style={{ aspectRatio: `1 / ${ratio}` }} aria-label={label} role="img">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
