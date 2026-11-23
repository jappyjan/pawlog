import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { clean, requireHousehold } from "./lib";
import { foodKind, foodUnit } from "./schema";

const fields = {
  name: v.string(),
  brand: v.optional(v.string()),
  kind: foodKind,
  unit: foodUnit,
  kcalPer: v.optional(v.number()),
  defaultQty: v.optional(v.number()),
  notes: v.optional(v.string()),
};

/** The household's food library (shared by all dogs). Archived foods come last. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { householdId } = await requireHousehold(ctx);
    const foods = await ctx.db
      .query("foods")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
    return foods.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  },
});

function check(f: { name?: string; kcalPer?: number; defaultQty?: number }) {
  if (!f.name) throw new ConvexError("Name is required");
  if (f.kcalPer !== undefined && (f.kcalPer < 0 || f.kcalPer > 10_000)) throw new ConvexError("Calories look off");
  if (f.defaultQty !== undefined && f.defaultQty < 0) throw new ConvexError("Portion can't be negative");
}

export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    const { householdId } = await requireHousehold(ctx);
    const f = clean(args);
    check(f);
    return await ctx.db.insert("foods", { ...f, householdId, archived: false });
  },
});

async function own(ctx: MutationCtx, foodId: Id<"foods">) {
  const { householdId } = await requireHousehold(ctx);
  const food = await ctx.db.get(foodId);
  if (!food || food.householdId !== householdId) throw new ConvexError("Food not found");
  return food;
}

export const update = mutation({
  args: { foodId: v.id("foods"), ...fields },
  handler: async (ctx, { foodId, ...rest }) => {
    await own(ctx, foodId);
    const f = clean(rest);
    check(f);
    await ctx.db.patch(foodId, f);
  },
});

/** Logged meals keep their own copy of name/kcal, so archiving never changes history. */
export const setArchived = mutation({
  args: { foodId: v.id("foods"), archived: v.boolean() },
  handler: async (ctx, { foodId, archived }) => {
    await own(ctx, foodId);
    await ctx.db.patch(foodId, { archived });
  },
});

export const remove = mutation({
  args: { foodId: v.id("foods") },
  handler: async (ctx, { foodId }) => {
    await own(ctx, foodId);
    await ctx.db.delete(foodId);
  },
});
