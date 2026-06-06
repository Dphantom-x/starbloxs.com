# Demo Ideas & Plan

Living doc for the demo. Holds: (1) the spoken **demo script**, (2) the **confirmed
architecture** for the new AI "Build & Verify" create flow, and (3) **what's still
to do** after it. `[NAME]` in the script = the product (Starblox).

---

## 1. Demo script (~3 min spoken)

> *Every AI edit is pre-run and cached before going on stage; "demo mode" fallback ready if Wi-Fi/API lags.*

### THE HOOK
*[Confident, conversational. You're talking to the people who built the thing.]*

"As sponsors, you obviously know SpacetimeDB better than anyone in this room. But doing our research, one thing stuck with us — you didn't build this to sell a database. You built it because BitCraft needed something that didn't exist: a single living world that thousands of people could share in real time, all at once.

You built a power plant just to light one house.

And we looked at that and thought — why does only one house get the power? Not everyone can code. Not everyone *wants* to learn. But everybody likes games.

So we built **[NAME]** — where the real-time muscle of SpacetimeDB is in everyone's hands, coder or not. You describe a game by talking to an AI, it comes to life in your browser, and your friends jump straight in. No downloads. No accounts. No setup. The person building the game and everyone playing it never leave the page."

### DEMO 1 — MAKE A GAME BY TALKING
*[Type the prompt where the audience can read it. Two browser windows already side by side.]*

"Let me just ask for a game.

> *'Make a multiplayer Flappy Bird — make it tall, give each pipe a few different gaps to aim for, and let the birds knock into each other.'*

*[Run. Game appears, second player joins.]*

And there it is — multiple players, multiple safe passages per pipe, birds bumping each other mid-air. We made that by talking to it."

### THE PIVOT
*[Slow down here — this is the SpacetimeDB moment.]*

"But say you *don't* want to start from scratch. Here's where SpacetimeDB does something nothing else can.

In [NAME], a game's rules don't sit in some file you have to recompile and redeploy. They live as **data — right inside SpacetimeDB.** Which means the AI can change the rules of a game that's *already running*, and every single player feels it the same instant.

Take this tank game. Somebody else on the platform built it — we're just playing it. Watch what happens when we, mid-match, ask for a completely different game."

### DEMO 2 — REMIX, LIVE *(the climax)*
*[Press the demo button / type the prompt. Both windows visible.]*

> *'Make one tank the hunter — black out the map for everyone except a short line of sight in front of them — and make every other tank throw sparks whenever they scrape a wall. Turn it into a manhunt.'*

*[Short beat. Game reloads, transformed, in both windows at once.]*

"No redeploy. No loading screen for anyone. The rules just — changed. Live. For every player at the same moment.

A top-down driving game became a horror manhunt, in one sentence."

### CLOSE
"Clockwork built the power plant. [NAME] is the part that puts it in everyone's hands.

Real-time multiplayer games — made, and remade, by anyone. Just by talking.

That's [NAME]."

### BACKUP PROMPT *(if the room's loving it / for Q&A)*
> *'Spawn speed-boost strips that fling tanks one direction, make one tank slower than everyone but give it a laser that bounces four times, and make everyone else a little faster.'*

### Q&A HONESTY LINE *(if a judge asks for an unbuilt genre, e.g. "now make it a racing game")*
"Racing's on the roadmap — today we're showing the two genres we've templated, because the point isn't that the AI invents engines from nothing. It's that anyone can shape a real, running multiplayer game by talking to it. Every edit you saw is the AI writing validated rules into SpacetimeDB — which is also why it can't break the game."

---

## 2. Confirmed architecture — the AI "Build & Verify" create flow

**The product vision for DEMO 1:** instead of today's one-shot "describe → preview →
create," the create experience becomes a real agent loop that **clarifies, confirms,
builds, and proves** the game with a captured test run.

### Guiding principle: real pipeline, canned fallback
Build the **real** pipeline; swap **only the AI's cognition** for a deterministic
stand-in when there's no API key. The same UI, flow, terminal, and test-capture work
**with or without a key** — adding a key is a one-line switch. This mirrors how
`/api/edit` already works (real AI SDK `generateObject` path **+** a `cannedPatch`
fallback). The canned path is **not** a hardcoded movie — it's a deterministic
implementation of the *same contract* the live AI fulfills.

### The agent contract (both the real AI and the canned responder fulfill this)
1. **Clarify & confirm (multi-turn).** The agent's *first* goal is to understand the
   essence of the game and **confirm it with ONE concise question**, then accept a
   "yes" or a correction, looping until confirmed.
   - Input: the user's prompt + the conversation history so far.
   - Output per turn: either a **question** (awaits the user's reply) OR a **confirmed**
     signal + the **final validated config** (`RulesPatchSchema`).
   - Example: prompt *"make a multiplayer flappy bird"* → agent asks *"Tap to keep your
     bird at a height, survive, and die when you hit a pipe — right?"* → user says *"no,
     only die if it hits the* side*, not the top/bottom"* → agent: *"Confirmed."*
     - **This correction maps to a REAL config** — it's our existing *forgiving
       collision* model (glide on the lip, die on a head-on wall). So even the branch is
       genuine, not invented.
2. **Build.** On confirm → create the game from the config (`create_game` →
   `apply_rules_patch`). A **terminal** opens and streams the build — the lines
   **reflect the real config being written**, not invented text. (With a key, the agent
   can narrate; canned mode flashes the same real lines.)
3. **Test & capture.** Run a short **scripted bot match on the real SpacetimeDB tick**
   with the new config, and **capture** it (record the entity-state stream → replay it
   pixel-identically, or encode a clip). This step is **engine-driven, so it's real
   whether or not there's a key.** Produces the "here's it working" video.
4. **Choose.** Show the video + two actions: **"Keep editing with AI"** or **"Play now."**

### Real vs canned (what's genuine in the demo)
- **Genuinely the app (real, key or not):** the game, the build from the confirmed
  config, the **bot test run**, and the **captured video**.
- **Scripted stand-in (only when no key):** the AI's *conversational replies* — the
  clarifying question, "Confirmed," the terminal "coding…" lines. Pre-written to mirror
  exactly what a live Claude integration would say.
- **Honest stage line:** *"This is the real pipeline. With a live key the AI does the
  thinking; for the demo we pre-scripted its replies and pre-captured the run — but the
  engine, the build, and the test video are all really the app. We just sped it up."*

### UI state machine
`idle → clarifying (chat Q&A) → confirmed → building (terminal) → testing → preview
(video + choose) → room`

### Pieces to build
- A **multi-turn create agent** (extend `/api/edit` or a new `/api/create`) with the
  dual path: real `generateObject`/multi-turn behind a key + a canned conversational
  responder.
- The **canned responder** per game type: clarifying question(s) + correction branches
  → final validated config.
- The **create-flow state machine** in the UI (replaces the current one-shot
  `CreateFlow.tsx`).
- The **"coding" terminal** (extend the existing change-terminal in `EditChat`).
- The **bot test-run + capture/replay** (reuse the engine + a replay-mode renderer; a
  scripted bot per game type — e.g. a flappy bird that flaps through pipes, scores, and
  takes one death to show the game-over).
- The **"Keep editing / Play now"** branch.

### Pre-baked vs fully-live (a choice, build to support both)
- **Pre-captured (stage default):** run the golden path once for real, save the
  video/replay artifact, replay it instantly on stage. Reliable, fast, still real-origin.
- **Fully live:** run the ~3–5s bot test during the "testing" state each time and replay
  immediately — nothing pre-baked. Slightly slower; maximum honesty.

### Confidence + the one caveat
- **Confidence to build: high.** It's an extension of a pattern already in the app, with
  no hard unknowns.
- **Caveat:** the **canned path** can be built *and fully tested*. The **real-AI path**
  can be built precisely to the AI SDK spec but **can't be end-to-end verified without a
  key** — it'll be "implemented and ready," activated by one switch when a key is added.

---

## 3. Still to do (AFTER this create-flow architecture is working)

> Parked deliberately — we finish and ship the Build & Verify create flow first.

- [ ] **DEMO 2 climax — manhunt visuals (NOT rendered yet).** The manhunt *rules* apply
      correctly server-side (hunter `role`, `vision_radius`, `wall_graze_sparks`), but the
      client currently draws **none** of it. To make the climax land, build:
      **blackout / fog-of-war**, a **line-of-sight reveal cone** in front of each tank,
      **wall-scrape spark particles**, and a **hunter highlight**. Until then the manhunt
      prompt looks like *nothing changed*. This is the single biggest risk to the script
      as written — do it right after the create flow.
- [ ] **Backup-prompt reconciliation.** The backup prompt says speed strips that *"fling
      tanks one direction"* and a *"laser that bounces four times."* Today the speed pads
      give a **5-second speed buff** (not a directional fling), and the **laser weapon
      doesn't render**. Reconcile the wording or build the visuals/mechanic.
- [ ] **(Optional) Phase 3 of Build & Verify:** real invariant checks per game type
      (e.g. "is the gap passable?") that can flag/auto-adjust degenerate configs — turns
      the "testing" step into a genuine guardrail, not just a showcase.
