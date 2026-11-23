import { useState } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { DogFields, readDogForm } from "../components/DogForm";
import { errorMessage } from "../lib/format";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "../components/LanguageSwitch";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { signOut } = useAuthActions();
  const { t } = useTranslation();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <img src="/favicon.svg" alt="" className="mb-6 size-14 rounded-2xl" />
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mb-6 mt-1 text-muted">{subtitle}</p>
      {children}
      <button type="button" className="btn-ghost mt-8 self-center text-sm text-muted" onClick={() => void signOut()}>
        {t("settings.signOut")}
      </button>
      <div className="mt-2 self-center"><LanguageSwitch /></div>
    </div>
  );
}

export function Onboarding() {
  const create = useMutation(api.households.create);
  const join = useMutation(api.households.join);
  const setName = useMutation(api.users.setName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={t("onboarding.welcome")} subtitle={t("onboarding.welcomeSub")}>
      <form
        className="card mb-4 space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void run(async () => {
            const name = String(fd.get("yourName"));
            if (name.trim()) await setName({ name });
            await create({ name: String(fd.get("household")) });
          })();
        }}
      >
        <h2 className="font-bold">{t("onboarding.start")}</h2>
        <div>
          <label className="label" htmlFor="yourName">{t("onboarding.yourName")}</label>
          <input id="yourName" name="yourName" className="input" placeholder={t("onboarding.yourNamePh")} autoComplete="given-name" />
        </div>
        <div>
          <label className="label" htmlFor="household">{t("onboarding.household")}</label>
          <input id="household" name="household" className="input" placeholder={t("onboarding.householdPh")} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{t("onboarding.create")}</button>
      </form>

      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void run(async () => {
            const name = String(fd.get("yourName2"));
            if (name.trim()) await setName({ name });
            await join({ code: String(fd.get("code")) });
          })();
        }}
      >
        <h2 className="font-bold">{t("onboarding.join")}</h2>
        <div>
          <label className="label" htmlFor="yourName2">{t("onboarding.yourName")}</label>
          <input id="yourName2" name="yourName2" className="input" autoComplete="given-name" />
        </div>
        <div>
          <label className="label" htmlFor="code">{t("onboarding.code")}</label>
          <input id="code" name="code" className="input font-mono uppercase tracking-widest" placeholder="ABCD2345" required autoCapitalize="characters" />
        </div>
        <button className="btn-soft w-full" disabled={busy}>{t("onboarding.joinBtn")}</button>
      </form>
      {error && <p className="mt-4 text-sm font-medium text-red-600" role="alert">{error}</p>}
    </Shell>
  );
}

export function AddFirstDog() {
  const create = useMutation(api.dogs.create);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  return (
    <Shell title={t("onboarding.dogTitle")} subtitle={t("onboarding.dogSub")}>
      <form
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await create(readDogForm(e.currentTarget));
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <DogFields compact />
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full">{t("onboarding.addDog")}</button>
      </form>
    </Shell>
  );
}
