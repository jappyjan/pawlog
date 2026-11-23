import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { registerSW } from "virtual:pwa-register";
import { api } from "../convex/_generated/api";
import App from "./App";
import "./index.css";
import "./i18n";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Installed PWAs (iOS especially) resume from the background without a page load, so the
// browser never checks for a new service worker. Check on every return to the foreground
// and hourly; autoUpdate then reloads the page onto the new version.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => {
      if (navigator.onLine) void reg.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    setInterval(check, 60 * 60_000);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
