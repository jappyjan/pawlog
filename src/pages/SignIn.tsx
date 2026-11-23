import { useState } from "react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "../../convex/_generated/api";

function authError(err: { error: string; [k: string]: unknown }) {
  switch (err.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "Wrong username or password.";
    case "USERNAME_TAKEN":
    case "USERNAME_ALREADY_TAKEN":
      return "That username is taken.";
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${err.minimumLength ?? 8} characters.`;
    case "PASSWORD_TOO_COMMON":
      return "That password is too common — pick something less guessable.";
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password can't start or end with a space.";
    case "RATE_LIMITED":
      return "Too many attempts. Try again in a minute.";
    case "OTHER_ERROR":
      return "Couldn't reach the server. Check your connection.";
    default:
      return err.error.replaceAll("_", " ").toLowerCase();
  }
}

export function SignIn() {
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
        <p className="mt-1 text-muted">Walks, potty, meds & papers — shared with your pack.</p>
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
              {m === "signIn" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" name="username" className="input" autoComplete="username" autoCapitalize="none" required disabled={pending} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
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
          {pending ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        Each person gets their own account. After signing up, one of you creates the household and shares the invite code.
      </p>
    </div>
  );
}
