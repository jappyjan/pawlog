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

export function ago(ts: number | null | undefined, now = Date.now()) {
  if (!ts) return "—";
  const mins = differenceInMinutes(now, ts);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60 ? `${mins % 60}m ` : ""}ago`;
  return formatDistanceToNowStrict(ts, { addSuffix: true });
}

export function dayLabel(ts: number) {
  if (isToday(ts)) return "Today";
  if (isYesterday(ts)) return "Yesterday";
  if (isTomorrow(ts)) return "Tomorrow";
  return format(ts, "EEE, d MMM yyyy");
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
  if (y === 0) return `${m} mo`;
  return m ? `${y} y ${m} mo` : `${y} y`;
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
  if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string")
    return (e as { data: string }).data;
  if (e instanceof Error) return e.message.replace(/^.*Uncaught (ConvexError: )?/, "").split("\n")[0];
  return "Something went wrong";
}

export function bytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
