# 🐾 Pawlog

A shared dog tracker that installs as a PWA: walks, pee/poop, meals, weight, medication, vet visits, reminders with push notifications, and a folder for papers. Two or more people share one household and see each other's changes live.

**Stack:** React 19 + Vite + TypeScript + Tailwind v4 · Convex (database, file storage, scheduler, auth) · Convex Auth (username + password) · Web Push (VAPID) · Workbox service worker.

Everything runs on free tiers: the Convex free plan, plus any static host (Vercel Hobby, Cloudflare Pages, or your own Coolify).

## Features

- **Today**: one-tap Pee / Poop / Meal (with undo), "time since last pee/poop/walk/meal", walk goal progress, reminders due today, and today's timeline with who logged each entry.
- **Live walks**: tap *Start walk* and your partner sees "Walking · 12 min" on their phone. When you tap *Walk done*, you tick pee/poop and the duration is filled in for you.
- **Food & calories** (optional): keep a shared food list (kibble, wet food, toppers, treats) with kcal per 100 g or per piece/cup/can and a usual portion. A meal can have several foods, and calories fill in from the amount. One tap on *Meal* repeats the last meal. Treats are logged separately, and appetite can be recorded (ate all / most / a little / refused). There's a daily calorie goal with a progress bar, plus a kcal-per-day chart.
- **Stool tracking** (optional): a 1–7 fecal score (2 is ideal), color, and signs such as mucus, blood, worms or straining, on poops and on walks. Warning signs get a *Check* badge. Health shows the 14-day score trend, the share of ideal stools, and a count of warnings.
- **History**: everything, grouped by day, with filters. Tap an entry to edit or delete it, or add a past one.
- **Health**: weight chart, 14-day activity chart and averages, medications with dose schedules and a *Give* button, vet visits.
- **Reminders**: one-off or repeating (daily, weekly, monthly, yearly, every N days). Repeats are timezone- and DST-aware. Quick templates cover flea/tick, deworming, vaccines, nails, grooming and so on. Push notifications go to every household member, there's snooze, and a repeating reminder nags again on its next occurrence if nobody ticks it off.
- **Medications**: each scheduled medication creates reminders. Ticking a med reminder, or tapping *Give*, logs the dose and moves the reminder to the next one.
- **Papers**: upload photos or PDFs (vaccination pass, pedigree, insurance, receipts) by category, with expiry warnings. Microchip, registration and insurance numbers can be copied with one tap.
- **Sharing**: each person has their own account. One person creates the household, the other joins with an 8-character invite code. There's an optional "notify me when my partner walks/feeds/medicates" so nobody feeds the dog twice.
- **Multiple dogs** per household, a photo for each, and a full profile (breed, birthday, chip, vet, insurance, food, notes).
- **PWA**: installable, works offline as an app shell, has app shortcuts ("Log a walk"), dark mode, and safe-area insets for iPhone.

## Local development

```bash
npm install
npx convex dev          # first run: log in (or choose a local deployment); writes .env.local
npm run dev             # in a second terminal → http://localhost:5173
```

Push notifications need VAPID keys on the Convex deployment:

```bash
npx web-push generate-vapid-keys
npx convex env set VAPID_PUBLIC_KEY  <public key>
npx convex env set VAPID_PRIVATE_KEY <private key>
npx convex env set VAPID_SUBJECT     mailto:you@example.com
```

`npm run test:smoke` runs an end-to-end check against the running deployment. It covers two users, invite-code join, walks, meds, reminder roll-over, and access control.

## Deploying

### 1. Backend (Convex cloud, free)

```bash
npx convex deploy                                   # creates/updates your prod deployment
npx convex env set --prod VAPID_PUBLIC_KEY  ...     # same three VAPID vars as above
npx convex env set --prod VAPID_PRIVATE_KEY ...
npx convex env set --prod VAPID_SUBJECT     mailto:you@example.com
```

The prod URL (`https://<name>.convex.cloud`) is printed and shown in the Convex dashboard.

### 2a. Frontend on Vercel (simplest)

1. Push this folder to a Git repo and import it in Vercel.
2. In the Convex dashboard, go to *Settings → Deploy key* and generate a **production deploy key**.
3. In Vercel's environment variables, add `CONVEX_DEPLOY_KEY` = that key.

`vercel.json` already sets the build command to `npx convex deploy --cmd 'npm run build'`. That deploys the backend and builds the frontend with the right `VITE_CONVEX_URL` on every push.

### 2b. Frontend on Coolify (self-hosted)

Create a new resource from this repo with **Build pack: Dockerfile** and add a build variable:

```
VITE_CONVEX_URL=https://<name>.convex.cloud
```

The image is plain nginx with SPA fallback and correct cache headers for the service worker. Coolify handles the domain and HTTPS. Run `npx convex deploy` yourself whenever you change files in `convex/`.

> HTTPS is required for service workers and push. Both Vercel and Coolify (Let's Encrypt) provide it.

## Installing on phones

- **Android / Chrome**: open the site, then use *Install app* (also in Settings) and enable notifications in *Reminders*.
- **iPhone (iOS 16.4+)**: in Safari, tap *Share* then *Add to Home Screen*. Open Pawlog from the home-screen icon and tap *Enable* notifications. iOS only allows web push for home-screen apps.

Each phone has to enable notifications once.

## Project layout

```
convex/            backend: schema, queries/mutations, scheduler, push (Node action)
  schema.ts        users, households, memberships, dogs, events, foods, medications, reminders, documents, pushSubscriptions
  auth.ts          Convex Auth (username/password components)
  reminders.ts     reminder CRUD + scheduled `fire` → push
  schedule.ts      tz/DST-safe next-occurrence math
  push.ts          web-push sender ("use node")
src/
  pages/           Today, History, Health, Reminders, Docs (Papers), DogProfile, Settings, SignIn, Onboarding
  components/      Sheet (native <dialog>), EventSheet, WalkSheet, MedicationSheet, PushCard, Layout…
  sw.ts            service worker: precache, SPA offline, push + notification click
```
