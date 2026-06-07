# Handoff — pick-up notes

For the next session (human or agent). Start with [README.md](README.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); this is the operational cheat-sheet.

## Current state

Working MVP. The multiplayer engine, the generation pipeline, and live editing are
all wired (see README → "What's real today"). The AI runs in **demo mode** (cached
pipeline outputs) unless `ANTHROPIC_API_KEY` is set, which flips it to **live**
generation. Full e2e suite is green.

## Run it

- **Backend (SpacetimeDB):** `spacetime start`, then `npm run stdb:publish`
  (publishes the `blox` module) + `npm run stdb:generate`. Runs on **:3000**.
- **Frontend:** `npm run dev` → **:3001**. `.env.local` points at the local
  backend (`ws://localhost:3000` / `blox`) with `NEXT_PUBLIC_TEST_MODE=1`.
- **Tests:** `npm run test:e2e` (Playwright; needs the local backend up).
- **Live AI:** add `ANTHROPIC_API_KEY` to `.env.local` and restart dev.

## Key files

- Pipeline: `src/lib/gamegen.ts`, `src/app/api/create/route.ts`,
  `src/lib/buildAgent.ts`, `src/engine/loader.ts`, `src/engine/sandbox.worker.ts`,
  `src/lib/gameStore.ts`.
- Engine: `src/engine/runtime.ts`, `src/engine/types.ts`; games in `src/games/`.
- Backend module: `spacetimedb/src/index.ts` (tables + reducers).
- Create UI: `src/components/CreateFlow.tsx`; live edit: `EngineEditChat.tsx`,
  `EditChat.tsx`.

## What's next (see PROJECT.md for the full roadmap)

1. Turn live generation on by default with a key; widen the SDK + genres.
2. Promote `sandbox.worker.ts` from scaffold to the default execution path.
3. Add the `game_code` SpacetimeDB table so published games load cross-device.

## Gotchas

- **Demo vs live:** if "the AI feels canned," there's no key set — that's demo
  mode by design. Add a key for live.
- **Testing multiplayer by hand:** two browser tabs share one identity. Use a
  normal **+ incognito** window (or two browsers / a phone) to be two players.
- **Module changes:** editing `spacetimedb/src/index.ts` (tables/reducers)
  requires `npm run stdb:publish` + `npm run stdb:generate`, or a new client hits
  an old server. Client-only changes don't.
- **Production:** see [DEPLOY.md](DEPLOY.md). Republish the module to Maincloud and
  point Vercel env at Maincloud, or engine features break on the live site.
