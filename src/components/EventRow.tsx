import type { Doc } from "../../convex/_generated/dataModel";
import { describe, eventLabel, EventIcon } from "../lib/events";
import { stoolWarning } from "../lib/nutrition";
import { time } from "../lib/format";
import { useApp } from "../lib/app";
import { UserBadge } from "./Avatar";
import { useTranslation } from "react-i18next";

export function EventRow({ e, medName, onClick }: { e: Doc<"events">; medName?: (id: string) => string | undefined; onClick?: () => void }) {
  const { memberName, realName } = useApp();
  const { t } = useTranslation();
  const who = memberName(e.byUserId);
  const detail = describe(e, medName);
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-line/40">
        <EventIcon type={e.type} treat={e.mealKind === "treat"} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {stoolWarning(e) && <span className="mr-1 rounded-md bg-red-500/15 px-1.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">{t("stool.check")}</span>}
            {eventLabel(e)}{detail && <span className="font-normal text-muted"> · {detail}</span>}</span>
          {e.notes && <span className="block truncate text-sm text-muted">{e.notes}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">{time(e.at)}</span>
          <UserBadge name={realName(e.byUserId)} id={e.byUserId} />
          <span className="sr-only">{t("events.loggedBy", { who })}</span>
        </span>
      </button>
    </li>
  );
}
