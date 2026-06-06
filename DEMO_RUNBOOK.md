# Blox — Demo runbook & deployed smoke test

## Before you go on stage
- **Two views** of the deployed site: a laptop window **+ a phone** (scan the room
  QR), or two laptop windows (normal + Incognito = two distinct players).
- **Pre-warm Maincloud:** open the site once (free tier sleeps when idle).
- On Vercel set **`NEXT_PUBLIC_TEST_MODE=1`** so the on-screen demo buttons (the
  network-independent fallback) are available.
- Have the **cached prompts ready** to paste (below) — the canned patches map them
  even with no API key.

## The flow (~3 min) — mapped to the app
1. **Hook (talk).** Open the home menu → two games (Tank Trouble, Flappy Arena) +
   "Create with AI".
2. **DEMO 1 — make a game by talking.** Click **Create with AI**, type:
   > *Make a multiplayer Flappy Bird — make it tall, give each pipe a few different gaps to aim for, and let the birds knock into each other.*
   You're dropped into a NEW Flappy game (tall, multi-gap pipes, birds collide).
   Have the second view **join** (scan QR / open the same `/game/{id}`). Both flap.
   ✅ **Fully lands today.**
3. **Pivot (talk).** "Rules live as data in SpacetimeDB — the AI can change a
   *running* game for everyone at once." Open **Tank Trouble**.
4. **DEMO 2 — remix live (climax).** In the room's AI box, type a transformation.
   - ⚠️ The scripted **manhunt** prompt (hunter + black-out/fog + sparks) currently
     **applies the rules but does NOT visually render** (no fog/sparks/hunter art yet
     — see To-do #2). On stage it would *look like nothing changed*.
   - ✅ **What visibly transforms live on tanks TODAY:** speed, bounce count, shell
     speed, rapid fire, per-player speed. A climax that lands today:
     > *Make everyone twice as fast, make shells bounce five times, and make it rapid-fire.*
     → both screens turn to chaos at the same instant.
5. **Close (talk).**

## Cached prompts (canned-mode safe)
- Flappy create: *"a multiplayer flappy bird, tall, 3 gaps, birds collide"*
- Tank chaos (lands today): *"make everyone twice as fast and shells bounce 5 times"* · *"rapid fire"*
- Flappy edits: *"lower gravity and widen the gaps"* · *"let the birds knock into each other"*
- Manhunt (needs To-do #2 to render): *"turn it into a manhunt — one hunter, black out the map, others throw sparks"*

---

## Smoke test — the DEPLOYED Vercel link

### Prerequisite: the deploy must be fully wired (not just `git push`)
For the deployed site to work you need BOTH:
1. The SpacetimeDB module published to **Maincloud**:
   `spacetime login` then `spacetime publish <unique-name> --server maincloud`.
2. Vercel **env vars**:
   - `NEXT_PUBLIC_STDB_URI = wss://maincloud.spacetimedb.com`
   - `NEXT_PUBLIC_STDB_DB = <unique-name>`
   - `NEXT_PUBLIC_TEST_MODE = 1`
   - (optional) `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
If these aren't set, the site loads but stays **"Connecting…"**. (See `DEPLOY.md`.)

### Steps
0. **Connects.** Open the Vercel URL → home shows **"Connected"** + Tank Trouble +
   Flappy Arena. _Stuck on "Connecting…" → backend/env not wired (prereq above)._
1. **Single play.** Open Tank Trouble → drive (arrows), fire (space), shells bounce.
2. **AI edit.** Type *"make everyone twice as fast and shells bounce 5 times"* →
   status "done ✓", tanks speed up + shells bounce more. Try the **demo buttons**.
3. **Create.** Home → Create with AI → *"a multiplayer flappy bird, tall, 3 gaps, birds collide"* → dropped into a matching new Flappy game.
4. **Cross-device (the payoff).** In a tank room click **📱 Scan to join**, scan with
   your phone on cellular → it joins the **same match**. Move on the phone → see it
   on the laptop. Edit on the laptop → the phone changes too.
   _(Known issue: the 800×600 canvas overflows a phone screen — To-do #3.)_
5. **Graceful refusal.** Type *"order me a pizza"* → friendly "I can't do that one yet".
6. Open DevTools console → no red errors; confirm the QR encodes the **Vercel** URL.

**DONE WHEN:** the deployed site connects, both games play, AI/demo edits change the
game live, Create works, and a phone joins the same match over the internet.
