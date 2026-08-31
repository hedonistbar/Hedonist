# AI Digital Onboarding & Presence Platform for Independent Hospitality

> Tell us which property is yours. We do the digital work.

A separate product from the Hedonist AI-marketer (`../README.md`, `../SPEC.md`)
living in this repo for now. Different audience (owners with little to no
digital presence, vs. Hedonist's already-online restaurant), different job
to be done (get online from nothing, vs. run daily marketing on an existing
presence), different data model. See `SPEC.md` §2 for the full comparison.

**Read in this order:**

1. **[`SPEC.md`](./SPEC.md)** — the product spec: positioning, the
   zero-form onboarding flow, the Property Graph data model, the Discovery
   Engine, AI layer, website generation, booking strategy, MVP boundaries,
   architecture proposal, KPIs, roadmap.
2. **[`RESEARCH.md`](./RESEARCH.md)** — the open-source module reuse
   matrix required before writing any of this (per the brief's own
   instruction: "не начинать программировать весь продукт сразу"). Real
   findings from a 2026-08-27 search pass, with licenses, activity, and
   explicit open questions that need a human legal decision before Phase 4.
3. **[`mvp/`](./mvp/)** — the clickable prototype. `cd mvp && npm install
   && npm run dev` to try the full onboarding flow yourself.

## Where this stands

This is Phase 0 per `SPEC.md` §20: architecture + research + a clickable,
fully click-tested prototype of the onboarding flow using a mocked (but
realistically shaped) Discovery Engine output. No live source integrations,
no real Property Graph persistence, no real booking engine yet — those are
Phases 1–4. The prototype's entire point is to prove the UX and data-model
shape end-to-end before committing engineering time to live integrations
whose partner-API approval timelines (Booking.com, Tripadvisor) are outside
engineering's control anyway (see `RESEARCH.md` §3).

## Main KPI

> What percentage of a property's profile the system fills in automatically
> before asking the owner a single question. Target: **≥ 70%**.

The MVP prototype's mocked run scores **93%** auto-filled before the one
real question it asks (a Google-vs-Booking check-in time conflict) — see
`mvp/README.md` for how that was verified.
