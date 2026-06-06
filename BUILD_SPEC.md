# BUILD SPEC — [NAME]: AI-Edited Multiplayer Game Platform on SpacetimeDB
*Hand this whole file to Claude Code as the project brief (rename to `CLAUDE.md` if you like). Build strictly phase by phase. Do not start a phase until the previous phase's automated tests AND manual smoke test pass. Maintain a `STATE.md` at the repo root and update it after every phase with what's done, what's verified, and what's next.*

---

## 0. HOW TO USE THIS DOC

- **Build in the numbered phases in Section 11.** Each phase is a vertical slice with (a) a clear goal, (b) exactly what to build, (c) Playwright tests you must write and pass, (d) manual smoke-test steps the human will run in a browser, (e) a "DONE WHEN" gate.
- **Confirm SpacetimeDB API specifics against the live docs before writing module code.** The TypeScript module API is from SpacetimeDB 2.x and a few signatures changed across versions. Where this doc says "VERIFY:", open the linked doc and match the exact current signature. **Pin versions** (CLI, `spacetimedb` npm package, and the host you publish to must be the same major/minor) — version mismatch is the #1 source of confusing errors.
- **Read these first** (canonical entry points, designed for AI consumption):
  - LLM-optimized full docs: https://spacetimedb.com/llms.txt
  - Docs home: https://spacetimedb.com/docs/
  - Key architecture: https://spacetimedb.com/docs/intro/key-architecture/
  - TypeScript module reference: https://spacetimedb.com/docs/modules/typescript/
  - TypeScript quickstart: https://spacetimedb.com/docs/quickstarts/typescript/
  - Cheat sheet (all syntax, all langs): https://spacetimedb.com/docs/databases/cheat-sheet/

---

## 1. WHAT WE'RE BUILDING

A Roblox-style, browser-based platform where multiplayer games are **created and edited by talking to an AI**. Players open a home menu, pick a game, and play with others in real time. Inside any game, a player can type a request in plain English ("make the tanks faster, give the loser a bouncing laser") and the **game's rules change live for every connected player, with no reload and no redeploy.** Two games ship for the demo: **Tank Trouble** (top-down maze tanks with bouncing shells) and a **multiplayer Flappy Bird** (shared pipe field, birds collide).

**Demo flow we are building toward:** Home menu → pick/launch a game → conversational AI edit hot-reloads mechanics for all players → switch to the second game to prove it generalizes → "create/remix your own."

---

## 2. NON-NEGOTIABLE ARCHITECTURE (do not deviate)

1. **Game logic is DATA-DRIVEN.** All game behavior (speeds, gravity, bounce counts, spawns, roles, win conditions) is read from a `game_rules` row at runtime. The AI never writes or recompiles code to change mechanics; it writes **validated config rows**. Changing a row → SpacetimeDB pushes it to every subscribed client → behavior changes instantly. This is the entire product thesis and the reason it must be on SpacetimeDB.
2. **SpacetimeDB is authoritative** for game rules, scoring, and server-ticked entity state (shell positions, collisions, scoring). Clients render and predict; they do not arbitrate truth.
3. **"Create a game" and "edit a game" are the SAME pipeline.** Create = instantiate a game template into a new `game_id` and set its config. Edit = update config on an existing `game_id`. Build ONE config pipeline, not two.
4. **The AI may ONLY emit values for keys in the Mechanic Library (Section 7).** It cannot invent new fields. Every output is schema-validated (Zod) and server-clamped before it touches the DB.
5. **Raw AI-generated code is allowed ONLY for client-only cosmetics** (particle presets, color skins) and must run sandboxed with no DB/network access. For the demo, prefer pre-built cosmetic presets the AI *selects* over generated code. If short on time, cut generated code entirely.

> Why this matters for judging: the hosts (Clockwork Labs) explicitly want SpacetimeDB "meaningfully used, not bolted on." In this design the game logic *is* reducers, the mechanics *are* tables, and multiplayer sync *is* subscriptions. Every demo sentence should name the SpacetimeDB primitive doing the work.

---

## 3. TECH STACK (exact)

- **Backend:** SpacetimeDB **TypeScript module** (runs on V8). One language end-to-end; config types shared between module, client, and validation. (Rust is faster but unnecessary at our entity counts; only port the tick hot-path to Rust if profiling later demands it.)
- **Frontend:** **Next.js (App Router) + React + TypeScript.** Chosen over plain Vite because the LLM call needs a server-side endpoint to hide the Anthropic API key, and Next.js gives that via a route handler with zero extra infra and deploys cleanly to Vercel. (Alt: Vite + Vercel serverless `/api` functions — acceptable, but Next.js is lower-friction.)
- **Game rendering:** **Phaser 3** (Arcade physics, input, scenes, tweens, particles). Mount inside a client component via `next/dynamic` with `{ ssr: false }` — Phaser is browser-only and must not be server-rendered.
- **SpacetimeDB client:** `spacetimedb` npm package (TypeScript SDK + module library in one) — https://www.npmjs.com/package/spacetimedb. React hooks at the `spacetimedb/react` subpath (StrictMode-safe, single WebSocket).
- **LLM edit layer:** **Vercel AI SDK** `generateObject` + **Zod** schema + **Anthropic Claude (Sonnet)**. `generateObject` validates model output against the Zod schema and returns a typed object.
- **Styling:** Tailwind CSS.
- **Tests:** Playwright (e2e + multiplayer), Vitest (unit, for the Zod validation/mechanic layer).
- **Hosting:** Frontend on **Vercel**; backend on **SpacetimeDB Maincloud**.
- **CLI install:** `curl -sSf https://install.spacetimedb.com | sh` (macOS/Linux) or `iwr https://windows.spacetimedb.com -useb | iex` (Windows PowerShell). Then `spacetime login` (GitHub auth).

---

## 4. SPACETIMEDB PRIMITIVES WE USE (with doc links)

- **Tables** — relational tables held in memory and persisted to disk. `public: true` tables are subscribable by clients; default is private (server-only). All writes go through reducers. Docs: https://spacetimedb.com/docs/modules/typescript/
- **Reducers** — atomic, transactional, deterministic functions; the ONLY way to write. **They do not return data to the caller** — clients read via subscriptions. No `fetch`/`fs`/timers/`Math.random` (use `ctx.rng`). Throw to roll back the whole transaction. Docs: https://spacetimedb.com/docs/functions/reducers/ and context: https://spacetimedb.com/docs/functions/reducers/reducer-context/
- **Subscriptions** — clients subscribe to public tables (SQL or query builder) and receive pushed `onInsert/onUpdate/onDelete` callbacks into a local cache. Reads after subscribe are local/instant.
- **Scheduled reducers (our game loop)** — a schedule table drives a reducer at a fixed interval (e.g. ~30Hz). VERIFY exact wiring: https://spacetimedb.com/docs/tables/schedule-tables/
- **Lifecycle reducers** — `init` (first publish / after data wipe — seed default rows here), `client_connected`, `client_disconnected` (spawn/despawn player rows). VERIFY exact registration syntax in the TS module reference.
- **Identity** — every reducer call carries the caller's `Identity` (`ctx.sender`). Anonymous identities are fine for the demo (token in `localStorage`); never trust an identity passed as an argument. Docs: https://spacetimedb.com/docs/intro/key-architecture/

### Gotchas (bake these in)
- **Tree-shaking:** if a reducer is imported on the client but never used to set a callback, the bundler may drop it and subscriptions break. Use the explicit reducer `.call(...)` form and reference reducers you depend on.
- **Republish hot-swaps without disconnecting clients**, BUT auto-migration only allows *adding* tables and *adding nullable/default columns at the end*. Reordering columns / changing types / adding unique or PK constraints is breaking and needs `--delete-data`. → **Design `game_rules` columns up front; iterate via row data, not schema churn.** Never run `--delete-data` on stage.
- **Database names are global on Maincloud** — pick a unique name or you'll hit an auth error.
- **`bigint` for u64:** scheduled IDs and u64 PKs are JS `bigint` (`0n`, `33_000n`). Don't mix with `number`.
- **No built-in client prediction** — you implement interpolation (remote entities) and prediction (local player) yourself.

---

## 5. DATA MODEL (tables)

> Syntax below matches the SpacetimeDB 2.x TS module API: `import { schema, table, t } from 'spacetimedb/server';`. **VERIFY** column-type helpers and the reducer registration form against https://spacetimedb.com/docs/modules/typescript/ before relying on them. All gameplay rows carry `game_id` so one Maincloud database hosts many concurrent game instances ("rooms") — this is simpler than per-match databases and sufficient for the demo.

```ts
import { schema, table, t } from 'spacetimedb/server';

// A live game instance ("room"). One per match.
const game = table(
  { name: 'game', public: true },
  {
    game_id:   t.u64().primaryKey().autoInc(),
    game_type: t.string(),            // 'tanks' | 'flappy'
    name:      t.string(),
    owner:     t.identity(),          // VERIFY identity column helper name
    created_at: t.timestamp(),        // VERIFY timestamp helper
    status:    t.string(),            // 'lobby' | 'active' | 'ended'
  }
);

// One row per game instance holding ALL globally-tunable mechanics.
// The tick + movement reducers READ from here every frame.
const game_rules = table(
  { name: 'game_rules', public: true },
  {
    game_id:            t.u64().primaryKey(),   // 1:1 with game
    game_type:          t.string(),
    // ---- shared ----
    player_speed:       t.f32(),   // global multiplier, 1 = normal
    win_score:          t.u32(),
    map_seed:           t.u64(),
    // ---- tanks ----
    projectile_bounces: t.u8(),
    projectile_speed:   t.f32(),
    fire_cooldown_ms:   t.u32(),
    damage:             t.u32(),
    // ---- flappy ----
    gravity:            t.f32(),
    field_height:       t.f32(),
    gaps_per_pipe:      t.u8(),
    pipe_gap:           t.f32(),
    pipe_speed:         t.f32(),
    bird_collision:     t.bool(),
    // ---- meta ----
    updated_by:         t.identity(),
    updated_at:         t.timestamp(),
  }
);

// Spatial map features the AI can place (boost zones, etc). JSON-encoded list per game.
const map_features = table(
  { name: 'map_features', public: true },
  {
    game_id:  t.u64().primaryKey(),
    features: t.string(),   // JSON: [{kind:'boost', x,y,w,h, dir:[dx,dy], strength}]
  }
);

// Per-player state + per-player overrides the AI can set (slow tank, hunter role, vision).
const player = table(
  { name: 'player', public: true },
  {
    identity:  t.identity().primaryKey(),
    game_id:   t.u64().index('btree'),
    name:      t.string(),
    role:      t.string(),     // 'normal' | 'hunter' | 'runner'
    speed_override: t.f32(),    // 0 = use global
    weapon:    t.string(),      // 'normal' | 'laser'
    vision_radius: t.f32(),     // 0 = full map; >0 = fog reveal radius
    score:     t.u32(),
    alive:     t.bool(),
  }
);

// High-frequency authoritative entity state (tanks, birds, shells). Kept NARROW
// and SEPARATE from game_rules so 30Hz position writes don't spam rules subscribers.
const entity = table(
  { name: 'entity', public: true },
  {
    entity_id: t.u64().primaryKey().autoInc(),
    game_id:   t.u64().index('btree'),
    kind:      t.string(),   // 'tank' | 'bird' | 'shell' | 'pipe'
    owner:     t.identity(), // VERIFY nullable identity for non-player entities
    x: t.f32(), y: t.f32(),
    vx: t.f32(), vy: t.f32(),
    angle: t.f32(),
    data: t.string(),        // JSON for kind-specific fields (bounces_left, gap_centers, etc.)
  }
);

// The game-loop schedule table (drives the tick reducer). VERIFY against schedule-tables doc.
const tick_schedule = table(
  { name: 'tick_schedule', public: false },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    // scheduled_at: ScheduleAt  -- VERIFY exact field type/registration in docs
  }
);

const spacetimedb = schema({ game, game_rules, map_features, player, entity, tick_schedule });
export default spacetimedb;
```

---

## 6. REDUCERS (signatures + behavior)

> **VERIFY** the registration form. In 2.x it is either `spacetimedb.reducer('name', argsSchema, handler)` or `export const name = spacetimedb.reducer(argsSchema, handler)`. Use whichever the current TS reference shows; keep names snake_case.

- `init()` *(lifecycle)* — seed nothing global; defaults are written on game creation.
- `client_connected(ctx)` / `client_disconnected(ctx)` *(lifecycle)* — VERIFY; despawn the player's entities and remove/flag their `player` row on disconnect.
- `create_game(ctx, { game_type, name })` — insert a `game` row, insert a default `game_rules` row for that `game_type` (use a defaults map), insert default `map_features` (`[]`). Returns nothing; client subscribes to see it.
- `join_game(ctx, { game_id, name })` — insert/update a `player` row for `ctx.sender` in that game; spawn their entity (tank/bird).
- `set_input(ctx, { game_id, up, down, left, right, fire })` — record the caller's current input on their `player`/`entity` row (the tick reducer consumes it). Local prediction happens client-side.
- `tick(ctx)` *(scheduled, ~30Hz)* — the game loop. Guard: only run if `ctx.sender == module identity` (VERIFY how to check). For each active game: read `game_rules` + `map_features` + `player` overrides, advance entities (tank movement w/ per-player speed, shell motion + wall bounces up to `projectile_bounces`, bird gravity from `gravity`, pipe scroll, collisions, scoring, win check). Write updated `entity` rows.
- `apply_rules_patch(ctx, { game_id, patch /* JSON string */ })` — **the heart.** Parse the already-Zod-validated patch, then **whitelist + clamp every field server-side** (defense in depth: e.g. `player_speed` ∈ [0.25,4], `projectile_bounces` ∈ [0,10]), update the `game_rules` row, set `updated_by`/`updated_at`. May also update `map_features` (add boost zones) and per-`player` overrides (assign hunter, set vision_radius, set weapon). Subscribers receive the change instantly.
- `reset_game(ctx, { game_id })` — restore default rules for the game's type (for re-running the demo cleanly without `--delete-data`).

---

## 7. THE MECHANIC LIBRARY (the contract)

This is the fixed universe of legal edits. **The Zod schema, the server-side clamps, and the LLM tool definition all derive from this one list.** Build it first; everything references it. For the demo prompts, you need exactly these:

| Key | Scope | Type / Range | Applies to | Meaning |
|---|---|---|---|---|
| `player_speed` | global | f32, 0.25–4 | all | movement speed multiplier |
| `win_score` | global | int, 1–100 | all | score to win |
| `projectile_bounces` | global | int, 0–10 | tanks | shell wall bounces |
| `projectile_speed` | global | f32, 0.5–3 | tanks | shell speed multiplier |
| `fire_cooldown_ms` | global | int, 100–3000 | tanks | shoot cooldown |
| `gravity` | global | f32, 0.2–3 | flappy | gravity multiplier |
| `field_height` | global | f32, 1–3 | flappy | playfield height multiplier (taller) |
| `gaps_per_pipe` | global | int, 1–5 | flappy | number of safe gaps per pipe column |
| `pipe_gap` | global | f32, 0.5–2 | flappy | gap size multiplier |
| `pipe_speed` | global | f32, 0.5–3 | flappy | scroll speed multiplier |
| `bird_collision` | global | bool | flappy | birds collide with each other |
| `speed_override` (per player) | player | f32, 0.25–4 | tanks | one tank slower/faster than rest |
| `weapon` (per player) | player | enum: normal\|laser | tanks | special weapon for a player |
| `role` (per player) | player | enum: normal\|hunter\|runner | tanks | manhunt roles |
| `vision_radius` (per player) | player | f32, 0=full else 2–10 | tanks | fog: reveal radius (use a radius, NOT raycast LOS) |
| `boost_zones` (spatial) | map | list of {x,y,w,h,dir,strength} | tanks | directional speed strips |
| `wall_graze_sparks` (cosmetic) | client | bool | tanks | particle burst on wall contact |

> **Scope honesty:** the AI configures and recombines these pre-built mechanics. It does NOT invent new game types or novel mechanics live. If a prompt asks for something not in this table, the validation layer rejects it gracefully ("I can't do that one yet"). Keep live judge-prompts within these keys.

---

## 8. FRONTEND STRUCTURE

```
app/
  page.tsx                 // HOME MENU (Roblox-style game grid) — Phase 1
  game/[gameId]/page.tsx   // GAME ROOM (canvas + chat + QR) — Phases 3+
  api/edit/route.ts        // server-side LLM endpoint (hides API key) — Phase 5
components/
  GameGrid.tsx             // list of available games / "create" tile
  GameCanvas.tsx           // dynamic(ssr:false) Phaser mount
  EditChat.tsx             // prompt box -> /api/edit -> apply_rules_patch
  RoomQR.tsx               // QR to the room URL for phone join
  DemoControls.tsx         // "demo mode" buttons w/ cached prompts (hardening)
lib/
  spacetime.ts             // connection, identity (localStorage), subscriptions
  mechanics.ts             // THE Mechanic Library + Zod schema (Section 7)
  testHooks.ts             // window.__APP__ debug surface (Section 10)
game/
  TankScene.ts             // Phaser scene, reads rules/entities from STDB cache
  FlappyScene.ts
  net.ts                   // interpolation (remote) + prediction (local)
```

- **Connection & identity:** on load, connect to STDB (local in dev, Maincloud in prod via `https://maincloud.spacetimedb.com` + db name), restore/create anonymous identity from `localStorage`. Subscribe filtered by the current `game_id` (e.g. `SELECT * FROM entity WHERE game_id = X`).
- **Render loop:** Phaser reads the STDB local cache each frame. Remote entities are interpolated toward their latest server position (`Phaser.Math.Linear(cur, target, 0.2)`); the local player is predicted immediately on input and reconciled when authoritative state arrives.
- **Rules are reactive:** subscribe to the `game_rules` row; on `onUpdate`, re-read mechanics live (no reload). This is the hot-reload.

---

## 9. LLM EDIT PIPELINE

- **Endpoint:** `app/api/edit/route.ts` (server-side; Anthropic key in env, never shipped to browser).
- **Flow:** prompt + `game_type` + current player list → `generateObject({ model: anthropic('claude-sonnet-...'), schema: RulesPatchSchema, prompt })` → returns typed patch → re-validate with Zod (`.parse`) → on failure, re-prompt once with the validation error appended → on second failure return a friendly rejection → on success, client calls `apply_rules_patch(game_id, JSON.stringify(patch))`.
- **Zod schema** is generated from `mechanics.ts`. Every field `.optional()` and `.describe()`d with its meaning and range (descriptions measurably improve accuracy). Enforce enums and numeric `min`/`max` in Zod — the model can emit out-of-enum values or `3.0` for an int.

```ts
// lib/mechanics.ts (excerpt)
export const RulesPatchSchema = z.object({
  player_speed: z.number().min(0.25).max(4).optional()
    .describe('Global movement speed multiplier; 1 = normal'),
  projectile_bounces: z.number().int().min(0).max(10).optional()
    .describe('How many times tank shells bounce off walls'),
  gravity: z.number().min(0.2).max(3).optional()
    .describe('Flappy gravity multiplier; 1 = normal'),
  gaps_per_pipe: z.number().int().min(1).max(5).optional()
    .describe('Number of safe gaps in each Flappy pipe column'),
  field_height: z.number().min(1).max(3).optional(),
  bird_collision: z.boolean().optional(),
  win_score: z.number().int().min(1).max(100).optional(),
  per_player: z.array(z.object({
    target: z.enum(['random','loser','leader','all_others']),
    speed_override: z.number().min(0.25).max(4).optional(),
    weapon: z.enum(['normal','laser']).optional(),
    role: z.enum(['normal','hunter','runner']).optional(),
    vision_radius: z.number().min(0).max(10).optional(),
  })).optional(),
  boost_zones: z.array(z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    dir: z.tuple([z.number(), z.number()]),
    strength: z.number().min(1).max(3),
  })).optional(),
  wall_graze_sparks: z.boolean().optional(),
}).strict();
```

- **Demo/test mode:** when `VITE_TEST_MODE`/`?test=1` is set, `/api/edit` returns a **canned patch** keyed by the prompt (no live model call) so Playwright is deterministic and the on-stage fallback is instant. (Section 13.)

- LLM-in-module alternative (Procedures, beta — NOT recommended for the demo): the module itself can call an LLM via `ctx.http.fetch`. Slower to debug and beta. Keep the call on the Next.js edge instead. Docs if curious: https://spacetimedb.com/docs/functions/procedures/

---

## 10. TESTABILITY CONVENTIONS (critical — read before Phase 0)

Phaser renders to a `<canvas>` that Playwright cannot inspect by reading pixels. So we expose a **debug surface** in dev/test builds:

```ts
// lib/testHooks.ts — only mounted when NEXT_PUBLIC_TEST_MODE === '1'
window.__APP__ = {
  connected: () => boolean,
  identity: () => string,
  currentGameId: () => string | null,
  getRules: () => Record<string, unknown>,     // current game_rules row
  getEntities: () => Array<{entity_id,kind,x,y,owner,...}>,
  getPlayers: () => Array<{identity,role,speed_override,score,alive}>,
  callReducer: (name: string, args: object) => Promise<void>,
  forceEdit: (patchJson: string) => Promise<void>, // bypass LLM, apply patch directly
};
```

Playwright then asserts on real synced state:
```ts
const rules = await page.evaluate(() => window.__APP__.getRules());
expect(rules.player_speed).toBeCloseTo(2);
```

**Multiplayer is tested with two browser contexts** (this is exactly how you prove sync):
```ts
test('rules edit propagates to all players', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`${BASE}/game/${gid}?test=1`);
  await b.goto(`${BASE}/game/${gid}?test=1`);
  await a.waitForFunction(() => window.__APP__.connected());
  await b.waitForFunction(() => window.__APP__.connected());

  // edit on A
  await a.evaluate(() => window.__APP__.forceEdit(JSON.stringify({ player_speed: 2 })));

  // B sees it (pushed via subscription)
  await b.waitForFunction(() => window.__APP__.getRules().player_speed === 2);
});
```

Rules: every phase ships its Playwright spec(s) in `e2e/`. The mechanic/Zod layer gets Vitest unit tests in `lib/__tests__/`. Tests must pass headless in CI-style (`npx playwright test`). Never make a test depend on a live LLM call — use `forceEdit` or canned `/api/edit`.

---

## 11. BUILD PHASES

> Order is chosen so each phase is independently testable and the sequence mirrors the demo (home → game → edit → second game → cross-device). After each phase: run its Playwright spec, do the manual smoke test, update `STATE.md`, commit.

### PHASE 0 — Scaffold & connection
**Goal:** A Next.js app that connects to a local SpacetimeDB module and reads one table.
**Build:** `spacetime dev --template basic-ts` (or `spacetime init --lang typescript`) to scaffold module + bindings; create the Next.js app; `lib/spacetime.ts` connects, restores anonymous identity from `localStorage`, subscribes to a trivial `game` table; mount `window.__APP__` test hooks. Pin `spacetimedb` package version == CLI version.
**Playwright:** app loads; `window.__APP__.connected()` becomes true; `getEntities()` returns `[]` without error.
**Manual smoke:** `spacetime dev` running; open localhost; DevTools console shows "connected" and an identity string; no red errors.
**DONE WHEN:** both pass and `spacetime logs` shows the client connecting.

### PHASE 1 — Home menu (Roblox-style)
**Goal:** The landing grid that lists games and a "Create" tile. Routing only; no gameplay.
**Build:** `app/page.tsx` + `GameGrid.tsx`. Read the `game` table (seed 2 demo rows: a Tank game and a Flappy game via `create_game`). Clicking a tile routes to `/game/[gameId]`. A "Create with AI" tile routes to a create flow (stubbed for now).
**Playwright:** home renders ≥2 game cards; clicking a card navigates to `/game/{id}`; the create tile is visible and clickable.
**Manual smoke:** open home → see the two game cards with names → click "Tank" → URL changes to the room route (blank room is fine here).
**DONE WHEN:** navigation works for both cards and the create tile.

### PHASE 2 — Multiplayer vertical slice (THE proof)
**Goal:** Two browsers in the same room see each other's avatars move in real time. No game yet — just synced movement squares.
**Build:** `join_game` + `set_input` reducers; a minimal `tick` scheduled reducer that integrates position from input; subscribe to `entity WHERE game_id`; render each entity as a square in Phaser; interpolate remote squares, predict the local one.
**Playwright (two contexts):** A and B join same `game_id`; A presses right (`callReducer('set_input', {right:true})`); assert in B that A's entity `x` increases; assert A's own entity moves immediately (prediction).
**Manual smoke:** open the room in two windows side by side; arrow-key one; watch it move in the other within a frame or two; movement feels smooth, not teleporty.
**DONE WHEN:** cross-window movement is visible and the Playwright two-context test passes. *(If you only had 12 hours, this slice + one edit is already a winning SpacetimeDB demo.)*

### PHASE 3 — Tank game playable
**Goal:** Real Tank Trouble: maze, driving, firing, bouncing shells, hits — all reading hard-coded constants for now (rules wired in Phase 4).
**Build:** `TankScene.ts` (maze from `map_seed`, tank sprite, turret aim); shells as `entity` rows; bounce math + wall collision + hit detection in `tick`; respawn/score. Interpolate remote tanks & shells.
**Playwright:** spawn 2 tanks; fire (`callReducer('set_input',{fire:true})`); assert a `shell` entity appears, its position changes over ticks, and a hit reduces a player's `alive`/increments `score`.
**Manual smoke:** drive both tanks; shoot; shells bounce off walls; hitting the other tank registers; scoreboard updates.
**DONE WHEN:** a full tank round is playable across two windows and the shell/hit test passes.

### PHASE 4 — Data-driven rules (no AI yet)
**Goal:** All tank behavior reads from the `game_rules` row; changing the row changes the game live.
**Build:** replace constants in `tick`/movement with reads from `game_rules` (+ per-`player` overrides + `map_features`). Implement `apply_rules_patch` with server-side clamps. Subscribe to the rules row on the client and re-read on `onUpdate`.
**Playwright:** with 2 tanks running, `forceEdit({player_speed:2})`; assert both clients' `getRules().player_speed===2` AND that tank displacement per second roughly doubles; `forceEdit({projectile_bounces:5})`; assert a fired shell bounces more than before. Out-of-range patch (`player_speed:999`) is clamped to 4.
**Manual smoke:** in two windows, use a temporary debug button to set speed×2 — both tanks speed up at the same instant, no reload.
**DONE WHEN:** rules changes propagate to all clients live and clamps hold. **This proves the hot-reload before any LLM exists.**

### PHASE 5 — AI edit pipeline
**Goal:** Plain-English prompt → validated config → live change for all players.
**Build:** `lib/mechanics.ts` (Mechanic Library + `RulesPatchSchema`); `app/api/edit/route.ts` (`generateObject` + Claude + Zod validate/retry; canned responses when `TEST_MODE`); `EditChat.tsx` wires prompt → `/api/edit` → `apply_rules_patch`. Resolve `per_player.target` ('loser'/'leader'/'random'/'all_others') against the live scoreboard server-side.
**Vitest:** feed fixture prompts/JSON to the validator; valid patches pass, malformed/out-of-enum patches are rejected or clamped; retry path covered.
**Playwright (two contexts, canned `/api/edit`):** type "make everyone twice as fast and shells bounce 5 times" in A; assert B's `getRules()` shows `player_speed≈2, projectile_bounces=5`.
**Manual smoke:** with live Claude, type a real sentence in one window; watch both windows change; try a nonsense request and confirm a graceful "can't do that yet."
**DONE WHEN:** real prompts produce valid live edits across windows, and invalid prompts fail safely.

### PHASE 6 — Multiplayer Flappy Bird
**Goal:** Second game on the SAME pipeline, proving generalization.
**Build:** `FlappyScene.ts`; birds as `entity` rows (gravity + flap impulse in `tick`, all from `game_rules`); pipe columns generated with `gaps_per_pipe` safe gaps and `field_height`; bird-bird collision (pairwise in `tick`, bounce on contact) gated by `bird_collision`; scoring on pipe pass; same `apply_rules_patch` edits it.
**Playwright:** 2 birds join; assert gravity from rules affects fall; set `gaps_per_pipe:3` and assert pipe entities expose 3 gap centers; enable `bird_collision` and assert two overlapping birds bounce apart.
**Manual smoke:** two windows flap through a tall, multi-gap field; birds bump each other; then edit "lower gravity, widen gaps" and both react live.
**DONE WHEN:** Flappy is playable across windows and AI edits work on it with zero new pipeline code.

### PHASE 7 — Create / remix flow
**Goal:** "Make a game by talking" and "make someone else's game your own."
**Build:** create flow: a prompt → AI picks `game_type` + initial `RulesPatch` → `create_game` then `apply_rules_patch` on the new `game_id` (reuses everything). Remix: a "Make it mine" button clones a game's rules into a new `game_id` owned by the caller.
**Playwright (canned):** creation prompt "multiplayer flappy, tall, 3 gaps, birds collide" yields a new `game` row with `game_type='flappy'` and rules `gaps_per_pipe=3, field_height>1, bird_collision=true`. Remix produces a new `game_id` with copied rules.
**Manual smoke:** from home, "Create with AI", type the flappy sentence, get dropped into a working game matching it; open an existing tank game, "Make it mine", edit it without affecting the original.
**DONE WHEN:** both flows produce correct new game instances.

### PHASE 8 — Deploy, cross-device, QR, demo-mode
**Goal:** Live on the internet, joinable from a phone, demo-hardened.
**Build:** publish module to Maincloud (`spacetime publish --server maincloud <unique-name>` — VERIFY flag against CLI ref); point the prod client at `https://maincloud.spacetimedb.com` + db name via env; deploy frontend to Vercel with `ANTHROPIC_API_KEY` set; `RoomQR.tsx` renders a QR to the room URL (`/game/{id}`); `DemoControls.tsx` exposes buttons that call `forceEdit` with the cached demo patches (instant, network-independent). Add a `reset_game` button.
**Playwright (against the deployed URL):** load prod home; create/join a room; second context (different storage state) joins same room and sees shared entities.
**Manual smoke:** on the laptop open the deployed URL and start a tank game; scan the QR with your phone (on cellular); confirm the phone joins the SAME match and both move; run a `DemoControls` button and watch laptop + phone change together; verify the two-windows-on-laptop fallback also works with the phone off.
**DONE WHEN:** a real phone joins a real match over the internet, AI edits sync to both, and the cached-prompt fallback fires instantly.

---

## 12. DEPLOYMENT & CROSS-DEVICE (reference)

- **Publish backend:** `spacetime login` then `spacetime publish --server maincloud <unique-name>`. Updating = same command; it hot-swaps without disconnecting clients. Manage at `https://spacetimedb.com/@<username>/<db-name>`. Docs: https://spacetimedb.com/docs/how-to/deploy/maincloud/ and CLI: https://spacetimedb.com/docs/cli-reference/
- **Connect prod client:** host `https://maincloud.spacetimedb.com`, module name = your db name.
- **Cross-device truth:** every device that loads the Vercel URL connects directly to the same Maincloud database — laptop on Wi-Fi + phone on 5G are in the same match. No local server, no tunneling.
- **Rooms:** one database, many `game_id`s; clients subscribe filtered by `game_id`. (Production alternative is one database per match via orchestration — overkill here.)
- **Free tier note:** scales to zero when idle (≈sub-second resume) — pre-warm before demoing. Names are global — keep yours unique.

---

## 13. DEMO-DAY HARDENING CHECKLIST

- [ ] Run each exact demo prompt once the morning of; confirm it produces valid config; save the JSON into `DemoControls` cached patches.
- [ ] `DemoControls` buttons call `forceEdit(cachedJson)` so a slow/失败 LLM or bad Wi-Fi never strands you. Trigger this path if `/api/edit` exceeds ~3s.
- [ ] Pre-warm Maincloud (open the app) right before going on stage.
- [ ] Have two laptop browser windows ready as the no-network fallback.
- [ ] `reset_game` between run-throughs (never `--delete-data` on stage).
- [ ] Rehearse the silent ~1s beat after firing a prompt — let the room watch both screens flip together.

---

## APPENDIX — SpacetimeDB doc links (verified)

- LLM-optimized docs: https://spacetimedb.com/llms.txt
- Docs home: https://spacetimedb.com/docs/
- Key architecture: https://spacetimedb.com/docs/intro/key-architecture/
- TypeScript module reference: https://spacetimedb.com/docs/modules/typescript/
- TypeScript quickstart: https://spacetimedb.com/docs/quickstarts/typescript/
- Reducers: https://spacetimedb.com/docs/functions/reducers/
- Reducer context: https://spacetimedb.com/docs/functions/reducers/reducer-context/
- Schedule tables (game loop): https://spacetimedb.com/docs/tables/schedule-tables/
- Cheat sheet: https://spacetimedb.com/docs/databases/cheat-sheet/
- CLI reference: https://spacetimedb.com/docs/cli-reference/
- Deploy to Maincloud: https://spacetimedb.com/docs/how-to/deploy/maincloud/
- FAQ (migrations, hosting, gotchas): https://spacetimedb.com/docs/intro/faq/
- Procedures (LLM-in-module, beta): https://spacetimedb.com/docs/functions/procedures/
- SpacetimeAuth (if you add real accounts): https://spacetimedb.com/docs/spacetimeauth/creating-a-project/
- TS SDK npm: https://www.npmjs.com/package/spacetimedb
- TS SDK repo: https://github.com/clockworklabs/spacetimedb-typescript-sdk
- Main repo (README, tutorials list): https://github.com/clockworklabs/SpacetimeDB
- CLI install: `curl -sSf https://install.spacetimedb.com | sh`
