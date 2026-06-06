# STATE

_Last updated: 2026-06-06 — **Starblox UI port complete** (full reskin + real lobby); cloud deploy pending (guided)._

> 🚩 **DIRECTION CHANGE — read `docs/direction/` first.** The owner has decided to build
> **Option B**: turn Starblox from a *config app* (AI tunes 2 pre-built templates) into a
> platform where the **AI genuinely writes games from scratch** (thin pseudo-engine + agent
> write→run→fix loop). Everything below describes the *current* Option-A codebase, which
> stays as the reliable backbone/fallback. See `docs/direction/README.md`.

## Environment (verified)
- Node 24.12, npm 11.6, SpacetimeDB CLI **2.4.1** (local), npm `spacetimedb` pinned **2.4.1**
- Next **16.2.7** + React **19.2** + Tailwind 4 + **Phaser 4.1** + **react-qr-code**; AI: **ai ^6 + @ai-sdk/anthropic ^3 + zod ^3.25**; **vitest ^4**
- Local STDB server on **:3000**; Next dev on **:3001**
- Server module `./spacetimedb` (frozen schema); client bindings `src/module_bindings`
- AI: **canned** (no key). Live **Claude Opus** flips on with `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL` default `claude-opus-4-8`); force canned via `AI_CANNED=1`. Canned trigger = `!key || AI_CANNED=1`.

## Phase status — feature-complete & deploy-ready
- [x] 0–7 (scaffold, home, multiplayer, tanks, hot-reload, AI edit, flappy, create/remix) — GREEN
- [x] **8 (local bits)** — Room QR, env-driven prod config (`.env.example`), `DEPLOY.md`, demo hardening; **`npm run build` passes**
- [x] **Starblox UI** — full light-metallic reskin (`globals.css` design system; primitives in `src/components/ui.tsx`; persistent `AppShell` top bar). New **real lobby** route `/lobby/[gameId]` (home card → lobby → **Play** → room); create has a **preview-confirm** step; 404 page. All SpacetimeDB wiring preserved; product renamed **Starblox**. Routing note: home cards → `/lobby/{id}`, lobby **Play** + per-card/lobby **Make it mine** → `/game/{id}`.
- [x] **8 (backend cloud)** — module **published to Maincloud as `starblox-prod`** (2026-06-06); `init` seeded Tank Trouble + Flappy Arena; verified a local build with the prod env (`wss://maincloud.spacetimedb.com` + `starblox-prod`) connects + syncs the seeds. Dashboard: https://spacetimedb.com/starblox-prod
- [x] **Connection-error UX** — failed/misconfigured connections now show a red **Disconnected** pill + a banner naming the bad URL/db (and detecting a literal `<placeholder>` db name), instead of a silent forever-"Connecting…". (`spacetime.ts` `getConnectError` → `StdbProvider.error` → `Conn`/`AppShell` banner.)
- [ ] **8 (frontend cloud)** — **user step**: set Vercel env `NEXT_PUBLIC_STDB_URI=wss://maincloud.spacetimedb.com`, `NEXT_PUBLIC_STDB_DB=starblox-prod`, `NEXT_PUBLIC_TEST_MODE=1`, then **redeploy** (NEXT_PUBLIC_* bake in at build time). Then run the production smoke test in `SMOKE_TESTS.md`.
- [x] **Immersive room (round 2)** — canvas now scales via Phaser `Scale.FIT` (no more fixed 800×600 overflow); chat is an on-demand right drawer (`edit-open` button); a terminal in `EditChat` flashes the real patch as "code edits"; CSS theater/fullscreen toggle (`fullscreen-toggle`, hides chrome via `body.sb-theater`); `TouchControls` give phones a d-pad+fire / tap-to-flap (CSS-gated `@media (max-width:860px)`). Covered by `e2e/phase8_immersive.spec.ts` (12 e2e total).
- [x] **Flappy overhaul (round 3)** — classic look (tilting/flapping yellow bird sprite + green capped Mario-style pipes + sky/ground) in `FlappyScene.ts`; **forgiving collision** in the module tick (no teleport — glide on ground/ceiling/gap-lips, head-on pipe wall = death via `player.alive=false`); per-player **game-over card** (`GameOverCard.tsx`, score + best + Play again) + new **`respawn`** reducer. Covered by `phase6.spec.ts` (death→card→restart). _LOCAL DB is now `bloxdev`_ (see [[starblox-deploy]]) — bindings regenerated for `respawn`. 13 e2e green.
- [x] **Tank overhaul (round 4)** — connected corridor mazes (recursive-backtracker `generateMaze`, 3 fixed seeds via `pickMaze`) that **rotate every 5 total points** (`rotateMap` respawns all tanks; also on Reset); smaller + slower tanks (`TANK_R 11`, `BASE_SPEED 185`); **speed pads** = gold-chevron metallic plates (`TankScene` `drawPads`) that grant a **2× speed buff for 5s** on drive-through (`BOOST_MULT`/`BOOST_MS`, `entity.data.boostUntil`); "speed blitz"/boost edits + the demo button now place pads at **random** spots (`mechanics.ts` `randomBoostZones`). Covered by `phase9_tank.spec.ts` (buff). 14 e2e green.
- [ ] **Preloaded showcase edits (next, hands-on)** — curate the exact demo edits/phrases. Flappy + tank art can still be tuned to taste.
- [ ] **Deferred** — manhunt-climax visuals (fog/sparks/hunter/boost/laser don't render yet).

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
