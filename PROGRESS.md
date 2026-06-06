# Progress Log

Running log of work on the Corsica & Nice Voyage Journal. Newest session first.

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
