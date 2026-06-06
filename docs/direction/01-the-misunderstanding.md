# 01 — The misunderstanding

## What the owner assumed
The owner believed Starblox already worked like this: you describe *any* game to an AI,
and the **AI writes/builds the entire game from scratch** (code, mechanics, visuals),
publishes it, and others join — essentially a Roblox-like "AI makes any game" platform.

## What the code actually is
It's a **data-driven configuration app**, *not* a codegen platform:
- There are **two hand-built game engines/templates**: Tank Trouble and Flappy. Their
  visuals, animations, collision, scoring, and multiplayer are all **pre-written by hand**
  (in the SpacetimeDB module + the Phaser scenes + the React UI).
- The AI's *entire* job is to (1) pick which template (`game_type: "tanks" | "flappy"`)
  and (2) fill in **validated rule knobs** (gravity, gaps, speed, bounces, …) defined by a
  Zod schema (`RulesPatchSchema`).
- The AI **never generates code.** It emits a small validated JSON "rules patch" that gets
  written into SpacetimeDB **as data**.

## Why it's built that way (and why it's actually a strength)
- **The live-remix superpower:** because rules are *data*, the AI can change a *running*
  game and every player feels it the same instant — no recompile, no redeploy. That's the
  SpacetimeDB magic and the core demo moment.
- **"It can't break the game":** the AI can only write validated, in-range data, so it
  physically cannot produce a broken or unsafe game.
- The owner's own demo script already states this correctly: *"the point isn't that the AI
  invents engines from nothing… every edit you saw is the AI writing validated rules into
  SpacetimeDB — which is also why it can't break the game."*

## The consequence the owner cared about
Because the polish lives in the **template**, every "make a flappy" produces the *same*
polished flappy automatically — great for reliability, but it means the AI **cannot make a
genuinely new/different game** (new genre, new mechanics, custom look) on its own. The
"3 rounds of iteration" that produced the polished flappy was **us building the template
once** — not the AI building a game each time.

That gap — *"configure a pre-built game"* vs. *"the AI writes a new game from scratch"* —
is exactly what the Option B pivot addresses.
