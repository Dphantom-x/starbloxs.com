# Project direction — context, options, and the decision

This folder is a **handoff** for any future agent (or teammate) working on Starblox.
It captures a pivotal moment: a misunderstanding about what the codebase actually was,
the options that surfaced once it was clarified, and the **decision to pursue Option B**
— turning Starblox into a platform where the AI genuinely **writes games from scratch**,
not just configures pre-built ones.

## Read in order
1. [`01-the-misunderstanding.md`](01-the-misunderstanding.md) — what the owner thought we had vs. what the code actually is.
2. [`02-options-a-and-b.md`](02-options-a-and-b.md) — the two paths and the decision (**Option B**).
3. [`03-option-b-plan.md`](03-option-b-plan.md) — Option B architecture, the **reference-driven rebuild strategy**, the milestone order, effort/risk.
4. [`04-current-state.md`](04-current-state.md) — what exists today (the starting point you build Option B on).
5. [`05-golden-path-demo.md`](05-golden-path-demo.md) — exactly how the demo plays out on the pseudo-engine.

## TL;DR for a new agent
- **What the code is TODAY:** a *data-driven config app*. Two hand-built game templates
  (Tank Trouble, Flappy). The AI emits *validated rule patches* (a Zod schema) into
  SpacetimeDB — it does **not** generate code. That's why "it can't break the game," and
  why every flappy looks identical (the polish is the **template**, not AI output).
- **What the owner wants (the vision):** a Roblox-like platform where you **talk to an AI,
  it writes a real game from scratch, the game actually runs (multiplayer), you iterate
  over a few rounds to improve it, then save/publish** it so others join/play/edit. Plus
  import/export of game files.
- **THE DECISION: build Option B** — a thin "pseudo-engine" the AI writes games against
  (generic multiplayer backend + small client SDK + a loader/sandbox + an agentic
  write→run→fix loop). **Frail + golden-path is fine** — this is a hackathon. The current
  config app (Option A) stays as the reliable backbone/fallback.
- **The strategy = reference-driven rebuild.** We use our two existing games (Flappy + Tank)
  as the **acceptance tests**: the four pieces are "done" when **Flappy and Tank both run on
  them.** We **rebuild Flappy as a real game file on the pseudo-engine** — porting the actual
  art + mechanics so it's **just as polished** (pixel-identical bird/pipes/game-over), then
  owner + agent **iterate it even better** (extending the SDK as needed). The terminal flashes
  that **real rebuilt code**, and that same code is what runs — no smoke-and-mirrors. The
  "it tested itself" clip is our **real e2e test, recorded as video.**
- **Honest framing:** Option B is the **biggest, riskiest build** in the project, but the
  reference-driven approach drains most of the risk (known targets). It's feasible *because*
  the constraints are relaxed: multi-turn iteration is OK, golden-path only, frail is fine,
  and the demo is **cached** (it only has to work **once**, captured).
