import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { clean, requireDog } from "./lib";
import { completeReminder, scheduleNotification } from "./reminders";

export const list = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const meds = await ctx.db
      .query("medications")
      .withIndex("by_dog", (q) => q.eq("dogId", dogId))
      .collect();
    return await Promise.all(
      meds.map(async (m) => {
        const reminders = await ctx.db
          .query("reminders")
          .withIndex("by_medication", (q) => q.eq("medicationId", m._id))
          .collect();
        const lastDose = await ctx.db
          .query("events")
          .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", "medication"))
          .order("desc")
          .filter((q) => q.eq(q.field("medicationId"), m._id))
          .first();
        return { ...m, reminders, lastDoseAt: lastDose?.at ?? null };
      }),
    );
  },
});

const schedule = v.object({
  /** Local "HH:MM" times for the first dose day. */
  times: v.array(v.string()),
  repeat: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("everyNDays")),
  intervalDays: v.optional(v.number()),
  /** Absolute ms of the first dose for each time, computed on the client in its tz. */
  firstDueAts: v.array(v.number()),
  timezone: v.string(),
});

export const create = mutation({
  args: {
    dogId: v.id("dogs"),
    name: v.string(),
    dosage: v.optional(v.string()),
    notes: v.optional(v.string()),
    schedule: v.optional(schedule),
  },
  handler: async (ctx, { dogId, schedule, ...rest }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    const fields = clean(rest);
    if (!fields.name) throw new ConvexError("Name is required");
    const medicationId = await ctx.db.insert("medications", {
      ...fields,
      dogId,
      householdId: dog.householdId,
      active: true,
    });
    if (schedule) {
      for (const dueAt of schedule.firstDueAts) {
        const id = await ctx.db.insert("reminders", {
          householdId: dog.householdId,
          dogId,
          medicationId,
          title: `${fields.name}${fields.dosage ? ` (${fields.dosage})` : ""}`,
          dueAt,
          timezone: schedule.timezone,
          repeat: schedule.repeat,
          intervalDays: schedule.intervalDays,
          done: false,
          createdBy: userId,
        });
        await scheduleNotification(ctx, id);
      }
    }
    return medicationId;
  },
});

export const update = mutation({
  args: {
    medicationId: v.id("medications"),
    name: v.string(),
    dosage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { medicationId, ...rest }) => {
    const med = await ctx.db.get(medicationId);
    if (!med) return;
    await requireDog(ctx, med.dogId);
    const fields = clean(rest);
    if (!fields.name) throw new ConvexError("Name is required");
    await ctx.db.patch(medicationId, fields);
  },
});

/** Stopping a medication pauses its reminders; restarting re-arms them. */
export const setActive = mutation({
  args: { medicationId: v.id("medications"), active: v.boolean() },
  handler: async (ctx, { medicationId, active }) => {
    const med = await ctx.db.get(medicationId);
    if (!med) return;
    await requireDog(ctx, med.dogId);
    await ctx.db.patch(medicationId, { active });
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_medication", (q) => q.eq("medicationId", medicationId))
      .collect();
    for (const r of reminders) {
      await ctx.db.patch(r._id, { done: !active });
      await scheduleNotification(ctx, r._id);
    }
  },
});

export const remove = mutation({
  args: { medicationId: v.id("medications") },
  handler: async (ctx, { medicationId }) => {
    const med = await ctx.db.get(medicationId);
    if (!med) return;
    await requireDog(ctx, med.dogId);
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_medication", (q) => q.eq("medicationId", medicationId))
      .collect();
    for (const r of reminders) {
      await ctx.db.patch(r._id, { done: true });
      await scheduleNotification(ctx, r._id); // cancels pending job
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(medicationId);
  },
});

/** Log a dose now; ticks off any of this med's reminders that are due (or due within 3h). */
export const giveDose = mutation({
  args: { medicationId: v.id("medications"), notes: v.optional(v.string()) },
  handler: async (ctx, { medicationId, notes }) => {
    const med = await ctx.db.get(medicationId);
    if (!med) return;
    const { userId } = await requireDog(ctx, med.dogId);
    await ctx.db.insert("events", {
      householdId: med.householdId,
      dogId: med.dogId,
      type: "medication",
      at: Date.now(),
      byUserId: userId,
      medicationId,
      amount: med.dosage,
      notes: notes?.trim() || undefined,
    });
    await tickDueReminder(ctx, medicationId);
  },
});

/** A dose was just given: tick off this med's reminder that is due (or due within 3h). */
export async function tickDueReminder(ctx: MutationCtx, medicationId: Id<"medications">) {
  const soon = Date.now() + 3 * 3600_000;
  const reminders = await ctx.db
    .query("reminders")
    .withIndex("by_medication", (q) => q.eq("medicationId", medicationId))
    .collect();
  const due = reminders.filter((r) => !r.done && r.dueAt <= soon).sort((a, b) => a.dueAt - b.dueAt);
  if (due[0]) await completeReminder(ctx, due[0]);
}
