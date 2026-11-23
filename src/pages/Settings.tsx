import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Copy, LogOut, RefreshCw, Share2, UserMinus, Download } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { useToast } from "../components/Toast";
import { PushCard } from "../components/PushCard";
import { errorMessage } from "../lib/format";
import { UserBadge } from "../components/Avatar";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt) return null;
  return (
    <button
      type="button"
      className="btn-soft w-full"
      onClick={async () => {
        const e = evt;
        setEvt(null);
        await e.prompt();
      }}
    >
      <Download className="size-4" /> Install Pawlog app
    </button>
  );
}

export function SettingsPage() {
  const { me, household, members } = useApp();
  const { signOut } = useAuthActions();
  const setName = useMutation(api.users.setName);
  const rename = useMutation(api.households.rename);
  const regen = useMutation(api.households.regenerateInviteCode);
  const removeMember = useMutation(api.households.removeMember);
  const leave = useMutation(api.households.leave);
  const setActivity = useMutation(api.notify.setActivityNotifications);
  const changePassword = useMutation(api.auth.changePassword);
  const toast = useToast();

  const shareText = `Join our dog household on Pawlog 🐾\nInvite code: ${household.inviteCode}\n${location.origin}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Settings</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">You</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await setName({ name: String(new FormData(e.currentTarget).get("name")) });
            toast({ text: "Saved" });
          }}
        >
          <label className="sr-only" htmlFor="s-name">Display name</label>
          <input id="s-name" name="name" className="input" defaultValue={me.name ?? ""} placeholder="Display name" />
          <button className="btn-soft">Save</button>
        </form>
        <p className="text-sm text-muted">Signed in as <b>{me.username}</b></p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">Household</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await rename({ name: String(new FormData(e.currentTarget).get("hh")) });
            toast({ text: "Saved" });
          }}
        >
          <label className="sr-only" htmlFor="s-hh">Household name</label>
          <input id="s-hh" name="hh" className="input" defaultValue={household.name} />
          <button className="btn-soft">Save</button>
        </form>

        <div className="rounded-xl bg-bg p-4 text-center">
          <p className="text-sm text-muted">Invite code — your partner signs up, then enters this</p>
          <p className="my-2 font-mono text-3xl font-extrabold tracking-[0.25em]">{household.inviteCode}</p>
          <div className="flex justify-center gap-2">
            <button type="button" className="chip" onClick={() => void navigator.clipboard.writeText(household.inviteCode).then(() => toast({ text: "Copied" }))}>
              <Copy className="size-4" /> Copy
            </button>
            {"share" in navigator && (
              <button type="button" className="chip" onClick={() => void navigator.share({ text: shareText }).catch(() => {})}>
                <Share2 className="size-4" /> Share
              </button>
            )}
            <button
              type="button"
              className="chip"
              onClick={() => {
                if (confirm("Make a new code? The old one stops working.")) void regen();
              }}
            >
              <RefreshCw className="size-4" /> New
            </button>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m._id} className="flex items-center gap-3 py-2">
              <UserBadge name={m.name ?? m.username ?? "?"} id={m._id} />
              <span className="flex-1">
                {m.name ?? m.username} {m._id === me._id && <span className="text-muted">(you)</span>}
              </span>
              {m._id !== me._id && (
                <button
                  type="button"
                  className="btn-ghost size-9 p-0"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => {
                    if (confirm(`Remove ${m.name ?? m.username} from the household?`)) void removeMember({ userId: m._id });
                  }}
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Notifications</h2>
        <PushCard />
        <label className="card flex items-center gap-3 p-4">
          <span className="flex-1 text-sm">
            <span className="block font-semibold">Tell me when others log walks, meals & meds</span>
            <span className="text-muted">So nobody feeds the dog twice.</span>
          </span>
          <input type="checkbox" className="size-6 accent-brand" checked={!!me.notifyActivity} onChange={(e) => void setActivity({ enabled: e.target.checked })} />
        </label>
      </section>

      <InstallButton />

      <details className="card p-4">
        <summary className="cursor-pointer font-bold">Change password</summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            try {
              const res = await changePassword({ currentPassword: String(fd.get("cur")), newPassword: String(fd.get("new")) });
              if ((res as { success: boolean }).success) {
                toast({ text: "Password changed" });
                form.reset();
              } else toast({ text: ((res as { userError: { error: string } }).userError.error).replaceAll("_", " ").toLowerCase(), error: true });
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          <input name="cur" type="password" className="input" placeholder="Current password" autoComplete="current-password" required aria-label="Current password" />
          <input name="new" type="password" className="input" placeholder="New password" autoComplete="new-password" minLength={8} required aria-label="New password" />
          <button className="btn-soft w-full">Change</button>
        </form>
      </details>

      <div className="flex flex-col gap-2">
        <button type="button" className="btn-ghost w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" /> Sign out
        </button>
        <button
          type="button"
          className="btn-ghost w-full text-sm text-red-600"
          onClick={async () => {
            if (!confirm("Leave this household? You'll lose access to its dogs.")) return;
            try {
              await leave();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          Leave household
        </button>
      </div>
      <p className="pb-4 text-center text-xs text-muted">Pawlog · made with 🧡 for good dogs</p>
    </div>
  );
}
