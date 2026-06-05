# Forking this app for a different trip

This app is **single-trip**: each trip is its own deployment (its own Supabase
project + Vercel project). Forking is mostly editing content in `src/data/` and
`src/config/`, running one SQL file, and wiring up env vars. No code logic needs
to change.

## 1. Copy the repo
```bash
git clone <this-repo> my-new-trip && cd my-new-trip
npm install
```

## 2. Edit the trip content (all under `src/data/`)
This is the bulk of the work — it's writing, not coding.

| File | What to change |
|------|----------------|
| `src/data/trip.js` | `TRIP`: title, subtitle, dates, **`startDate`** (ISO), and the `days[]` itinerary (timeline, activities, meals, route). Day count is flexible — the UI maps over `days`. Also `CATEGORY_ICONS` if you want different photo categories. |
| `src/data/dayDetails.js` | `DAY_DETAILS[n]`: the Places-tab content per day (hero, sections, tips). |
| `src/data/guide.js` | `GUIDE`: the AI guide's name, origin, persona, and knowledge base (`knowledge` + `instructions`). Rewrite for your destination. |
| `src/data/locations.js` | `MAP_LOCATIONS` (lat/lng), `DAILY_ROUTES`, `FULL_ROUTE`, `MAP_CENTER` (Map tab) and `DAY_LOCATIONS` (per-day context that primes AI photo ID). |

> Tip: the old `src/data/tripContext.js` was removed as dead code. If you want a
> richer guide, expand `guide.js`.

## 3. Re-skin (optional) — `src/config/theme.js`
- `THEME`: change color values in one place; all components reference these tokens.
- `BRAND`: app name / short name / description / theme color.

## 4. Update the static files (can't import JS — edit by hand)
- `index.html` — `<title>`, description meta, `theme-color`, apple web-app title.
- `public/manifest.json` — `name`, `short_name`, `description`, colors, icon paths.
- `public/` icons — **note:** `index.html`/`manifest.json` reference
  `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and `favicon.svg`. Only
  `favicon.svg` ships today; add the PNG icons (or update the references) for a
  clean PWA install.
- `README.md` — describe your trip.

## 5. Create a new Supabase project
1. New project at supabase.com.
2. SQL Editor → paste and run **`supabase/setup.sql`** (creates tables, RLS,
   storage buckets, enables realtime; optional traveler seed at the bottom).
3. Auth → enable Email (magic link), and set the Site URL / redirect URLs to
   your Vercel domain.

## 6. Create a new Vercel project
Import the repo, then set env vars (Project → Settings → Environment Variables):

| Variable | Where it's used |
|----------|-----------------|
| `VITE_SUPABASE_URL` | client |
| `VITE_SUPABASE_ANON_KEY` | client |
| `VITE_TRIP_PASSCODE` | client (shared login passcode) |
| `ANTHROPIC_API_KEY` | server (`api/`) — no `VITE_` prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | server (`api/`) — no `VITE_` prefix |

Push to `main` to deploy (auto-deploys on push).

## 7. Verify
- `npm run build` and `npm test` pass locally.
- On the deployed site: log in with the passcode, then check the two AI features
  end-to-end — **Chat** (the guide replies) and **Photos** (upload identifies).
  These exercise the `api/` functions + Anthropic + Supabase together.
- Open in two browsers to confirm realtime (a note/photo/chat in one appears in
  the other).
