# Progress Log

Running log of work on the Corsica & Nice Voyage Journal. Newest session first.

---

## Session — 2026-06-29 (post-trip: photo recognition, GPS, refine, lightbox)

Applied to **both** apps (kept in sync; only trip content / guide name differ).

### Completed this session
- **Photo identification upgraded to Opus + extended thinking.** `identify.js`
  uses a separate `ANTHROPIC_VISION_MODEL` (claude-opus-4-8) with the adaptive
  thinking API (`thinking:{type:'adaptive'}` + `output_config.effort:'high'`);
  chat stays on Sonnet. `max_tokens` 8000 so high-effort thinking can't truncate
  the JSON. `vercel.json` raises `api/identify.js` maxDuration to 60s. Gotcha:
  Opus 4.8 rejects the old `thinking:{type:'enabled',budget_tokens}` form (400 →
  "identification failed").
- **Loosened the identify prompt** — identify the true subject first; treat the
  day's known-locations as a hint, not ground truth; be honest about uncertainty
  instead of inventing a precise place.
- **GPS readiness** — reverse-geocode coords via OpenStreetMap Nominatim (free,
  best-effort, 4s timeout) + correct hemisphere (S/W). NOTE: iOS strips GPS from
  photos picked via the web file input, so 0/27 of this trip's photos had GPS —
  this only helps future GPS-bearing uploads / forks.
- **"Refine" flow** — per-photo 🧭 panel to give a location hint or use the
  browser's current location, then re-identify and write back (most authoritative
  signal in the prompt).
- **Fixed a crash on malformed/panorama JPEGs** — `sharp({ failOn: 'none' })`; a
  7936×2768 panorama always failed with "Invalid SOS parameters for sequential JPEG".
- **Tap-to-expand lightbox** for photos (full uncropped view; Escape/backdrop/✕ to
  close; reads live photo data so captions don't go stale).

### Discussed, not built (future)
- **"Discuss in Chat"** — open a photo in a Léa conversation with an `update_photo`
  write-back tool (chat already supports image attachments + tool use).
- **Spotted-log import** — `corsica_cotedazur_spotted_log.json` (repo root)
  documents the trip; idea: seed photo entries on the correct day with an
  "add photo" button.

### Open / pending
- **Performance: Supabase is in the EU, users are now in the US.** The browser
  talks to Supabase directly (queries, realtime, storage), so it lags from the US.
  Fix = migrate each project to a US region (us-east-1, co-located with Vercel's
  iad1). Supabase can't relocate in place → new project + copy data/storage +
  reconfigure settings (Site/redirect URLs, `{{ .Token }}` templates, SendGrid
  SMTP, OTP=6) + swap env vars; users just re-login (attribution is by
  author_email). Not yet done.
- **Rotate the Aeolian service_role key** (exposed in a transcript). A US-region
  migration would retire the old project and moot this.

---

## Session — 2026-06-26 (emergency: AI features fixed after model retirement)

- Chat + photo identify both stopped working mid-trip. Cause: both pinned
  `claude-sonnet-4-20250514`, which Anthropic **retired 2026-06-15**; requests
  404'd and the catch masked it as a generic failure.
- Fixed → `claude-sonnet-4-6`, then **centralized the model in `api/_aiModel.js`**
  (env-overridable via `ANTHROPIC_MODEL`) so the next retirement is a one-line change.

---

## Session — 2026-06-10 (login overhaul + go-live prep)

Applied to **both** this app and the Aeolian app (kept in sync).

### Completed this session
- **Login redesigned: shared passcode + magic link → email + in-app OTP code.** `LoginScreen.jsx` now does email → `signInWithOtp` → enter code → `verifyOtp` (no leaving the app, which fixes the mobile browser-bounce that lost sessions). Dropped `VITE_TRIP_PASSCODE` entirely (login is now open email OTP). Normalizes email (trim/lowercase) + mobile input hints.
- **Variable-length codes.** Codes accept 6–10 digits (Supabase OTP length is configurable; was emitting 8). Later set both projects to 6 in Supabase. Input/validation no longer hardcode length.
- **Custom SMTP (SendGrid).** Replaced Supabase's built-in sender (~2 emails/hour cap) with SendGrid SMTP, then raised the auth email rate limit. Documented in `SETUP.md` step 5 + `FORKING.md`.
- **Chat reset for go-live.** Added `scripts/reset-chat.mjs` (service_role; deletes `trip_chat` rows + empties `chat-attachments`, paginated). This project's chat was already empty (0/0).
- **Quality pass:** merged Supabase's conflated expired/invalid OTP error into one accurate message; `htmlFor`/`id` on inputs; doc fixes (env-var count, stale "magic link"/passcode references).

### Requires manual Supabase config (per project, not in code)
- **Email templates must include `{{ .Token }}`** in **both** *Confirm signup* (new users) and *Magic Link* (returning users), or the code-less email breaks login.
- Custom SMTP settings + raised rate limit live in the dashboard, not the repo.

### Incomplete / caveats
- **Rotate the Aeolian `service_role` key** — it was pasted into a chat transcript during the reset. Then update it in Vercel for the Aeolian project.

---

## Session — 2026-06-05 (clone from Aeolian app)

### Completed this session
- Cloned the fork-ready Aeolian app into this project (fresh git history, no Aeolian secrets carried over).
- Rewrote all trip content for a Nice ⇄ Corsica charter: `trip.js` (8-day itinerary), `locations.js` (map coords + routes + DAY_LOCATIONS), `guide.js` (AI guide **Léa**), `dayDetails.js` (Places tab).
- Rebranded everywhere the fork-refactor didn't reach: `theme.js` BRAND, ChatTab (Léa, 🇫🇷, greeting), LoginScreen (title + date), TravelersModal, `api/identify.js` (expert prompt + `beach` category), `api/chat.js` (Léa), `index.html`, `manifest.json`, README. Swapped photo category `volcano`→`beach`.
- Wrote `SETUP.md` with the remaining owner-only steps.

### Working / tested
- `npm run build` clean (SW emitted); `npm test` 8/8 (carried-over chatMerge tests).
- All app code is in place; identical feature set to the Aeolian app (realtime, offline notes+photos, editable IDs, reference headshots, etc.).

### Deployment — DONE ✅
- GitHub: https://github.com/jdwinter-ux/corsica-trip
- Supabase project created + `setup.sql` run; Vercel deploy live at https://corsica-trip.vercel.app
- Verified live: client env baked into the bundle; `/api/chat` + `/api/identify` return 401 (load cleanly); branding correct.
- Gotcha hit & fixed: a Vercel "Use existing Build Cache" redeploy served an env-less bundle (500s) — a fresh commit forced a clean build that baked in the env vars.

### Incomplete / caveats
- **Placeholders to confirm:** trip dates (Sep 5–12, 2026), boat name, and the itinerary are a researched draft — replace with the real plan.
- Final human check: logged-in Chat (Léa) reply + a photo upload; ensure the Vercel domain is in Supabase Auth redirect URLs for magic-link login.
- Michelin/restaurant names are real as of 2025 research but verify before relying on them.

### Tackle next time
- Replace placeholder dates/boat/itinerary with the confirmed trip.
- Optional: PDF export, PWA icon PNGs.
