import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clean, requireDog, requireUser } from "./lib";
import { docCategory } from "./schema";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: { dogId: v.id("dogs") },
  handler: async (ctx, { dogId }) => {
    await requireDog(ctx, dogId);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_dog", (q) => q.eq("dogId", dogId))
      .order("desc")
      .collect();
    return await Promise.all(docs.map(async (d) => ({ ...d, url: await ctx.storage.getUrl(d.storageId) })));
  },
});

const fields = {
  title: v.string(),
  category: docCategory,
  date: v.optional(v.string()),
  expiresOn: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const create = mutation({
  args: {
    dogId: v.id("dogs"),
    storageId: v.id("_storage"),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    ...fields,
  },
  handler: async (ctx, { dogId, ...rest }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    const f = clean(rest);
    if (!f.title) throw new ConvexError("Title is required");
    return await ctx.db.insert("documents", {
      ...f,
      dogId,
      householdId: dog.householdId,
      uploadedBy: userId,
    });
  },
});

export const update = mutation({
  args: { documentId: v.id("documents"), ...fields },
  handler: async (ctx, { documentId, ...rest }) => {
    const d = await ctx.db.get(documentId);
    if (!d) return;
    await requireDog(ctx, d.dogId);
    const f = clean(rest);
    if (!f.title) throw new ConvexError("Title is required");
    await ctx.db.patch(documentId, f);
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const d = await ctx.db.get(documentId);
    if (!d) return;
    await requireDog(ctx, d.dogId);
    await ctx.storage.delete(d.storageId);
    await ctx.db.delete(documentId);
  },
});
