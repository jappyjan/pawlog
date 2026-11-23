import {
  differenceInMinutes,
  differenceInMonths,
  differenceInYears,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import i18n, { dateLocale } from "../i18n";

const t = i18n.t.bind(i18n);

export function ago(ts: number | null | undefined, now = Date.now()) {
  if (!ts) return "—";
  const mins = differenceInMinutes(now, ts);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minAgo", { m: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return mins % 60 ? t("time.hMinAgo", { h, m: mins % 60 }) : t("time.hAgo", { h });
  return formatDistanceToNowStrict(ts, { addSuffix: true, locale: dateLocale() });
}

/** Same as ago() without "ago", for compact tiles. */
export function since(ts: number | null | undefined, now = Date.now()) {
  if (!ts) return "—";
  const mins = differenceInMinutes(now, ts);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return mins % 60 ? `${h} h ${mins % 60} m` : `${h} h`;
  return formatDistanceToNowStrict(ts, { locale: dateLocale() });
}

export function dayLabel(ts: number) {
  if (isToday(ts)) return t("time.today");
  if (isYesterday(ts)) return t("time.yesterday");
  if (isTomorrow(ts)) return t("time.tomorrow");
  return fmt(ts, "EEE, d MMM yyyy");
}

/** date-fns format in the current UI language. */
export function fmt(ts: number | Date, pattern: string) {
  return format(ts, pattern, { locale: dateLocale() });
}

export const time = (ts: number) => format(ts, "HH:mm");

export function whenLabel(ts: number) {
  return `${dayLabel(ts)} · ${time(ts)}`;
}

export function age(birthDate?: string) {
  if (!birthDate) return null;
  const d = parseISO(birthDate);
  const y = differenceInYears(new Date(), d);
  const m = differenceInMonths(new Date(), d) % 12;
  if (y === 0) return t("time.ageMonths", { m });
  return m ? t("time.ageYearsMonths", { y, m }) : t("time.ageYears", { y });
}

export function startOfLocalDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** value for <input type="datetime-local"> */
export function toLocalInput(ts: number) {
  return format(ts, "yyyy-MM-dd'T'HH:mm");
}
export function fromLocalInput(s: string) {
  return new Date(s).getTime();
}

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function errorMessage(e: unknown) {
  let msg: string | undefined;
  if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string") msg = (e as { data: string }).data;
  else if (e instanceof Error) msg = e.message.replace(/^.*Uncaught (ConvexError: )?/, "").split("\n")[0];
  if (!msg) return t("errors.generic");
  // Server messages are English; translate the known ones.
  const known = SERVER_ERRORS[msg];
  return known ? t(`errors.server.${known}`) : msg;
}

const SERVER_ERRORS: Record<string, keyof typeof import("../i18n/en").en.errors.server> = {
  "Add at least one food": "addFood",
  "Calories look off": "calories",
  "Dog not found": "dogNotFound",
  "Food not found": "notFound",
  "Meal not found": "notFound",
  "Reminder not found": "notFound",
  "Document not found": "notFound",
  "Pick a file first": "pickFile",
  "Too many files": "tooManyFiles",
  "Name is required": "nameRequired",
  "Title is required": "titleRequired",
  "Not allowed": "notAllowed",
  "Not signed in": "notSignedIn",
  "Portion can't be negative": "portion",
  "That invite code doesn't exist": "badCode",
  "You already have a household": "hasHousehold",
  "You are not part of a household yet": "noHousehold",
  "You're the last member — the household and its data would be orphaned.": "lastMember",
  "Your current household still has dogs. Remove them first.": "hasDogs",
};

export function bytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
