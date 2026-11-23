/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as documents from "../documents.js";
import type * as dogs from "../dogs.js";
import type * as events from "../events.js";
import type * as foods from "../foods.js";
import type * as households from "../households.js";
import type * as lib from "../lib.js";
import type * as meals from "../meals.js";
import type * as medications from "../medications.js";
import type * as notify from "../notify.js";
import type * as push from "../push.js";
import type * as reminders from "../reminders.js";
import type * as routines from "../routines.js";
import type * as schedule from "../schedule.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  documents: typeof documents;
  dogs: typeof dogs;
  events: typeof events;
  foods: typeof foods;
  households: typeof households;
  lib: typeof lib;
  meals: typeof meals;
  medications: typeof medications;
  notify: typeof notify;
  push: typeof push;
  reminders: typeof reminders;
  routines: typeof routines;
  schedule: typeof schedule;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
