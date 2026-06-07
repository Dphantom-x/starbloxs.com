# Starblox — the project

## The idea

Making a multiplayer game is hard in two specific places, and Starblox removes
both:

- **Starting.** No code, no engine to learn, no blank page. You describe the game
  in plain words and it exists.
- **Multiplayer.** Real-time sync, servers, netcode — the brutal part — is just
  there, free and instant, for every game, via SpacetimeDB.

The long-term thesis: a **"pseudo-engine"** where an AI writes a real game against
a generic SDK and our runtime plays it live with friends. Get this right and the
pseudo-engine grows into a genuine, AI-native game engine — the way you'd make a
game on Roblox, except you describe it instead of building it by hand.

## Where it is now — an honest MVP

This repo is a **proof of concept**, and we're deliberate about what that means:

- ✅ The **multiplayer engine** is real and tested (host-authoritative tick →
  SpacetimeDB → all clients). This is the hard part and it works.
- ✅ Two **reference games** (Flappy, Tank) are real modules on that engine — proof
  the SDK can express real games, and the worked examples the generator learns from.
- ✅ The **generation pipeline** (`/api/create` → loader → run) is real and
  **key-ready**: with an API key it generates a runnable game module from a
  sentence and the engine runs it. Without a key it serves **captured outputs** of
  that same pipeline so the demo is offline-reliable.
- ✅ **Live editing** of a running game works for everyone, mid-match.
- 🚧 The pseudo-engine is intentionally **simple and frail** today: a small SDK,
  two genres, a single-host model, a sandbox we scaffold rather than harden. That's
  the MVP boundary, not the ceiling.

We're proving the concept end-to-end, not shipping a finished engine — and we say
so plainly. The cached demo assets are snapshots of the real pipeline, documented
as such in the code and the [README](README.md).

## Roadmap — MVP → real engine

**Phase A — Generation depth (now → next).**
Wire `/api/create` to live generation by default (with a key), widen the SDK
(more draw + input + physics primitives), and grow the genre space beyond
flappy/tank so "any simple game" is literally true. Strengthen the
generate → run → fix loop (`buildAgent`) so the agent reliably repairs its own
output.

**Phase B — Safe execution at scale.**
Promote the sandbox (`src/engine/sandbox.worker.ts`) from scaffold to the default
execution path: untrusted generated code runs in a Web Worker with no page, DOM,
or network access — only the engine's message API. This is what makes running
arbitrary AI-written games safe.

**Phase C — Real persistence + publishing.**
Move game source from the local game store to a SpacetimeDB `game_code` table so a
published AI game loads and plays on any device, for anyone with the link.

**Phase D — Toward a real engine.**
Assets/sprites (an image primitive + uploads), richer entities and physics, an
authoring loop where the AI and the user co-edit a game over many turns, and
eventually creator tooling. This is the multi-quarter R&D arc that turns the
pseudo-engine into something that competes with hand-building on Roblox.

## Why SpacetimeDB

The multiplayer is the moat. Real-time state sync, identity, and persistence come
from one place, so every generated game is multiplayer by default with zero netcode
written by the creator (or the AI). That's the unlock that makes "describe it and
play it with friends" possible at all.
