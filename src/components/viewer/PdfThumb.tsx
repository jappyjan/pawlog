import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** First page of a PDF as a cover image (rendered when scrolled into view). */
export default function PdfThumb({ url, className = "" }: { url: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const task = pdfjs.getDocument({ url });
      destroy = () => void task.destroy();
      task.promise
        .then((doc) => doc.getPage(1))
        .then((page) => {
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (Math.max(c.clientWidth, 160) * Math.min(devicePixelRatio || 1, 2)) / base.width });
          c.width = Math.floor(viewport.width);
          c.height = Math.floor(viewport.height);
          return page.render({ canvas: c, viewport }).promise;
        })
        .catch(() => !cancelled && setFailed(true));
    });
    io.observe(c);
    return () => {
      cancelled = true;
      io.disconnect();
      destroy?.();
    };
  }, [url]);
  if (failed) return <span className={`grid place-items-center bg-bg text-3xl ${className}`} aria-hidden>📄</span>;
  return <canvas ref={canvas} className={`bg-white object-cover object-top ${className}`} aria-hidden />;
}
