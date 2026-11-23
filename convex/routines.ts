import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { clean, requireDog } from "./lib";
import { routineType } from "./schema";
import { nextRoutineNotify, timesOf } from "./schedule";

/** Don't nag if someone already did it this long before the push would go out. */
const ALREADY_DONE_WINDOW_MS = 60 * 60_000;

type RoutineType = Doc<"routines">["type"];

const META: Record<RoutineType, { emoji: string; name: { en: string; de: string }; logType?: Doc<"events">["type"] }> = {
  meal: { emoji: "🍖", name: { en: "Feeding", de: "Fütterung" }, logType: "meal" },
  walk: { emoji: "🦮", name: { en: "Walk", de: "Gassi" }, logType: "walk" },
  potty: { emoji: "💧", name: { en: "Potty break", de: "Pipi-Pause" }, logType: "pee" },
  other: { emoji: "⏰", name: { en: "Routine", de: "Routine" } },
};

async function cancelJob(ctx: MutationCtx, jobId?: Id<"_scheduled_functions">) {
  if (!jobId) return;
  const job = await ctx.db.system.get(jobId);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(jobId);
}

/** (Re)arm the push for a routine at its next notify time, or disarm it when disabled. */
async function arm(ctx: MutationCtx, routineId: Id<"routines">, after = Date.now()) {
  const r = await ctx.db.get(routineId);
  if (!r) return;
  await cancelJob(ctx, r.scheduledJobId);
  const next = r.enabled ? nextRoutineNotify(r, after) : null;
  if (next === null) {
    await ctx.db.patch(routineId, { scheduledJobId: undefined, nextNotifyAt: undefined });
    return;
  }
  const jobId = await ctx.scheduler.runAt(next.at, internal.routines.fire, { routineId, time: next.time });
  await ctx.db.patch(routineId, { scheduledJobId: jobId, nextNotifyAt: next.at });
}

const fields = {
  type: routineType,
  times: v.array(v.string()),
  timezone: v.string(),
  days: v.optional(v.array(v.number())),
  notifyBefore: v.number(),
  mealId: v.optional(v.id("meals")),
  label: v.optional(v.string()),
};

function normalize(f: { type: RoutineType; times: string[]; notifyBefore: number; days?: number[]; mealId?: Id<"meals">; label?: string; timezone: string }) {
  const times = [...new Set(f.times)].sort();
  if (times.length === 0 || times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new ConvexError("Pick a time");
  if (times.length > 12) throw new ConvexError("Too many times");
  if (!Number.isInteger(f.notifyBefore) || f.notifyBefore < 0 || f.notifyBefore > 12 * 60) throw new ConvexError("Pick when to notify");
  const days = [...new Set(f.days ?? [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (f.days && days.length === 0) throw new ConvexError("Pick at least one day");
  const out = clean({ ...f, times, days: days.length === 7 || !f.days ? undefined : days, mealId: f.type === "meal" ? f.mealId : undefined });
  if (out.type === "other" && !out.label) throw new ConvexError("Name is required");
  return out;
}

export const list = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const routines = await ctx.db.query("routines").withIndex("by_dog", (q) => q.eq("dogId", dogId)).collect();
    return routines.sort((a, b) => (timesOf(a)[0] ?? "").localeCompare(timesOf(b)[0] ?? ""));
  },
});

export const create = mutation({
  args: { dogId: v.id("dogs"), ...fields },
  handler: async (ctx, { dogId, ...rest }) => {
    const { dog } = await requireDog(ctx, dogId);
    const id = await ctx.db.insert("routines", { ...normalize(rest), householdId: dog.householdId, dogId, enabled: true });
    await arm(ctx, id);
    return id;
  },
});

async function own(ctx: MutationCtx, routineId: Id<"routines">) {
  const r = await ctx.db.get(routineId);
  if (!r) throw new ConvexError("Routine not found");
  await requireDog(ctx, r.dogId);
  return r;
}

export const update = mutation({
  args: { routineId: v.id("routines"), ...fields },
  handler: async (ctx, { routineId, ...rest }) => {
    await own(ctx, routineId);
    // `label` may be left out of the args; clear it then (days/mealId are always set by normalize).
    await ctx.db.patch(routineId, { time: undefined, label: undefined, ...normalize(rest) });
    await arm(ctx, routineId);
  },
});

export const setEnabled = mutation({
  args: { routineId: v.id("routines"), enabled: v.boolean() },
  handler: async (ctx, { routineId, enabled }) => {
    await own(ctx, routineId);
    await ctx.db.patch(routineId, { enabled });
    await arm(ctx, routineId);
  },
});

export const remove = mutation({
  args: { routineId: v.id("routines") },
  handler: async (ctx, { routineId }) => {
    const r = await own(ctx, routineId);
    await cancelJob(ctx, r.scheduledJobId);
    await ctx.db.delete(routineId);
  },
});

/** Runs `notifyBefore` minutes ahead of a routine: push to the household (unless it was
 *  just done), then arm the next one. */
export const fire = internalMutation({
  args: { routineId: v.id("routines"), time: v.optional(v.string()) },
  handler: async (ctx, { routineId, time: firedTime }) => {
    const r = await ctx.db.get(routineId);
    if (!r || !r.enabled) return;
    const time = firedTime ?? timesOf(r)[0];
    const now = Date.now();
    const dog = await ctx.db.get(r.dogId);
    if (!dog) return;
    if (!(await alreadyDone(ctx, r, dog, now))) {
      const meta = META[r.type];
      const meal = r.mealId ? await ctx.db.get(r.mealId) : null;
      const what = meal?.name ?? r.label;
      const name = { en: what ?? meta.name.en, de: what ?? meta.name.de };
      const body =
        r.notifyBefore > 0
          ? { en: `${name.en} in ${r.notifyBefore} min (${time})`, de: `${name.de} in ${r.notifyBefore} Min. (${time} Uhr)` }
          : { en: `Time for ${name.en} (${time})`, de: `Zeit für ${name.de} (${time} Uhr)` };
      await ctx.scheduler.runAfter(0, internal.push.sendToHousehold, {
        householdId: r.householdId,
        title: `${meta.emoji} ${dog.name}`,
        body,
        url: meta.logType ? `/?log=${meta.logType}` : "/",
        tag: `routine-${r._id}`,
      });
    }
    await arm(ctx, routineId, now);
  },
});

async function alreadyDone(ctx: MutationCtx, r: Doc<"routines">, dog: Doc<"dogs">, now: number) {
  const recent = (type: Doc<"events">["type"]) =>
    ctx.db
      .query("events")
      .withIndex("by_dog_type_at", (q) => q.eq("dogId", r.dogId).eq("type", type).gte("at", now - ALREADY_DONE_WINDOW_MS))
      .collect();
  switch (r.type) {
    case "meal":
      return (await recent("meal")).some((e) => e.mealKind !== "treat");
    case "walk":
      return !!dog.walkStartedAt || (await recent("walk")).length > 0;
    case "potty":
      return !!dog.walkStartedAt || (await recent("pee")).length > 0 || (await recent("walk")).some((e) => e.pee);
    default:
      return false;
  }
}
