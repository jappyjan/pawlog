import { useState } from "react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { LanguageSwitch } from "../components/LanguageSwitch";

const t = i18n.t.bind(i18n);

function authError(err: { error: string; [k: string]: unknown }) {
  switch (err.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return t("auth.err.credentials");
    case "USERNAME_TAKEN":
    case "USERNAME_ALREADY_TAKEN":
      return t("auth.err.taken");
    case "PASSWORD_TOO_SHORT":
      return t("auth.err.short", { n: Number(err.minimumLength ?? 8) });
    case "PASSWORD_TOO_COMMON":
      return t("auth.err.common");
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return t("auth.err.whitespace");
    case "RATE_LIMITED":
      return t("auth.err.rate");
    case "OTHER_ERROR":
      return t("auth.err.network");
    default:
      return err.error.replaceAll("_", " ").toLowerCase();
  }
}

export function SignIn() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const { signIn, pending: p1 } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: p2 } = useSignUpWithUsernamePassword(api.auth);
  const pending = p1 || p2;

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto mb-4 size-20 rounded-3xl shadow-lg shadow-brand/30" />
        <h1 className="text-3xl font-extrabold">Pawlog</h1>
        <p className="mt-1 text-muted">{t("auth.tagline")}</p>
      </div>
      <form
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const creds = {
            username: String(fd.get("username")).trim().toLowerCase(),
            password: String(fd.get("password")),
          };
          const res = mode === "signIn" ? await signIn(creds) : await signUp(creds);
          if (res.status !== "complete") setError(authError(res.userError as { error: string }));
        }}
      >
        <div className="grid grid-cols-2 rounded-xl bg-bg p-1 text-sm font-semibold">
          {(["signIn", "signUp"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 transition ${mode === m ? "bg-card shadow-sm" : "text-muted"}`}
            >
              {m === "signIn" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="username">{t("auth.username")}</label>
          <input id="username" name="username" className="input" autoComplete="username" autoCapitalize="none" required disabled={pending} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            minLength={8}
            required
            disabled={pending}
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "…" : mode === "signIn" ? t("auth.signIn") : t("auth.signUp")}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        {t("auth.hint")}
      </p>
      <LanguageSwitch className="mt-4 self-center" />
    </div>
  );
}
