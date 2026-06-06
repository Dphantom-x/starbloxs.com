# STATE

_Last updated: 2026-06-06 — Phase 8 local bits done; cloud deploy pending (guided)._

## Environment (verified)
- Node 24.12, npm 11.6, SpacetimeDB CLI **2.4.1** (local), npm `spacetimedb` pinned **2.4.1**
- Next **16.2.7** + React **19.2** + Tailwind 4 + **Phaser 4.1** + **react-qr-code**; AI: **ai ^6 + @ai-sdk/anthropic ^3 + zod ^3.25**; **vitest ^4**
- Local STDB server on **:3000**; Next dev on **:3001**
- Server module `./spacetimedb` (frozen schema); client bindings `src/module_bindings`
- AI: **canned** (no key). Live **Claude Opus** flips on with `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL` default `claude-opus-4-8`); force canned via `AI_CANNED=1`. Canned trigger = `!key || AI_CANNED=1`.

## Phase status — feature-complete & deploy-ready
- [x] 0–7 (scaffold, home, multiplayer, tanks, hot-reload, AI edit, flappy, create/remix) — GREEN
- [x] **8 (local bits)** — Room QR, env-driven prod config (`.env.example`), `DEPLOY.md`, demo hardening; **`npm run build` passes**
- [ ] **8 (cloud deploy)** — Maincloud publish + Vercel deploy + cross-device. **Guided, needs user**: GitHub login for `spacetime login`, a globally-unique Maincloud db name, Vercel + (optional) Anthropic accounts. Steps in `DEPLOY.md`.

## Tests: 10 Playwright e2e (serial) + 14 Vitest unit green; `tsc --noEmit` clean; `next build` clean
Every spec phase has a Playwright test (`e2e/phaseN.spec.ts`); mechanics/Zod covered by Vitest (`src/lib/__tests__`). Manual smoke tests per phase in `SMOKE_TESTS.md`.

## Architecture recap (the thesis)
- All game behavior reads from a `game_rules` row + per-`player` overrides + `map_features` (maze/boosts). The 30Hz scheduled `tick` advances entities from those rows. `apply_rules_patch` (whitelist+clamp) is the ONLY way mechanics change → SpacetimeDB pushes the row to every subscriber → live for all players. Create = `create_game` + `apply_rules_patch`; edit = `apply_rules_patch`; same pipeline. Two games (tanks, flappy) prove it generalizes. AI = `/api/edit` (Zod-validated `generateObject`, canned fallback) producing those patches from English.

## Conventions / gotchas (verified — see also memory)
- Server ctx.db + columns snake_case; client rows camelCase. Reducer call `conn.reducers.camelName({camelArgs})`, u64=bigint. Module identity `ctx.databaseIdentity`. `ScheduleAt.interval(33_333n)` from `'spacetimedb'`.
- Browser contexts/Incognito = new identity; match entities by **owner identity**; `onDisconnect` despawns player entities; flappy pipes cleaned when birdless.
- Schema frozen; re-seed needs `--delete-data`; adding reducers/logic = plain `publish` hot-swap. Playwright `workers:1`.
- **f32 tolerance** for float-rule compares (`Math.abs(v-target)<0.01`). **No `Nn` bigint literals in e2e** (ES2017 target) → `BigInt(n)`. Flappy gravity measured by vy at a pipe-free x.
- `spacetime sql`: no `ORDER BY`/`SUBSTRING`. AI SDK v6: `maxOutputTokens`.

## How to run
1. `spacetime start` (refresh PATH in Claude shells). 2. `spacetime publish blox --server local [--delete-data] -y` + `npm run stdb:generate`. 3. `npm run dev` → http://localhost:3001. 4. `npm run test:e2e` + `npm run test:unit`. 5. `npm run build` (prod check).

## Next — cloud deploy (when user is ready): follow `DEPLOY.md`
`spacetime login` → `spacetime publish <unique> --server maincloud`; Vercel import + env (`NEXT_PUBLIC_STDB_URI=wss://maincloud.spacetimedb.com`, `NEXT_PUBLIC_STDB_DB=<unique>`, `NEXT_PUBLIC_TEST_MODE=1`, optional `ANTHROPIC_API_KEY`). Verify the SDK accepts the maincloud wss URI at deploy time.
