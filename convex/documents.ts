import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { clean, requireDog, requireUser } from "./lib";
import { docCategory, docFile } from "./schema";

type DocFile = NonNullable<Doc<"documents">["files"]>[number];

/** Files of a document, including legacy single-file documents. */
export function filesOf(d: Doc<"documents">): DocFile[] {
  if (d.files?.length) return d.files;
  return d.storageId ? [{ storageId: d.storageId, name: d.title, contentType: d.contentType, size: d.size }] : [];
}

const MAX_FILES = 50;

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
    return await Promise.all(
      docs.map(async (d) => ({
        ...d,
        files: await Promise.all(filesOf(d).map(async (f) => ({ ...f, url: await ctx.storage.getUrl(f.storageId) }))),
      })),
    );
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
    files: v.array(docFile),
    ...fields,
  },
  handler: async (ctx, { dogId, files, ...rest }) => {
    const { dog, userId } = await requireDog(ctx, dogId);
    const f = clean(rest);
    if (!f.title) throw new ConvexError("Title is required");
    if (!files.length) throw new ConvexError("Pick a file first");
    if (files.length > MAX_FILES) throw new ConvexError("Too many files");
    return await ctx.db.insert("documents", {
      ...f,
      files,
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
    for (const f of filesOf(d)) await ctx.storage.delete(f.storageId);
    await ctx.db.delete(documentId);
  },
});

async function editable(ctx: MutationCtx, documentId: Id<"documents">) {
  const d = await ctx.db.get(documentId);
  if (!d) throw new ConvexError("Document not found");
  await requireDog(ctx, d.dogId);
  return d;
}

export const addFiles = mutation({
  args: { documentId: v.id("documents"), files: v.array(docFile) },
  handler: async (ctx, { documentId, files }) => {
    const d = await editable(ctx, documentId);
    const all = [...filesOf(d), ...files];
    if (all.length > MAX_FILES) throw new ConvexError("Too many files");
    await ctx.db.patch(documentId, { files: all, storageId: undefined, contentType: undefined, size: undefined });
  },
});

/** Removing the last file deletes the whole document. */
export const removeFile = mutation({
  args: { documentId: v.id("documents"), storageId: v.id("_storage") },
  handler: async (ctx, { documentId, storageId }) => {
    const d = await editable(ctx, documentId);
    const rest = filesOf(d).filter((f) => f.storageId !== storageId);
    await ctx.storage.delete(storageId);
    if (rest.length === 0) await ctx.db.delete(documentId);
    else await ctx.db.patch(documentId, { files: rest, storageId: undefined, contentType: undefined, size: undefined });
  },
});

/** Change the order of files (e.g. page order of a scanned contract). */
export const reorderFiles = mutation({
  args: { documentId: v.id("documents"), order: v.array(v.id("_storage")) },
  handler: async (ctx, { documentId, order }) => {
    const d = await editable(ctx, documentId);
    const files = filesOf(d);
    const sorted = order.map((id) => files.find((f) => f.storageId === id)).filter((f): f is DocFile => !!f);
    if (sorted.length !== files.length) throw new ConvexError("Not allowed");
    await ctx.db.patch(documentId, { files: sorted });
  },
});

/** One-off: move legacy single-file documents into `files`. */
export const migrateFiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    for (const d of await ctx.db.query("documents").collect()) {
      if (d.files?.length || !d.storageId) continue;
      await ctx.db.patch(d._id, { files: filesOf(d), storageId: undefined, contentType: undefined, size: undefined });
      n++;
    }
    return n;
  },
});
