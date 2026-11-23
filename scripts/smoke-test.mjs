// End-to-end smoke test against a running Convex deployment:
//   node scripts/smoke-test.mjs [convexUrl]
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url = process.argv[2] ?? process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210";
const api = anyApi;
const rnd = Math.random().toString(36).slice(2, 7);
const assert = (c, msg) => { if (!c) throw new Error("FAIL: " + msg); console.log("✓", msg); };

async function user(name) {
  const c = new ConvexHttpClient(url);
  const r = await c.mutation(api.auth.signUpWithUsernamePassword, { username: `${name}-${rnd}`, password: "correct horse battery staple" });
  assert(r.status === "complete", `${name} signed up`);
  c.setAuth(r.tokens.accessToken);
  await c.mutation(api.users.setName, { name });
  return c;
}

const a = await user("Jan");
const b = await user("Wife");

await a.mutation(api.households.create, { name: "Test pack" });
const curA = await a.query(api.households.current, {});
assert(curA.household.inviteCode.length === 8, "household created with invite code");

await b.mutation(api.households.join, { code: curA.household.inviteCode.toLowerCase() });
const curB = await b.query(api.households.current, {});
assert(curB.household._id === curA.household._id && curB.members.length === 2, "partner joined via code");

const dogId = await a.mutation(api.dogs.create, { name: "Bello", breed: "Beagle", birthDate: "2021-04-01" });
const dogsB = (await b.query(api.households.current, {})).dogs;
assert(dogsB.some((d) => d._id === dogId), "partner sees the dog");

await b.mutation(api.dogs.startWalk, { dogId });
await a.mutation(api.dogs.finishWalk, { dogId, pee: true, poop: true, notes: "" });
await a.mutation(api.events.log, { dogId, type: "weight", weightKg: 12.4 });
await b.mutation(api.events.log, { dogId, type: "meal", amount: "120 g" });
const last = await a.query(api.events.lastTimes, { dogId });
assert(last.pee && last.poop && last.walk && last.meal && last.weightKg === 12.4, "lastTimes includes walk pee/poop, meal, weight");

const tzName = "Europe/Berlin";
const medId = await a.mutation(api.medications.create, {
  dogId, name: "Apoquel", dosage: "1 tablet",
  schedule: { times: ["08:00"], repeat: "daily", firstDueAts: [Date.now() - 1000], timezone: tzName },
});
let meds = await b.query(api.medications.list, { dogId });
assert(meds[0].reminders.length === 1, "medication created with reminder");
const due0 = meds[0].reminders[0].dueAt;
await b.mutation(api.medications.giveDose, { medicationId: medId });
meds = await a.query(api.medications.list, { dogId });
assert(meds[0].lastDoseAt && meds[0].reminders[0].dueAt > due0 + 23 * 3600e3, "giving dose logs it and rolls reminder to tomorrow");

const remId = await a.mutation(api.reminders.create, { dogId, title: "Flea treatment", dueAt: Date.now() + 3600e3, timezone: tzName, repeat: "monthly" });
await b.mutation(api.reminders.complete, { reminderId: remId });
const rems = await a.query(api.reminders.list, {});
const flea = rems.find((r) => r._id === remId);
assert(flea && flea.dueAt > Date.now() + 27 * 86400e3, "completing monthly reminder rolls forward a month");

// Food library, meals with calories, stool details
const kibble = await a.mutation(api.foods.create, { name: "Lamb & Rice", kind: "dry", unit: "g", kcalPer: 360, defaultQty: 120 });
const foodsB = await b.query(api.foods.list, {});
assert(foodsB.some((f) => f._id === kibble), "partner sees the shared food list");
await b.mutation(api.events.log, {
  dogId, type: "meal", mealKind: "meal", appetite: "most",
  items: [{ foodId: kibble, name: "Lamb & Rice", qty: 120, unit: "g", kcal: 432 }, { name: "Pumpkin", qty: 20, unit: "g", kcal: 5.4 }, { name: "  " }],
});
const lm = await a.query(api.events.lastMeal, { dogId });
assert(lm && lm.items.length === 2 && lm.kcal === 437, "meal kcal is summed from items, blank items dropped");
await a.mutation(api.events.log, { dogId, type: "meal", mealKind: "treat", items: [{ name: "Chew", kcal: 80 }] });
assert((await a.query(api.events.lastMeal, { dogId })).kcal === 437, "treats don't replace the 'last meal'");
await a.mutation(api.events.log, { dogId, type: "poop", stoolScore: 9.4, stoolColor: "brown", stoolFlags: ["mucus"] });
await b.mutation(api.dogs.startWalk, { dogId });
await b.mutation(api.dogs.finishWalk, { dogId, pee: false, poop: true, stoolScore: 2 });
const todayEv = await a.query(api.events.range, { dogId, from: Date.now() - 3600e3 });
assert(todayEv.find((e) => e.type === "poop")?.stoolScore === 7, "stool score is clamped to 1–7");
assert(todayEv.find((e) => e.type === "walk" && e.stoolScore === 2), "walk stores stool score");
let foodBlocked = false;
const outsider = await user("Stranger");
try { await outsider.mutation(api.foods.update, { foodId: kibble, name: "x", kind: "dry", unit: "g" }); } catch { foodBlocked = true; }
assert(foodBlocked, "non-members cannot edit the food list");
let blocked = false;
try { await outsider.query(api.events.lastTimes, { dogId }); } catch { blocked = true; }
assert(blocked, "non-members cannot read the dog's data");

const page = await b.query(api.events.list, { dogId, paginationOpts: { numItems: 20, cursor: null } });
assert(page.page.length >= 4, `history has ${page.page.length} events`);
console.log("\nAll good 🐶");
