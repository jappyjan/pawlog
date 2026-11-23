import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BellRing, BellOff } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { currentSubscription, isIOS, isStandalone, pushSupported, subscribePush, subscriptionKeys } from "../lib/push";
import { errorMessage } from "../lib/format";
import { useToast } from "./Toast";

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

  if (!pushSupported()) {
    if (isIOS() && !isStandalone())
      return (
        <div className="card p-4 text-sm">
          <p className="font-semibold">📲 Want reminder notifications on iPhone?</p>
          <p className="text-muted">Tap the Share button, then “Add to Home Screen”, and open Pawlog from there.</p>
        </div>
      );
    return compact ? null : <p className="text-sm text-muted">This browser doesn't support push notifications.</p>;
  }
  if (key === null) return compact ? null : <p className="text-sm text-muted">Push isn't configured on the server yet (VAPID keys missing).</p>;
  if (enabled && compact) return null;

  return (
    <div className={`card flex items-center gap-3 p-4 ${enabled ? "" : "border-brand/40 bg-brand-soft/50"}`}>
      {enabled ? <BellRing className="size-6 text-emerald-600" /> : <BellOff className="size-6 text-brand" />}
      <div className="flex-1 text-sm">
        <p className="font-semibold">{enabled ? "Notifications on for this device" : "Get notified on this device"}</p>
        <p className="text-muted">{enabled ? "Reminders will pop up even when the app is closed." : "Reminders and meds, even when the app is closed."}</p>
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
              toast({ text: "Notifications enabled 🔔" });
            }
          } catch (e) {
            toast({ text: errorMessage(e), error: true });
          }
        }}
      >
        {enabled ? "Turn off" : "Enable"}
      </button>
    </div>
  );
}
