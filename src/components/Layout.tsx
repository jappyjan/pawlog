import { NavLink, Outlet, Link } from "react-router";
import { Bell, CalendarClock, FileText, HeartPulse, House, ListOrdered, Settings, ChevronDown, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useApp } from "../lib/app";
import { DogAvatar } from "./Avatar";
import { age } from "../lib/format";

const tabs = [
  { to: "/", label: "Today", icon: House },
  { to: "/history", label: "History", icon: ListOrdered },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/reminders", label: "Reminders", icon: CalendarClock },
  { to: "/docs", label: "Papers", icon: FileText },
];

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Layout() {
  const { dog, dogs, setDogId } = useApp();
  const online = useOnline();
  const reminders = useQuery(api.reminders.list);
  const overdue = reminders?.filter((r) => r.dueAt <= Date.now()).length ?? 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/dog" className="flex min-w-0 flex-1 items-center gap-3" aria-label={`${dog.name}'s profile`}>
            <DogAvatar url={dog.photoUrl} name={dog.name} size="size-10" />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold leading-tight">{dog.name}</span>
              <span className="block truncate text-xs text-muted">
                {[dog.breed, age(dog.birthDate)].filter(Boolean).join(" · ") || "Tap to edit profile"}
              </span>
            </span>
          </Link>
          {dogs.length > 1 && (
            <label className="relative">
              <span className="sr-only">Switch dog</span>
              <select
                className="input appearance-none py-2 pr-8 text-sm"
                value={dog._id}
                onChange={(e) => setDogId(e.target.value as typeof dog._id)}
              >
                {dogs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </label>
          )}
          <Link to="/reminders" className="btn-ghost relative size-10 p-0" aria-label={`Reminders${overdue ? `, ${overdue} due` : ""}`}>
            <Bell className="size-5" />
            {overdue > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {overdue}
              </span>
            )}
          </Link>
          <Link to="/settings" className="btn-ghost size-10 p-0" aria-label="Settings">
            <Settings className="size-5" />
          </Link>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/15 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            <WifiOff className="size-3.5" /> Offline — changes will sync when you're back online
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-md">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                    isActive ? "text-brand" : "text-muted"
                  }`
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
