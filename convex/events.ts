import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { clean, requireDog } from "./lib";
import { eventType, mealFields, stoolFields } from "./schema";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { tickDueReminder } from "./medications";

const eventFields = {
  durationMin: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  pee: v.optional(v.boolean()),
  poop: v.optional(v.boolean()),
  ...stoolFields,
  ...mealFields,
  weightKg: v.optional(v.number()),
  medicationId: v.optional(v.id("medications")),
  amount: v.optional(v.string()),
  notes: v.optional(v.string()),
};

type Fields = { items?: Doc<"events">["items"]; kcal?: number; stoolScore?: number };

/** Validate ranges and derive the meal's kcal total from its items. */
function normalize<T extends Fields>(f: T): T {
  if (f.stoolScore !== undefined) f.stoolScore = Math.min(7, Math.max(1, Math.round(f.stoolScore)));
  if (f.items) {
    f.items = f.items
      .map((i) => ({ ...i, name: i.name.trim() }))
      .filter((i) => i.name || i.foodId);
    const kcals = f.items.map((i) => i.kcal).filter((k): k is number => typeof k === "number");
    if (kcals.length) f.kcal = Math.round(kcals.reduce((a, b) => a + b, 0));
    if (f.items.length === 0) f.items = undefined;
  }
  return f;
}

const NOTIFY_TYPES = new Set<Doc<"events">["type"]>(["walk", "meal", "medication"]);

export const log = mutation({
  args: { dogId: v.id("dogs"), type: eventType, at: v.optional(v.number()), ...eventFields },
  handler: async (ctx, { dogId, type, at, ...rest }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    const eventId = await ctx.db.insert("events", {
      householdId: dog.householdId,
      dogId,
      type,
      at: at ?? Date.now(),
      byUserId: userId,
      ...normalize(clean(rest)),
    });
    if (NOTIFY_TYPES.has(type) && (at === undefined || Date.now() - at < 30 * 60_000)) {
      await ctx.scheduler.runAfter(0, internal.notify.activity, { eventId });
    }
    // A dose logged as given recently counts for its reminder, same as "Give" on the med.
    if (type === "medication" && rest.medicationId && (at === undefined || Date.now() - at < 3 * 3600_000)) {
      await tickDueReminder(ctx, rest.medicationId);
    }
    return eventId;
  },
});

export const update = mutation({
  args: { eventId: v.id("events"), at: v.number(), ...eventFields },
  handler: async (ctx, { eventId, ...rest }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) return;
    await requireDog(ctx, ev.dogId);
    await ctx.db.patch(eventId, normalize(clean(rest)));
  },
});

export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) return;
    await requireDog(ctx, ev.dogId);
    await ctx.db.delete(eventId);
  },
});

export const list = query({
  args: {
    dogId: v.id("dogs"),
    type: v.optional(eventType),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { dogId, type, paginationOpts }) => {
    await requireDog(ctx, dogId);
    const q = type
      ? ctx.db
          .query("events")
          .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", type))
      : ctx.db.query("events").withIndex("by_dog_at", (q) => q.eq("dogId", dogId));
    return await q.order("desc").paginate(paginationOpts);
  },
});

/** Events in [from, to) — used for "today" and for stats/charts. */
export const range = query({
  args: { dogId: v.id("dogs"), from: v.number(), to: v.optional(v.number()) },
  handler: async (ctx, { dogId, from, to }) => {
    await requireDog(ctx, dogId);
    return await ctx.db
      .query("events")
      .withIndex("by_dog_at", (q) => {
        const r = q.eq("dogId", dogId).gte("at", from);
        return to ? r.lt("at", to) : r;
      })
      .order("desc")
      .take(2000);
  },
});

/** "How long since…" for the home screen. Walks count as pee/poop when ticked. */
export const lastTimes = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const latest = async (type: Doc<"events">["type"]) =>
      await ctx.db
        .query("events")
        .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", type))
        .order("desc")
        .first();
    const recentWalks = await ctx.db
      .query("events")
      .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", "walk"))
      .order("desc")
      .take(30);
    const max = (...xs: (number | undefined)[]) => {
      const ys = xs.filter((x): x is number => x !== undefined);
      return ys.length ? Math.max(...ys) : null;
    };
    const walkEnd = (w: Doc<"events">) => w.at + (w.durationMin ?? 0) * 60_000;
    const [pee, poop, meal, weight] = await Promise.all([
      latest("pee"),
      latest("poop"),
      latest("meal"),
      latest("weight"),
    ]);
    const walkPee = recentWalks.find((w) => w.pee);
    const walkPoop = recentWalks.find((w) => w.poop);
    return {
      walk: recentWalks[0] ? walkEnd(recentWalks[0]) : null,
      pee: max(pee?.at, walkPee && walkEnd(walkPee)),
      poop: max(poop?.at, walkPoop && walkEnd(walkPoop)),
      meal: meal?.at ?? null,
      weightKg: weight?.weightKg ?? null,
      weightAt: weight?.at ?? null,
    };
  },
});

export const weights = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", "weight"))
      .order("asc")
      .collect();
    return rows
      .filter((r) => r.weightKg !== undefined)
      .map((r) => ({ _id: r._id, at: r.at, weightKg: r.weightKg!, notes: r.notes }));
  },
});

/** The most recent real meal (not a treat), used to pre-fill and to repeat with one tap. */
export const lastMeal = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const meals = await ctx.db
      .query("events")
      .withIndex("by_dog_type_at", (q) => q.eq("dogId", dogId).eq("type", "meal"))
      .order("desc")
      .take(25);
    const m = meals.find((e) => e.mealKind !== "treat" && e.items?.length);
    return m ? { items: m.items!, kcal: m.kcal ?? null } : null;
  },
});
