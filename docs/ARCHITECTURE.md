# Architecture — the AI game pipeline

How a sentence becomes a running, multiplayer game, and how to extend it. This is
the real machine; demo mode just replays its captured outputs.

## The pipeline, end to end

```
 user prompt
     │
     ▼
 /api/create ───────────────► generated game module (plain-JS factory string)
 (src/app/api/create)            with a key: Claude generates against the SDK
     │                           no key:    a captured output (source:"cached")
     ▼
 buildAgent ─────────────────► compile-check (engine/loader.canCompile);
 (src/lib/buildAgent.ts)         on failure, re-prompt the model to fix → retry
     │
     ▼
 gameStore.saveGameSource ───► persist the module for this game (publish)
 (src/lib/gameStore.ts)
     │
     ▼
 EngineCanvas.resolveGame ───► load stored source via the loader; reference
 (src/components/EngineCanvas)   games use their precompiled module (fast path)
     │
     ▼
 engine/loader.compileGameModule ─► compile + shape-validate → GameModule
 (src/engine/loader.ts)              (untrusted code: runInSandbox → Worker)
     │
     ▼
 engine/runtime.mountEngine ──► host runs tick() 30Hz, commits entities;
 (src/engine/runtime.ts)         every client renders from SpacetimeDB
```

## The SDK contract (`src/lib/gamegen.ts`)

A generated game is **plain JS** (no build step) — a factory returning
`{ id, init?(api), tick(api), render(api) }`. The model is given `SDK_CONTRACT`,
which documents the entire surface a game may use: `api.draw` (immediate-mode 2D),
`api.input()`, `api.players()`, `api.entities()/local()/setLocal()`, `api.config()`,
`api.dt`. Nothing else is in scope — that's both the safety boundary and the spec.
The two reference games (`src/games/flappy.ts`, `tank.ts`) are the worked examples.

To widen what can be generated, grow the SDK (`engine/types.ts` + the `DrawApi`)
and update `SDK_CONTRACT` + the exemplars together.

## The loader + sandbox (`src/engine/`)

- `compileGameModule(source)` — evaluates the factory string and shape-validates
  it into a `GameModule`. Used for **trusted** source (the reference games, dev).
- `runInSandbox(source)` — runs **untrusted** model-generated code in
  `sandbox.worker.ts`: a Web Worker with no DOM, window, or network. The host's
  `tick()` runs in the worker and posts the committed entities back; the host
  writes them to SpacetimeDB exactly as the trusted path does. `render()` stays on
  the main thread but may only call the curated `DrawApi`. Neither half gets
  ambient authority.

The live demo runs the trusted reference modules directly (reliability); the
sandbox is the isolation boundary generated games adopt. **Hardening note:**
promoting `runInSandbox` to the default execution path for engine games is Phase B
of the roadmap.

## Demo mode vs. live mode

`/api/create` and `/api/edit` both branch on `ANTHROPIC_API_KEY`:

- **No key (or `AI_CANNED=1`)** → return a captured output (`cannedCreate` /
  `cannedPatch`), tagged `source: "cached"`. Deterministic, offline, stage-safe.
- **Key set** → call Claude (`generateObject`/`generateText`), validate, and (for
  create) hand the result to the compile-check + fix loop.

The cached payloads are real, representative outputs of the same pipeline — the
seed reference games and pre-validated edits — so demo mode shows true machine
output, not a fake.

## Persistence — current + the upgrade

`src/lib/gameStore.ts` persists each game's module (localStorage today — single
device, enough to prove publish→load). The cross-device production version is a
SpacetimeDB **`game_code` table** (`game_id` pk, `source`, `game_type`, `owner`),
written on publish and read on join — the same pattern as the existing
`engine_config` table. That one addition makes published AI games load on any
device. See PROJECT.md → Phase C.

## How to extend

- **A new genre / primitive:** add to the SDK + `SDK_CONTRACT` + an exemplar game.
- **Turn live generation on:** set `ANTHROPIC_API_KEY` in `.env.local`.
- **Harden execution:** route engine games through `runInSandbox` in
  `EngineCanvas`/`runtime` instead of the main-thread `compileGameModule`.
- **Cross-device publish:** add the `game_code` table to `spacetimedb/src/index.ts`
  + reducers, regenerate bindings, and point `gameStore` at it.
