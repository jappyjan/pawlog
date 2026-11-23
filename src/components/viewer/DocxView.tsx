import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { useTranslation } from "react-i18next";

export default function DocxView({ url }: { url: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    void fetch(url)
      .then((r) => r.blob())
      .then((b) => (cancelled || !ref.current ? undefined : renderAsync(b, ref.current, undefined, { inWrapper: true, breakPages: true })))
      .then(() => !cancelled && setState("ok"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div className="min-h-full overflow-auto bg-neutral-200 text-black">
      {state === "loading" && <p className="p-6 text-center text-neutral-600">{t("common.loading")}</p>}
      {state === "error" && <p className="p-6 text-center text-neutral-700">{t("viewer.cantPreview")}</p>}
      <div ref={ref} className="[&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-2 [&_section.docx]:!mb-3 [&_section.docx]:max-w-full [&_section.docx]:shadow-lg" />
    </div>
  );
}
