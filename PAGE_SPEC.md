# Blox — Page & UI Spec (the app shell, excl. the live game canvas)

This documents every **non-gameplay** screen so a designer (or Claude Code) can
restyle the app. The Phaser **game canvas itself is out of scope** — only the
chrome around it is described here.

For each page: **route → purpose → layout → every element (with current copy &
`data-testid`) → all states & messages → design notes**. Current copy and test
IDs are listed so a redesign can keep the existing wiring intact. Anything marked
**PROPOSED** does not exist yet.

---

## 0. Global app shell (applies to every page)

- **Stack:** Next.js App Router (single-page feel, client navigation). `RootLayout`
  wraps the whole app in `<StdbProvider>` — **one** SpacetimeDB WebSocket for the
  entire session.
- **Identity / auth:** anonymous. An identity token is auto-created and stored in
  `localStorage` on first connect. **There is no login/signup UI** and none is
  needed. (Two browser profiles / an Incognito window = two distinct players.)
- **Connection state is global:** any page can read `connected` (boolean) and show
  "Connected / Connecting…". Until connected, data-driven content (game cards,
  rules) is empty.
- **Fonts:** Geist Sans (UI) + Geist Mono (numbers/code), already wired.
- **Theme:** Tailwind, follows system light/dark (`dark:` variants exist).
- **No global top bar today.** Each page renders its own header; pages that aren't
  Home show a `← back to games` link. _Design opportunity: a slim branded top bar
  with the Blox logo + connection dot, shared across pages._
- **Brand colors currently in use** (reuse for consistency):
  - your tank/you = green `#22c55e` · enemy/others = red `#ef4444`
  - flappy bird (you) yellow `#facc15` · (others) orange `#fb923c`
  - pipes green `#22c55e` · maze walls gray `#6b7280` · tank field `#e9eef2` · sky `#87ceeb`
  - text-muted = `gray-500`; borders = `black/10–20` (light) / `white/15–25` (dark)

---

## 1. Route map

| Route | Screen | Kind | Exists |
|---|---|---|---|
| `/` | **Home / Game selection** | shell | ✅ |
| `/create` | **Create with AI** | shell | ✅ |
| `/game/[gameId]` | **Game room** (shell chrome + canvas) | dynamic | ✅ |
| `/_not-found` | **404** | static | ✅ (Next default, unstyled) |
| `/game/[gameId]` lobby | **Game detail / lobby** (intermediate) | — | ❌ **PROPOSED** |

> **Note on "an intermediate page before starting":** there is **none today** —
> clicking a game card navigates **straight into the live room** (`/game/{id}`)
> and auto-joins. Section 6 proposes one if you want it.

---

## 2. Home / Game Selection — `/`

**Purpose:** the landing hub. Browse games, open one, create a new one by talking
to AI, or remix/delete.

### Layout
- Full-height page, generous padding.
- **Header** (top-left): big wordmark + a one-line status/tagline.
- **Responsive grid** below: 2 cols (mobile) → 3 (sm) → 4 (md+). Game cards first,
  then the "Create" tile as the last cell.

### Elements
1. **Wordmark** — `Blox` (currently `text-4xl` extrabold).
2. **Status / tagline** — `"{Connected | Connecting…} · pick a game, make one by talking to AI, or remix any game"` (muted, small).
3. **Game card** (repeated per game) — `data-testid="game-card"`, `data-game-type`, `data-game-id`; the whole card is a link to `/game/{id}`:
   - **Icon** — 🎮 (tanks) / 🐤 (flappy), large.
   - **Name** — bold (e.g. "Tank Trouble", "Flappy Arena", "Tank Trouble (remix)").
   - **Type label** — uppercase muted ("TANKS" / "FLAPPY").
   - **"Make it mine" button** — top-right corner; `data-testid="remix-btn"`, `data-remix-id`. Clones the game into a new one you own and navigates there. Shows `"…"` and is disabled while remixing.
   - **"✕" delete button** — top-left corner; **only on games you own** (`data-testid="delete-btn"`, `data-delete-id`). Deletes the game; the card vanishes. (The 2 seeded games are owned by the server, so they show no ✕.)
4. **"Create with AI" tile** — last grid cell; `data-testid="create-tile"`; dashed border; links to `/create`:
   - `＋` icon · **"Create with AI"** · sub-label **"describe a game"**.

### States
- **Connecting:** tagline reads "Connecting…"; grid may be empty until games sync in.
- **Connected:** tagline "Connected"; cards render.
- **Remixing card N:** that card's button → "…", disabled (others unaffected).
- **Owned vs not:** owned games show the ✕; seeds don't.
- **Empty (no games):** only the Create tile shows (normally there are always ≥2 seeds).

### Design notes / opportunities
- Cards are plain bordered boxes — prime spot for **thumbnails/preview art** per
  game, **"N playing now"** live counts, nicer hover/press states.
- The remix/delete buttons are tiny utilitarian chips — consider **icon buttons +
  tooltips**, or a **⋯ overflow menu** per card (Play / Make it mine / Share / Delete).
- Consider sections: **"Featured/seeded"** vs **"Your games"** vs **"Community"**.
- A **hero** (logo + one-liner: "Multiplayer games, made and remade by talking").
- Search/filter once there are many games.

---

## 3. Create with AI — `/create`

**Purpose:** make a brand-new game by describing it in plain English. (Same AI +
rules pipeline as in-game editing.)

### Layout
- `← back to games` link, then a title block, then a single prompt row, then
  status + example hints. Single column, left-aligned.

### Elements
1. **Back link** — `"← back to games"` → `/`.
2. **Title** — `"Create a game with AI"`.
3. **Subtitle** — `"Describe a game in plain English and the AI builds it."`.
4. **Prompt input** — `data-testid="create-input"`; placeholder `"e.g. a multiplayer Flappy Bird, tall, with a few gaps, and birds that collide"`.
5. **Create button** — `data-testid="create-submit"`; label `"Create"`; disabled while busy or while disconnected.
6. **Status line** — `data-testid="create-status"` (see messages below).
7. **Examples hint** — `Try: "a multiplayer flappy bird, tall, 3 gaps, birds collide" · "a tank game with bouncy shells"`.

### States & messages
- **Idle:** just the form + hint.
- **Working:** status `"designing your game…"` → `"creating…"`; button disabled; input keeps its text.
- **Success:** navigates to the new room `/game/{newId}` (no on-page success text — the navigation *is* the success).
- **Errors** (button re-enables): `"I couldn't build that — try a tank or flappy game."` · `"could not create the game"` · `"something went wrong"`.
- **Disconnected:** Create button disabled.

### Design notes / opportunities
- Make the input a **hero prompt box** (big, centered) — this is a signature moment.
- **Clickable example chips** that fill the input.
- A **"thinking" animation** during "designing…/creating…".
- Optionally **preview the chosen game type + rule summary** ("Flappy · tall, 3
  gaps, birds collide") with a "Looks good → Create" confirm before navigating.
- Friendly **empty/refusal** illustration for the error states.

---

## 4. Game Room — shell chrome — `/game/[gameId]`

**Purpose:** play + edit-by-talking + share. **The 800×600 game canvas is the
game (out of scope).** Everything else on this page is shell and is described here.

### Layout (top → bottom)
1. `← back to games`
2. **Room title**
3. **Status + controls hint + QR** (one wrapping row)
4. **[GAME CANVAS — out of scope]** (currently fixed 800×600)
5. **AI edit chat** (one row)
6. **Scoreboard** (one row)
7. **Demo controls** (one row)

### Elements
1. **Back link** — `"← back to games"` → `/`.
2. **Title** — `"Room {gameId}"` (`data-testid="room-title"`). _Design note: show the
   game's **name** ("Tank Trouble") instead of/with the id._
3. **Status + controls hint** — `"{connected | connecting…} · {controls}"` where
   controls = tanks `"arrow keys to drive · space to fire"`, flappy `"up / space to flap"`.
4. **Room QR / share** — `data-testid="room-qr"`:
   - Toggle button `data-testid="qr-toggle"`: `"📱 Scan to join"` / `"Hide QR"`.
   - When open: a **QR code** (encodes the current room URL), the **URL text**, and a
     **copy** button (shows `"✓"` for ~1.5s after copying).
5. **AI edit chat** — `data-testid="edit-chat"`:
   - Input `data-testid="edit-input"`, placeholder `"Tell the AI how to change the game…"`.
   - Button `data-testid="edit-submit"`, label `"Edit"` (disabled while busy).
   - Status `data-testid="edit-status"`: `"thinking…"` → `"done ✓"` | a friendly
     refusal (e.g. `"I can't do that one yet — try speed, bounces, gravity, gaps, roles, boosts, or sparks."`) | `"no change"` | `"something went wrong"`.
6. **Scoreboard** — `data-testid="scoreboard"`: one entry per player = a small
   **colored square** (green = you, red = others) + `"{name}: {score}"` (score in
   `data-testid="score"`). Updates live.
7. **Demo controls** — `data-testid="demo-controls"`, **only when `NEXT_PUBLIC_TEST_MODE=1`**:
   `"demo:"` label + preset buttons + `"Reset"`. Presets are **game-type aware**:
   - **Tanks:** Speed ×2 · Bouncy shells · Fast shells · Rapid fire · Boost strips
   - **Flappy:** Low gravity · Heavy gravity · Wide gaps · More gaps · Birds collide · Tall field
   Each applies a cached rule patch instantly (live for everyone). Reset restores defaults.

### States
- connecting → connected
- AI edit **busy** ("thinking…"), **success** ("done ✓"), **refused** (friendly message)
- QR **closed / open**, copy **idle / copied (✓)**
- scoreboard reflects join/leave + score changes live

### Design notes / opportunities (this page is the most bare — biggest win)
- Reorganize into **game + side panel**: canvas on the left/center, a right rail
  with **AI chat (the star), scoreboard, share/QR**. On mobile, stack.
- The **AI prompt box should feel premium** — it's the whole product. Suggest
  prompt chips, a sending animation, a short history of recent edits.
- **Scoreboard → player list** with avatars/color, "you" highlighted, win target.
- **Share/QR** as a tidy popover/modal, not inline.
- **Win / score moments** (a flash when someone scores or hits the win score).
- ⚠️ **Mobile/canvas sizing (important for the QR-join feature):** the canvas is a
  **fixed 800×600**. On a phone (the exact device you scan the QR with) it overflows
  the screen. The room layout should **scale/letterbox the canvas to fit small
  screens** and reflow the chat/scoreboard/controls below. Flag this for the design.

---

## 5. 404 / Not found — `/_not-found`

- Currently the **Next.js default** (unstyled). _Design opportunity:_ a branded 404
  with the Blox wordmark, a friendly line ("That room flew the coop"), and a
  `← back to games` button.

---

## 6. PROPOSED — Game Detail / Lobby (the "intermediate page")

**Today there is no intermediate page** — selecting a card auto-joins the live
room. If you want a beat between selection and play (more Roblox-like, and a
natural home for Share + a rules summary), here's a spec.

**Routing options (pick one):**
- (a) Make `/game/[id]` the **lobby**, move live play to `/game/[id]/play`.
- (b) Keep `/game/[id]` as the room, add `/game/[id]/about` or a **modal** opened
  from the card.

**Content:**
- **Header:** game icon, **name**, type, owner ("Created by you" / "by a player" /
  "Official").
- **Rules summary** (plain English, generated from `game_rules`): e.g.
  "Tanks · shells bounce 5×, everyone 2× speed, rapid fire" or
  "Flappy · tall field, 3 gaps per pipe, birds collide".
- **Live players:** count + names currently in the match ("3 playing now", or
  "Be the first to play"). From the `player` table filtered to this game.
- **Preview** (optional): static art or a tiny live canvas preview.
- **Primary CTA:** `Play` / `Join` → enters the live room.
- **Secondary:** `Make it mine` (remix) · `Share` (QR + link) · `Back`.
- **If you own it:** `Edit rules` (could open the AI chat pre-join) · `Delete`.

**States:** loading (game not synced), **not found** (bad id → "This game doesn't
exist" + back), empty player list.

**Why add it:** context before a fast game; a clean place for Share/QR + the
AI rule-summary; lets people remix without entering. **Trade-off:** one extra tap
before play. (The current direct-to-room flow is snappier for a live demo.)

---

## 7. Cross-cutting

### State inventory (design should cover all)
- **Connection:** connecting · connected · (rare) disconnected/reconnecting.
- **Async actions:** AI thinking · creating · remixing · copying — each needs a
  busy affordance + disabled controls.
- **Errors:** AI refusal (friendly, non-blocking) · create failure · generic.
- **Empty:** no games (Home), no players yet (Scoreboard / proposed Lobby).

### Copy inventory (current exact strings — keep the voice)
- Home tagline: `"… · pick a game, make one by talking to AI, or remix any game"`
- Card actions: `"Make it mine"`, `"✕"`
- Create tile: `"Create with AI"`, `"describe a game"`
- Create page: `"Create a game with AI"`, `"Describe a game in plain English and the AI builds it."`, button `"Create"`, statuses `"designing your game…"`/`"creating…"`/errors above.
- Room: `"Room {id}"`, controls hints, `"📱 Scan to join"`/`"Hide QR"`/`"copy"`/`"✓"`.
- Edit chat: placeholder `"Tell the AI how to change the game…"`, button `"Edit"`, `"thinking…"`/`"done ✓"`/refusal.
- Demo: `"demo:"`, preset labels (§4), `"Reset"`.

### Responsive
- Home grid already responsive (2→3→4). **Room is not mobile-ready** (fixed canvas
  — see §4 warning). Create page is fine but could center as a hero.

### Accessibility
- Player identity is **color-only** (green/you, red/others) — add a non-color cue
  (a "you" badge, initials, shape).
- Ensure all icon buttons (✕, 📱) have accessible labels (the ✕ has a `title`).
- Keyboard: the game grabs arrow/space; make sure inputs (chat/create) don't lose
  focus to the game, and Esc/Tab behave.

### Suggested design-system deliverables
- Color tokens (reuse the brand colors in §0), spacing scale, type scale, button
  variants (primary/secondary/ghost/danger), card component, status/toast
  component, the AI prompt component, and a mobile layout for the room.
