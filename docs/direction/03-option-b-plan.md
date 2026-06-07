# 03 — Option B: architecture & build plan

Goal: a **tiny game platform** ("pseudo-engine") that the AI writes *games* on top of.
Frail + golden-path is fine. Roblox parallel: rich engine/framework + scripting + publish —
we build the *minimal* version of that.

## Core strategy: reference-driven — rebuild OUR TWO GAMES on the pseudo-engine
We do **not** design an abstract engine and hope the AI can target it. We use the two games
we already have (**Flappy + Tank**) as the **acceptance tests**: the four pieces are "done"
when **Flappy and Tank both run on them.** They're ideal targets because they're different
genres (Flappy = gravity/scrolling/vertical survival; Tank = top-down movement/projectiles/
maze), so together they validate the stack across two very different mechanics.

This turns "build a platform for any game" into a concrete, testable task: *"make these two
known games run on the new stack."* Huge de-risk. It does **not** make it trivial — porting
two games + building the four pieces is still the biggest build in the project (~2–3 focused
weeks) — but the scary uncertainty is gone because the target is known.

## The four pieces
1. **One generic multiplayer backend (SpacetimeDB), published ONCE.** A generic shared-state /
   entity store + sync that *every* AI-made game reuses — **no per-game server republish.**
   Largely **reuses the existing `entity` table** (`kind, owner, x, y, vx, vy, angle, data`),
   which is already generic enough to hold both games' state.
   - **Authority model: host-authoritative.** One client runs the game's tick (the AI-written
     logic) and writes the authoritative state into the generic store, which SpacetimeDB syncs
     live to everyone. This avoids per-game server code AND **keeps the live-edit superpower**
     (it's still one live shared state; rules/config remain editable live for all players).
     Porting our current *server*-side ticks to run *client*-side is the main bounded chunk.
2. **A thin client SDK = the "pseudo-engine."** General primitives the AI's game code calls:
   draw shapes/sprites/graphics, read input, an update/tick loop, read/write shared state,
   track players/spawns. **General, not game-specific** (no `makeFlappyPipe()` cheats) — that
   discipline is what makes it a real engine and leaves a path to a 3rd game.
   - **The SDK co-evolves with Flappy:** if a polish need isn't expressible, we *extend the
     SDK* until it is. Flappy (then Tank) drives the SDK toward "rich enough."
3. **A loader / sandbox.** Takes the AI-written game file and **runs it live** in every
   player's browser (dynamic import / sandboxed iframe). Where the (deferred) safety concern
   lives — fine to relax for the golden-path demo / trusted context.
4. **The build-agent loop.** Describe a game → AI writes a game file against the SDK → the app
   runs it → **if it errors, the error feeds back → it fixes → repeat** until it runs → keep
   iterating to improve. "Save/publish" = persist the game file so others load it. This loop
   *is* the owner's "talk to it until it's right."

## Rebuilding Flappy/Tank: polish is PRESERVED (we port, not re-derive)
The rebuilt games must be **just as polished as today's** — same bird sprite + flap/tilt, same
capped pipes, sky/ground, same forgiving collision, same game-over card. That's guaranteed
because the polish is concrete code we **carry over**:
- **Visuals:** the drawing routines from `FlappyScene.ts` / `TankScene.ts` move into the game
  file (calling the SDK's draw primitives — Phaser under the hood). Same routines → **pixel-
  identical**. (Reference-driven: if the SDK can't draw it, extend the SDK.)
- **Mechanics:** gravity/flap/multi-gap/scoring/forgiving-collision move into the game file's
  (host-side) tick. Same logic → same feel.
- **UI:** the React **game-over card** carries over — the game file signals "dead" via shared
  state and the same card renders.
- **No smoke-and-mirrors:** the terminal flashes the **real rebuilt game-file code**, and that
  *same* code is what loads and runs. We never load the old hardcoded template.
- Nice side effect: the game file is **substantial, real code** (drawing + collision + tick),
  so the terminal shows meaningful code — better demo *and* more honest.

## Iterate together (the workflow)
1. Build the engine (4 pieces). 2. Port Flappy onto it — even a rough v1. 3. **Owner + agent
iterate the rebuilt Flappy game file** to full polish (extending the SDK as needed), exactly
like we polished the original. The game and the engine co-evolve. Starting from our perfected
Flappy as the target means quality is the **floor**, not the risk. Then repeat for Tank.

## Real AI vs. canned (same dual-path as today's `/api/edit`)
- **With an Anthropic key:** the agent genuinely writes/iterates the game code (autonomous
  write→run→fix loop).
- **Without a key (demo):** responses are pre-scripted/cached. The **infrastructure is real**;
  only the AI's *cognition* is stood in for.
- **Caveat:** the real-AI codegen loop can be built to spec but **can't be end-to-end verified
  without a key** — one-switch flip once a key exists.

## Verification = the real e2e test, captured as a video
The "AI is testing it" step uses our **actual Playwright e2e test** of the game (Playwright
records video natively; we already have a Flappy e2e). We point it at the **rebuilt** Flappy,
capture the run, and render that video in the create UI for the user to review. Genuinely
real, reuses what we have.

## What Option B reuses (not from zero)
SpacetimeDB connection + the generic `entity` table + sync, Phaser setup, room UI, chat/
terminal, deploy pipeline, the real+canned AI pattern. **New:** the generic backend shape, the
thin SDK, the loader/sandbox, the agent loop, save/publish + import/export.

## Import / export
Define a game **package format** (game file + manifest). Build in-app and **export** to keep
working in your own IDE, or build **externally** and **import** to publish. Straightforward
once the SDK/format exists.

## Honest boundaries (for the pitch + Q&A)
- "**Any game from scratch**" is the true *capability/pitch* — the agent writes real runnable
  code — **demonstrated on Flappy (cached)**. Reliable coverage is bounded by the SDK's
  primitives (validated by Flappy + Tank); a wildly novel genre may need the SDK widened. The
  existing Q&A honesty line covers "now make a racing game."
- **Manhunt visuals still don't render** (blackout/line-of-sight/sparks) — separate deferred
  build if DEMO 2's climax uses manhunt.

## Effort, complexity, risk (golden-path, frail)
- generic backend ~2–4 days · thin SDK ~3–5 days · loader/sandbox ~2–4 days · agent loop +
  error feedback ~3–5 days · then several days porting Flappy + Tank.
- **~2–3 focused weeks** for a working golden-path version. **Complexity: high. Risk: med–high**
  (dynamic code-loading + codegen reliability + generic sync) — *reduced* by the reference-
  driven approach.

## Milestone order (what we execute)
1. **Generic backend** (mostly the existing `entity` table + a generic state-sync + players).
2. **Thin SDK** (draw / input / tick / sync primitives — general).
3. **Loader/sandbox** (run a game file in the browser).
4. **Port Flappy → v1 on the pseudo-engine** (first real proof + the demo asset). Even rough.
5. **Owner + agent iterate Flappy to full polish** (extend the SDK as needed) — pixel-match today.
6. **Capture the e2e run as the verification video.**
7. **Port Tank** (second proof).
8. **Agent loop + clarify/confirm + terminal(real code) + publish/iterate** — wire the full
   create flow; cache the golden-path run for the demo.

See [`05-golden-path-demo.md`](05-golden-path-demo.md) for how the demo plays out on this stack.
