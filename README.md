# CadeiraPro

White-label SaaS booking platform for Brazilian barbershops. Real-time three-way
Pix split (shop / barber / platform), pt-BR throughout, mobile-first booking widget,
WhatsApp automation.

Owner: Gleydson de Paiva — GDP Ventures Limited.

## Repository layout

```
cadeirapro/
├── apps/
│   ├── api/            # Hono on Cloudflare Workers
│   └── dashboard/      # Vite + React 19 on Cloudflare Pages
├── packages/
│   └── shared/         # Money / time / Zod schemas / Pix helpers
├── supabase/           # Migrations and seed (added in §3)
└── .github/workflows/  # CI + deploy (added in §8)
```

`apps/widget/` and `packages/themes` and `packages/ui` arrive in later sprints.

## Prerequisites

- **Node.js ≥ 22 LTS** (Build Guide §2). Local dev tested on Node 24.
- **pnpm 9.x**, dispatched via Corepack (bundled with Node).
- **Supabase CLI** for migrations: `npm install -g supabase` (or use `npx supabase`).
- **Wrangler CLI** for the Worker: comes in via `pnpm install` as a dev dependency
  of `apps/api` (no global install needed).

### pnpm via Corepack — first-time setup

`packageManager` in `package.json` pins `pnpm@9.15.4`. Two options to invoke it:

- **Recommended (one-time, requires admin on Windows):**
  Open an elevated PowerShell and run `corepack enable`. From then on, `pnpm`
  is on `PATH` and dispatches to the pinned version automatically.
- **No-admin fallback (per-user shim):** install pnpm shims to a user-writable
  directory and add it to your `PATH`:

  ```bash
  mkdir -p ~/.local/bin
  corepack enable pnpm --install-directory ~/.local/bin
  # then add ~/.local/bin to your shell PATH (e.g. in .bashrc)
  export PATH="$HOME/.local/bin:$PATH"
  pnpm --version   # → 9.15.4
  ```

  This is what root scripts (`pnpm typecheck`, `pnpm test`) require — they
  shell out to `pnpm` recursively, which needs `pnpm` on `PATH`. Top-level
  `corepack pnpm <cmd>` works too but won't help with nested invocations.

- CI uses `pnpm/action-setup@v4` and is unaffected.

## Getting started

```bash
git clone https://github.com/gdepaula85-source/cadeirapro.git
cd cadeirapro
pnpm install                  # or: corepack pnpm install
```

### Environment

`.env.example` lists every variable from Build Guide §12.2. **Real staging
values are never committed.** They live at:

```
C:\Users\gdepa\Desktop\cadeirapro-secrets\env.staging.txt
```

`apps/api/.dev.vars` (gitignored) is hand-populated from that file for local
`wrangler dev`. Cloudflare Pages env vars are set in the Cloudflare dashboard.
Worker runtime secrets are set with `wrangler secret put <NAME>` (interactive).

### Common scripts

```bash
pnpm dev               # api + dashboard in parallel
pnpm dev:api           # wrangler dev on localhost:8787
pnpm dev:dashboard     # vite on localhost:5173
pnpm typecheck         # all workspaces
pnpm lint
pnpm test
pnpm build
pnpm db:migrate        # supabase migration up
pnpm db:reset          # supabase db reset (DESTRUCTIVE — wipes local data)
pnpm deploy:api        # wrangler deploy --minify
```

## One-off manual steps

These cannot be automated — owner action required.

### Database (Supabase)

1. **Apply migrations** via `supabase/migrations/0001_*.sql`, `0002_*.sql`,
   `0003_*.sql`, then `supabase/seed.sql`. Either via Supabase CLI
   (`supabase db push --linked`) or by pasting each file into
   the dashboard's SQL Editor in numerical order.
2. **Auth → Hooks → Customize Access Token (JWT) Claims** → enable, select
   `public.custom_access_token_hook`. Without this, JWTs lack
   `organization_id`. Build Guide §5.3.
3. **Auth → URL Configuration → Site URL** = `http://localhost:5173` for
   local dev; add `https://cadeirapro-dashboard.pages.dev` to "Redirect URLs"
   for staging. Without this, password-recovery / email-verify links
   redirect to nowhere.

### Worker runtime secrets (one-time)

Public env vars live in `apps/api/wrangler.toml` `[vars]`. Real secrets are
set once via `wrangler secret put` and stored in Cloudflare's secret store
— never in CI logs, never in git:

```bash
cd apps/api
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# (paste the value at the prompt — find it in cadeirapro-secrets/env.staging.txt)
```

In S3+ you'll add `TRANSFEERA_API_KEY`, `TRANSFEERA_WEBHOOK_SECRET`. In S4+
you'll add `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `RESEND_API_KEY`.

### GitHub repo secrets (for CI deploy)

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name                    | Value source                         |
| ----------------------- | ------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | `cadeirapro-secrets/env.staging.txt` |
| `CLOUDFLARE_ACCOUNT_ID` | `104c85648997fcf1d9c5f02938417df3`   |

These are read by `.github/workflows/deploy-api.yml` to authenticate the
`wrangler deploy` step. The Worker's runtime secrets do NOT go here —
those live in Cloudflare's secret store as above.

### Cloudflare Pages — create dashboard project (one-time)

After the first commit lands on `main`:

- Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
- Pick the `cadeirapro` repo, branch `main`
- Framework preset: **Vite**
- Build command: `pnpm install && pnpm --filter dashboard build`
- Build output directory: `apps/dashboard/dist`
- Root directory: `/`
- **Environment variables** (Production AND Preview):
  - `VITE_API_BASE` = `https://cadeirapro-api.g-depaula85.workers.dev`
  - `VITE_SUPABASE_URL` = `https://bqjdmkodzwrdjltvghqk.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_xas4vgYO_4YH1ucWux1MWg_-BDtkbc2`

After the project is created, every push to `main` auto-deploys the
dashboard at `cadeirapro-dashboard.pages.dev`. No GitHub Action needed.

## Conventions

- Conventional Commits (`feat(scope): subject`) enforced by commitlint + husky.
- snake_case in DB, camelCase in TS, PascalCase for types/components,
  SCREAMING_SNAKE_CASE for env vars.
- Money in integer cents, never floats.
- pt-BR copy lives in `apps/dashboard/src/strings/pt-BR.ts`, never inline in
  components.
- Audit-log every tenant-data mutation from the route handler (not via DB
  triggers).

Full conventions in Build Guide §14.

## Deployment

- **API (Worker):** auto-deploys on push to `main` when `apps/api/**` or
  `packages/shared/**` change. See `.github/workflows/deploy-api.yml`.
- **Dashboard (Pages):** auto-deploys on push to `main` once the Pages project
  is connected to the repo.

Staging only in S1. Production Supabase project is provisioned in S6.
