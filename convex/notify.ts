import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib";

/* ---------- Push subscription management ---------- */

export const vapidPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) await ctx.db.patch(existing._id, { ...args, userId });
    else await ctx.db.insert("pushSubscriptions", { ...args, userId });
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const isSubscribed = query({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await requireUser(ctx);
    const s = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    return s?.userId === userId;
  },
});

export const setActivityNotifications = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await requireUser(ctx);
    await ctx.db.patch(userId, { notifyActivity: enabled });
  },
});

/* ---------- Internal helpers used by the push action ---------- */

export const subscriptionsFor = internalQuery({
  args: { householdId: v.id("households"), exceptUserId: v.optional(v.id("users")), onlyActivity: v.optional(v.boolean()) },
  handler: async (ctx, { householdId, exceptUserId, onlyActivity }) => {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
    const subs = [];
    for (const m of members) {
      if (m.userId === exceptUserId) continue;
      const u = await ctx.db.get(m.userId);
      if (onlyActivity && !u?.notifyActivity) continue;
      const mine = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .collect();
      subs.push(...mine.map((s) => ({ ...s, locale: u?.locale })));
    }
    return subs;
  },
});

export const removeSubscription = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const s = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (s) await ctx.db.delete(s._id);
  },
});

/** "Anna just fed Bello" — tells the *other* members, so nobody double-feeds. */
export const activity = internalMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) return;
    const [dog, user] = await Promise.all([ctx.db.get(ev.dogId), ctx.db.get(ev.byUserId)]);
    if (!dog) return;
    const who = { en: user?.name ?? "Someone", de: user?.name ?? "Jemand" };
    let text: { en: string; de: string };
    switch (ev.type) {
      case "walk": {
        const mins = ev.durationMin ? ` (${ev.durationMin} min)` : "";
        const potty = (l: "en" | "de") =>
          ev.pee || ev.poop
            ? ` · ${[ev.pee && (l === "en" ? "pee" : "Pipi"), ev.poop && (l === "en" ? "poop" : "Häufchen")].filter(Boolean).join(" + ")}`
            : "";
        text = {
          en: `${who.en} walked ${dog.name}${mins}${potty("en")}`,
          de: `${who.de} war mit ${dog.name} Gassi${mins}${potty("de")}`,
        };
        break;
      }
      case "meal": {
        if (ev.mealKind === "treat") return;
        const what = ev.mealName || ev.items?.map((i) => i.name).join(" + ") || ev.amount;
        const detail = [what, ev.kcal && `${ev.kcal} kcal`].filter(Boolean).join(", ");
        const d = detail ? ` (${detail})` : "";
        text = { en: `${who.en} fed ${dog.name}${d}`, de: `${who.de} hat ${dog.name} gefüttert${d}` };
        break;
      }
      case "medication": {
        const med = ev.medicationId ? await ctx.db.get(ev.medicationId) : null;
        text = {
          en: `${who.en} gave ${dog.name} ${med?.name ?? "medication"}`,
          de: `${who.de} hat ${dog.name} ${med?.name ?? "Medikamente"} gegeben`,
        };
        break;
      }
      default:
        return;
    }
    await ctx.scheduler.runAfter(0, internal.push.sendToHousehold, {
      householdId: ev.householdId,
      exceptUserId: ev.byUserId,
      onlyActivity: true,
      title: "🐾 " + dog.name,
      body: text,
      url: "/",
      tag: `activity-${ev.type}-${dog._id}`,
    });
  },
});
