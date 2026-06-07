/*
 * Blox — data-driven multiplayer game module.
 *
 * Design rule (from BUILD_SPEC §4): the SCHEMA below is frozen up-front so we
 * iterate via row DATA, never schema churn (auto-migration only allows adding
 * tables / nullable-default columns at the end). Reducers are added phase by
 * phase; the schema does not change again.
 *
 * Verified against SpacetimeDB 2.4.1:
 *  - import from 'spacetimedb/server'; ScheduleAt from 'spacetimedb'
 *  - server ctx.db + columns are snake_case (default CASE_CONVERSION_POLICY)
 *  - lifecycle/reducers MUST be `export const`; module identity = ctx.databaseIdentity
 *  - RNG is ctx.random(); u64 columns are bigint (use 0n)
 */
import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
  type InferSchema,
} from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// A live game instance ("room"). One row per match.
const game = table(
  { name: 'game', public: true },
  {
    game_id: t.u64().primaryKey().autoInc(),
    game_type: t.string(), // 'tanks' | 'flappy'
    name: t.string(),
    owner: t.identity(),
    created_at: t.timestamp(),
    status: t.string(), // 'lobby' | 'active' | 'ended'
  }
);

// One row per game holding ALL globally-tunable mechanics. The tick + movement
// reducers READ from here every frame; apply_rules_patch WRITES here.
const game_rules = table(
  { name: 'game_rules', public: true },
  {
    game_id: t.u64().primaryKey(), // 1:1 with game
    game_type: t.string(),
    // ---- shared ----
    player_speed: t.f32(), // global multiplier, 1 = normal
    win_score: t.u32(),
    map_seed: t.u64(),
    // ---- tanks ----
    projectile_bounces: t.u32(),
    projectile_speed: t.f32(),
    fire_cooldown_ms: t.u32(),
    damage: t.u32(),
    // ---- flappy ----
    gravity: t.f32(),
    field_height: t.f32(),
    gaps_per_pipe: t.u32(),
    pipe_gap: t.f32(),
    pipe_speed: t.f32(),
    bird_collision: t.bool(),
    // ---- meta ----
    updated_by: t.identity(),
    updated_at: t.timestamp(),
  }
);

// Spatial map features the AI can place (boost zones, etc). JSON list per game.
const map_features = table(
  { name: 'map_features', public: true },
  {
    game_id: t.u64().primaryKey(),
    features: t.string(), // JSON: { walls: [[x1,y1,x2,y2],...], boost_zones: [...] }
  }
);

// Per-player state + per-player overrides the AI can set.
const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    game_id: t.u64().index('btree'),
    name: t.string(),
    role: t.string(), // 'normal' | 'hunter' | 'runner'
    speed_override: t.f32(), // 0 = use global
    weapon: t.string(), // 'normal' | 'laser'
    vision_radius: t.f32(), // 0 = full map; >0 = fog reveal radius
    score: t.u32(),
    alive: t.bool(),
  }
);

// High-frequency authoritative entity state (tanks, birds, shells, pipes).
// Kept NARROW and SEPARATE from game_rules so 30Hz writes don't spam rules subs.
const entity = table(
  { name: 'entity', public: true },
  {
    entity_id: t.u64().primaryKey().autoInc(),
    game_id: t.u64().index('btree'),
    kind: t.string(), // 'tank' | 'bird' | 'shell' | 'pipe'
    owner: t.option(t.identity()), // null for non-player entities (shells reference firer, pipes null)
    x: t.f32(),
    y: t.f32(),
    vx: t.f32(),
    vy: t.f32(),
    angle: t.f32(),
    data: t.string(), // JSON for kind-specific fields (bounces_left, gap_centers, ...)
  }
);

// Option B engine: per-player input for engine games. Clients write their own
// row; the host reads everyone's. Kept SEPARATE from entity so host commits
// never clobber inputs (and vice-versa).
const engine_input = table(
  { name: 'engine_input', public: true },
  {
    identity: t.identity().primaryKey(),
    game_id: t.u64().index('btree'),
    input: t.string(), // JSON { up, down, left, right, fire }
  }
);

// Option B engine: per-game LIVE config (manhunt mode + tunable knobs). An edit
// writes this row; the host reads it each tick → applied for every player with no
// redeploy. This is what makes DEMO 2's live-remix work on engine games.
const engine_config = table(
  { name: 'engine_config', public: true },
  {
    game_id: t.u64().primaryKey(),
    config: t.string(), // JSON
  }
);

// Game-loop schedule table (drives the tick reducer).
const tick_schedule = table(
  {
    name: 'tick_schedule',
    scheduled: (): any => tick, // (): any => avoids the circular reference to `tick`
  },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  }
);

const spacetimedb = schema({
  game,
  game_rules,
  map_features,
  player,
  entity,
  engine_input,
  engine_config,
  tick_schedule,
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

// ---------------------------------------------------------------------------
// Field + gameplay constants (Phase 2/3). Phase 4 reads tunables from game_rules.
// ---------------------------------------------------------------------------
const FIELD_W = 800;
const FIELD_H = 600;
const TICK_DT = 1 / 30; // seconds; matches the ~30Hz schedule
const BASE_SPEED = 185; // tank drive speed px/s (eased down for the maze)
const TANK_R = 11; // smaller tanks fit the tighter maze
const SHELL_R = 4;
const SHELL_SPEED = 330;
const FIRE_COOLDOWN_MS = 600;
const MAX_BOUNCES = 2; // projectile_bounces default (Phase 4 reads from rules)
const WALL_HALF = 4; // half wall thickness for collision
const GRACE_TICKS = 8; // a shell can't hit its own firer for this many ticks
// Central open arena kept clear of maze walls; tanks spawn here.
const ARENA = { x0: 255, y0: 185, x1: 545, y1: 415 };

// ---- flappy constants (Phase 6) ----
const FLAPPY_BASE_H = 600; // world height at field_height = 1
const BIRD_R = 14;
const BIRD_X0 = 150; // birds hold near this x
const GRAVITY_BASE = 1300; // px/s^2 at gravity = 1
const FLAP_IMPULSE = 430; // px/s upward per flap
const PIPE_W = 70;
const PIPE_SPEED_BASE = 150; // px/s scroll at pipe_speed = 1
const GAP_BASE = 165; // px gap height at pipe_gap = 1
const PIPE_SPACING = 300;
const NUM_PIPES = 4;
const PIPE_START_X = 850;

type Wall = [number, number, number, number]; // axis-aligned x1,y1,x2,y2

type Input = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};
const NO_INPUT: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
};

// Deterministic PRNG: the same map_seed always yields the same maze, generated
// once at creation and stored so server collision and client render agree.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let tt = Math.imul(a ^ (a >>> 15), 1 | a);
    tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt;
    return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296;
  };
}

/** Does an axis-aligned wall segment intersect the rect [x0,y0,x1,y1]? */
function segHitsRect(
  w: Wall,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  if (w[0] === w[2]) {
    const x = w[0];
    const lo = Math.min(w[1], w[3]);
    const hi = Math.max(w[1], w[3]);
    return x >= x0 && x <= x1 && hi >= y0 && lo <= y1;
  }
  const y = w[1];
  const lo = Math.min(w[0], w[2]);
  const hi = Math.max(w[0], w[2]);
  return y >= y0 && y <= y1 && hi >= x0 && lo <= x1;
}

/** A connected corridor maze (recursive backtracker) with a clear central
 *  combat zone. Seeded → each seed is a distinct, reproducible Tank-Trouble-
 *  style layout. A few extra openings keep it loopy (not all dead ends). */
function generateMaze(seed: number): Wall[] {
  const rng = mulberry32(seed);
  const COLS = 8;
  const ROWS = 6;
  const CELL = 100;
  const east: boolean[][] = [];
  const south: boolean[][] = [];
  for (let c = 0; c < COLS; c++) {
    east[c] = [];
    south[c] = [];
    for (let r = 0; r < ROWS; r++) {
      east[c][r] = true;
      south[c][r] = true;
    }
  }
  const seen: boolean[][] = Array.from({ length: COLS }, () =>
    Array(ROWS).fill(false)
  );
  const stack: Array<[number, number]> = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const nbrs: Array<[number, number, string]> = [];
    if (r > 0 && !seen[c][r - 1]) nbrs.push([c, r - 1, 'N']);
    if (c < COLS - 1 && !seen[c + 1][r]) nbrs.push([c + 1, r, 'E']);
    if (r < ROWS - 1 && !seen[c][r + 1]) nbrs.push([c, r + 1, 'S']);
    if (c > 0 && !seen[c - 1][r]) nbrs.push([c - 1, r, 'W']);
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const [nc, nr, dir] = nbrs[Math.floor(rng() * nbrs.length)];
    if (dir === 'E') east[c][r] = false;
    else if (dir === 'W') east[nc][nr] = false;
    else if (dir === 'S') south[c][r] = false;
    else south[nc][nr] = false; // 'N'
    seen[nc][nr] = true;
    stack.push([nc, nr]);
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && east[c][r] && rng() < 0.14) east[c][r] = false;
      if (r < ROWS - 1 && south[c][r] && rng() < 0.14) south[c][r] = false;
    }
  }
  const walls: Wall[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (c < COLS - 1 && east[c][r]) {
        const x = (c + 1) * CELL;
        walls.push([x, r * CELL, x, (r + 1) * CELL]);
      }
      if (r < ROWS - 1 && south[c][r]) {
        const y = (r + 1) * CELL;
        walls.push([c * CELL, y, (c + 1) * CELL, y]);
      }
    }
  }
  // Keep a generous central combat zone clear (spawns + room to maneuver).
  return walls.filter(w => !segHitsRect(w, 220, 150, 580, 450));
}

// Exactly three rotating maps: three fixed seeds → three distinct mazes.
const MAZE_SEEDS = [7, 23, 91];
function pickMaze(ctx: Ctx): Wall[] {
  const i = ctx.random.integerInRange(0, MAZE_SEEDS.length - 1);
  return generateMaze(MAZE_SEEDS[i]);
}

/** Distance from a point to an axis-aligned segment. */
function distToWall(px: number, py: number, w: Wall): number {
  const dx = w[2] - w[0];
  const dy = w[3] - w[1];
  const len2 = dx * dx + dy * dy || 1;
  let s = ((px - w[0]) * dx + (py - w[1]) * dy) / len2;
  s = Math.max(0, Math.min(1, s));
  const cx = w[0] + s * dx;
  const cy = w[1] + s * dy;
  return Math.hypot(px - cx, py - cy);
}

function hitsAnyWall(x: number, y: number, r: number, walls: Wall[]): boolean {
  for (const w of walls) {
    if (distToWall(x, y, w) < r + WALL_HALF) return true;
  }
  return false;
}

function randomSpawn(ctx: Ctx): { x: number; y: number } {
  return {
    x: ctx.random.integerInRange(ARENA.x0 + 40, ARENA.x1 - 80),
    y: ctx.random.integerInRange(ARENA.y0 + 30, ARENA.y1 - 30),
  };
}

/** A spawn point clear of the given walls (the central zone is always clear). */
function clearSpawn(ctx: Ctx, walls: Wall[]): { x: number; y: number } {
  for (let i = 0; i < 12; i++) {
    const sp = randomSpawn(ctx);
    if (!hitsAnyWall(sp.x, sp.y, TANK_R, walls)) return sp;
  }
  return randomSpawn(ctx);
}

/** Load a fresh random map for a tank game + respawn every tank into it. */
function rotateMap(ctx: Ctx, gameId: bigint): void {
  const mf = ctx.db.map_features.game_id.find(gameId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let features: Record<string, any> = {};
  try {
    features = mf ? JSON.parse(mf.features) : {};
  } catch {
    features = {};
  }
  const walls = pickMaze(ctx);
  features.walls = walls;
  if (mf) {
    ctx.db.map_features.game_id.update({
      ...mf,
      features: JSON.stringify(features),
    });
  }
  for (const tnk of ctx.db.entity.game_id.filter(gameId)) {
    if (tnk.kind !== 'tank') continue;
    const sp = clearSpawn(ctx, walls);
    ctx.db.entity.entity_id.update({ ...tnk, x: sp.x, y: sp.y, vx: 0, vy: 0 });
  }
}

/** `count` random safe-gap centers spread over a flappy world of height H. */
function makeGaps(ctx: Ctx, count: number, H: number): number[] {
  const margin = 80;
  const gaps: number[] = [];
  for (let i = 0; i < count; i++) {
    gaps.push(ctx.random.integerInRange(margin, Math.max(margin + 1, H - margin)));
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Phase 1: game creation + per-type default rules.
// ---------------------------------------------------------------------------
type RulesDefaults = {
  player_speed: number;
  win_score: number;
  projectile_bounces: number;
  projectile_speed: number;
  fire_cooldown_ms: number;
  damage: number;
  gravity: number;
  field_height: number;
  gaps_per_pipe: number;
  pipe_gap: number;
  pipe_speed: number;
  bird_collision: boolean;
};

const TANK_DEFAULTS: RulesDefaults = {
  player_speed: 1,
  win_score: 10,
  projectile_bounces: 2,
  projectile_speed: 1,
  fire_cooldown_ms: 600,
  damage: 1,
  gravity: 1,
  field_height: 1,
  gaps_per_pipe: 1,
  pipe_gap: 1,
  pipe_speed: 1,
  bird_collision: false,
};

const FLAPPY_DEFAULTS: RulesDefaults = {
  player_speed: 1,
  win_score: 10,
  projectile_bounces: 0,
  projectile_speed: 1,
  fire_cooldown_ms: 600,
  damage: 1,
  gravity: 1,
  field_height: 1,
  gaps_per_pipe: 1,
  pipe_gap: 1,
  pipe_speed: 1,
  bird_collision: false,
};

/** Create a game: game row + default rules + map features (maze for tanks). */
function createGameInternal(ctx: Ctx, game_type: string, name: string): bigint {
  const owner = ctx.sender;
  const g = ctx.db.game.insert({
    game_id: 0n,
    game_type,
    name,
    owner,
    created_at: ctx.timestamp,
    status: 'lobby',
  });
  const seed = ctx.random.integerInRange(1, 2_000_000_000);
  const d = game_type === 'flappy' ? FLAPPY_DEFAULTS : TANK_DEFAULTS;
  ctx.db.game_rules.insert({
    game_id: g.game_id,
    game_type,
    player_speed: d.player_speed,
    win_score: d.win_score,
    map_seed: BigInt(seed),
    projectile_bounces: d.projectile_bounces,
    projectile_speed: d.projectile_speed,
    fire_cooldown_ms: d.fire_cooldown_ms,
    damage: d.damage,
    gravity: d.gravity,
    field_height: d.field_height,
    gaps_per_pipe: d.gaps_per_pipe,
    pipe_gap: d.pipe_gap,
    pipe_speed: d.pipe_speed,
    bird_collision: d.bird_collision,
    updated_by: owner,
    updated_at: ctx.timestamp,
  });
  const walls = game_type === 'flappy' ? [] : pickMaze(ctx);
  ctx.db.map_features.insert({
    game_id: g.game_id,
    features: JSON.stringify({ walls, boost_zones: [] }),
  });
  return g.game_id;
}

export const create_game = spacetimedb.reducer(
  { game_type: t.string(), name: t.string() },
  (ctx, { game_type, name }) => {
    createGameInternal(ctx, game_type, name);
  }
);

// ---------------------------------------------------------------------------
// Phase 2/3: join, input, debug placement.
// ---------------------------------------------------------------------------
export const join_game = spacetimedb.reducer(
  { game_id: t.u64(), name: t.string() },
  (ctx, { game_id, name }) => {
    const me = ctx.sender;
    const existing = ctx.db.player.identity.find(me);
    if (existing) {
      ctx.db.player.identity.update({ ...existing, game_id, name, alive: true });
    } else {
      ctx.db.player.insert({
        identity: me,
        game_id,
        name,
        role: 'normal',
        speed_override: 0,
        weapon: 'normal',
        vision_radius: 0,
        score: 0,
        alive: true,
      });
    }
    // Engine games (Option B) manage all entities host-side — no template spawn.
    const gg = ctx.db.game.game_id.find(game_id);
    if (gg && (gg.game_type === 'eflappy' || gg.game_type === 'etank')) return;

    // Spawn the player's tank/bird if they don't already have one here.
    let has = false;
    for (const e of ctx.db.entity.game_id.filter(game_id)) {
      if (e.owner != null && e.owner.equals(me)) {
        has = true;
        break;
      }
    }
    if (!has) {
      const g = ctx.db.game.game_id.find(game_id);
      const kind = g && g.game_type === 'flappy' ? 'bird' : 'tank';
      if (kind === 'bird') {
        ctx.db.entity.insert({
          entity_id: 0n,
          game_id,
          kind,
          owner: me,
          x: BIRD_X0 + ctx.random.integerInRange(0, 80),
          y: 200,
          vx: 0,
          vy: 0,
          angle: 0,
          data: JSON.stringify({ input: NO_INPUT, wasFlap: false }),
        });
      } else {
        const sp = randomSpawn(ctx);
        ctx.db.entity.insert({
          entity_id: 0n,
          game_id,
          kind,
          owner: me,
          x: sp.x,
          y: sp.y,
          vx: 0,
          vy: 0,
          angle: 0,
          data: JSON.stringify({ input: NO_INPUT, lastFireMicros: 0 }),
        });
      }
    }
  }
);

export const set_input = spacetimedb.reducer(
  {
    game_id: t.u64(),
    up: t.bool(),
    down: t.bool(),
    left: t.bool(),
    right: t.bool(),
    fire: t.bool(),
  },
  (ctx, { game_id, up, down, left, right, fire }) => {
    const me = ctx.sender;
    for (const e of ctx.db.entity.game_id.filter(game_id)) {
      if (e.owner != null && e.owner.equals(me)) {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(e.data) as Record<string, unknown>;
        } catch {
          data = {};
        }
        data.input = { up, down, left, right, fire };
        ctx.db.entity.entity_id.update({ ...e, data: JSON.stringify(data) });
        break;
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Option B engine: host-authoritative entity writes. A "host" client runs the
// game's tick (AI-written, client-side) and commits the whole entity set for
// its game each frame. Reconciled by a stable host key (data.__key) so updates
// happen in place (smooth sync). Engine games use their own game_ids; the
// server `tick` only ever touches the fixed kinds tank/bird/shell/pipe, and
// rows without a __key are never reconciled here — so the two never collide.
// ---------------------------------------------------------------------------
export const commit_entities = spacetimedb.reducer(
  { game_id: t.u64(), entities: t.string() },
  (ctx, { game_id, entities }) => {
    let incoming: Array<{
      key: string;
      kind: string;
      x: number;
      y: number;
      vx?: number;
      vy?: number;
      angle?: number;
      data?: Record<string, unknown>;
    }> = [];
    try {
      incoming = JSON.parse(entities);
    } catch {
      return;
    }
    if (!Array.isArray(incoming)) return;

    // Index this game's existing engine rows by their stable host key.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = new Map<string, any>();
    for (const e of ctx.db.entity.game_id.filter(game_id)) {
      let k = '';
      try {
        k = ((JSON.parse(e.data) as { __key?: string }).__key) ?? '';
      } catch {
        k = '';
      }
      if (k) existing.set(k, e);
    }

    const seen = new Set<string>();
    for (const inc of incoming) {
      const key = String(inc.key ?? '');
      if (!key) continue;
      seen.add(key);
      const data = JSON.stringify({ ...(inc.data ?? {}), __key: key });
      const prev = existing.get(key);
      if (prev) {
        ctx.db.entity.entity_id.update({
          ...prev,
          owner: ctx.sender, // host owns engine entities → onDisconnect auto-cleans
          kind: inc.kind,
          x: inc.x,
          y: inc.y,
          vx: inc.vx ?? 0,
          vy: inc.vy ?? 0,
          angle: inc.angle ?? 0,
          data,
        });
      } else {
        ctx.db.entity.insert({
          entity_id: 0n,
          game_id,
          kind: inc.kind,
          owner: ctx.sender, // host owns engine entities → onDisconnect auto-cleans
          x: inc.x,
          y: inc.y,
          vx: inc.vx ?? 0,
          vy: inc.vy ?? 0,
          angle: inc.angle ?? 0,
          data,
        });
      }
    }
    // Drop engine rows the host no longer reports.
    for (const [key, row] of existing) {
      if (!seen.has(key)) ctx.db.entity.entity_id.delete(row.entity_id);
    }
  }
);

// Option B engine: a client publishes its own input for an engine game. The
// host reads every player's row each tick and simulates accordingly.
export const set_engine_input = spacetimedb.reducer(
  { game_id: t.u64(), input: t.string() },
  (ctx, { game_id, input }) => {
    const me = ctx.sender;
    const existing = ctx.db.engine_input.identity.find(me);
    if (existing) {
      ctx.db.engine_input.identity.update({ ...existing, game_id, input });
    } else {
      ctx.db.engine_input.insert({ identity: me, game_id, input });
    }
  }
);

// Option B engine: write a game's live config (the live-edit path). Any player
// can edit; the host reads it next tick → instant for everyone, no redeploy.
export const set_engine_config = spacetimedb.reducer(
  { game_id: t.u64(), config: t.string() },
  (ctx, { game_id, config }) => {
    const existing = ctx.db.engine_config.game_id.find(game_id);
    if (existing) {
      ctx.db.engine_config.game_id.update({ ...existing, config });
    } else {
      ctx.db.engine_config.insert({ game_id, config });
    }
  }
);

// Test-only: position the caller's tank deterministically (used by e2e tests).
export const debug_place = spacetimedb.reducer(
  { game_id: t.u64(), x: t.f32(), y: t.f32(), angle: t.f32() },
  (ctx, { game_id, x, y, angle }) => {
    for (const e of ctx.db.entity.game_id.filter(game_id)) {
      if (
        e.owner != null &&
        e.owner.equals(ctx.sender) &&
        (e.kind === 'tank' || e.kind === 'bird')
      ) {
        ctx.db.entity.entity_id.update({ ...e, x, y, angle, vx: 0, vy: 0 });
        break;
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Phase 4: THE HEART — apply a validated rules patch. Whitelist + clamp every
// field server-side (defense in depth), then write game_rules / player /
// map_features. Subscribers receive the change instantly (the live hot-reload).
// ---------------------------------------------------------------------------
const BOOST_MULT = 2; // speed multiplier while a speed-pad buff is active
const BOOST_MS = 5000; // pad buff lasts this long after you drive over it
type BoostZone = {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: [number, number];
  strength: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const apply_rules_patch = spacetimedb.reducer(
  { game_id: t.u64(), patch: t.string() },
  (ctx, { game_id, patch }) => {
    const rules = ctx.db.game_rules.game_id.find(game_id);
    if (!rules) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: Record<string, any> = {};
    try {
      p = JSON.parse(patch);
    } catch {
      return;
    }

    const upd = { ...rules };
    if (typeof p.player_speed === 'number')
      upd.player_speed = clamp(p.player_speed, 0.25, 4);
    if (typeof p.win_score === 'number')
      upd.win_score = Math.round(clamp(p.win_score, 1, 100));
    if (typeof p.projectile_bounces === 'number')
      upd.projectile_bounces = Math.round(clamp(p.projectile_bounces, 0, 10));
    if (typeof p.projectile_speed === 'number')
      upd.projectile_speed = clamp(p.projectile_speed, 0.5, 3);
    if (typeof p.fire_cooldown_ms === 'number')
      upd.fire_cooldown_ms = Math.round(clamp(p.fire_cooldown_ms, 100, 3000));
    if (typeof p.gravity === 'number') upd.gravity = clamp(p.gravity, 0.2, 3);
    if (typeof p.field_height === 'number')
      upd.field_height = clamp(p.field_height, 1, 3);
    if (typeof p.gaps_per_pipe === 'number')
      upd.gaps_per_pipe = Math.round(clamp(p.gaps_per_pipe, 1, 5));
    if (typeof p.pipe_gap === 'number') upd.pipe_gap = clamp(p.pipe_gap, 0.5, 2);
    if (typeof p.pipe_speed === 'number')
      upd.pipe_speed = clamp(p.pipe_speed, 0.5, 3);
    if (typeof p.bird_collision === 'boolean')
      upd.bird_collision = p.bird_collision;
    upd.updated_by = ctx.sender;
    upd.updated_at = ctx.timestamp;
    ctx.db.game_rules.game_id.update(upd);

    // Per-player overrides — resolve target against the live scoreboard.
    if (Array.isArray(p.per_player)) {
      const players = [...ctx.db.player.game_id.filter(game_id)];
      let chosenHex: string | null = null;
      for (const entry of p.per_player) {
        if (!entry || typeof entry !== 'object') continue;
        let targets = players.slice(0, 0);
        if (entry.target === 'random') {
          if (players.length > 0) {
            const idx = ctx.random.integerInRange(0, players.length - 1);
            chosenHex = players[idx].identity.toHexString();
            targets = [players[idx]];
          }
        } else if (entry.target === 'loser') {
          let m = players[0];
          for (const pl of players) if (pl.score < m.score) m = pl;
          if (m) targets = [m];
        } else if (entry.target === 'leader') {
          let m = players[0];
          for (const pl of players) if (pl.score > m.score) m = pl;
          if (m) targets = [m];
        } else if (entry.target === 'all_others') {
          targets = players.filter(
            pl => pl.identity.toHexString() !== chosenHex
          );
        }
        for (const pl of targets) {
          const u = { ...pl };
          if (typeof entry.speed_override === 'number')
            u.speed_override = clamp(entry.speed_override, 0.25, 4);
          if (entry.weapon === 'normal' || entry.weapon === 'laser')
            u.weapon = entry.weapon;
          if (
            entry.role === 'normal' ||
            entry.role === 'hunter' ||
            entry.role === 'runner'
          )
            u.role = entry.role;
          if (typeof entry.vision_radius === 'number')
            u.vision_radius =
              entry.vision_radius === 0 ? 0 : clamp(entry.vision_radius, 2, 10);
          ctx.db.player.identity.update(u);
        }
      }
    }

    // Boost zones + cosmetic flags -> map_features.
    if (Array.isArray(p.boost_zones) || typeof p.wall_graze_sparks === 'boolean') {
      const mf = ctx.db.map_features.game_id.find(game_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let features: Record<string, any> = {};
      try {
        features = mf ? JSON.parse(mf.features) : {};
      } catch {
        features = {};
      }
      if (Array.isArray(p.boost_zones)) {
        const zones: BoostZone[] = [];
        for (const z of p.boost_zones.slice(0, 12)) {
          if (!z || typeof z !== 'object') continue;
          const dir: [number, number] = Array.isArray(z.dir)
            ? [Number(z.dir[0]) || 0, Number(z.dir[1]) || 0]
            : [1, 0];
          zones.push({
            x: Number(z.x) || 0,
            y: Number(z.y) || 0,
            w: Number(z.w) || 0,
            h: Number(z.h) || 0,
            dir,
            strength: clamp(Number(z.strength) || 1, 1, 3),
          });
        }
        features.boost_zones = zones;
      }
      if (typeof p.wall_graze_sparks === 'boolean')
        features.wall_graze_sparks = p.wall_graze_sparks;
      if (mf)
        ctx.db.map_features.game_id.update({
          ...mf,
          features: JSON.stringify(features),
        });
    }
  }
);

// Restore a game to its default rules + clear per-player overrides and boost
// zones (keeps the maze). For re-running the demo cleanly without --delete-data.
export const reset_game = spacetimedb.reducer(
  { game_id: t.u64() },
  (ctx, { game_id }) => {
    const g = ctx.db.game.game_id.find(game_id);
    if (!g) return;
    const rules = ctx.db.game_rules.game_id.find(game_id);
    if (rules) {
      const d = g.game_type === 'flappy' ? FLAPPY_DEFAULTS : TANK_DEFAULTS;
      ctx.db.game_rules.game_id.update({
        ...rules,
        player_speed: d.player_speed,
        win_score: d.win_score,
        projectile_bounces: d.projectile_bounces,
        projectile_speed: d.projectile_speed,
        fire_cooldown_ms: d.fire_cooldown_ms,
        damage: d.damage,
        gravity: d.gravity,
        field_height: d.field_height,
        gaps_per_pipe: d.gaps_per_pipe,
        pipe_gap: d.pipe_gap,
        pipe_speed: d.pipe_speed,
        bird_collision: d.bird_collision,
        updated_by: ctx.sender,
        updated_at: ctx.timestamp,
      });
    }
    for (const pl of ctx.db.player.game_id.filter(game_id)) {
      ctx.db.player.identity.update({
        ...pl,
        role: 'normal',
        speed_override: 0,
        weapon: 'normal',
        vision_radius: 0,
        alive: true,
        score: 0,
      });
    }
    // Flappy: revive + recenter every bird so Reset gives a clean run.
    if (g.game_type === 'flappy') {
      const midY = (FLAPPY_BASE_H * FLAPPY_DEFAULTS.field_height) / 2;
      for (const e of ctx.db.entity.game_id.filter(game_id)) {
        if (e.kind === 'bird') {
          ctx.db.entity.entity_id.update({
            ...e,
            y: midY,
            vy: 0,
            vx: 0,
            data: JSON.stringify({ input: NO_INPUT, wasFlap: false }),
          });
        }
      }
    }
    const mf = ctx.db.map_features.game_id.find(game_id);
    if (mf) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let f: Record<string, any> = {};
      try {
        f = JSON.parse(mf.features);
      } catch {
        f = {};
      }
      f.boost_zones = [];
      f.wall_graze_sparks = false;
      // Tank games get a fresh random maze on Reset.
      if (g.game_type !== 'flappy') f.walls = pickMaze(ctx);
      ctx.db.map_features.game_id.update({
        ...mf,
        features: JSON.stringify(f),
      });
      if (g.game_type !== 'flappy') {
        const walls = f.walls as Wall[];
        for (const tnk of ctx.db.entity.game_id.filter(game_id)) {
          if (tnk.kind !== 'tank') continue;
          const sp = clearSpawn(ctx, walls);
          ctx.db.entity.entity_id.update({ ...tnk, x: sp.x, y: sp.y, vx: 0, vy: 0 });
        }
      }
    }
  }
);

// Flappy: revive the caller's bird after a game-over and start a fresh run
// (score back to 0). Centered, alive, ready to flap.
export const respawn = spacetimedb.reducer(
  { game_id: t.u64() },
  (ctx, { game_id }) => {
    const me = ctx.sender;
    const rules = ctx.db.game_rules.game_id.find(game_id);
    const midY = (FLAPPY_BASE_H * (rules ? rules.field_height : 1)) / 2;
    for (const e of ctx.db.entity.game_id.filter(game_id)) {
      if (e.owner != null && e.owner.equals(me) && e.kind === 'bird') {
        ctx.db.entity.entity_id.update({
          ...e,
          y: midY,
          vy: 0,
          vx: 0,
          data: JSON.stringify({ input: NO_INPUT, wasFlap: false }),
        });
        break;
      }
    }
    const pl = ctx.db.player.identity.find(me);
    if (pl && pl.game_id === game_id) {
      ctx.db.player.identity.update({ ...pl, score: 0, alive: true });
    }
  }
);

// Phase 7: "Make it mine" — clone a game's type + rules + map (maze/boosts)
// into a NEW game owned by the caller. The original is untouched.
export const remix_game = spacetimedb.reducer(
  { game_id: t.u64() },
  (ctx, { game_id }) => {
    const src = ctx.db.game.game_id.find(game_id);
    if (!src) return;
    const newId = createGameInternal(ctx, src.game_type, `${src.name} (remix)`);

    const srcRules = ctx.db.game_rules.game_id.find(game_id);
    const newRules = ctx.db.game_rules.game_id.find(newId);
    if (srcRules && newRules) {
      ctx.db.game_rules.game_id.update({
        ...newRules,
        player_speed: srcRules.player_speed,
        win_score: srcRules.win_score,
        projectile_bounces: srcRules.projectile_bounces,
        projectile_speed: srcRules.projectile_speed,
        fire_cooldown_ms: srcRules.fire_cooldown_ms,
        damage: srcRules.damage,
        gravity: srcRules.gravity,
        field_height: srcRules.field_height,
        gaps_per_pipe: srcRules.gaps_per_pipe,
        pipe_gap: srcRules.pipe_gap,
        pipe_speed: srcRules.pipe_speed,
        bird_collision: srcRules.bird_collision,
        updated_by: ctx.sender,
        updated_at: ctx.timestamp,
      });
    }

    const srcMf = ctx.db.map_features.game_id.find(game_id);
    const newMf = ctx.db.map_features.game_id.find(newId);
    if (srcMf && newMf) {
      ctx.db.map_features.game_id.update({ ...newMf, features: srcMf.features });
    }
  }
);

// Owner-only: delete a game and everything attached to it. The seeded demo
// games are owned by the module identity, so players can only delete their own
// created/remixed games.
export const delete_game = spacetimedb.reducer(
  { game_id: t.u64() },
  (ctx, { game_id }) => {
    const g = ctx.db.game.game_id.find(game_id);
    if (!g) return;
    if (!g.owner.equals(ctx.sender)) return;
    for (const e of [...ctx.db.entity.game_id.filter(game_id)]) {
      ctx.db.entity.entity_id.delete(e.entity_id);
    }
    for (const p of [...ctx.db.player.game_id.filter(game_id)]) {
      ctx.db.player.identity.delete(p.identity);
    }
    if (ctx.db.game_rules.game_id.find(game_id)) {
      ctx.db.game_rules.game_id.delete(game_id);
    }
    if (ctx.db.map_features.game_id.find(game_id)) {
      ctx.db.map_features.game_id.delete(game_id);
    }
    ctx.db.game.game_id.delete(game_id);
  }
);

// ---------------------------------------------------------------------------
// Lifecycle reducers (must be `export const`).
// ---------------------------------------------------------------------------
export const init = spacetimedb.init(ctx => {
  if (ctx.db.game.count() === 0n) {
    createGameInternal(ctx, 'tanks', 'Tank Trouble');
    createGameInternal(ctx, 'flappy', 'Flappy Arena');
  }
  if (ctx.db.tick_schedule.count() === 0n) {
    ctx.db.tick_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.interval(33_333n),
    });
  }
});

export const onConnect = spacetimedb.clientConnected(_ctx => {
  // Phase 2+: nothing on connect; players join explicitly.
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  // Despawn the player's entities and remove their player row so the world
  // doesn't fill with ghosts when a browser/tab closes.
  const me = ctx.sender;
  const toDelete: bigint[] = [];
  for (const e of ctx.db.entity.iter()) {
    if (e.owner != null && e.owner.equals(me)) toDelete.push(e.entity_id);
  }
  for (const id of toDelete) ctx.db.entity.entity_id.delete(id);
  if (ctx.db.player.identity.find(me)) {
    ctx.db.player.identity.delete(me);
  }
  // Remember which engine game they were in, then drop their input row.
  const myInput = ctx.db.engine_input.identity.find(me);
  const leftGame = myInput ? myInput.game_id : null;
  if (myInput) {
    ctx.db.engine_input.identity.delete(me);
  }
  // If that engine game is now empty, reset its live config to default — so a
  // game flipped mid-match (e.g. to "manhunt") doesn't stay stuck in that mode
  // the next time it's played. (New games get fresh ids; this covers reused ones.)
  if (leftGame != null) {
    let stillPlaying = false;
    for (const r of ctx.db.engine_input.iter()) {
      if (r.game_id === leftGame) {
        stillPlaying = true;
        break;
      }
    }
    if (!stillPlaying && ctx.db.engine_config.game_id.find(leftGame)) {
      ctx.db.engine_config.game_id.delete(leftGame);
    }
  }
});

// ---------------------------------------------------------------------------
// Scheduled game loop (~30Hz): drive tanks (wall collision), fire, advance
// bouncing shells, detect hits/scoring. Phase 4 swaps constants for game_rules.
// ---------------------------------------------------------------------------
export const tick = spacetimedb.reducer(
  { timer: tick_schedule.rowType },
  ctx => {
    if (!ctx.sender.equals(ctx.databaseIdentity)) {
      throw new SenderError('tick is scheduler-only');
    }

    // Maze walls per game.
    const wallsByGame = new Map<string, Wall[]>();
    const boostByGame = new Map<string, BoostZone[]>();
    for (const mf of ctx.db.map_features.iter()) {
      try {
        const parsed = JSON.parse(mf.features) as {
          walls?: Wall[];
          boost_zones?: BoostZone[];
        };
        wallsByGame.set(mf.game_id.toString(), parsed.walls ?? []);
        boostByGame.set(mf.game_id.toString(), parsed.boost_zones ?? []);
      } catch {
        wallsByGame.set(mf.game_id.toString(), []);
        boostByGame.set(mf.game_id.toString(), []);
      }
    }
    const wallsFor = (gid: bigint): Wall[] =>
      wallsByGame.get(gid.toString()) ?? [];

    // Phase 4: data-driven. game_rules per game + per-player overrides.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rulesByGame = new Map<string, any>();
    for (const r of ctx.db.game_rules.iter()) {
      rulesByGame.set(r.game_id.toString(), r);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerByOwner = new Map<string, any>();
    for (const pl of ctx.db.player.iter()) {
      playerByOwner.set(pl.identity.toHexString(), pl);
    }

    const nowMicros = Number(ctx.timestamp.microsSinceUnixEpoch);
    const ents = [...ctx.db.entity.iter()];

    // ---- tanks: drive (axis-separated wall collision) + fire ----
    for (const e of ents) {
      if (e.kind !== 'tank') continue;
      let data: { input?: Input; lastFireMicros?: number; boostUntil?: number } =
        {};
      try {
        data = JSON.parse(e.data);
      } catch {
        data = {};
      }
      const input = data.input ?? NO_INPUT;
      const walls = wallsFor(e.game_id);
      const rules = rulesByGame.get(e.game_id.toString());
      const ohex = e.owner != null ? e.owner.toHexString() : null;
      const pl = ohex ? playerByOwner.get(ohex) : null;
      const sover = pl && pl.speed_override > 0 ? pl.speed_override : 1;
      let boostUntil = data.boostUntil ?? 0;
      const boosted = nowMicros < boostUntil;
      const speedMult =
        (rules ? rules.player_speed : 1) * sover * (boosted ? BOOST_MULT : 1);

      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const mag = Math.hypot(dx, dy);
      const nx = mag > 0 ? dx / mag : 0;
      const ny = mag > 0 ? dy / mag : 0;
      const stepX = nx * BASE_SPEED * speedMult * TICK_DT;
      const stepY = ny * BASE_SPEED * speedMult * TICK_DT;

      let x = e.x;
      let y = e.y;
      if (stepX !== 0) {
        const tx = Math.max(TANK_R, Math.min(FIELD_W - TANK_R, x + stepX));
        if (!hitsAnyWall(tx, y, TANK_R, walls)) x = tx;
      }
      if (stepY !== 0) {
        const ty = Math.max(TANK_R, Math.min(FIELD_H - TANK_R, y + stepY));
        if (!hitsAnyWall(x, ty, TANK_R, walls)) y = ty;
      }
      // Speed pads: driving onto one grants a timed buff that carries off it.
      for (const z of boostByGame.get(e.game_id.toString()) ?? []) {
        const zx = z.x * FIELD_W;
        const zy = z.y * FIELD_H;
        const zw = z.w * FIELD_W;
        const zh = z.h * FIELD_H;
        if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) {
          boostUntil = nowMicros + BOOST_MS * 1000;
        }
      }
      const angle = mag > 0 ? Math.atan2(ny, nx) : e.angle;
      const moved = x !== e.x || y !== e.y;
      const vx = moved ? (x - e.x) / TICK_DT : 0;
      const vy = moved ? (y - e.y) / TICK_DT : 0;

      let fired = false;
      let lastFire = data.lastFireMicros ?? 0;
      if (input.fire) {
        const cooldown = rules ? rules.fire_cooldown_ms : FIRE_COOLDOWN_MS;
        const shellSpeed = SHELL_SPEED * (rules ? rules.projectile_speed : 1);
        const bouncesInit = rules ? rules.projectile_bounces : MAX_BOUNCES;
        if (nowMicros - lastFire >= cooldown * 1000) {
          ctx.db.entity.insert({
            entity_id: 0n,
            game_id: e.game_id,
            kind: 'shell',
            owner: e.owner,
            x: x + Math.cos(angle) * (TANK_R + SHELL_R + 2),
            y: y + Math.sin(angle) * (TANK_R + SHELL_R + 2),
            vx: Math.cos(angle) * shellSpeed,
            vy: Math.sin(angle) * shellSpeed,
            angle,
            data: JSON.stringify({ bouncesLeft: bouncesInit, age: 0 }),
          });
          lastFire = nowMicros;
          fired = true;
        }
      }

      const boostChanged = boostUntil !== (data.boostUntil ?? 0);
      if (moved || fired || boostChanged || angle !== e.angle) {
        ctx.db.entity.entity_id.update({
          ...e,
          x,
          y,
          vx,
          vy,
          angle,
          data: JSON.stringify({ input, lastFireMicros: lastFire, boostUntil }),
        });
      }
    }

    // ---- shells: move, bounce, hit ----
    const tanksNow = [...ctx.db.entity.iter()].filter(en => en.kind === 'tank');
    for (const e of ents) {
      if (e.kind !== 'shell') continue;
      const walls = wallsFor(e.game_id);
      let sdata: { bouncesLeft?: number; age?: number } = {};
      try {
        sdata = JSON.parse(e.data);
      } catch {
        sdata = {};
      }
      let bounces = sdata.bouncesLeft ?? MAX_BOUNCES;
      const age = (sdata.age ?? 0) + 1;
      let vx = e.vx;
      let vy = e.vy;
      let x = e.x;
      let y = e.y;

      let nxp = x + vx * TICK_DT;
      if (
        nxp < SHELL_R ||
        nxp > FIELD_W - SHELL_R ||
        hitsAnyWall(nxp, y, SHELL_R, walls)
      ) {
        vx = -vx;
        bounces--;
        nxp = x + vx * TICK_DT;
      }
      x = Math.max(SHELL_R, Math.min(FIELD_W - SHELL_R, nxp));

      let nyp = y + vy * TICK_DT;
      if (
        nyp < SHELL_R ||
        nyp > FIELD_H - SHELL_R ||
        hitsAnyWall(x, nyp, SHELL_R, walls)
      ) {
        vy = -vy;
        bounces--;
        nyp = y + vy * TICK_DT;
      }
      y = Math.max(SHELL_R, Math.min(FIELD_H - SHELL_R, nyp));

      if (bounces < 0) {
        ctx.db.entity.entity_id.delete(e.entity_id);
        continue;
      }

      let hit = false;
      for (const tnk of tanksNow) {
        if (tnk.game_id !== e.game_id) continue;
        const sameOwner =
          tnk.owner != null && e.owner != null && tnk.owner.equals(e.owner);
        if (sameOwner && age < GRACE_TICKS) continue;
        if (Math.hypot(x - tnk.x, y - tnk.y) < SHELL_R + TANK_R) {
          if (!sameOwner && e.owner != null) {
            const shooter = ctx.db.player.identity.find(e.owner);
            if (shooter) {
              ctx.db.player.identity.update({
                ...shooter,
                score: shooter.score + 1,
              });
            }
          }
          const sp = randomSpawn(ctx);
          ctx.db.entity.entity_id.update({
            ...tnk,
            x: sp.x,
            y: sp.y,
            vx: 0,
            vy: 0,
          });
          ctx.db.entity.entity_id.delete(e.entity_id);
          hit = true;
          // Every 5 total points in this game: rotate to a new random map
          // (Tank-Trouble-style round change) and respawn all tanks into it.
          if (!sameOwner && e.owner != null) {
            let total = 0;
            for (const p of ctx.db.player.game_id.filter(e.game_id)) {
              total += p.score;
            }
            if (total > 0 && total % 5 === 0) rotateMap(ctx, e.game_id);
          }
          break;
        }
      }
      if (hit) continue;

      ctx.db.entity.entity_id.update({
        ...e,
        x,
        y,
        vx,
        vy,
        data: JSON.stringify({ bouncesLeft: bounces, age }),
      });
    }

    // ---- flappy: scrolling multi-gap pipes + birds (gravity / flap) ----
    for (const [, r] of rulesByGame) {
      if (r.game_type !== 'flappy') continue;
      const gid: bigint = r.game_id;
      const gravity: number = r.gravity;
      const H = FLAPPY_BASE_H * r.field_height;
      const gapsPerPipe: number = r.gaps_per_pipe;
      const gapH = GAP_BASE * r.pipe_gap;
      const pipeSpeed = PIPE_SPEED_BASE * r.pipe_speed;
      const birdCollision: boolean = r.bird_collision;

      const all = [...ctx.db.entity.game_id.filter(gid)];
      const birds = all.filter(en => en.kind === 'bird');
      if (birds.length === 0) {
        // No players: clean up pipes so the world doesn't keep persisting/scrolling.
        for (const p of all) {
          if (p.kind === 'pipe') ctx.db.entity.entity_id.delete(p.entity_id);
        }
        continue;
      }

      // Birds whose player is in the game-over state: they freeze and don't score.
      const deadSet = new Set<string>();
      for (const b of birds) {
        const oh = b.owner ? b.owner.toHexString() : null;
        if (oh) {
          const pl = playerByOwner.get(oh);
          if (pl && !pl.alive) deadSet.add(oh);
        }
      }

      // Ensure NUM_PIPES exist, spaced to the right.
      const pipes = all.filter(en => en.kind === 'pipe');
      let rightmost = PIPE_START_X - PIPE_SPACING;
      for (const p of pipes) if (p.x > rightmost) rightmost = p.x;
      for (let n = pipes.length; n < NUM_PIPES; n++) {
        rightmost += PIPE_SPACING;
        ctx.db.entity.insert({
          entity_id: 0n,
          game_id: gid,
          kind: 'pipe',
          owner: undefined,
          x: rightmost,
          y: 0,
          vx: -pipeSpeed,
          vy: 0,
          angle: 0,
          data: JSON.stringify({
            gaps: makeGaps(ctx, gapsPerPipe, H),
            gapsCount: gapsPerPipe,
            scoredBy: [],
          }),
        });
      }

      const pipesNow = [...ctx.db.entity.game_id.filter(gid)].filter(
        en => en.kind === 'pipe'
      );
      let maxX = 0;
      for (const p of pipesNow) if (p.x > maxX) maxX = p.x;

      // Scroll + recycle pipes; regenerate gaps when gaps_per_pipe changes; score.
      for (const p of pipesNow) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pd: any = {};
        try {
          pd = JSON.parse(p.data);
        } catch {
          pd = {};
        }
        let gaps: number[] = pd.gaps ?? [];
        let scoredBy: string[] = pd.scoredBy ?? [];
        let x = p.x - pipeSpeed * TICK_DT;
        if ((pd.gapsCount ?? gapsPerPipe) !== gapsPerPipe) {
          gaps = makeGaps(ctx, gapsPerPipe, H);
          scoredBy = [];
        }
        if (x < -PIPE_W) {
          maxX += PIPE_SPACING;
          x = maxX;
          gaps = makeGaps(ctx, gapsPerPipe, H);
          scoredBy = [];
        }
        for (const bird of birds) {
          if (bird.owner == null) continue;
          const bhex = bird.owner.toHexString();
          if (deadSet.has(bhex)) continue;
          if (x + PIPE_W < bird.x && !scoredBy.includes(bhex)) {
            scoredBy.push(bhex);
            const pl = playerByOwner.get(bhex);
            if (pl) {
              ctx.db.player.identity.update({ ...pl, score: pl.score + 1 });
            }
          }
        }
        ctx.db.entity.entity_id.update({
          ...p,
          x,
          vx: -pipeSpeed,
          data: JSON.stringify({ gaps, gapsCount: gapsPerPipe, scoredBy }),
        });
      }

      // Birds: gravity + flap; glide along surfaces; a head-on pipe wall kills.
      for (const e of birds) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let d: any = {};
        try {
          d = JSON.parse(e.data);
        } catch {
          d = {};
        }
        const input: Input = d.input ?? NO_INPUT;
        const oh = e.owner ? e.owner.toHexString() : null;

        // Dead birds freeze where they fell (the client shows a game-over card;
        // the respawn reducer revives them). They never teleport.
        if (oh && deadSet.has(oh)) {
          if (e.vy !== 0 || e.vx !== 0) {
            ctx.db.entity.entity_id.update({ ...e, vx: 0, vy: 0 });
          }
          continue;
        }

        const flap = !!(input.up || input.fire);
        let vy = e.vy + GRAVITY_BASE * gravity * TICK_DT;
        if (flap && !d.wasFlap) vy = -FLAP_IMPULSE;
        let y = e.y + vy * TICK_DT;

        // Ground / ceiling: clamp + glide. Never teleport, never die here.
        if (y < BIRD_R) {
          y = BIRD_R;
          if (vy < 0) vy = 0;
        }
        if (y > H - BIRD_R) {
          y = H - BIRD_R;
          if (vy > 0) vy = 0;
        }

        // Pipes: aligned with a gap → glide along its lip; otherwise the bird
        // smacked the solid face head-on → game over.
        let died = false;
        for (const p of pipesNow) {
          const px = p.x - pipeSpeed * TICK_DT;
          if (e.x + BIRD_R > px && e.x - BIRD_R < px + PIPE_W) {
            let gaps: number[] = [];
            try {
              gaps = JSON.parse(p.data).gaps ?? [];
            } catch {
              gaps = [];
            }
            const center = gaps.find(c => Math.abs(y - c) <= gapH / 2);
            if (center === undefined) {
              died = true;
              break;
            }
            const top = center - gapH / 2 + BIRD_R;
            const bot = center + gapH / 2 - BIRD_R;
            if (top > bot) {
              died = true; // gap too small to fit through
              break;
            }
            if (y < top) {
              y = top;
              if (vy < 0) vy = 0;
            }
            if (y > bot) {
              y = bot;
              if (vy > 0) vy = 0;
            }
          }
        }

        if (died) {
          if (oh) {
            const pl = playerByOwner.get(oh);
            if (pl && pl.alive) {
              ctx.db.player.identity.update({ ...pl, alive: false });
            }
          }
          ctx.db.entity.entity_id.update({
            ...e,
            vx: 0,
            vy: 0,
            data: JSON.stringify({ input, wasFlap: flap }),
          });
        } else {
          ctx.db.entity.entity_id.update({
            ...e,
            vx: 0,
            vy,
            y,
            data: JSON.stringify({ input, wasFlap: flap }),
          });
        }
      }

      // Bird-bird collision (push apart) when enabled.
      if (birdCollision) {
        const bnow = [...ctx.db.entity.game_id.filter(gid)].filter(
          en => en.kind === 'bird'
        );
        for (let i = 0; i < bnow.length; i++) {
          for (let j = i + 1; j < bnow.length; j++) {
            const a = bnow[i];
            const b = bnow[j];
            const ah = a.owner ? a.owner.toHexString() : null;
            const bh = b.owner ? b.owner.toHexString() : null;
            if ((ah && deadSet.has(ah)) || (bh && deadSet.has(bh))) continue;
            let ddx = b.x - a.x;
            let ddy = b.y - a.y;
            let dist = Math.hypot(ddx, ddy);
            if (dist >= 2 * BIRD_R) continue;
            if (dist === 0) {
              ddx = 1;
              ddy = 0;
              dist = 1;
            }
            const push = (2 * BIRD_R - dist) / 2 + 0.5;
            const ux = ddx / dist;
            const uy = ddy / dist;
            ctx.db.entity.entity_id.update({
              ...a,
              x: a.x - ux * push,
              y: a.y - uy * push,
            });
            ctx.db.entity.entity_id.update({
              ...b,
              x: b.x + ux * push,
              y: b.y + uy * push,
            });
          }
        }
      }
    }
  }
);
