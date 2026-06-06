# 04 — Current state of the code (the Option B starting point)

What exists **today** — what you build Option B on top of, and what to reuse vs. eventually
replace. (See `STATE.md` at the repo root for the running status log.)

## Product & stack
- **Starblox** — live multiplayer games made/remade by talking to an AI, on SpacetimeDB.
  No downloads/accounts; builder and players never leave the page.
- Next.js **16.2.7** (App Router) + React **19** + Tailwind **v4** + **Phaser 4.1** +
  react-qr-code. AI: **AI SDK v6 + @ai-sdk/anthropic v3 + zod**. SpacetimeDB **2.4.1**
  TypeScript module. **Vitest** (unit) + **Playwright** (e2e).

## Architecture TODAY (data-driven / config — this is "Option A")
- **`game_rules` row + per-player overrides + `map_features`** hold all behavior. A 30 Hz
  scheduled `tick` advances entities from those rows.
- **`apply_rules_patch`** (whitelist + clamp) is the ONLY way mechanics change → SpacetimeDB
  pushes the row to every subscriber → live for everyone. Create = `create_game` +
  `apply_rules_patch`; edit = `apply_rules_patch`.
- **AI = `/api/edit`**: real `generateObject` against `RulesPatchSchema` when a key is set,
  else a deterministic `cannedPatch`. Produces validated rule patches from English.
  **This real+canned dual-path is the exact pattern Option B will follow.**
- **Two templates:** Tanks (rotating corridor mazes every 5 pts, smaller/slower tanks,
  gold-chevron speed pads with a 5 s buff) and Flappy (classic bird + capped pipes,
  forgiving collision, game-over card + respawn).
- **Immersive room:** scaling Phaser canvas, chat-on-demand "Edit with AI" drawer + an
  AI-change terminal, mobile touch controls, fullscreen, slim scoreboard overlay.

## Key files
- `spacetimedb/src/index.ts` — the SpacetimeDB module (schema + reducers + the `tick`).
  All tank + flappy logic lives here.
- `src/lib/mechanics.ts` — `RulesPatchSchema` (the AI's allowed output) + `cannedPatch`.
- `src/app/api/edit/route.ts` — the AI endpoint (real + canned).
- `src/game/TankScene.ts`, `src/game/FlappyScene.ts` — the Phaser renderers (hand-built;
  this is the "polish is the template" part).
- `src/components/CreateFlow.tsx` — the create page. `src/app/game/[gameId]/page.tsx` — the room.
- `src/lib/spacetime.ts` — client connection + cache reads + reducer calls.

## Deploy state
- **Backend:** Maincloud database **`starblox-prod`** (owned by the project's GitHub
  identity). **Frontend:** Vercel — live at **`https://starbloxs-com-5zct.vercel.app`**
  (runs in **canned mode** — no Anthropic key set). Vercel env: `NEXT_PUBLIC_STDB_URI=
  wss://maincloud.spacetimedb.com`, `NEXT_PUBLIC_STDB_DB=starblox-prod`,
  `NEXT_PUBLIC_TEST_MODE=1`.
- **Local dev:** the original machine uses local DB **`bloxdev`** (the name `blox` got
  orphaned by a CLI identity switch). On a **fresh machine use `blox`** (matches
  `npm run stdb:publish`). `.env.local` is gitignored → create it per machine. See
  `DEPLOY.md` + `.env.example`.
- **Deploying = republish module to `starblox-prod` (Maincloud) + `git push` (Vercel
  auto-builds).** Both are needed — pushing the frontend alone breaks the live site.

## Tests & docs
- **14 Playwright e2e + 14 Vitest unit green; `tsc --noEmit` clean; `next build` clean.**
- Related docs: `STATE.md` (status), `DEMO_IDEAS.md` (demo script + the "Build & Verify"
  create-flow spec), `DEMO_RUNBOOK.md` (click-by-click demo), `DEPLOY.md`, `SMOKE_TESTS.md`.

## What Option B reuses vs. adds vs. replaces
- **Reuse:** SpacetimeDB connection + `entity` table + sync, Phaser setup, room UI,
  chat/terminal, deploy pipeline, the real+canned AI pattern.
- **Add (new for B):** a generic multiplayer backend (one published module), a thin client
  SDK (the pseudo-engine), a loader/sandbox for AI-written game code, the agentic
  write→run→fix loop, and save/publish + import/export of game files.
- **Eventually replace:** the two hardcoded templates stop being the *only* games — they
  become reference examples the agent studies/seeds from.

## Working agreements / gotchas (from memory)
- Phase-gated: pause after each phase and hand the user manual smoke-test steps.
- Debugging protocol: research → instrument → fix → repeat (never fix blind).
- SpacetimeDB CLI on Windows needs a PATH refresh per shell; effort/“ultracode” is the
  user's default working mode. `spacetime login` switched the CLI identity (hence the
  `blox`→`bloxdev` orphaning) — re-login with the SAME GitHub account to own `starblox-prod`.
