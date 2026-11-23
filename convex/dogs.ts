import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clean, requireDog, requireHousehold, requireUser } from "./lib";
import { internal } from "./_generated/api";
import { stoolFields } from "./schema";
import { filesOf } from "./documents";

const dogFields = {
  name: v.string(),
  breed: v.optional(v.string()),
  sex: v.optional(v.union(v.literal("male"), v.literal("female"))),
  neutered: v.optional(v.boolean()),
  birthDate: v.optional(v.string()),
  color: v.optional(v.string()),
  microchip: v.optional(v.string()),
  registrationNo: v.optional(v.string()),
  insurance: v.optional(v.string()),
  vetName: v.optional(v.string()),
  vetPhone: v.optional(v.string()),
  food: v.optional(v.string()),
  notes: v.optional(v.string()),
  walkGoalPerDay: v.optional(v.number()),
  kcalGoalPerDay: v.optional(v.number()),
};

export const create = mutation({
  args: dogFields,
  handler: async (ctx, args) => {
    const { householdId } = await requireHousehold(ctx);
    const fields = clean(args);
    if (!fields.name) throw new ConvexError("Name is required");
    return await ctx.db.insert("dogs", { ...fields, householdId, walkGoalPerDay: fields.walkGoalPerDay ?? 3 });
  },
});

export const update = mutation({
  args: { dogId: v.id("dogs"), ...dogFields },
  handler: async (ctx, { dogId, ...rest }) => {
    await requireDog(ctx, dogId);
    const fields = clean(rest);
    if (!fields.name) throw new ConvexError("Name is required");
    // Empty strings were mapped to undefined by clean(), which patch() treats as "remove field".
    await ctx.db.patch(dogId, fields);
  },
});

export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setPhoto = mutation({
  args: { dogId: v.id("dogs"), storageId: v.id("_storage") },
  handler: async (ctx, { dogId, storageId }) => {
    const { dog } = await requireDog(ctx, dogId);
    for (const f of await ctx.db
      .query("routines")
      .withIndex("by_dog", (q) => q.eq("dogId", dogId))
      .collect()) {
      if (f.scheduledJobId) {
        const job = await ctx.db.system.get(f.scheduledJobId);
        if (job?.state.kind === "pending") await ctx.scheduler.cancel(f.scheduledJobId);
      }
      await ctx.db.delete(f._id);
    }
    if (dog.photoId) await ctx.storage.delete(dog.photoId);
    await ctx.db.patch(dogId, { photoId: storageId });
  },
});

export const remove = mutation({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    const { dog } = await requireDog(ctx, dogId);
    for (const e of await ctx.db
      .query("events")
      .withIndex("by_dog_at", (q) => q.eq("dogId", dogId))
      .collect())
      await ctx.db.delete(e._id);
    for (const d of await ctx.db
      .query("documents")
      .withIndex("by_dog", (q) => q.eq("dogId", dogId))
      .collect()) {
      for (const f of filesOf(d)) await ctx.storage.delete(f.storageId);
      await ctx.db.delete(d._id);
    }
    for (const m of await ctx.db
      .query("medications")
      .withIndex("by_dog", (q) => q.eq("dogId", dogId))
      .collect())
      await ctx.db.delete(m._id);
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_household_done_due", (q) => q.eq("householdId", dog.householdId))
      .collect();
    for (const r of reminders.filter((r) => r.dogId === dogId)) {
      if (r.scheduledJobId) await ctx.scheduler.cancel(r.scheduledJobId);
      await ctx.db.delete(r._id);
    }
    if (dog.photoId) await ctx.storage.delete(dog.photoId);
    await ctx.db.delete(dogId);
  },
});

/* ---------- Live walk (shared between household members) ---------- */

export const startWalk = mutation({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    if (dog.walkStartedAt) return;
    await ctx.db.patch(dogId, { walkStartedAt: Date.now(), walkStartedBy: userId });
  },
});

export const cancelWalk = mutation({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    await ctx.db.patch(dogId, { walkStartedAt: undefined, walkStartedBy: undefined });
  },
});

export const finishWalk = mutation({
  args: {
    dogId: v.id("dogs"),
    pee: v.boolean(),
    poop: v.boolean(),
    distanceKm: v.optional(v.number()),
    notes: v.optional(v.string()),
    ...stoolFields,
  },
  handler: async (ctx, { dogId, ...rest }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    const now = Date.now();
    const startedAt = dog.walkStartedAt ?? now;
    const eventId = await ctx.db.insert("events", {
      householdId: dog.householdId,
      dogId,
      type: "walk",
      at: startedAt,
      byUserId: userId,
      durationMin: Math.max(1, Math.round((now - startedAt) / 60000)),
      ...clean(rest),
    });
    await ctx.db.patch(dogId, { walkStartedAt: undefined, walkStartedBy: undefined });
    await ctx.scheduler.runAfter(0, internal.notify.activity, { eventId });
  },
});

export const get = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    const { dog } = await requireDog(ctx, dogId);
    return { ...dog, photoUrl: dog.photoId ? await ctx.storage.getUrl(dog.photoId) : null };
  },
});
