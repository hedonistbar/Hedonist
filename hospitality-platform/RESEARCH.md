# Module reuse matrix — open-source landscape

Per `SPEC.md` §16-17. Findings below come from a web-search pass done on
2026-08-27 (see links) — **not** from reading source code or running the
projects. Before any of these ships in production, someone must: clone it,
read the actual `LICENSE` file (not just the README's claim), check the
last 6–12 months of commit/issue activity, and run a dependency/CVE scan.
Nothing here is a green light by itself — it narrows the search.

Legend for **Recommendation**: `ADOPT` (use as-is or as a library),
`REFERENCE` (study the design, don't vendor the code), `BUILD` (no
suitable candidate — write in-house), `VERIFY` (promising but a blocking
question — usually license — must be resolved with a human/legal decision
before any commitment).

---

## 1. Booking engine / PMS layer

| Candidate | License | Stack | Activity | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|---|---|
| **QloApps** ([github.com/Qloapps/QloApps](https://github.com/Qloapps/QloApps)) | **OSL-3.0** (core), **AFL-3.0** (some modules) — confirmed via project docs | PHP / PrestaShop fork | Actively maintained by Webkul, commercial company behind it | Full PMS + booking engine + hotel website builder; closest match to the brief's booking flow (`Search → Quote → Select room → Guest details → Payment → Confirm`) | OSL-3.0/AFL-3.0 are **reciprocal/copyleft-like licenses** — the brief explicitly flags these as "avoid without separate legal sign-off". PHP/PrestaShop stack does not match our TS/Node codebase — would run as an isolated service, not an in-process library. Tight coupling to PrestaShop's admin/catalog model is a poor fit for our "invisible to the owner" UX principle (§3, §13 of SPEC.md) | `REFERENCE` for booking UX, room catalog, rate/inventory data model (matches brief §7 QloApps guidance). `VERIFY` before ever vendoring code — do not copy files without a license decision. |
| **inPMS** (surfaced via search as an "AI-native, open-source, hosted PMS... MCP tool layer for AI agents") | **Unverified** — no GitHub repo URL or LICENSE file was found in this pass; site language ("free, hosted PMS") suggests it may be a hosted product with an open component, not a fully open-source self-hostable codebase | Unknown | Unknown — appears to be a newer/smaller project | If genuinely open and MIT/Apache, it would be the best-fit reference the brief names explicitly (PMS models, booking engine, direct booking, inventory, rates, payments, API architecture) | Cannot be adopted or even referenced responsibly until: (a) the actual GitHub repo is located, (b) LICENSE is read, (c) activity/security is checked. Treating "hosted PMS" as "open-source we can vendor" is exactly the mistake §16 of SPEC.md warns against. | `VERIFY` — first task before any commitment: get a direct repo link from the project's own site/GitHub org and re-run the §16 checklist. Do not reference it as a settled dependency until then. |
| Small student/hobby hotel-management repos (`hotelio`, `PyPMS`, `hotel-pms`, etc.) | Mixed, often unspecified | PHP/Python/Java, varies | Low — mostly single-author, sparse commit history | Useful only as design reading (schema shapes, room/rate modeling) | Not production-grade, not actively maintained, license often missing entirely (missing LICENSE = all rights reserved by default) | `REFERENCE` only, never `ADOPT`. |
| **In-house minimal direct-booking engine** | N/A | TS/Node, matches our stack | N/A | Full control over the "one screen = one question" UX and the Property Graph coupling; small surface area (MVP only needs single-property availability + a deposit charge, not multi-property inventory) | Building payments/PCI-adjacent flow ourselves is real work and real risk | `BUILD` for MVP scope (search → quote → room select → guest details → deposit via Stripe Checkout or similar hosted payment page → confirm), `REFERENCE` QloApps for the state machine only. Defer full PMS ambitions entirely — §14 of SPEC.md already excludes this from MVP. |

**Decision needed from a human before Phase 4 (Booking connect):** whether
to pursue an inPMS legal/technical evaluation, vendor nothing and build the
minimal flow above, or scope Phase 4 as "embed the owner's existing
provider's widget only" and push a self-built engine to a later phase.

## 2. Entity resolution / deduplication (Discovery Engine core)

| Candidate | License | Stack | Activity | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|---|---|
| **Splink** ([github.com/moj-analytical-services/splink](https://github.com/moj-analytical-services/splink)) | **MIT** | Python, DuckDB/Spark/Athena backends | Active, maintained by UK Ministry of Justice, well documented, used at scale ("~1M records/minute on a laptop" per project docs) | Probabilistic record linkage (Fellegi-Sunter) is exactly the "is this Google listing, this Booking listing and this Instagram profile the same physical property?" problem in §9 of SPEC.md | Python, not TypeScript — would run as a small isolated microservice/CLI called from the Node orchestrator, not embedded in-process. Overkill machinery (Spark/Athena) not needed at our scale — DuckDB backend is the right fit | `ADOPT` (as an isolated Python service) for the probabilistic-matching layer; feed it (name, address, phone, coordinates) blocks, keep LLM verification only for the residual ambiguous cases (cheaper and more auditable than LLM-only matching). |
| **dedupe** ([github.com/dedupeio/dedupe](https://github.com/dedupeio/dedupe)) | **MIT** (confirmed via repo LICENSE search) | Python | Established, but active-learning workflow (human-in-the-loop labeling) is a better fit for messy CSV cleanup than for a real-time onboarding pipeline | Same problem space as Splink | Requires a labeling step to train the matcher — adds friction for a real-time flow | `REFERENCE`; prefer Splink for the always-on pipeline, dedupe only if we later need an offline "clean up the whole listings database" batch job. |
| In-house heuristic pre-filter (normalized name similarity + geo-distance + phone match) | N/A | TS | N/A | Cheap first pass before invoking Splink/LLM — most true matches will already agree on phone or exact address | None beyond normal engineering | `BUILD` as a pre-filter in front of Splink to cut cost. |

## 3. Business/location discovery sources

| Candidate | License / terms | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| **Google Places API (Nearby/Text/Place Details)** | Commercial, paid, Google ToS | Highest-quality primary source for name/address/phone/hours/rating/photos; the brief names it explicitly | Cost (~$0.03–0.05/call class of pricing, changes over time — re-check current pricing before committing budget); ToS forbids scraping around the API, must use official endpoints/caching rules | `ADOPT` as primary paid source for MVP candidate search. |
| **OpenStreetMap + Overpass API** (and wrapper APIs like "BizData API" surfaced in search) | **ODbL** (data), Overpass itself is free infra with fair-use limits | Free fallback/enrichment source for address/coordinates/opening hours where Google data is thin or as a free tier before paid calls | ODbL requires attribution and share-alike **for the OSM data itself** if redistributed as a dataset (does not affect our own code's license, but affects how we may republish raw OSM extracts) | `ADOPT` as a secondary/fallback source; must display OSM attribution wherever OSM-derived data is shown verbatim. |
| Booking.com / Airbnb / Expedia / Tripadvisor listing pages | Each platform's own ToS; official partner APIs exist but require partner status/approval | Needed for Booking/Airbnb ratings, room types, prices per §4 of the brief | Unauthorized scraping of these specific platforms is a ToS and legal risk (also called out generically in SPEC.md §6 — "не через неавторизованный скрейпинг"); official APIs (Booking Connectivity API, Tripadvisor Content API) require an approved partner account, which takes time | `VERIFY` — apply for partner/API access as a business step in parallel with engineering; MVP demo therefore uses **mocked** data shaped like these sources' output (see `mvp/README.md`), not live scraping. |

## 4. Image quality / enhancement

| Candidate | License | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| **sharp** (already a dependency in `app/package.json`) | **Apache-2.0** | Cropping, resizing, format conversion, basic exposure/levels adjustments — covers most of the "enhance reality" list (crop, perspective, resize) | None significant | `ADOPT` — already in the repo. |
| Classical/light denoise & white-balance libraries (e.g. OpenCV bindings) | **Apache-2.0/BSD** (OpenCV) | Noise reduction, white balance, exposure — the remaining allowed operations from SPEC.md §8 | Native bindings add build complexity in a serverless/edge deploy target | `ADOPT` for a server-side image-processing worker (not client-side). |
| Generative image models (inpainting/outpainting, "room enhancement" tools) | Varies, several proprietary | Would trivially violate the brief's explicit ban ("не добавлять мебель… не менять интерьер… не скрывать реальные недостатки") | Reputational/legal risk if a generated photo misrepresents the property to a paying guest | `BUILD`/explicitly **exclude** — do not integrate any tool from this category into the enhancement pipeline, by product rule not just by omission. |

## 5. Menu OCR / structuring (Restaurant module, later phase)

| Candidate | License | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| **Tesseract / Tesseract.js** | **Apache-2.0** | Baseline OCR for scanned/photographed menus | Weak on complex multi-column menu layouts without pre/post-processing | `ADOPT` as a first pass, paired with LLM-based structuring (categories/dishes/prices/allergens) rather than pure OCR — matches SPEC.md's "AI extraction" pattern already used elsewhere. |
| **MinerU** ([github.com/opendatalab/mineru](https://github.com/opendatalab/mineru)) | Apache-2.0 (per project) | Stronger general PDF/table extraction, useful for printed PDF menus with price columns | Heavier dependency (ML models), general-purpose rather than menu-specific | `REFERENCE`/evaluate in Phase 6 (restaurant module) — not needed for MVP. |
| Menu-specific vision-model repos (e.g. small single-purpose "OCR-menu" projects found in search) | Often unlicensed or unclear | Demonstrates the LLM-vision-for-menus approach | Not production-grade, sparse activity | `REFERENCE` for approach only; SPEC.md already assumes Claude's vision capability does the structuring, not a bespoke OCR model. |

## 6. Website generation / CMS layer

| Candidate | License | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| Static-site approach (own SSG templates over Property Graph, e.g. using Vite/React SSG or Astro) | N/A (our code) | Full control, matches "owner never touches layout" principle, easy multilingual routing | None beyond normal build | `BUILD` — this is core product surface, not a commodity to outsource. |
| Headless CMS (Payload CMS, Strapi, Directus) | Payload: MIT (since v2); Strapi: Strapi license (not pure MIT, has commercial-tier caveats); Directus: BUSL-ish source-available terms in some versions — **all need re-verification at adoption time** | Could store Property Graph + editorial content | Adds an entire extra system the owner never needs to see; none of these model "confidence/source per field" out of the box — would need heavy customization anyway | `BUILD` on top of our own Property Graph schema (§5 of SPEC.md) rather than adopting a generic CMS; a generic CMS solves a problem (flexible content modeling for editors) we don't have. |
| **QloApps' hotel-website module** | OSL-3.0/AFL-3.0 (same caveat as §1) | Reference for room catalog / gallery / amenities page structure per SPEC.md §7 of the brief | Same license caveat as above; do not vendor code | `REFERENCE` only. |

## 7. i18n / translation

| Candidate | License | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| LibreTranslate | **AGPL-3.0** | Self-hostable translation | AGPL triggers copyleft obligations for any service that calls it over a network boundary in some interpretations, and is explicitly on SPEC.md's "avoid" list | `BUILD`/avoid — use Claude API for FR/EN (and later DE/ES/IT/NL) translation instead, consistent with the rest of the AI layer and with zero extra licensing exposure. |

## 8. Schema.org / structured data

| Candidate | License | Reuse potential | Risks | Recommendation |
|---|---|---|---|---|
| **schema-dts** (Google, TypeScript types for Schema.org) | **Apache-2.0** | Typed `LodgingBusiness`/`Hotel`/`Restaurant`/`Review` structures for the generated website's JSON-LD | None significant | `ADOPT`. |

---

## Summary: build vs. reuse

**Reuse (after the license/legal check above is actually performed by a human):**
- Splink for probabilistic entity resolution (isolated Python service).
- `sharp` + OpenCV-class libraries for the allowed photo-enhancement operations.
- Tesseract as first-pass OCR for menus (Phase 6, not MVP).
- `schema-dts` for typed structured data.
- Google Places API + OSM/Overpass as discovery data sources (one paid, one free fallback).

**Build in-house (no license-clean, well-fitting alternative exists):**
- Discovery Engine orchestration and conflict detection.
- Property Graph model (`SourcedField`, confidence scoring).
- AI Content Improvement / Review Intelligence prompt layer.
- The "one screen, one question" onboarding UX and Digital Score.
- Website generator driven by the Property Graph.
- Minimal direct-booking flow for properties with no existing provider (MVP scope only).

**Open questions requiring a human/legal decision before Phase 4:**
- Whether inPMS is genuinely open-source, under what license, and whether its
  codebase/architecture is worth adopting once actually located and read.
- Whether QloApps' OSL-3.0/AFL-3.0 core is acceptable to depend on **as a
  separate hosted service** (not vendored code) for properties that want a
  fuller PMS than our MVP direct-booking flow offers.
- Partner-API access timelines for Booking.com / Tripadvisor / Airbnb —
  this gates when Discovery Engine can move from "mocked, shaped like these
  sources" (current MVP) to "live".

Sources consulted (search pass, 2026-08-27):
- [QloApps — GitHub](https://github.com/Qloapps/QloApps)
- [QloApps — official site](https://qloapps.com/)
- [Splink — MoJ Analytical Services](https://moj-analytical-services.github.io/splink/index.html)
- [Splink introduction — Robin Linacre](https://www.robinlinacre.com/introducing_splink/)
- [dedupe — GitHub](https://github.com/dedupeio/dedupe) / [LICENSE](https://github.com/dedupeio/dedupe/blob/main/LICENSE)
- [Best Open Source Entity Resolution Libraries — Tilores](https://tilores.io/content/best-open-source-entity-resolution-and-record-linkage-libraries-splink-zingg-dedupe-and-when-to-move-beyond-them/)
- [MinerU — GitHub](https://github.com/opendatalab/mineru)
- [OpenDataLoader PDF — GitHub](https://github.com/opendataloader-project/opendataloader-pdf)
- [BizData API (OSM-based Places alternative)](https://googlemapsmania.blogspot.com/2026/05/bizdata-api-open-alternative-to-google.html)
- [OpenStreetMap licensing overview via Google Places alternatives roundup](https://traveltime.com/blog/google-places-api-alternatives-points-of-interest-data)
