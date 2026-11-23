"use node";
import * as webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { localized } from "./schema";

export const sendToHousehold = internalAction({
  args: {
    householdId: v.id("households"),
    exceptUserId: v.optional(v.id("users")),
    onlyActivity: v.optional(v.boolean()),
    title: v.string(),
    body: localized,
    url: v.string(),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { householdId, exceptUserId, onlyActivity, body, ...payload }) => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn("VAPID keys not configured; skipping push");
      return;
    }
    webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const subs = await ctx.runQuery(internal.notify.subscriptionsFor, {
      householdId,
      exceptUserId,
      onlyActivity,
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...payload, body: body[s.locale ?? "en"] }),
            { TTL: 60 * 60 * 12, urgency: "high" },
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await ctx.runMutation(internal.notify.removeSubscription, { endpoint: s.endpoint });
          } else {
            console.error("push failed", status, err);
          }
        }
      }),
    );
  },
});
