import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const eventType = v.union(
  v.literal("walk"),
  v.literal("pee"),
  v.literal("poop"),
  v.literal("meal"),
  v.literal("weight"),
  v.literal("medication"),
  v.literal("vet"),
  v.literal("symptom"),
  v.literal("note"),
);

export const repeat = v.union(
  v.literal("none"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("yearly"),
  v.literal("everyNDays"),
);

export const docCategory = v.union(
  v.literal("vaccination"),
  v.literal("vet"),
  v.literal("insurance"),
  v.literal("registration"),
  v.literal("pedigree"),
  v.literal("receipt"),
  v.literal("other"),
);

export const stoolColor = v.union(
  v.literal("brown"),
  v.literal("yellow"),
  v.literal("green"),
  v.literal("black"),
  v.literal("red"),
  v.literal("grey"),
);

export const stoolFlag = v.union(
  v.literal("mucus"),
  v.literal("blood"),
  v.literal("worms"),
  v.literal("straining"),
  v.literal("foreign"),
);

/** Optional stool details, used on poop events and on walks where the dog pooped. */
export const stoolFields = {
  stoolScore: v.optional(v.number()), // 1–7 fecal score (1 hard … 2 ideal … 7 watery)
  stoolColor: v.optional(stoolColor),
  stoolFlags: v.optional(v.array(stoolFlag)),
};

export const docFile = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
});

export const foodUnit = v.union(
  v.literal("g"),
  v.literal("piece"),
  v.literal("cup"),
  v.literal("can"),
  v.literal("scoop"),
);

export const foodKind = v.union(
  v.literal("dry"),
  v.literal("wet"),
  v.literal("raw"),
  v.literal("fresh"),
  v.literal("treat"),
  v.literal("supplement"),
  v.literal("other"),
);

export const mealItem = v.object({
  foodId: v.optional(v.id("foods")),
  name: v.string(),
  qty: v.optional(v.number()),
  unit: v.optional(foodUnit),
  kcal: v.optional(v.number()),
});

export const mealFields = {
  mealName: v.optional(v.string()), // from a saved meal, e.g. "Breakfast"
  mealKind: v.optional(v.union(v.literal("meal"), v.literal("treat"))),
  items: v.optional(v.array(mealItem)),
  kcal: v.optional(v.number()), // total, derived from items
  appetite: v.optional(v.union(v.literal("all"), v.literal("most"), v.literal("some"), v.literal("none"))),
};

/** Push text in every supported language; each recipient gets theirs. */
export const localized = v.object({ en: v.string(), de: v.string() });

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    notifyActivity: v.optional(v.boolean()),
    locale: v.optional(v.union(v.literal("en"), v.literal("de"))),
  }),

  households: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    createdBy: v.id("users"),
  }).index("by_invite_code", ["inviteCode"]),

  memberships: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_household", ["householdId"])
    .index("by_household_user", ["householdId", "userId"]),

  dogs: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    breed: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("male"), v.literal("female"))),
    neutered: v.optional(v.boolean()),
    birthDate: v.optional(v.string()), // YYYY-MM-DD
    color: v.optional(v.string()),
    microchip: v.optional(v.string()),
    registrationNo: v.optional(v.string()),
    insurance: v.optional(v.string()),
    vetName: v.optional(v.string()),
    vetPhone: v.optional(v.string()),
    food: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    walkGoalPerDay: v.optional(v.number()),
    kcalGoalPerDay: v.optional(v.number()),
    // Live walk shared between household members
    walkStartedAt: v.optional(v.number()),
    walkStartedBy: v.optional(v.id("users")),
  }).index("by_household", ["householdId"]),

  events: defineTable({
    householdId: v.id("households"),
    dogId: v.id("dogs"),
    type: eventType,
    at: v.number(),
    byUserId: v.id("users"),
    durationMin: v.optional(v.number()),
    distanceKm: v.optional(v.number()),
    pee: v.optional(v.boolean()),
    poop: v.optional(v.boolean()),
    // Legacy (pre stool score); read-only.
    poopQuality: v.optional(
      v.union(v.literal("hard"), v.literal("normal"), v.literal("soft"), v.literal("diarrhea")),
    ),
    ...stoolFields,
    ...mealFields,
    weightKg: v.optional(v.number()),
    medicationId: v.optional(v.id("medications")),
    amount: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_dog_at", ["dogId", "at"])
    .index("by_dog_type_at", ["dogId", "type", "at"]),

  foods: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    brand: v.optional(v.string()),
    kind: foodKind,
    unit: foodUnit,
    kcalPer: v.optional(v.number()), // kcal per 100 g when unit is "g", otherwise per unit
    defaultQty: v.optional(v.number()),
    notes: v.optional(v.string()),
    archived: v.boolean(),
  }).index("by_household", ["householdId"]),

  // Saved meals per dog, e.g. "Breakfast" = 120 g kibble + 1 scoop topper.
  meals: defineTable({
    householdId: v.id("households"),
    dogId: v.id("dogs"),
    name: v.string(),
    items: v.array(mealItem),
    kcal: v.optional(v.number()),
    order: v.number(),
  }).index("by_dog", ["dogId"]),

  medications: defineTable({
    householdId: v.id("households"),
    dogId: v.id("dogs"),
    name: v.string(),
    dosage: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_dog", ["dogId"]),

  reminders: defineTable({
    householdId: v.id("households"),
    dogId: v.optional(v.id("dogs")),
    medicationId: v.optional(v.id("medications")),
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.number(),
    timezone: v.string(),
    repeat,
    intervalDays: v.optional(v.number()),
    done: v.boolean(),
    createdBy: v.id("users"),
    scheduledJobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_household_done_due", ["householdId", "done", "dueAt"])
    .index("by_medication", ["medicationId"]),

  documents: defineTable({
    householdId: v.id("households"),
    dogId: v.id("dogs"),
    title: v.string(),
    category: docCategory,
    files: v.optional(v.array(docFile)), // one document can hold several files
    // Legacy single-file fields (migrated into `files` by documents:migrateFiles).
    storageId: v.optional(v.id("_storage")),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    date: v.optional(v.string()), // YYYY-MM-DD issued
    expiresOn: v.optional(v.string()), // YYYY-MM-DD
    notes: v.optional(v.string()),
    uploadedBy: v.id("users"),
  }).index("by_dog", ["dogId"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
});
