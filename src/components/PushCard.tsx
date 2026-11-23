import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BellRing, BellOff } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { currentSubscription, isIOS, isStandalone, pushSupported, subscribePush, subscriptionKeys } from "../lib/push";
import { errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import { useTranslation } from "react-i18next";

export function usePushState() {
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void currentSubscription().then((s) => setEndpoint(s?.endpoint ?? null));
  }, []);
  const registered = useQuery(api.notify.isSubscribed, endpoint ? { endpoint } : "skip");
  return { endpoint, setEndpoint, enabled: !!endpoint && registered === true };
}

export function PushCard({ compact }: { compact?: boolean }) {
  const key = useQuery(api.notify.vapidPublicKey);
  const subscribe = useMutation(api.notify.subscribe);
  const unsubscribe = useMutation(api.notify.unsubscribe);
  const { endpoint, setEndpoint, enabled } = usePushState();
  const toast = useToast();
  const { t } = useTranslation();

  if (!pushSupported()) {
    if (isIOS() && !isStandalone())
      return (
        <div className="card p-4 text-sm">
          <p className="font-semibold">{t("push.iosTitle")}</p>
          <p className="text-muted">{t("push.iosBody")}</p>
        </div>
      );
    return compact ? null : <p className="text-sm text-muted">{t("push.unsupported")}</p>;
  }
  if (key === null) return compact ? null : <p className="text-sm text-muted">{t("push.notConfigured")}</p>;
  if (enabled && compact) return null;

  return (
    <div className={`card flex items-center gap-3 p-4 ${enabled ? "" : "border-brand/40 bg-brand-soft/50"}`}>
      {enabled ? <BellRing className="size-6 text-emerald-600" /> : <BellOff className="size-6 text-brand" />}
      <div className="flex-1 text-sm">
        <p className="font-semibold">{enabled ? t("push.onTitle") : t("push.offTitle")}</p>
        <p className="text-muted">{enabled ? t("push.onBody") : t("push.offBody")}</p>
      </div>
      <button
        type="button"
        className={enabled ? "btn-ghost text-sm" : "btn-primary"}
        disabled={key === undefined || endpoint === undefined}
        onClick={async () => {
          try {
            if (enabled && endpoint) {
              const sub = await currentSubscription();
              await sub?.unsubscribe();
              await unsubscribe({ endpoint });
              setEndpoint(null);
            } else {
              const sub = await subscribePush(key!);
              await subscribe(subscriptionKeys(sub));
              setEndpoint(sub.endpoint);
              toast({ text: t("push.enabled") });
            }
          } catch (e) {
            toast({ text: errorMessage(e), error: true });
          }
        }}
      >
        {enabled ? t("push.turnOff") : t("push.enable")}
      </button>
    </div>
  );
}
