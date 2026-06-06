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

---

## Starblox UI — full redesign + real lobby ✅
The whole app is reskinned to the **Starblox** light-metallic theme (brick logo, chrome/graphite, Geist), and the home → room journey now goes through a **real lobby page**. All wiring is unchanged — every screen reads live from SpacetimeDB.

**App shell**
1. Every page has the sticky **top bar**: brick logo + **Starblox** wordmark (left), a live **Connected / Connecting…** dot + **Create** button (right). The browser tab title reads **Starblox**.

**Home** (`/`)
1. Hero "**Games, made and remade by talking.**" with a dashed **Create with AI** tile (marble + ＋).
2. **Search** box + **All / Tanks / Flappy** filter chips actually filter the grid (type in the search, toggle a chip).
3. Cards live under **Your games** (only games you own) / **Community**. Each card shows a **procedural thumbnail** (tank maze or flappy sky), the name, a TANKS/FLAPPY tag, and **rule chips**. Hover a card → a play overlay + **Make it mine**; your own games also show a **✕** on hover.
4. Clicking a card opens its **lobby** (not the room directly).

**Lobby** (`/lobby/{id}`)
1. Left: large preview thumbnail + a **Share · scan to join** panel with the real room URL and a **Show QR** toggle (scannable QR of `…/game/{id}`).
2. Right: owner tag (**Created by you** / **By a player**), name, blurb, **Rules** chips, and a **Live players** panel (shows who's currently in the match, or "be the first").
3. **Play** drops you into the live room; **Make it mine** clones it into a room you own; **Delete** (your games only) removes it and returns home.

**Create** (`/create`)
1. Marble + textarea; **⏎ to build**. After you submit, a **preview card** appears ("Looks like… {name}", type tag, rule chips) derived from the real AI patch.
2. **Looks good — create** makes exactly that game and opens the room; **Tweak it** returns to the prompt. **Try** chips prefill examples.

**Room** (`/game/{id}`)
1. Big game name + meta row (Connected · controls · **Room {id}**) and a **Scan to join** QR popover (with copy link).
2. Left: the **untouched 800×600 Phaser canvas** sits in a dark stage with a `800 × 600 · live` badge; demo presets + Reset below (test mode).
3. Right rail: **Edit with AI** chat panel (marble spins while thinking; subtitle shows live status; suggestion chips; applied edits show a ✓ "done"; refusals show in red) and a live **Scoreboard** (bars fill toward the win score, your row highlighted).

**DONE WHEN:** the app is fully Starblox-themed, clicking a home card → lobby → **Play** → room works, create shows the preview-confirm step, and the room's AI edits/scoreboard/QR all behave exactly as before. _Automated: all 10 e2e specs pass (`npx playwright test`), `npm run build` is green._

---

## Production smoke test — deployed (Vercel + Maincloud `starblox-prod`) ✅
Run this on the **live Vercel URL** after the redeploy. Backend is published to Maincloud as `starblox-prod` and seeded (Tank Trouble + Flappy Arena).

### Pre-flight (one time, in Vercel)
- Env vars set **exactly** (no angle brackets, no quotes): `NEXT_PUBLIC_STDB_URI=wss://maincloud.spacetimedb.com`, `NEXT_PUBLIC_STDB_DB=starblox-prod`, `NEXT_PUBLIC_TEST_MODE=1` (optional: `ANTHROPIC_API_KEY`).
- **Redeployed** after setting them (NEXT_PUBLIC_* bake in at build time).

### A. Loads & connects to the cloud
1. Open the deployed URL. Top bar shows the brick logo + **Starblox** and a green **● Connected** within ~1–2s (Maincloud scales from zero, so the very first hit can take a beat).
2. **No red banner** appears. (A red "Disconnected" banner naming a bad URL/db = env wrong → fix env + redeploy.)
3. Under **Community** you see **Tank Trouble** (tanks) and **Flappy Arena** (flappy) with thumbnails + rule chips. _Seeing these = the browser is talking to Maincloud._

### B. Browse
1. Type in **Search** and toggle **All / Tanks / Flappy** — the grid filters.

### C. Lobby + share
1. Click **Tank Trouble** → its **lobby** opens (preview, owner tag, rules, Live players).
2. Click **Show QR** → a QR + the **real deployed** room URL (`https://<your-app>/game/1`) appears.
3. Click **Play** → you land in `/game/1`.

### D. Room (single device)
1. The 800×600 canvas renders the maze in the dark stage with a `live` badge; meta row shows **Connected · controls · Room 1**.
2. Arrow keys drive your green tank; **space** fires; the **Scoreboard** lists you.

### E. Real cross-device multiplayer (the Maincloud payoff)
1. On a **laptop**, enter a room; click **Scan to join** and scan the QR with a **phone on cellular** (different network than the laptop).
2. The phone opens the **same room** and a second tank/bird appears in **both** views.
3. Move on one device → it moves on the other within a fraction of a second. _This is the proof that every device shares one live match through Maincloud — no tunneling._

### F. AI edit, live for everyone
1. In the room's **Edit with AI** box (or a suggestion chip) send **"everyone moves 2× faster"** (tanks) / **"make the gaps wider"** (flappy).
2. The chat shows a ✓ "done" and the change takes effect in **all** connected devices at once. A nonsense prompt like **"order me a pizza"** is politely refused (red message containing "can't").

### G. Create & remix
1. **Create** → describe **"a multiplayer flappy bird, tall, 3 gaps, birds collide"** → **Create** → preview card → **Looks good — create** → you're dropped into a new live Flappy room (open it on a 2nd device to confirm it's shared).
2. On the home/lobby, **Make it mine** on a game → a new copy you own; the original is unchanged. Your own games show a **✕** to delete.

### H. Demo fallback
1. In any room the **demo** preset chips apply cached rule changes instantly (network-independent), and **Reset** restores defaults.

**DONE WHEN:** the live URL connects to Maincloud (seeded games visible, no red banner), two devices on different networks share one match, AI/demo edits hot-reload to everyone, and create/remix work. _If anything fails to connect, the red banner now names the exact URL/db it tried — match it against the env above._

---

## Immersive room + mobile controls ✅ (round 2 upgrades)
The room is now game-first: the canvas scales to fill the stage, the AI chat is hidden until you ask for it, edits flash through a little terminal, there's a fullscreen mode, and phones get on-screen controls. (Game-art polish is intentionally separate — that's the hands-on pass we'll do together.)

**Desktop**
1. Open any game → the canvas is **large and centered** in a dark stage (it scales to your window), with a **slim scoreboard** overlaid top-right and a `800 × 600 · live` badge bottom-left.
2. Bottom-right of the stage: a **⤢ fullscreen** button and an **Edit with AI** button. The big chat rail is **gone by default** — the game is the focus.
3. Click **Edit with AI** → a chat panel **slides in from the right**. Type a change (e.g. *"everyone moves 2× faster and shells bounce 5 times"*) and send.
4. A **terminal** above the input flashes the real change as code — `$ starblox apply → game_rules`, `~ player_speed: 2`, `~ projectile_bounces: 5`, `✓ hot-reloaded · live for N · 9ms`. The change is live for everyone instantly. Close the panel with the **✕**.
5. Click **⤢ fullscreen** → the game goes **edge-to-edge** (top bar hidden). Click again (or press **Esc**) to exit.

**Mobile / touch** (open the deployed URL on a phone, or DevTools device mode)
1. Tank games show a **d-pad (▲◀▶▼) bottom-left + a red FIRE button bottom-right**; hold them to drive and shoot — no keyboard needed.
2. Flappy games show a **TAP TO FLAP** button; tap it to flap.
3. The canvas scales to fit the phone; the scoreboard sits as a slim overlay up top.

**DONE WHEN:** the game fills the stage and scales with the window, the chat only appears when you click **Edit with AI**, edits flash through the terminal and go live, fullscreen is truly edge-to-edge, and a phone can drive the tank / flap with on-screen controls. _Automated: `e2e/phase8_immersive.spec.ts` covers mobile-drive, fullscreen, open-chat, type+apply, and the terminal; all 12 e2e specs + `npm run build` are green._

---

## Flappy overhaul ✅ (classic look + forgiving collision + game-over)
Open **http://localhost:3001/game/2** (Flappy Arena). _Note: local DB is now `bloxdev` (see STATE.md); prod is unaffected._

**Look**
1. Sky gradient with clouds, a ground strip, **green capped (Mario-style) pipes**, and a classic **yellow bird** that **tilts** (nose-up when you flap, nose-down as it falls) and flaps its wing.

**Forgiving collision (no more teleport)**
2. Let the bird fall to the **ground** — it **glides** along the floor, it does **not** teleport to the middle anymore.
3. Flap up so you're lined up with a gap and skim the **top/bottom lip** of the gap — you **slide through** (survive).
4. Fly straight into the **solid face of a pipe** (not aligned with the gap) → **Game Over**.

**Game-over card + restart**
5. On death a card appears — **SCORE** + **BEST** (best persists locally) + **Play again**. In multiplayer, only the bird that died sees its card; everyone else keeps flying.
6. Click **Play again** → you respawn centered, score resets to 0, and you're flying again.

**Multiplayer + still-live edits**
7. Two windows both at `/game/2`: both birds fly in sync; one dying doesn't affect the other. The **Edit with AI** box still changes gravity/gaps/etc. live for everyone, and the on-screen **TAP TO FLAP** works on mobile.

**DONE WHEN:** the bird/pipes look classic, the bird glides on surfaces instead of teleporting, a head-on pipe wall ends the run with a score card + Play again, and restart revives you. _Automated: `phase6.spec.ts` covers the gravity/gaps/collision rules AND the death→card→restart flow; all 13 e2e specs green._

---

## Tank overhaul ✅ (maze maps + speed pads + smaller tanks)
Open **http://localhost:3001/game/1** (Tank Trouble).

**Maze maps**
1. The arena is now a proper **corridor maze** (not scattered walls), on a faint grid floor, with a clear central area where tanks spawn.
2. There are **3 distinct maps**; a new one loads at random **every 5 total points** (and on **Reset**). Hit **Reset** a few times — the maze changes.

**Smaller / slower tanks**
3. Tanks are noticeably **smaller** and a touch **slower** by default — easier to thread the corridors.

**Speed pads ("speed blitz")**
4. In **Edit with AI** type **"add a speed blitz"** (or use the **Speed blitz** demo button). A few **gold-chevron metallic pads** appear at random spots, arrows pointing their boost direction (matching the reference).
5. Drive a tank **over a pad** → it's **sped up (~2×) for 5 seconds** (the boost follows you off the pad; the tank gets a gold outline while buffed), then returns to normal.

**Multiplayer + edits still live**
6. Two windows at `/game/1`: maze + pads are identical for both; rotation + edits apply to everyone at once.

**DONE WHEN:** the map is a maze that rotates between 3 layouts every 5 points, tanks are smaller/slower, and a speed-blitz edit drops chevron pads that give a 5-second speed buff on contact. _Automated: `phase9_tank.spec.ts` verifies the timed buff; all 14 e2e specs green._
