# 05 — The golden-path demo (on the Option B pseudo-engine)

How the demo plays out **once Flappy (and Tank) are rebuilt on the pseudo-engine.** Cached
for the stage (must work once, not live), but the pipeline + games are genuinely the app —
not smoke-and-mirrors.

## DEMO 1 — "make a game from scratch by talking" (the create flow)
1. **Pitch:** *any user can create a game from scratch by talking to a code-generation AI that
   helps you design, brainstorm, and polish.*
2. **Prompt:** *"Make a multiplayer Flappy-Bird-like game with collision."*
3. **AI clarifies & confirms (multi-turn).** It asks ONE concise question about the essence,
   e.g. *"Should the pipes kill you on any contact?"*
4. **User corrects:** *"No — only kill me if I hit the* side *of a pipe, not the top or bottom."*
   - This correction maps to a **real config** we already built: the **forgiving collision**
     model (glide along the lip, die on a head-on wall). So even the branch is genuine.
5. **AI: "Confirmed."** A **terminal opens and flashes the real code being written** — the
   actual rebuilt Flappy **game-file source** (the bird drawing, the pipe/gap logic, the
   collision, the tick), not filler.
6. **It loads and runs the rebuilt Flappy** — running on the pseudo-engine (the generic
   backend + SDK + loader), **just as polished as today's** (same bird/pipes/ground/game-over),
   multiplayer, a second player joins.
7. **Verification video:** the app shows a short clip of the game **passing its real e2e test**
   (Playwright-recorded run of the rebuilt Flappy) for the user to review — the "it tested
   itself and it works" beat.
8. **Choose:** **keep editing with the AI** to improve it, or **publish / play now.**

> Honesty line for stage: *"This is the real pipeline — the AI writes real game code, it runs,
> it's multiplayer, and it verified itself with a real test. For the demo we pre-scripted the
> AI's replies and pre-captured the run, but the engine, the code, the game, and the test are
> all really the app. We just sped it up."*

## DEMO 2 — remix a published game, live (the SpacetimeDB climax)
- Pick an **already-published** game (built by someone else) and **edit part of its rules** by
  talking — the change is live for every player the same instant, no redeploy.
- **Still works on Path-B games:** the game file reads its config as **live shared state** from
  SpacetimeDB, and the host re-applies changes — so the live-edit superpower carries over.
- ⚠️ **If the climax is the manhunt transform, the manhunt visuals (blackout / line-of-sight /
  sparks) still don't render** — that's a separate deferred build. Either build those visuals
  first, or use a transform that already lands (speed pads + bouncy + rapid-fire chaos).

## What makes this honest (not faked)
- The Flappy that loads is the **rebuilt game file running on the new stack**, not the old
  hardcoded template.
- The terminal shows that game file's **real code**.
- The verification clip is the **real e2e test** of that rebuilt game.
- Only two things are stood in for: the AI's **conversational replies** (pre-scripted, since
  there's no live key) and the **timing** (pre-captured so it's instant on stage). Both are
  legitimate, disclosable demo conveniences.

## Boundaries to keep in the pitch
- "**Any game**" = the real *capability* the infra enables (genuine codegen), **demonstrated on
  Flappy**. Reliable coverage is bounded by the SDK's primitives (validated by Flappy + Tank).
  Use the existing Q&A honesty line if asked for an un-built genre.
- The real-AI codegen path is built-to-spec but unverifiable until a key is added.
