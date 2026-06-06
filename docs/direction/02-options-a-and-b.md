# 02 — The options, and the decision

Once the misunderstanding was clear, two paths emerged. **We are going with Option B.**

## Option A — Tune pre-built games (what exists today)
- The AI configures one of two pre-built templates via validated rule patches. **No codegen.**
- **Status:** done, deployed, reliable. **Effort to finish the create-flow UX:** ~2–4 days. **Risk:** low.
- **Limitation:** only the two genres; the AI can't write a genuinely new game. *Not* the owner's vision.

## Option B — Thin pseudo-engine; the AI writes the game from scratch  ← CHOSEN
- You talk to the agent, it **writes real game code**, the code **actually runs** in the
  browser as a live multiplayer game, you **iterate over a few rounds** to improve it, then
  **save/publish** it so others join/play/edit. Import/export of game files too.
- Feasible because of the relaxed constraints below. **Effort:** ~2–3 focused weeks for a
  golden-path version. **Complexity:** high. **Risk:** medium–high.

## The constraints that make Option B feasible (important — the owner set these)
- **Multi-turn iteration is fine** — the agent need not one-shot a game; a back-and-forth
  (like the original 3 rounds) is expected and acceptable.
- **It just has to RUN** — the game can be bare-bones, but it must genuinely execute; then
  you iterate to improve it.
- **Golden-path only** — no edge cases. It only needs to work for simple games (flappy,
  tank). A **frail "pseudo-engine"** is acceptable; a real dedicated SpacetimeDB game engine
  is the *eventual* end goal, not now.
- **Slow builds are OK** — a publish/build can take minutes; the only hard requirement is
  that *after* a game is live, its rules stay editable without a redeploy.
- **The demo is cached** — responses/runs are pre-captured and replayed on stage, so it does
  **not** need to work live first-try. It only has to succeed **once**, captured.

## The decision
**Build Option B.** Keep Option A (the config app) as the reliable backbone / fallback.
For a near-term demo, a **hybrid** is acceptable: A drives the bulletproof live-remix
climax, plus a **cached slice of B** (one game truly built from scratch by the agent) as
the "watch it build a game live" showpiece. But the project's *direction* is the full
Option B platform.

## Why not just keep Option A?
Option A can never satisfy the core vision ("anyone makes *any* game by talking"). It's
genre-locked and the AI doesn't actually build anything — it tunes. Option B is the real
product. The trade is reliability/effort (A is safe and done; B is a big, risky build), and
the owner has chosen to take that on, with the demo de-risked via caching.
