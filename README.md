# Hedonist AI-marketer

AI marketer for restaurants — plans content, picks photos, writes copy in the
brand's voice, brands images, queues posts for approval, and handles routine
inbox/review replies. Multi-tenant from day one; pilot tenant is **Hedonist
Bar & Kitchen** (Kyiv). Full spec: [`SPEC.md`](./SPEC.md).

This is **Phase 0** — the scaffold: project setup, the multi-tenant database,
a Telegram bot with the safety-critical commands, and the "kill switch"
(стоп-кран). No content generation or publishing yet — that's Phase 1.

## Stack

- Node.js 20+ / TypeScript, ESM
- Postgres via [Supabase](https://supabase.com) (DB + storage)
- [grammY](https://grammy.dev) for the Telegram bot
- [Zod](https://zod.dev) for env validation

## Setup

1. Create a Supabase project (or point at any Postgres instance).
2. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and grab the token.
3. Copy the env file and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Settings → API
   - `SUPABASE_DB_URL` — Supabase dashboard → Settings → Database → Connection string (URI). Only needed for `npm run migrate`.
   - `DEFAULT_RESTAURANT_SLUG` — defaults to `hedonist`
4. Install dependencies:
   ```bash
   npm install
   ```
5. Apply the database schema:
   ```bash
   npm run migrate
   ```
6. Seed the pilot tenant (Hedonist brand context, starter FAQ, default settings):
   ```bash
   npm run seed
   ```
7. Run the bot:
   ```bash
   npm run dev
   ```
8. Open the bot in Telegram and send `/start`. The **first person** to do
   this on a fresh restaurant becomes its **owner** automatically. The owner
   can then register administrators with `/add_admin <telegram_id>` (get the
   id via `/whoami`).

## Bot commands (Phase 0)

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
migrations/           SQL migrations (applied in filename order)
src/
  config/env.ts        Typed, validated environment loading
  db/
    client.ts           Supabase client (service role — bypasses RLS)
    migrate.ts           Migration runner (npm run migrate)
    seed.ts               Pilot tenant seed (npm run seed)
    repo.ts                 Query helpers (restaurants, users, settings, activity log)
  types/database.ts    Hand-written types mirroring the schema
  bot/
    index.ts             Bot bootstrap
    context.ts             Custom grammY context (restaurant + role)
    middleware/tenant.ts     Resolves the active restaurant per update
    commands/                 One file per command
```

## Data model

Every table except `restaurants` carries a `restaurant_id` for tenant
isolation (see `migrations/0001_init.sql` for the full schema: `restaurants`,
`restaurant_users`, `brand_context`, `info_faq`, `campaigns`, `assets`,
`content_items`, `publications`, `messages`, `reviews`, `activity_log`,
`settings`). Row Level Security is enabled on every table; the bot currently
connects with the Supabase service role key (bypasses RLS), so per-tenant
policies aren't required yet — add them if/when client-side or dashboard
access is introduced (Phase 4).

## Roadmap

See `SPEC.md` §10 for the full phase breakdown:

- **Phase 0** (this) — scaffold, DB, bot, стоп-кран
- **Phase 1** — brand knowledge base, Google Drive ingestion, content
  generation via Claude, image branding, Telegram approval queue,
  publishing to Instagram/Facebook via a gateway
- **Phase 2** — campaigns module, Google Business Profile, Stories/Reels
- **Phase 3** — inbox (simple/complex classification, auto-reply +
  escalation), review monitoring and draft replies
- **Phase 4** — multi-tenant product: onboarding, billing, direct Meta review
