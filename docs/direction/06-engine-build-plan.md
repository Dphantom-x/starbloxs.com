# 06 — Engine build plan (phased, test-gated)

How we build Option B (the pseudo-engine + rebuilt games + the create flow) in
small sections. **Every phase ends with (a) a Playwright e2e gate I run, and
(b) a manual smoke guide you click through.** We don't advance until both pass.
The demo (`DEMO_IDEAS.md` + `05-golden-path-demo.md`) is the north star — the
e2e specs are written to prove *that demo* is real.

Legend: **Build** = what gets written · **✅ Gate** = the Playwright spec ·
**🧪 Smoke** = your manual click-through · **Done-when** = exit criteria.

---

## Phase 0 — Engine proof-of-life (the plumbing)
The riskiest systems bit first: host computes → reducer writes → SpacetimeDB
syncs → every client renders.
- **Build:** `commit_entities(game_id, entities_json)` reducer (generic host
  write); a minimal engine runtime (`src/engine/`) that mounts Phaser, runs
  `onTick` (host only, fixed 30 Hz) + `onRender` (all clients); a trivial proof
  game (a box the host moves); a `/engine-test` route + a `window.__ENGINE__`
  debug surface. Engine entities use a `kind` the server tick ignores.
- **✅ Gate** (`e2e/engine0.spec.ts`): host context spawns a box; its `x`
  increases over time; a second context sees the same box at the same position
  (multiplayer sync).
- **🧪 Smoke:** open `/engine-test?host=1` and `/engine-test` in two windows → a
  box drifts across both in lockstep.
- **Done-when:** gate green; the host→sync→render loop is proven.

## Phase 1 — SDK surface (draw + input + players)
- **Build:** full draw API over Phaser Graphics (rect/circle/triangle/rounded/
  path/text/sprite/mask), input (keys + touch), players (me/list/join/leave),
  camera + FIT scaling.
- **✅ Gate** (`e2e/engine1.spec.ts`): a test game draws shapes and moves a
  player-box with arrow keys; assert keypress moves it and a 2nd player sees it.
- **🧪 Smoke:** drive the box with arrows in two windows; shapes render crisply.
- **Done-when:** gate green; the SDK can express arbitrary 2D games + input.

## Phase 2 — Rebuild Flappy v1 on the engine
- **Build:** `src/games/flappy.ts` — render (port `drawBird`/`drawSeg`/sky/
  ground from `FlappyScene.ts`) + host tick (port gravity/flap/multi-gap/
  forgiving-collision/scoring from the server `tick`) + game-over via shared
  state.
- **✅ Gate** (`e2e/engine2_flappy.spec.ts`): the `phase6` assertions, retargeted
  — gravity-from-rules, multi-gap pipes, bird collision, head-on death →
  game-over → restart.
- **🧪 Smoke:** play Flappy on the engine — flap through gaps, die on a wall,
  restart.
- **Done-when:** Flappy e2e green **on the engine** (not the old scene).

## Phase 3 — Flappy pixel-polish + the verification video
- **Build:** tune the rebuilt Flappy to visually match today's; wire Playwright
  `video: 'on'` for the Flappy spec; surface the latest `.webm` in the create UI.
- **✅ Gate** (`e2e/engine3_video.spec.ts`): Flappy spec passes **and** a `.webm`
  is produced in `test-results/`.
- **🧪 Smoke:** rebuilt vs. original Flappy side-by-side (identical); watch the
  captured test video.
- **Done-when:** pixel-match + a real recorded verification clip exists.

## Phase 4 — Rebuild Tank on the engine (second genre)
- **Build:** `src/games/tank.ts` — render (port `TankScene.ts`) + host tick
  (drive/axis-wall-collision/fire/bouncing-shells/maze/speed-pads/scoring).
- **✅ Gate** (`e2e/engine4_tank.spec.ts`): the `phase3`/`phase9` assertions,
  retargeted — fire→shell moves, hit→score, speed-pad buff.
- **🧪 Smoke:** play Tank — drive, fire, bounce a shell, score, hit a pad.
- **Done-when:** tank e2e green on the engine. *(Engine validated on 2 genres.)*

## Phase 5 — Game-file storage + publish + load-on-join (cross-device)
- **Build:** `game_code` table (stores each game's source); on publish, persist
  the file; on room-join, fetch + load it (transpile via `esbuild-wasm`/Babel →
  run against the SDK) — the dynamic-loader path. Host election (creator/first).
- **✅ Gate** (`e2e/engine5_publish.spec.ts`): context A publishes a game →
  context B loads the **stored file** and renders the same synced state.
- **🧪 Smoke:** publish a game; open it on your phone → it loads and you play
  together.
- **Done-when:** a published, AI-shaped game loads on a fresh client.

## Phase 6 — The create flow (DEMO 1)
- **Build:** `/api/create` multi-turn agent (real `generateText`+tools+`stopWhen`;
  **canned** conversational responder per game type incl. the forgiving-collision
  branch); the create UI state machine `idle → clarifying → confirmed → building
  (terminal shows the REAL game-file code) → testing (plays the verification
  video) → choose (publish / keep editing)`.
- **✅ Gate** (`e2e/engine6_create.spec.ts`): drive the canned conversation →
  terminal shows code → video shown → land in the room with the running rebuilt
  game.
- **🧪 Smoke:** the full DEMO 1 — prompt → Q&A → terminal → video → publish →
  play; join from your phone.
- **Done-when:** DEMO 1 e2e green end-to-end (canned path).

## Phase 7 — Live-edit climax (DEMO 2)  ✅ DONE (manhunt)
Shipped the **manhunt** edit: rebuilt Tank reads `api.config()` live, so speaking
"manhunt" is a config write (`set_engine_config` → `engine_config` table) the host
applies next tick. Render branches to the hunter POV (blacked-out map + flashlight
cone, runners only visible in the light); runners can't fire. The live edit goes
through the real *Edit with AI* panel (`EngineEditChat` → `cannedEdit` →
`setEngineConfig`). Gate `e2e/engine7_live.spec.ts` is green. (Dash-pads remain a
fallback; they're still in the tick.)
- **Build:** manhunt rendering in `tank.ts` (dark overlay + triangular flashlight
  mask + hunter highlight + sparks) gated by config; mechanic (runners can't
  fire; hunter-hit = win); the live edit = a config write the host applies next
  tick.
- **✅ Gate** (`e2e/engine7_live.spec.ts`): apply the manhunt (or dash-pad) edit
  live → assert role/vision applied + the overlay/mask elements render (or the
  pad buff works) → no reconnect, state preserved.
- **🧪 Smoke:** join the published Tank from 2 devices → speak the edit → it
  applies live for everyone mid-match, no interruption.
- **Done-when:** live-edit e2e green.

## Phase 8 — Cache the golden path + demo hardening  ✅ DONE
- **Build:** the verification video is pre-captured (`public/flappy-verification.webm`,
  played in the create flow); `DEMO_RUNBOOK.md` rewritten for the engine + manhunt
  demo; engine games render their genre everywhere (thumbnails, lobby tag, room
  controls hint, grid filter — via `genreOf()`).
- **✅ Gate** (`e2e/engine8_demo.spec.ts`): the full DEMO 1 + DEMO 2 runs green in
  canned/cached mode.
- **🧪 Smoke:** full dress rehearsal via the runbook.
- **Done-when:** the demo runs once, captured, stage-ready.

---

## Running things (per machine)
Engine phases add a reducer, so they need the **local** backend (or a cloud
republish to `starblox-prod`). For me: `spacetime start` + `npm run stdb:publish`
+ `npm run stdb:generate`, `.env.local` → local. For **your** manual smoke tests:
either install the SpacetimeDB CLI in your own terminal and run local, or I
republish the module to Maincloud so you can smoke-test the deployed site. Each
phase's 🧪 Smoke section notes the exact clicks.
