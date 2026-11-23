import { lazy, Suspense, useEffect } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { lang } from "./i18n";
import { Navigate, Route, Routes } from "react-router";
import { api } from "../convex/_generated/api";
import { AppProvider } from "./lib/app";
import { ToastProvider } from "./components/Toast";
import { Layout } from "./components/Layout";
import { SignIn } from "./pages/SignIn";
import { Onboarding, AddFirstDog } from "./pages/Onboarding";
import { Today } from "./pages/Today";
import { History } from "./pages/History";
import { Reminders } from "./pages/Reminders";
import { Docs } from "./pages/Docs";
import { DogProfile } from "./pages/DogProfile";
import { SettingsPage } from "./pages/Settings";
import { FoodPage } from "./pages/Food";

const Health = lazy(() => import("./pages/Health").then((m) => ({ default: m.Health })));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <img src="/favicon.svg" alt="" className="size-16 animate-pulse rounded-2xl" />
    </div>
  );
}

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <Splash />;
  if (!isAuthenticated) return <SignIn />;
  return (
    <ToastProvider>
      <SignedIn />
    </ToastProvider>
  );
}

function SignedIn() {
  const current = useQuery(api.households.current);
  const { t, i18n } = useTranslation();
  const setLocale = useMutation(api.users.setLocale);
  // Push notifications are written server-side in each member's language.
  useEffect(() => {
    void setLocale({ locale: lang() });
  }, [i18n.resolvedLanguage, setLocale]);
  if (current === undefined || current === null) return <Splash />;
  if (!current.household) return <Onboarding />;
  if (current.dogs.length === 0) return <AddFirstDog />;
  return (
    <AppProvider current={{ ...current, household: current.household }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="history" element={<History />} />
          <Route path="health" element={<Suspense fallback={<p className="text-muted">{t("common.loading")}</p>}><Health /></Suspense>} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="docs" element={<Docs />} />
          <Route path="dog" element={<DogProfile />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="food" element={<FoodPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
