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
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useTranslation } from "react-i18next";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallButton() {
  const { t } = useTranslation();
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
      <Download className="size-4" /> {t("settings.install")}
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
  const { t } = useTranslation();

  const shareText = t("settings.shareText", { code: household.inviteCode, url: location.origin });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("nav.settings")}</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">{t("settings.you")}</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await setName({ name: String(new FormData(e.currentTarget).get("name")) });
            toast({ text: t("common.saved") });
          }}
        >
          <label className="sr-only" htmlFor="s-name">{t("settings.displayName")}</label>
          <input id="s-name" name="name" className="input" defaultValue={me.name ?? ""} placeholder={t("settings.displayName")} />
          <button className="btn-soft">{t("common.save")}</button>
        </form>
        <p className="text-sm text-muted">{t("settings.signedInAs")} <b>{me.username}</b></p>
        <LanguageSwitch />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">{t("settings.household")}</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await rename({ name: String(new FormData(e.currentTarget).get("hh")) });
            toast({ text: t("common.saved") });
          }}
        >
          <label className="sr-only" htmlFor="s-hh">{t("onboarding.household")}</label>
          <input id="s-hh" name="hh" className="input" defaultValue={household.name} />
          <button className="btn-soft">{t("common.save")}</button>
        </form>

        <div className="rounded-xl bg-bg p-4 text-center">
          <p className="text-sm text-muted">{t("settings.inviteHint")}</p>
          <p className="my-2 font-mono text-3xl font-extrabold tracking-[0.25em]">{household.inviteCode}</p>
          <div className="flex justify-center gap-2">
            <button type="button" className="chip" onClick={() => void navigator.clipboard.writeText(household.inviteCode).then(() => toast({ text: t("common.copied") }))}>
              <Copy className="size-4" /> {t("common.copy")}
            </button>
            {"share" in navigator && (
              <button type="button" className="chip" onClick={() => void navigator.share({ text: shareText }).catch(() => {})}>
                <Share2 className="size-4" /> {t("common.share")}
              </button>
            )}
            <button
              type="button"
              className="chip"
              onClick={() => {
                if (confirm(t("settings.newCodeConfirm"))) void regen();
              }}
            >
              <RefreshCw className="size-4" /> {t("settings.newCode")}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m._id} className="flex items-center gap-3 py-2">
              <UserBadge name={m.name ?? m.username ?? "?"} id={m._id} />
              <span className="flex-1">
                {m.name ?? m.username} {m._id === me._id && <span className="text-muted">({t("settings.youShort")})</span>}
              </span>
              {m._id !== me._id && (
                <button
                  type="button"
                  className="btn-ghost size-9 p-0"
                  aria-label={t("settings.remove", { name: m.name ?? m.username })}
                  onClick={() => {
                    if (confirm(t("settings.removeConfirm", { name: m.name ?? m.username }))) void removeMember({ userId: m._id });
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
        <h2 className="font-bold">{t("settings.notifications")}</h2>
        <PushCard />
        <label className="card flex items-center gap-3 p-4">
          <span className="flex-1 text-sm">
            <span className="block font-semibold">{t("settings.activity")}</span>
            <span className="text-muted">{t("settings.activitySub")}</span>
          </span>
          <input type="checkbox" className="size-6 accent-brand" checked={!!me.notifyActivity} onChange={(e) => void setActivity({ enabled: e.target.checked })} />
        </label>
      </section>

      <InstallButton />

      <details className="card p-4">
        <summary className="cursor-pointer font-bold">{t("settings.changePassword")}</summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            try {
              const res = await changePassword({ currentPassword: String(fd.get("cur")), newPassword: String(fd.get("new")) });
              if ((res as { success: boolean }).success) {
                toast({ text: t("settings.passwordChanged") });
                form.reset();
              } else toast({ text: ((res as { userError: { error: string } }).userError.error).replaceAll("_", " ").toLowerCase(), error: true });
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          <input name="cur" type="password" className="input" placeholder={t("settings.currentPassword")} autoComplete="current-password" required aria-label={t("settings.currentPassword")} />
          <input name="new" type="password" className="input" placeholder={t("settings.newPassword")} autoComplete="new-password" minLength={8} required aria-label={t("settings.newPassword")} />
          <button className="btn-soft w-full">{t("settings.change")}</button>
        </form>
      </details>

      <div className="flex flex-col gap-2">
        <button type="button" className="btn-ghost w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" /> {t("settings.signOut")}
        </button>
        <button
          type="button"
          className="btn-ghost w-full text-sm text-red-600"
          onClick={async () => {
            if (!confirm(t("settings.leaveConfirm"))) return;
            try {
              await leave();
            } catch (err) {
              toast({ text: errorMessage(err), error: true });
            }
          }}
        >
          {t("settings.leave")}
        </button>
      </div>
      <p className="pb-4 text-center text-xs text-muted">{t("settings.footer")}</p>
    </div>
  );
}
