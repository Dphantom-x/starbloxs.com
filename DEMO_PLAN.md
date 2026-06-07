# Demo plan — click-by-click

What to **click**, **say**, and **expect**. Two beats: make a game by talking,
then change it live. Honest framing for the room: we run the AI in **demo mode**
(cached outputs of the real pipeline) for stage reliability — the pipeline is real
and runs live with an API key (see [README](README.md)). Say that if asked; don't
imply live generation when it's cached.

> Verified by `e2e/engine8_demo.spec.ts` (full create→manhunt journey) and
> `e2e/engine7_live.spec.ts`.

## Pre-flight

**Local:** `spacetime start` → `npm run stdb:publish` → `npm run dev` (:3001).
**Production (your domain):**
1. Republish the module to Maincloud: `spacetime publish <your-prod-db> --server maincloud`
   (it carries the engine tables/reducers; without it, engine features break live).
2. Vercel → Production env: `NEXT_PUBLIC_STDB_URI = wss://maincloud.spacetimedb.com`,
   `NEXT_PUBLIC_STDB_DB = <your-prod-db>`. Redeploy if changed.
3. Open the site ~30s early to warm Maincloud; confirm the green **Connected** dot.
4. Two **distinct identities**: a normal **+ incognito** window (same-browser tabs
   share one identity = one player). Open the **hunter** window first.

## Demo 1 — make a game by talking (~60s)

1. **Create** → type **`a multiplayer tank arena with bouncing shells`** → Enter.
2. Answer the one clarifying question (e.g. **`yes, bounce them off the walls`**).
3. **Expect:** the terminal shows the game code, a verification clip plays, then
   **Publish & Play**. Click it → you drop into a live maze + tank. Arrows to
   drive, space to fire.
4. **Reliable multiplayer shot:** open the room URL in the second identity → two
   tanks, in sync, in both windows. (Optional: the **Scan to join** QR on a phone.)

## Demo 2 — change it live (~40s)

1. With both windows visible, click **Edit with AI** (bottom-right) in the first.
2. Type **`manhunt`** → send.
3. **Expect, instantly and mid-match, no reload:** the first window (the hunter)
   goes **dark with a flashlight cone** and only sees runners caught in the light;
   the other window stays lit but **can't fire**. The hunter wins by tagging
   runners. Drive the cone over a runner to reveal + shoot them.
4. **Reset:** `lights on`.

## Safe commands (work in demo mode)

- **Tank:** `manhunt` · `lights on` · `everyone 2× faster` · `shells bounce more`
- **Flappy:** `more gravity` · `wider gaps` · `no collision` · `faster pipes`

Clicking the suggestion chips is the safest move. An off-script phrase returns a
friendly "try one of these" and never breaks the match.

## Fallbacks

- **Only one tank?** The two windows share an identity — use normal + incognito.
- **Who's the hunter?** Lowest-identity player = the window opened first.
- **Red "Disconnected" banner?** Wrong `NEXT_PUBLIC_STDB_URI` / `NEXT_PUBLIC_STDB_DB`.
- **Roll back a bad prod deploy:** Vercel → Deployments → previous good → Promote.
