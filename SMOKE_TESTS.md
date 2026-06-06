# Manual smoke tests

Run these in a browser as each phase lands (you're ~one phase behind me — that's expected).

**Both servers must be running:**
- SpacetimeDB local server on `:3000` (I keep this running)
- Next dev on **http://localhost:3001** (`npm run dev`)

Tip: open DevTools (F12) → Console. `window.__APP__` exposes the live synced state.

---

## Phase 0 — Connection ✅
1. Open **http://localhost:3001** → you should see **"Connected ✅"** + an **identity** hex string.
2. Console: **no red errors**.
3. Console checks:
   - `window.__APP__.connected()` → `true`
   - `window.__APP__.identity()` → a long hex string
   - `window.__APP__.getEntities()` → `[]`
4. **Refresh** the page → reconnects with the **same identity** (localStorage token persistence).

**DONE WHEN:** "Connected ✅" + identity, no console errors, identity survives a refresh.

---

## Phase 1 — Home menu ✅
1. Open **http://localhost:3001** → a grid with **two game cards**: 🎮 **Tank Trouble** (tanks) and 🐤 **Flappy Arena** (flappy), plus a dashed **"Create with AI"** tile.
2. Click **Tank Trouble** → URL becomes `/game/1` and shows **"Room 1"** (placeholder room).
3. Click **← back to games**, then **Flappy Arena** → `/game/2`, **"Room 2"**.
4. Click **Create with AI** → `/create` placeholder page.
5. Console: `window.__APP__.getGames()` → an array of **2** objects, each with `name` and `gameType`.

**DONE WHEN:** both game cards + the create tile render, and every card/tile navigates to the right route.

---

## Phase 2 — Multiplayer movement ✅ (the proof)
**Important:** two windows in the *same* browser profile share one identity (= one player). For a real 2-player test, use **two different storage contexts** — e.g. a normal window **and** an Incognito/Private window, or two different browsers.

1. Window 1 (normal): open **http://localhost:3001/game/1** (Tank Trouble).
2. Window 2 (Incognito): open **http://localhost:3001/game/1**.
3. Each window shows an 800×600 field with squares — **your** square is blue, the **other** player's is pink.
4. Click Window 1 to focus it, press the **arrow keys** → your blue square moves.
5. Watch Window 2 → the matching pink square moves **in real time**, smoothly (not teleporting).
6. Move in Window 2 too → Window 1 reflects it.
7. **Close** one window → after ~1s the other window's pink square **disappears** (disconnect cleanup).

**DONE WHEN:** both windows show each other's squares moving live, and closing one removes its square in the other.

---

## Phase 3 — Tank Trouble ✅
Two windows (normal + Incognito), both at **http://localhost:3001/game/1**.

1. You see a grey **maze**, your **green** tank (with a barrel showing aim) and the other player's **red** tank, on a light field.
2. **Arrow keys** drive your tank; it **can't pass through walls**.
3. **Space** fires — a small dark shell shoots from your barrel and **bounces off walls** (a couple of bounces) before vanishing. _Aim = the direction you're driving, so steer the way you want to shoot, then fire._
4. Hit the other tank with a shell → it **respawns** and **your score goes up** (scoreboard below the field).
5. Both windows show the same maze, tanks, and shells **in sync**.

**DONE WHEN:** you can drive, walls block you, shells bounce, hitting the other tank scores, and both windows stay in sync.

---

## Phase 4 — Live rule edits / hot-reload ✅ (the thesis, no AI yet)
Two windows (normal + Incognito), both at **http://localhost:3001/game/1**, both with a tank. Below the scoreboard is a **"demo:"** row of buttons.

1. In Window 1, click **Speed ×2** → **both** windows' tanks immediately drive faster — **no reload**.
2. Click **Bouncy shells**, then fire (space) → shells now bounce more times before vanishing, in both windows.
3. Try **Fast shells**, **Rapid fire**, **Boost strips** (strips that fling tanks sideways).
4. Click **Reset** → rules snap back to default in both windows.

This is the whole product thesis: a game's rules live as **data in SpacetimeDB**, so changing them updates every player the same instant. _In Phase 5 the AI writes these exact patches from plain English._

**DONE WHEN:** clicking a demo button in one window changes the game in **both** windows live, and Reset restores defaults.

---

## Phase 5 — Edit the game by talking ✅ (AI pipeline, canned)
Two windows (normal + Incognito), both at **http://localhost:3001/game/1**, both with a tank. Above the scoreboard is a text box: _"Tell the AI how to change the game…"_.

1. In Window 1, type **make everyone twice as fast and shells bounce 5 times** → click **Edit**.
2. Status shows **"done ✓"**; **both** windows' tanks speed up and shells bounce more — live.
3. Try more: **rapid fire**, **make tanks slower**, **spawn boost strips and give the loser a laser**, **turn it into a manhunt**.
4. Type nonsense (**order me a pizza**) → friendly _"I can't do that one yet…"_, no crash.
5. **Reset** (demo row) restores defaults.

> **Canned vs live AI:** with no key it uses deterministic **canned** patches (and that's the demo-day fallback). To use **live Claude (Opus)**: put `ANTHROPIC_API_KEY=sk-ant-…` in `.env.local` (optionally `ANTHROPIC_MODEL`), restart `npm run dev`. The demo buttons + `window.__APP__` stay available. Force canned anytime with `AI_CANNED=1`.

**DONE WHEN:** a typed sentence changes the game live in both windows, and nonsense fails gracefully.

---

## Phase 6 — Multiplayer Flappy ✅ (same pipeline, second game)
Two windows (normal + Incognito), both at **http://localhost:3001/game/2** (Flappy Arena).

1. Sky-blue field; green **pipe columns scroll** left; birds (**yellow = you**, orange = others).
2. Press **UP** or **SPACE** to **flap** — your bird rises; gravity pulls it down between flaps.
3. Fly through the gaps; passing a pipe **scores** a point (scoreboard). Hitting a pipe/floor resets you to mid-field.
4. Both windows show the same pipes/birds **in sync**.
5. Edit it with the **same AI box**: try **"lower gravity"**, **"make the gaps wider"**, **"give each pipe more gaps"**, **"let the birds knock into each other"** — both windows react live.
6. The **demo:** buttons are now flappy-specific (Low gravity, Heavy gravity, Wide gaps, More gaps, Birds collide, Tall field).

**DONE WHEN:** you can flap through scrolling multi-gap pipes, birds sync across windows, and AI/demo edits change the flappy rules live. _This is the generalization proof — a totally different game on the exact same data-driven engine._

---

## Phase 7 — Create / remix ✅
**Make a game by talking:**
1. From the home menu, click **Create with AI**.
2. Type **"a multiplayer flappy bird, tall, 3 gaps, birds collide"** → **Create**.
3. After a moment you're dropped into a **new Flappy room** matching it (tall field, 3-gap pipes, birds collide). A second window joins via the same `/game/{id}` URL.
4. Try **"a tank game with bouncy shells"** too.

**Remix ("Make it mine"):**
1. On the home menu, click **Make it mine** on any card (e.g. Tank Trouble).
2. You're dropped into a **new copy you own** (same maze/rules, with "(remix)" in the name). Edit it freely — the **original is untouched**.

**Manage:** games you create/remix show a small **✕** to delete; the two seeded games are protected (you don't own them).

**DONE WHEN:** a create prompt makes a matching new game, "Make it mine" clones a game without changing the original, and you can delete your own games.

---

## Phase 8 — Deploy-ready (local bits) ✅
The cloud deploy itself is a **guided step we'll do together** — see `DEPLOY.md`. Verified locally:

1. **Production build:** `npm run build` succeeds (so Vercel will build it).
2. In any room, click **📱 Scan to join** → a **QR code + the room link + a copy button** appear (the QR encodes the current URL — it becomes the public link once deployed).
3. **Env-driven config:** the connection reads `NEXT_PUBLIC_STDB_URI` / `NEXT_PUBLIC_STDB_DB` (see `.env.example`), so going to Maincloud is just env vars — no code change.
4. **Demo hardening:** game-type-aware demo buttons + per-room **Reset** + the `AI_CANNED=1` fallback are all in place.

**DONE WHEN:** `npm run build` passes and the room QR/copy work. _(Real cross-device join over the internet comes with the Maincloud + Vercel deploy.)_
