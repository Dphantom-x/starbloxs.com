# 03 — Option B: architecture & build plan

Goal: a **tiny game platform** ("pseudo-engine") that the AI writes *games* on top of.
Frail + golden-path is fine. The Roblox parallel: Roblox = rich engine/framework + user
scripting + publish. We build the *minimal* version of that.

## The four pieces
1. **One generic multiplayer backend (SpacetimeDB), published ONCE.**
   A generic shared-state / entity store + sync that *every* AI-made game reuses — so there
   is **no per-game server republish**. Likely reuses the existing `entity` table + sync.
   For the minimal version, the game's authoritative logic can run **client/host-
   authoritative** (one client runs the AI's tick and writes entity state; others read it),
   which avoids per-game reducers/compiles entirely.
2. **A thin client SDK = the "pseudo-engine."**
   A small set of helpers the AI's game code calls: draw shapes/sprites, read input, an
   update/tick loop, read/write shared multiplayer state, track players/spawns. Deliberately
   minimal — just enough for flappy + tank. (Trade-off to remember: a *richer* SDK means the
   AI writes *less* code and codegen is *more reliable*, but it drifts back toward Option A.
   Keep it thin enough that the AI genuinely writes the game, rich enough that it can.)
3. **A loader / sandbox.**
   The app takes the AI-written game file and **runs it live** in every player's browser
   (dynamic import or sandboxed iframe). This is where the (deferred) **safety** concern
   lives — fine to relax for the golden-path demo / trusted context.
4. **The build-agent loop.**
   Describe a game → AI writes a game file against the SDK → the app runs it → **if it
   errors, the error is fed back to the AI → it fixes → repeat** until it runs. Then keep
   iterating to improve. "Save/publish" = persist the game file so others can load it. This
   loop *is* the owner's "talk to it until it's right."

## Real AI vs. canned (same dual-path as today's `/api/edit`)
- **With an Anthropic key:** the agent genuinely writes/iterates the game code (an autonomous
  write→run→fix coding loop).
- **Without a key (demo):** responses are pre-scripted/cached. The **infrastructure is real**;
  only the AI's *cognition* is stood in for.
- **Caveat:** the real-AI codegen loop can be built to spec but **cannot be end-to-end
  verified without a key** — it's a one-switch flip once a key exists.

## What Option B reuses (it is NOT from zero)
SpacetimeDB connection, the generic `entity` table + sync, the Phaser setup, the room UI,
the chat/terminal, the deploy pipeline, and the real+canned AI pattern. **New** pieces: the
generic backend shape, the thin SDK, the loader/sandbox, the agentic loop, and save/publish
+ import/export of game files.

## Import / export (a platform feature the owner wants)
Define a game **package format** (the game file + a small manifest). Users can build in-app
and **export** to keep working in their own IDE, or build **externally** and **import** to
publish on the platform. Straightforward once the SDK/format exists.

## Effort, complexity, risk (golden-path, frail)
- generic backend ~2–4 days · thin SDK ~3–5 days · loader/sandbox ~2–4 days · agent loop +
  error feedback ~3–5 days · then several days getting flappy + tank to generate-and-run.
- **~2–3 focused weeks** for a working golden-path version (raw coding is fast; the
  *unknowns* — does generated code reliably run, does generic sync hold for arbitrary games
  — are where the time really goes).
- **Complexity: high. Risk: medium–high** (dynamic code-loading + codegen reliability +
  generic multiplayer sync).

## Suggested first milestone (prove the loop)
Get the agent to produce **one** running game (flappy) as real client code against the SDK,
synced via the generic backend, loaded by the sandbox — **even ugly.** That single result
proves the entire pipeline. Then tank. Then iteration/polish. Then save/publish +
import/export.

## What about the existing two games?
Tank Trouble and Flappy stay as-is (Option A) for the reliable demo backbone, and become
**reference examples** the agent can study / seed from when it writes new games — rather than
the only games that can exist.
