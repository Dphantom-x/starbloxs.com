# Starblox — Demo runbook (click-by-click)

What to **click**, what to **say**, and what to **expect** — for the live demo /
recording. This is the **pseudo-engine** demo: the AI writes a real game *file*
that runs on our engine, and edits are **live config the host reads each tick**,
so changes land mid-match for everyone with no reconnect.

The two beats:
- **DEMO 1 — make a game by talking** (`/create`): describe → one clarifying
  question → it "writes the file" (the terminal flashes the *real* game code) →
  it "tests" it (plays the verification video) → **Publish & Play** → you're in a
  live multiplayer room.
- **DEMO 2 — change it live by talking** (room → *Edit with AI*): speak
  **"manhunt"** and the running Tank flips for *everyone* — one hunter on a
  blacked-out map with a flashlight cone, the rest are runners who can't shoot.

> Verified by `e2e/engine8_demo.spec.ts` (the full DEMO 1→2 journey) and
> `e2e/engine7_live.spec.ts` (the live manhunt flip). If those are green, this
> runbook is real.

---

## Pre-flight (5 min before recording)

1. **Backend up + module current.** Either is fine:
   - **Local (what the e2e use):** `spacetime start`, then
     `npm run stdb:publish` (publishes the `blox` module — includes the
     `engine_config` table + `set_engine_config` reducer the live edit needs) and
     `npm run stdb:generate`. `.env.local` defaults to `ws://localhost:3000` / `blox`.
   - **Maincloud (for a shareable URL / phone join):**
     `spacetime publish starblox-prod --server maincloud -y`, and point
     `.env.local` at it. **If you change the client, you must republish the module
     too** — new client + old server = broken.
2. **`NEXT_PUBLIC_TEST_MODE=1`** in `.env.local` keeps the demo helpers + the
   `window.__APP__` hooks on. Fine to leave on for the demo.
3. **Pre-warm:** open the site ~30s before recording (Maincloud free tier sleeps
   when idle; the *first* connect can take a beat, then it's instant).
4. **Two side-by-side windows** on the same room URL = your reliable "live for
   everyone" shot (Window A = you / the host, Window B = a friend). **They must be
   different identities** — use **one normal window + one incognito window** (or
   two different browsers / a phone). Two tabs in the *same* browser share the
   identity token, so they'd be the *same* player (one tank). Window A (opened
   first) is the lower identity → the **hunter**. Optional wow: a **phone** to scan
   the room QR (a phone is naturally a separate identity).
5. Confirm both windows show the green **Connected** dot (no red banner).
6. Canned-AI mode is **deterministic** — stick to the **Safe commands** at the
   bottom (or just click the suggestion chips).

---

## DEMO 1 — Make a game by describing it (~60s)

### Act 1 — Hook (~10s) · Home (`/`)
- **Say:** *"Every game here was written — and is changed — just by talking to an
  AI, and it's all live multiplayer. Let me make one from scratch."*
- **Expect:** the hub banner, green **Connected**, cards (Tank Trouble, Flappy
  Arena) with their genre thumbnails.

### Act 2 — Talk it into existence (~35s) · `/create`
- **Click:** the **Create** pill (top of the hub) → you're on `/create`.
- **Type** in the box: `a multiplayer tank arena with bouncing shells` → **Enter**
  (or click **Start**).
- **Expect:** the AI asks **one** clarifying question
  (*"Should the shells bounce off the walls?"*).
- **Type** the answer in the reply box: `yes, bounce them off the walls` → send.
- **Say:** *"It asked the one thing it needed, then it writes the actual game
  file — that's the real code scrolling by — and runs its own test."*
- **Expect, in order:**
  1. a **terminal** flashes the **real `tank.ts`** engine code (line by line),
  2. the **verification video** plays (*"Tests passed ✓ — here it is, working"*),
  3. a **Publish & Play** button appears with the game's name + rule chips.
- **Click:** **Publish & Play.**

### Act 3 — Instantly live & multiplayer (~15s) · Room
- **Expect:** you drop straight into the live room — a corridor **maze + tanks**,
  running on the pseudo-engine. Drive with **arrows**, fire with **space**.
- **Reliable shot:** bring up **Window B** on the same URL → **Expect** a 2nd tank
  in **both** windows, in sync.
- **Wow (optional):** the **Scan to join** QR → phone joins the same match.

---

## DEMO 2 — Change it live, by talking (~45s) · *Edit with AI*

> This is the climax. Have **both windows visible** so the room sees the change
> hit everyone at once.

- **Click:** the **"Edit with AI"** button (bottom-right of the game). A chat
  panel slides in.
- **Type:** `manhunt` → send. *(Or click the **manhunt** suggestion chip.)*
- **Say:** *"I'm changing the whole game mode in plain English — watch both
  screens."*
- **Expect:**
  - the little **terminal** flashes the real live write
    (`engine_config (live) · ~ manhunt: true · ✓ host picked it up next tick`),
  - **immediately, mid-match, no reload:** one player becomes the **hunter** — their
    screen goes **blacked-out with a flashlight cone**; they only see runners caught
    in the light. The **runners** keep the lit arena but **can no longer fire**.
  - **The hunter wins by shooting runners.** *(The hunter is the lowest-id player —
    in a 2-window demo, that's usually Window A.)*
- **Beat:** drive the hunter's cone over a runner → the runner pops into view in the
  light → fire to tag them.
- **Say:** *"Same running match — I just spoke a new game mode into it, and it
  applied live for everyone. No rebuild, no reconnect."*
- **Reset (optional):** type `lights on` → back to free-for-all, full visibility,
  everyone shoots.

### Optional extra live edits (same panel, one at a time, ~1s pause each)
- `everyone 2× faster` — tanks visibly speed up for everyone.
- `shells bounce more` — shells ricochet further off the maze walls.
- **Fullscreen** (⤢, top-right of the stage) for the finale — edge-to-edge.

---

## Safe commands (guaranteed in canned mode)

These map deterministically (no API key needed). Clicking the **suggestion chips**
is the safest move — one click, always maps.

- **Tank (engine):** `manhunt` · `lights on` · `everyone 2× faster` ·
  `shells bounce more` · `slower`
- **Flappy (engine):** `more gravity` · `floaty` / `easier` · `wider gaps` ·
  `tighter gaps` · `no collision` · `faster pipes`

> The live edit writes to `engine_config`; the host reads `api.config()` every
> tick, so every one of these changes is live for all players on the next frame.
> An off-script phrase just returns a friendly "try one of these" — it never
> breaks the match.

---

## Gotchas & fallbacks

- **Only one tank with two windows?** They're sharing an identity — use a **normal
  + incognito** window (or two browsers / a phone). Same-browser tabs share the
  identity token = same player.
- **Who's the hunter?** It's the lowest-identity player in the room (deterministic,
  not random). With two windows, open **Window A first** and it's reliably the
  hunter. If you need a specific window to be the hunter, open it first.
- **Cold start:** pre-warm the backend or the very first action looks laggy.
- **Nothing happened on the edit?** Make sure **both** clients are actually in the
  same room (2 tanks visible) before you speak the edit — roles only split once
  there are ≥2 players. Re-send `manhunt` (it's idempotent).
- **Red "Disconnected" banner:** the env/db is wrong (URI/DB name) — fix before
  filming. On a fresh local machine the DB name is **`blox`**.
- **Module errors on the live edit** (`set_engine_config` unknown): the deployed
  module is stale — republish it (`npm run stdb:publish` locally, or the Maincloud
  publish) so it has the `engine_config` table + reducer.

## Recording tips
- Two side-by-side windows = the safest "live for everyone" shot; phone-QR = a
  bigger wow if you can film it.
- Keep each edit to one command + a ~1s pause so the change reads as *live*.
- Save **manhunt** for last and let it breathe — the blacked-out flashlight reveal
  is the moment.
