import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { clean, requireDog, requireHousehold, requireMember } from "./lib";
import { repeat } from "./schema";
import { nextOccurrence } from "./schedule";

/** (Re)schedule the push notification for a reminder at its due time. */
export async function scheduleNotification(ctx: MutationCtx, reminderId: Id<"reminders">, at?: number) {
  const r = await ctx.db.get(reminderId);
  if (!r) return;
  if (r.scheduledJobId) {
    const job = await ctx.db.system.get(r.scheduledJobId);
    if (job && job.state.kind === "pending") await ctx.scheduler.cancel(r.scheduledJobId);
  }
  if (r.done) {
    await ctx.db.patch(reminderId, { scheduledJobId: undefined });
    return;
  }
  const when = Math.max(Date.now(), at ?? r.dueAt);
  const jobId = await ctx.scheduler.runAt(when, internal.reminders.fire, { reminderId });
  await ctx.db.patch(reminderId, { scheduledJobId: jobId });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { householdId } = await requireHousehold(ctx);
    return await ctx.db
      .query("reminders")
      .withIndex("by_household_done_due", (q) => q.eq("householdId", householdId).eq("done", false))
      .order("asc")
      .take(500);
  },
});

export const recentlyDone = query({
  args: {},
  handler: async (ctx) => {
    const { householdId } = await requireHousehold(ctx);
    return await ctx.db
      .query("reminders")
      .withIndex("by_household_done_due", (q) => q.eq("householdId", householdId).eq("done", true))
      .order("desc")
      .take(20);
  },
});

const reminderFields = {
  dogId: v.optional(v.id("dogs")),
  title: v.string(),
  notes: v.optional(v.string()),
  dueAt: v.number(),
  timezone: v.string(),
  repeat,
  intervalDays: v.optional(v.number()),
};

export const create = mutation({
  args: reminderFields,
  handler: async (ctx, args) => {
    const { householdId, userId } = await requireHousehold(ctx);
    if (args.dogId) await requireDog(ctx, args.dogId);
    const fields = clean(args);
    if (!fields.title) throw new ConvexError("Title is required");
    const id = await ctx.db.insert("reminders", {
      ...fields,
      householdId,
      createdBy: userId,
      done: false,
    });
    await scheduleNotification(ctx, id);
    return id;
  },
});

export const update = mutation({
  args: { reminderId: v.id("reminders"), ...reminderFields },
  handler: async (ctx, { reminderId, ...rest }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) throw new ConvexError("Reminder not found");
    await requireMember(ctx, r.householdId);
    const fields = clean(rest);
    if (!fields.title) throw new ConvexError("Title is required");
    await ctx.db.patch(reminderId, { ...fields, done: false });
    await scheduleNotification(ctx, reminderId);
  },
});

/** Mark done. Repeating reminders roll forward to their next occurrence.
 *  Medication reminders also log a dose. */
export const complete = mutation({
  args: { reminderId: v.id("reminders"), logDose: v.optional(v.boolean()) },
  handler: async (ctx, { reminderId, logDose }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) return;
    const userId = await requireMember(ctx, r.householdId);
    await completeReminder(ctx, r);
    if (r.medicationId && r.dogId && logDose !== false) {
      const med = await ctx.db.get(r.medicationId);
      await ctx.db.insert("events", {
        householdId: r.householdId,
        dogId: r.dogId,
        type: "medication",
        at: Date.now(),
        byUserId: userId,
        medicationId: r.medicationId,
        amount: med?.dosage,
      });
    }
  },
});

export async function completeReminder(ctx: MutationCtx, r: Doc<"reminders">) {
  const next = nextOccurrence(r, Math.max(Date.now(), r.dueAt));
  if (next === null) await ctx.db.patch(r._id, { done: true });
  else await ctx.db.patch(r._id, { dueAt: next });
  await scheduleNotification(ctx, r._id);
}

export const snooze = mutation({
  args: { reminderId: v.id("reminders"), minutes: v.number() },
  handler: async (ctx, { reminderId, minutes }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) return;
    await requireMember(ctx, r.householdId);
    const until = Date.now() + minutes * 60_000;
    if (r.repeat === "none") {
      await ctx.db.patch(reminderId, { dueAt: until });
      await scheduleNotification(ctx, reminderId);
    } else {
      // Keep the schedule anchor; only delay the notification.
      await scheduleNotification(ctx, reminderId, until);
    }
  },
});

export const reopen = mutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) return;
    await requireMember(ctx, r.householdId);
    await ctx.db.patch(reminderId, { done: false });
    await scheduleNotification(ctx, reminderId);
  },
});

export const remove = mutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) return;
    await requireMember(ctx, r.householdId);
    if (r.scheduledJobId) {
      const job = await ctx.db.system.get(r.scheduledJobId);
      if (job?.state.kind === "pending") await ctx.scheduler.cancel(r.scheduledJobId);
    }
    await ctx.db.delete(reminderId);
  },
});

/** Runs at the due time: push to the household, then arm the next nag for
 *  repeating reminders that nobody has ticked off yet. */
export const fire = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const r = await ctx.db.get(reminderId);
    if (!r || r.done) return;
    const dog = r.dogId ? await ctx.db.get(r.dogId) : null;
    await ctx.scheduler.runAfter(0, internal.push.sendToHousehold, {
      householdId: r.householdId,
      title: dog ? `${dog.name}: ${r.title}` : r.title,
      body: r.notes ?? (r.medicationId ? "Time for medication 💊" : "Reminder 🐾"),
      url: "/reminders",
      tag: `reminder-${r._id}`,
    });
    const next = nextOccurrence(r, Date.now());
    if (next !== null) {
      const jobId = await ctx.scheduler.runAt(next, internal.reminders.fire, { reminderId });
      await ctx.db.patch(reminderId, { scheduledJobId: jobId });
    } else {
      await ctx.db.patch(reminderId, { scheduledJobId: undefined });
    }
  },
});
