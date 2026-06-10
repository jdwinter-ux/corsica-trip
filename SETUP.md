# Corsica & Nice — Setup / Handoff

This app is a clone of the Aeolian journal, fully rebranded and re-content'd for a
**Nice ⇄ Corsica** charter. **All the code is done and it builds.** What remains
are the steps that need *your* accounts and the real trip details.

Location: `C:\Users\jdwin\ClaudeCodeProjects\corsica-trip` (separate from `aeolian-trip`).

---

## ✅ What's already done (by Claude, no input needed)
- Cloned the fork-ready Aeolian app here, fresh git history, **no Aeolian secrets** copied.
- Rewrote all trip content in `src/data/`: `trip.js`, `dayDetails.js`, `guide.js` (AI guide **Léa**), `locations.js` (map + per-day AI context).
- Rebranded all hardcoded strings: theme `BRAND`, ChatTab (Léa, 🇫🇷, greeting), LoginScreen (title/date), TravelersModal, `api/identify.js`, `api/chat.js`, `index.html`, `manifest.json`, README. Photo category `volcano` → `beach`.
- `npm install`, `npm run build` (clean, service worker emitted), `npm test` (8/8) all pass.
- Local git repo initialized with one commit.

## 🔧 What YOU need to do

### 1. Replace the placeholders (content)
These are researched guesses — swap in the real plan:
- **Dates** — currently `Sep 5–12, 2026`. Edit in `src/data/trip.js` (`dates`, `startDate`, each day's `date`/`weekday`) and `src/components/LoginScreen.jsx` (the date line).
- **Boat name** — not set (subtitle is "Côte d'Azur ⇄ Corsica"). Add the real yacht in `src/data/trip.js` `subtitle` and `src/data/guide.js` if you want Léa to mention it.
- **Itinerary** — the 8 days are a plausible Corsica charter, not a booking. Adjust stops/timeline/meals in `trip.js`, `dayDetails.js`, and `locations.js` (keep the day numbers aligned across all three).
- Verify the Michelin/restaurant names (La Signoria, Finestra, Casadelmar) are current/booked.

### 2. Create a new Supabase project
1. supabase.com → new project (pick a region near you/France, e.g. `eu-west`).
2. SQL Editor → paste and run **`supabase/setup.sql`** (creates tables, RLS, storage buckets, realtime, optional seed).
3. Auth → enable the **Email** provider; set Site URL + redirect URLs to your eventual Vercel domain (and `http://localhost:5173` for local dev).
4. **Email templates → add the login code.** Login uses an in-app OTP code (`signInWithOtp`/`verifyOtp`), not a clicked link. Supabase only includes the code if the template contains `{{ .Token }}`. (Code length is set by Authentication → Email OTP length, default 6; the app accepts 6–10 digits.) Edit **both** templates (a new email hits *Confirm signup*; a returning one hits *Magic Link*):
   - Authentication → Emails → **Confirm signup** *and* **Magic Link**
   - Add to each body: `<p>Your code: <b>{{ .Token }}</b></p>` (keep or drop the link as you like) → Save.
   - Skip this and first-time users get a code-less email and can't finish logging in.
5. Copy the **Project URL**, **anon key**, and **service_role key** from Settings → API.

### 3. Fill in `.env` (local) and Vercel env vars
Put the four Supabase/Anthropic values into `.env` (local) and into the Vercel
project's Environment Variables. You can reuse your existing **Anthropic API
key** or make a new one. (Login no longer uses a passcode, so `VITE_TRIP_PASSCODE`
is not needed — login is open email OTP.)

### 4. Create the GitHub repo + Vercel project
- New GitHub repo (e.g. `corsica-trip`), then from this folder:
  `git remote add origin <url>` → `git push -u origin main`.
- Import it into Vercel; set the 5 env vars; deploy. Pushes to `main` auto-deploy.

### 5. Verify (same as the Aeolian app)
- `npm run build` + `npm test` locally.
- On the deploy: log in (enter email → type the code from the email) → check **Chat** (Léa replies) and **Photos** (upload identifies). Both exercise the `api/` functions + Anthropic + Supabase.
- Two browsers → confirm realtime + offline (go offline, add a note/photo, reconnect → it syncs).

### 6. (Optional polish)
- Add real PWA icons in `public/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (referenced by `index.html`/`manifest.json`, currently missing — only `favicon.svg` ships).
- Re-skin colors in `src/config/theme.js` if you want a different palette than the navy/gold.

---

## Why some steps can't be automated
Creating Supabase/Vercel/GitHub projects and issuing API keys require your logins
and are outward-facing actions — they need you. Everything in the codebase itself
is complete.
