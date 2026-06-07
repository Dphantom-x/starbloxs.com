# Starblox — Demo Run-of-Show
*Spoken script + exactly what to click, beat by beat. Target: **~4:00**, hard cap 4:30. Read the **SAY** blocks aloud; do the **DO** blocks; every beat has a **SAFETY** fallback. Everything shown is real output from Starblox, pre-captured for stage speed so it never waits on Wi-Fi — the live pipeline is one keystroke away for Q&A.*

> Audience: the SpacetimeDB / Clockwork Labs judges. The one thing they must hear out loud: **SpacetimeDB is what makes every generated game instantly multiplayer and live-editable.** Name it; it's load-bearing but invisible.

---

## ⏱ T-MINUS — before you're called up

- [ ] **Maincloud is current.** Republish the module so the deployed backend has the engine reducers (`commit_entities`, `set_engine_config`, the manhunt-reset on disconnect): `spacetime publish <prod-db> --server maincloud`. Confirm the live site shows the green **Connected** dot.
- [ ] **Pre-warm:** open the deployed URL once and load a game (wakes Maincloud from idle).
- [ ] **Two windows = two players, two identities.** Window **A** = normal Chrome (you, the host). Window **B** = **Incognito** (a second player). ⚠️ *Same browser = one shared identity = no multiplayer. They must be different profiles.* Place them side-by-side, projected.
- [ ] **Window A is the permanent host** (open it first → lowest identity → the authoritative tick runs on your machine).
- [ ] **Phone on cell data**, screen bright, ready to scan the room QR (cross-device proof).
- [ ] **Confirmed working this morning:** the cached create-flow, the published Tank, the **manhunt** edit (+ the **"shells bounce more" / dash-pads edit** as the fallback).
- [ ] Zoom/text size up so the back row can read it. Notifications off. Charger in.

---

## 🎬 THE RUN

### BEAT 0 — The hook: why an engine, not a game · ~40s
**DO:** Window **A** projected on the Home screen. Just talk.

**SAY:**
> "The brief was 'build the best game.' That stopped me — because how do you pick *the* best game? I could ship something fun, but the best game was never going to be one *I* build. It's the thousand games everyone else builds the moment you hand them the power to. So instead of building a game, I built the engine that lets anyone — coder or not — build their own.
>
> Two things stop people from making games. **Starting** — the blank page, the years of learning to code. And if you clear that: **multiplayer** — servers, sync, netcode, brutal even for veterans. Remove both, and the creativity pours out.
>
> You already solved the second one. You built SpacetimeDB to run BitCraft — a real-time engine strong enough to hold a whole living world. You built a power plant to light one house. I put an AI in front of that plant and wired it to everyone. Describe a game in plain English, the agent builds it — and because it runs on SpacetimeDB, it's multiplayer the instant it exists, and you can rewrite it live, mid-match. No code. No netcode. No setup.
>
> That's **Starblox**. Let me show you."

**SAFETY:** Pure talk over a static screen — nothing can fail.

---

### BEAT 1 — Build a game by talking · ~85s
**DO (in order):**
1. Window **A** → click the **Create** pill → on `/create`, type the prompt in the box → **Start**.
2. The agent asks **one** clarifying question — read it aloud, type your answer → send.
3. It "builds": the **terminal flashes the real generated game-file code**, then the **test-script video plays** (the actual Playwright run of the game).
4. **Publish & Play** → you land in the live room (a tank arena).
5. Window **B** (Incognito): paste the room URL → joins as a 2nd player. Drive both a moment.
6. **Hold up the phone** → scan the room's **QR** → it joins the same match on cell data.

**SAY:**
> "I'll just ask for a game. *[typing]* 'A multiplayer tank arena with bouncing shells.'"
>
> *[agent asks]* "Good question — *[answer]* yeah, shells bounce off the walls."
>
> *[terminal → test-video]* "That's not a mock-up. That's the actual game file it wrote, and that's my real test suite playing it. The conversation, the code, the game — Starblox produced all of it. I cached this exact run so it's instant on stage; I'll happily generate a fresh one live in a minute."
>
> *[Publish → B joins → phone scans QR]* "Published. Here's a second player — *[B]* — in the same match. And this —" *[hold up phone]* "— is my phone, on cell service, in that same game. Nobody installed anything. Nobody wrote a line of netcode. It was multiplayer the second it existed."

**SAFETY:** The whole sequence is pre-captured — it plays regardless of network. If publish→join hiccups, open the already-published Tank instead. Two profiles guarantee B is a real second player.

---

### BEAT 2 — It's not a one-off: the gallery · ~20s
**DO:** Window **A** → back to Home → gesture across the **"Made by the AI"** shelf (each card is looping real gameplay). Optionally click one (e.g. **Evil Genie**) → it opens and runs.

**SAY:**
> "And it isn't one lucky game. Every title on this shelf was generated by the agent — a snake, a brick-breaker, an asteroids, even an 'evil genie' that twists your wishes. Different genres, all written from a sentence, all running on the same engine. *[optional click]* Here's one, live."

**SAFETY:** The cards are looping recorded clips — they always play. If a click is slow, just talk over the shelf.

---

### BEAT 3 — Change a running game, live, for everyone · THE CLIMAX · ~65s
**DO (in order):**
1. Make sure **A, B, and the phone are all in the tank match** (from Beat 1).
2. Window **A** → **Edit with AI** → type the manhunt edit → **Send**.
3. **STOP TALKING.** Let the ~1-second beat land — every screen transforms at once.
4. Gesture to **B** and the **phone**: they changed too, mid-game, uninterrupted.

**SAY (before Send):**
> "Now the part only SpacetimeDB makes possible. People are *in* this match right now. Watch what happens when I change the game itself, mid-play. *[typing]* 'Turn this into a manhunt — make one player the hunter with a flashlight on a blacked-out map; everyone else can't shoot and just has to survive.'"

**→ [ SEND. SILENT BEAT. Let them watch every screen flip together. ]**

**SAY (after):**
> "I just rewrote a *running* game, and SpacetimeDB pushed that change to every player at the same instant. No redeploy. No reload. Nobody dropped, nobody even paused. A tank deathmatch became a horror manhunt in one sentence — *that* is the thing you can only do on SpacetimeDB."

**SAFETY:** Run it cached so it's instant — this moment cannot hang. If nothing changes in ~2s, click the **"manhunt" suggestion chip** (same cached flip). If the flashlight rendering ever misbehaves, fall back to **"shells bounce more"** — the beat still reads as a live, for-everyone transformation.

---

### BEAT 4 — Close · ~20s
**DO:** Step back; let the manhunt keep playing behind you.

**SAY:**
> "Clockwork built the power plant. Starblox is the part that puts it in everyone's hands. The best game was never one I could build — it's the flood of games people make when *starting* is a sentence and *multiplayer* is free. That's **Starblox**. Thank you."

---

### ⭐ OPTIONAL — Q&A power move ("is the AI real?")
**DO:** Flip Window **A** to the live-key path. Take a judge's prompt *within the engine's range* and generate it live (accept the short wait).

**SAY:**
> "Everything you saw is my real pipeline — cached so the timing's tight. But it runs live. Give me a game and I'll generate it right now."

---

## 🛟 FALLBACK QUICK-REFERENCE

| If… | Do this |
|---|---|
| Create sequence stalls | It's pre-captured — it should just play; if publish→join hiccups, open the pre-published Tank |
| Manhunt doesn't apply in ~2s | Click the **"manhunt" suggestion chip** (cached flip) |
| Flashlight glitches | Fall back to the **"shells bounce more"** edit |
| Phone won't join / no signal | Ignore it — the two windows already prove the sync |
| Both windows act as one player | *(Prevented in setup: A normal, B incognito)* |
| Maincloud feels cold | *(Prevented: pre-warmed)* — reload once |
| "Did the AI really build that?" | "Yes — real pipeline output, cached for speed. I'll run a fresh one live right now." |
| You blank | One line holds it all: **"Describe a game, the AI builds it, it's instantly multiplayer, and I can rewrite it live — because SpacetimeDB does the hard part."** |

---

## The three things that make or break it
1. **Say SpacetimeDB's role out loud** — zero-netcode instant multiplayer + live edit for *every* generated game. It's essential but invisible unless you name it. The judges built it; show them it's load-bearing.
2. **Lean on the two unfakeable moments** — the phone joining a running game, and the manhunt flipping every screen at once. Those are genuinely happening in the room.
3. **The silent beat after the edit** — don't narrate over it. Every screen changing together *is* the pitch, made visible.

---

## Timing budget (~4:00)
| Beat | Target |
|---|---|
| 0 — Hook | 0:40 |
| 1 — Build by talking | 1:25 |
| 2 — The gallery | 0:20 |
| 3 — Live manhunt (climax) | 1:05 |
| 4 — Close | 0:20 |
| **Total** | **~3:50** |
*Buffer to 4:30 absorbs a slow join or a held beat. If you're running long, cut Beat 2 first.*
