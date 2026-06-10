# Corsica & Nice Voyage Journal

A shared travel journal for a Corsica & Côte d'Azur trip — Cap Corse · Bonifacio · Nice (June 19–23, 2026).

> **New clone — read `SETUP.md` first.** Dates, the boat name, the passcode, and
> all API keys are placeholders until you complete the setup steps.

## Features

- **Day-by-day itinerary** with timeline, activities, and meals
- **Shared notes** — all travelers can add notes to each day (works offline, syncs on reconnect)
- **Photo journal** with AI-powered identification (landmarks, food, people), also offline-capable
- **Léa**, an AI local guide to Corsica & the Côte d'Azur
- **Live sync** across devices (Supabase Realtime)
- **PWA** — installable, works offline after the first online load

## Tech Stack

- **Frontend:** Vite + React (PWA via `vite-plugin-pwa`)
- **Hosting:** Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime)
- **AI:** Anthropic Claude (photo identification + the Léa chat guide)

## Local Development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in your values (see `SETUP.md`).
3. Run the dev server: `npm run dev`
4. Tests: `npm test` · Build: `npm run build`

## Deployment

Deployed on Vercel; any push to `main` triggers a new deployment.

### Environment Variables (set in Vercel dashboard)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | Anthropic API key (server-side only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

## Operating Notes

- **Adding a guest:** just share the URL — they enter their email and get a login code by email (login is open; no passcode). Requires the Supabase *Confirm signup* + *Magic Link* templates to include `{{ .Token }}` (see `SETUP.md`).
- **Usage/costs:** Supabase / Anthropic console / Vercel dashboards.

## Offline support

PWA with a service worker. After opening it **online once**, it works offline:
the itinerary/Places/Map and previously-viewed notes, photos, and chat render
from cache; **new notes and photos can be added offline and sync automatically on
reconnect.** The AI features (Léa chat, live photo identification) need a
connection. An "Offline" banner shows when you're disconnected.

## Forking / cloning

This app is fork-ready — see `FORKING.md` for the general pattern and `SETUP.md`
for this clone's remaining steps. Trip content lives in `src/data/`
(`trip.js`, `dayDetails.js`, `guide.js`, `locations.js`) and branding in
`src/config/theme.js`.

## Future Enhancements

- Photo editing/cropping before upload
- Export trip journal as PDF
- PWA icon PNGs (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)

---

Cloned from the Aeolian Islands Voyage Journal for a Corsica & Côte d'Azur trip.
