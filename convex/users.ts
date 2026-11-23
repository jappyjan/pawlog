import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const methodArg = v.object({ name: v.literal("usernamePassword"), profile: v.object({}) });

export const createUser = internalMutation({
  args: { method: methodArg },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", {});
  },
});

export const onSignIn = internalMutation({
  args: { method: methodArg, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const username = await ctx.runQuery(components.authUsername.public.getUsername, {
      userId,
    });
    const user = await ctx.db.get(userId);
    if (user && username && user.username !== username) {
      await ctx.db.patch(userId, { username, name: user.name ?? capitalize(username) });
    }
    return null;
  },
});

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const setName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
    await ctx.db.patch(userId, { name: name.trim().slice(0, 60) || undefined, username: username ?? undefined });
  },
});
