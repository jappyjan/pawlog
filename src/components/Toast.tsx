import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Action = { label: string; run: () => void };
type Toast = { id: number; text: string; action?: Action; actions?: Action[]; error?: boolean };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.action || t.actions ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.error ? "bg-red-600 text-white" : "bg-ink text-bg"
            }`}
          >
            <span className="min-w-0 flex-[1_1_12rem]">{t.text}</span>
            <span className="ml-auto flex shrink-0 gap-4">
              {[...(t.actions ?? []), ...(t.action ? [t.action] : [])].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="font-bold text-brand"
                  onClick={() => {
                    a.run();
                    setToasts((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                >
                  {a.label}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
