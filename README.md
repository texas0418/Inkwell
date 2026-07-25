# Inkwell

A private, local-first journal. Text, photos, moods, and a calendar — all of
it stored in SQLite on the device. No account, no cloud, no analytics, no
subscription.

**The pitch:** Day One charges a subscription to store your diary on someone
else's computer. Inkwell keeps it on yours.

## Features

- Write entries with an optional title, mood, and photos
- Timeline home screen with search
- Calendar month view with dots on days you wrote; backfill any date
- Export/import your whole journal (photos embedded) as a single JSON file
- Free forever: writing, calendar, search, export
- Pro (one-time unlock via RevenueCat): unlimited photos per entry
  (free tier: one photo per entry)

## Stack

Expo SDK 57 · TypeScript (strict) · expo-sqlite (WAL, `user_version`
migrations) · react-native-purchases (fail-open) · no navigation library.

See `AGENTS.md` for house rules.

## Development

```sh
npm install
npm start          # Expo dev server (Pro is fail-open in Expo Go)
npm run typecheck
```

## Before shipping (TODO)

- [ ] Confirm final name + bundle id (working title "Inkwell", `com.inkwelljournal.app`)
- [x] App icon — "Drop & Ripple" (`assets/icon.png` + `assets/adaptive-icon.png`, wired in `app.json`)
- [ ] Splash screen art in `assets/`, referenced from `app.json`
- [ ] Create EAS project (`eas init`) — `app.json` has no `projectId` yet
- [ ] RevenueCat project + paste public SDK keys into `src/revenuecat.ts`
- [ ] App Store product `inkwell_pro_lifetime` (non-consumable, **$9.99 / Tier 10**)
