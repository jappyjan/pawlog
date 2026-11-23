import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireDog } from "./lib";
import { mealItem } from "./schema";

function normalize(name: string, items: Doc<"meals">["items"]) {
  const n = name.trim();
  if (!n) throw new ConvexError("Name is required");
  const its = items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name);
  if (!its.length) throw new ConvexError("Add at least one food");
  const kcals = its.map((i) => i.kcal).filter((k): k is number => typeof k === "number");
  return { name: n, items: its, kcal: kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0)) : undefined };
}

export const list = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const meals = await ctx.db.query("meals").withIndex("by_dog", (q) => q.eq("dogId", dogId)).collect();
    return meals.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: { dogId: v.id("dogs"), name: v.string(), items: v.array(mealItem) },
  handler: async (ctx, { dogId, name, items }) => {
    const { dog } = await requireDog(ctx, dogId);
    const last = await ctx.db.query("meals").withIndex("by_dog", (q) => q.eq("dogId", dogId)).collect();
    return await ctx.db.insert("meals", {
      householdId: dog.householdId,
      dogId,
      order: last.reduce((m, x) => Math.max(m, x.order), 0) + 1,
      ...normalize(name, items),
    });
  },
});

async function own(ctx: MutationCtx, mealId: Id<"meals">) {
  const meal = await ctx.db.get(mealId);
  if (!meal) throw new ConvexError("Meal not found");
  await requireDog(ctx, meal.dogId);
  return meal;
}

export const update = mutation({
  args: { mealId: v.id("meals"), name: v.string(), items: v.array(mealItem) },
  handler: async (ctx, { mealId, name, items }) => {
    await own(ctx, mealId);
    await ctx.db.patch(mealId, normalize(name, items));
  },
});

export const remove = mutation({
  args: { mealId: v.id("meals") },
  handler: async (ctx, { mealId }) => {
    await own(ctx, mealId);
    await ctx.db.delete(mealId);
  },
});
