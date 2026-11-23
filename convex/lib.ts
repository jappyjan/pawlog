import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");
  return userId;
}

export async function getMembership(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function requireHousehold(ctx: Ctx) {
  const userId = await requireUser(ctx);
  const membership = await getMembership(ctx, userId);
  if (!membership) throw new ConvexError("You are not part of a household yet");
  return { userId, householdId: membership.householdId };
}

export async function requireMember(ctx: Ctx, householdId: Id<"households">) {
  const userId = await requireUser(ctx);
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_household_user", (q) => q.eq("householdId", householdId).eq("userId", userId))
    .first();
  if (!m) throw new ConvexError("Not allowed");
  return userId;
}

export async function requireDog(ctx: Ctx, dogId: Id<"dogs">) {
  const dog = await ctx.db.get(dogId);
  if (!dog) throw new ConvexError("Dog not found");
  const userId = await requireMember(ctx, dog.householdId);
  return { dog, userId };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Trim strings; turn empty strings into undefined so optional fields get cleared. */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      const t = v.trim();
      out[k] = t === "" ? undefined : t;
    } else out[k] = v;
  }
  return out as T;
}
