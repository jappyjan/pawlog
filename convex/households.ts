import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMembership, randomCode, requireHousehold, requireUser } from "./lib";
import { getAuthUserId } from "@convex-dev/auth/server";
import { components } from "./_generated/api";

/** Everything the app shell needs: me, my household, members and dogs. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    // The username is recorded right after the createUser callback, so fill it in lazily.
    const me = user.username
      ? user
      : { ...user, username: (await ctx.runQuery(components.authUsername.public.getUsername, { userId })) ?? undefined };
    const membership = await getMembership(ctx, userId);
    if (!membership) return { me, household: null, members: [], dogs: [] };
    const household = await ctx.db.get(membership.householdId);
    if (!household) return { me, household: null, members: [], dogs: [] };
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", household._id))
      .collect();
    const members = (await Promise.all(memberships.map((m) => ctx.db.get(m.userId))))
      .filter((u) => u !== null)
      .map((u) => (u._id === me._id ? me : u));
    const dogs = await ctx.db
      .query("dogs")
      .withIndex("by_household", (q) => q.eq("householdId", household._id))
      .collect();
    const dogsWithPhotos = await Promise.all(
      dogs.map(async (d) => ({
        ...d,
        photoUrl: d.photoId ? await ctx.storage.getUrl(d.photoId) : null,
      })),
    );
    return { me, household, members, dogs: dogsWithPhotos };
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUser(ctx);
    if (await getMembership(ctx, userId)) throw new ConvexError("You already have a household");
    const householdId = await ctx.db.insert("households", {
      name: name.trim() || "Our pack",
      inviteCode: randomCode(),
      createdBy: userId,
    });
    await ctx.db.insert("memberships", { householdId, userId });
    return householdId;
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUser(ctx);
    const existing = await getMembership(ctx, userId);
    const household = await ctx.db
      .query("households")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code.trim().toUpperCase()))
      .first();
    if (!household) throw new ConvexError("That invite code doesn't exist");
    if (existing?.householdId === household._id) return household._id;
    if (existing) {
      // Leaving an empty household behind is fine; leaving one with dogs alone is not.
      const others = await ctx.db
        .query("memberships")
        .withIndex("by_household", (q) => q.eq("householdId", existing.householdId))
        .collect();
      const dogs = await ctx.db
        .query("dogs")
        .withIndex("by_household", (q) => q.eq("householdId", existing.householdId))
        .first();
      if (others.length === 1 && dogs) {
        throw new ConvexError("Your current household still has dogs. Remove them first.");
      }
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("memberships", { householdId: household._id, userId });
    return household._id;
  },
});

export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { householdId } = await requireHousehold(ctx);
    await ctx.db.patch(householdId, { name: name.trim().slice(0, 60) || "Our pack" });
  },
});

export const regenerateInviteCode = mutation({
  args: {},
  handler: async (ctx) => {
    const { householdId } = await requireHousehold(ctx);
    await ctx.db.patch(householdId, { inviteCode: randomCode() });
  },
});

export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { householdId, userId } = await requireHousehold(ctx);
    if (args.userId === userId) throw new ConvexError("Use 'leave' instead");
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_household_user", (q) =>
        q.eq("householdId", householdId).eq("userId", args.userId),
      )
      .first();
    if (m) await ctx.db.delete(m._id);
  },
});

export const leave = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const m = await getMembership(ctx, userId);
    if (!m) return;
    const others = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    if (others.length === 1) {
      throw new ConvexError("You're the last member — the household and its data would be orphaned.");
    }
    await ctx.db.delete(m._id);
  },
});
