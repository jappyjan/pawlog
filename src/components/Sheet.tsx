import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import i18n from "../i18n";

/** Native modal <dialog>: bottom sheet on phones, card on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  onBack,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Shows a back arrow before the title (multi-step sheets). */
  onBack?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Light-dismiss fallback where `closedby` isn't supported (Safari).
  useEffect(() => {
    const d = ref.current;
    if (!d || "closedBy" in HTMLDialogElement.prototype) return;
    const outside = (e: PointerEvent) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const down = (e: PointerEvent) => (pressedOutside = outside(e));
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) d.close();
    };
    d.addEventListener("pointerdown", down);
    d.addEventListener("pointerup", up);
    return () => {
      d.removeEventListener("pointerdown", down);
      d.removeEventListener("pointerup", up);
    };
  }, []);

  // Portal to <body>: a sheet opened from inside another sheet's <form> must not end up
  // with a nested <form> in the DOM (the browser would do a native submit and reload).
  return createPortal(
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      // `close` from a nested sheet would otherwise reach this one through React's tree.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      {...({ closedby: "any" } as object)}
    >
      {open && (
        <div className="pb-safe">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-card px-5 pb-2 pt-4">
            <div className="flex min-w-0 items-center gap-1">
              {onBack && (
                <button type="button" className="btn-ghost -ml-2 size-10 shrink-0 p-0" aria-label={i18n.t("common.back")} onClick={onBack}>
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <h2 id={titleId} className="truncate text-lg font-bold">
                {title}
              </h2>
            </div>
            <button type="button" className="btn-ghost -mr-2 size-10 p-0" aria-label={i18n.t("common.close")} onClick={() => ref.current?.close()}>
              <X className="size-5" />
            </button>
          </div>
          <div className="px-5 pb-6">{children}</div>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
