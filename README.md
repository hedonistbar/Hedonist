# Hedonist AI-marketer

AI marketer for restaurants — plans content, picks photos, writes copy in the
brand's voice, brands images, queues posts for approval, and handles routine
inbox/review replies. Multi-tenant from day one; pilot tenant is **Hedonist
Bar & Kitchen** (Kyiv). Full spec: [`SPEC.md`](./SPEC.md).

> This repo also hosts a **separate product**, unrelated to the above:
> [`hospitality-platform/`](./hospitality-platform/) is an AI Digital
> Onboarding & Presence Platform for small independent hospitality
> businesses (chambres d'hôtes, gîtes, small hotels) that don't have a
> digital presence yet. Different audience, different data model — see
> [`hospitality-platform/README.md`](./hospitality-platform/README.md).

This is **Phase 0** — the scaffold: multi-tenant database, the "kill switch"
(стоп-кран), and an owner/admin interface. No content generation or
publishing yet — that's Phase 1.

## Two interfaces, one database

- **`app/`** — a mobile-installable web app (PWA). This is the primary
  interface: sign in, see the стоп-кран status, pause/resume, manage the
  team. Runs entirely in the browser and talks to Supabase directly (see
  below) — no backend process required to use it.
- **`src/`** — a Telegram bot covering the same Phase-0 actions
  (`/status`, `/pause`, `/resume`, `/add_admin`). Built per `SPEC.md` §3,
  which specifies Telegram as the approval/escalation channel; kept as an
  optional notification channel alongside the app rather than the primary
  interface.

Both read/write the same `restaurants` / `restaurant_users` / `settings` /
`activity_log` tables (see `migrations/`).

## App: setup

The app calls Supabase directly from the browser using its **publishable**
key (safe to expose client-side — every table is protected by Row Level
Security, see `migrations/0002_auth.sql`). There's no server to run.

1. **Apply the database migrations once**, via the Supabase dashboard → SQL
   Editor → paste and run, in order:
   - `migrations/0001_init.sql`
   - `migrations/0002_auth.sql`
2. **Seed the pilot tenant** — either `npm run seed` (from repo root, needs
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `.env`) or paste equivalent
   `insert` statements into the SQL Editor.
3. **Enable Email auth** in Supabase (Authentication → Providers) if it
   isn't already — it is by default.
4. Build and open the app:
   ```bash
   cd app
   npm install
   npm run dev
   ```
   Or deploy it: pushing to `main` (or `claude/new-session-25ghuh`) triggers
   `.github/workflows/deploy-app.yml`, which builds `app/` and publishes it
   to GitHub Pages. First run may need Pages enabled once under repo
   Settings → Pages → Source: **GitHub Actions** (the workflow usually
   enables this itself).
5. Open the app, sign up with email + password. The **first person** to sign
   up becomes the restaurant's **owner**; the owner then adds admins by
   email from the **Команда** (Team) tab — the admin has to have signed up
   first.

Config is optional — `app/.env.example` documents `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_DEFAULT_RESTAURANT_SLUG` overrides,
but the app falls back to the Hedonist pilot project's values if unset.

## Bot: setup

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather).
2. From repo root:
   ```bash
   cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
   npm install
   npm run migrate         # applies migrations/*.sql in order
   npm run seed
   npm run dev
   ```
3. Message the bot `/start`. As with the app, the first person to do this
   becomes owner (this is a separate bootstrap path from the app's — the bot
   keys identity off `telegram_user_id`, the app off Supabase Auth
   `user_id`; both land in the same `restaurant_users` table).

### Bot commands

| Command | Who | What |
|---|---|---|
| `/start` | anyone | Registers as owner (if none yet) or greets a known user |
| `/status` | registered users | Shows стоп-кран state and current settings |
| `/pause [reason]` | owner/admin | **Стоп-кран**: halts all automated posting and auto-replies |
| `/resume` | owner/admin | Lifts the стоп-кран |
| `/add_admin <telegram_id> [name]` | owner | Grants admin access |
| `/whoami` | anyone | Shows your Telegram id and role |
| `/help` | anyone | Lists available commands |

The стоп-кран (`restaurants.is_paused`) is checked by every future automated
action — the daily content cycle, scheduled publishing, and inbox
auto-replies all read this flag before acting (Phase 1+). While paused, the
system keeps drafting and queuing content but nothing goes out without a
human pressing the button.

## Project layout

```
migrations/              SQL migrations (applied in filename order)
app/                      PWA — primary interface
  src/lib/                 Supabase client, auth/membership hooks, DB types
  src/screens/              AuthScreen, BootstrapScreen, StatusScreen, TeamScreen
.github/workflows/        GitHub Pages deploy for app/
src/                      Telegram bot
  config/env.ts             Typed, validated environment loading
  db/
    client.ts                Supabase client (service role — bypasses RLS)
    migrate.ts                Migration runner (npm run migrate)
    seed.ts                    Pilot tenant seed (npm run seed)
    repo.ts                     Query helpers (restaurants, users, settings, activity log)
  types/database.ts        Hand-written types mirroring the schema
  bot/
    index.ts                 Bot bootstrap
    context.ts                 Custom grammY context (restaurant + role)
    middleware/tenant.ts         Resolves the active restaurant per update
    commands/                     One file per command
```

## Data model

Every table except `restaurants` carries a `restaurant_id` for tenant
isolation (see `migrations/0001_init.sql`: `restaurants`, `restaurant_users`,
`brand_context`, `info_faq`, `campaigns`, `assets`, `content_items`,
`publications`, `messages`, `reviews`, `activity_log`, `settings`).
`migrations/0002_auth.sql` adds Supabase Auth identity (`restaurant_users.user_id`)
alongside the bot's `telegram_user_id`, plus Row Level Security policies so
the app's browser-side client (publishable key only) can only ever see or
change rows for restaurants it's a member of. The bot still connects with
the service role key and bypasses RLS entirely.

## Roadmap

See `SPEC.md` §10 for the full phase breakdown:

- **Phase 0** (this) — scaffold, DB, app + bot, стоп-кран
- **Phase 1** — brand knowledge base, Google Drive ingestion, content
  generation via Claude, image branding, approval queue,
  publishing to Instagram/Facebook via a gateway
- **Phase 2** — campaigns module, Google Business Profile, Stories/Reels
- **Phase 3** — inbox (simple/complex classification, auto-reply +
  escalation), review monitoring and draft replies
- **Phase 4** — multi-tenant product: onboarding, billing, direct Meta review
