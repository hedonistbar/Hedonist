# Onboarding MVP — clickable prototype

A standalone Vite + React + TypeScript app that walks through the full
onboarding flow from `hospitality-platform/SPEC.md` §4: property name → city
→ discovery → confirm → digital audit → conflict resolution → AI content
review → photo review → website style → booking connect → preview →
publish.

## Run it

```bash
cd hospitality-platform/mvp
npm install
npm run dev
```

## What's real vs. mocked

- **Real:** the entire UI flow, state machine, the Property Graph shape
  (`src/types.ts`), the "one screen, one question" interaction pattern, the
  conflict-resolution UX, the AI content accept/edit/keep pattern, the
  photo review rules (hero selection, duplicate flagging, enhancement
  limited to light/crop — never content changes), and the generated website
  preview assembled purely from the confirmed Property Graph.
- **Mocked:** `src/data/mockDiscovery.ts` returns a fixed, hand-written
  Property Graph instead of calling a real Discovery Engine. It is shaped
  exactly like what live Google Places / Booking.com / Instagram sources
  would produce (with per-field `sources`, `confidence`, and a genuine
  Google-vs-Booking check-in time conflict to exercise Step 5), so swapping
  it for a real Discovery Engine call is the only change needed for every
  downstream screen — none of them know or care that the data is mocked.

## Why the demo property is fictional

The brief (§21) suggests demonstrating this against a real small French
hospitality business. This prototype instead uses a fictional composite
("Maison Sereine", Langres) for two reasons: (1) at this stage there is no
live Discovery Engine — the "found" data would have to be hand-typed
anyway, and presenting hand-typed guesses as if they were live facts about
a real business (ratings, review counts, phone numbers) would be
misleading; (2) `RESEARCH.md` §3 flags that scraping Booking/Airbnb/
Tripadvisor without an approved partner API is a ToS and legal risk — so
there is no live source to point at yet. Once the Discovery Engine (see
`SPEC.md` §6) is built against real, authorized sources, this file is what
gets replaced.

## Testing performed

The full flow was click-tested end-to-end with a headless browser
(name → city → discovery → candidate confirm → digital score → check-in
conflict resolution → all four content fields accepted → photo review →
style pick → booking mode → generated site preview → publish), confirming
no console errors and a computed auto-fill percentage of 93% before the
first "real" question — consistent with the ≥70% KPI target in `SPEC.md`
§19. `npm run build` (`tsc -b && vite build`) passes with no type errors.
