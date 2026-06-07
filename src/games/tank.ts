// Tank, rebuilt on the Starblox engine. Host tick ported from the server tick
// (drive + maze-wall collision, fire, bouncing shells, hit→score→respawn, speed
// pads) and now reads LIVE config (api.config()) so a running game can be remixed
// with no redeploy — including a "manhunt" mode (one hunter with a flashlight on a
// grayed-out map; runners can't fire). Kinds `etank`/`eshell` so the legacy server
// tick never touches it.
import type { EngineApi, EngineEntity, GameModule, InputState } from "@/engine/types";

const FIELD_W = 800;
const FIELD_H = 600;
const BASE_SPEED = 185;
const TANK_R = 11;
const SHELL_R = 4;
const SHELL_SPEED = 330;
const FIRE_COOLDOWN_S = 0.6;
const MAX_BOUNCES = 2;
const WALL_HALF = 4;
const GRACE_TICKS = 8;
const BOOST_MULT = 2;
const BOOST_S = 5;
const ARENA = { x0: 255, y0: 185, x1: 545, y1: 415 };
const CONE_LEN = 300; // flashlight reach
const CONE_HALF = 0.52; // flashlight half-angle (~30°)

const NO_INPUT: InputState = { up: false, down: false, left: false, right: false, fire: false };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Wall = [number, number, number, number];
type Zone = { x: number; y: number; w: number; h: number; dir: [number, number] };
type TankData = { pid: string; score: number; boostUntil: number; lastFire: number; boosted: boolean; role: string };
type ShellData = { ownerPid: string; bouncesLeft: number; age: number };

const PADS: Zone[] = [
  { x: 0.3, y: 0.25, w: 0.06, h: 0.5, dir: [1, 0] },
  { x: 0.64, y: 0.25, w: 0.06, h: 0.5, dir: [-1, 0] },
];

// ---- maze (ported) ----
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
function segHitsRect(w: Wall, x0: number, y0: number, x1: number, y1: number): boolean {
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
  const seen: boolean[][] = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  const stack: Array<[number, number]> = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const nbrs: Array<[number, number, string]> = [];
    if (r > 0 && !seen[c][r - 1]) nbrs.push([c, r - 1, "N"]);
    if (c < COLS - 1 && !seen[c + 1][r]) nbrs.push([c + 1, r, "E"]);
    if (r < ROWS - 1 && !seen[c][r + 1]) nbrs.push([c, r + 1, "S"]);
    if (c > 0 && !seen[c - 1][r]) nbrs.push([c - 1, r, "W"]);
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const [nc, nr, dir] = nbrs[Math.floor(rng() * nbrs.length)];
    if (dir === "E") east[c][r] = false;
    else if (dir === "W") east[nc][nr] = false;
    else if (dir === "S") south[c][r] = false;
    else south[nc][nr] = false;
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
  return walls.filter((w) => !segHitsRect(w, 220, 150, 580, 450));
}
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
  for (const w of walls) if (distToWall(x, y, w) < r + WALL_HALF) return true;
  return false;
}
function clearSpawn(walls: Wall[]): { x: number; y: number } {
  for (let i = 0; i < 12; i++) {
    const sp = {
      x: ARENA.x0 + 40 + Math.random() * (ARENA.x1 - ARENA.x0 - 120),
      y: ARENA.y0 + 30 + Math.random() * (ARENA.y1 - ARENA.y0 - 60),
    };
    if (!hitsAnyWall(sp.x, sp.y, TANK_R, walls)) return sp;
  }
  return { x: 400, y: 300 };
}

const WALLS = generateMaze(7);
let gameTime = 0;
let shellSeq = 0;

export const tankGame: GameModule = {
  id: "tank",
  tick(api) {
    gameTime += api.dt;
    const dt = api.dt;
    const cfg = api.config();
    const manhunt = !!cfg.manhunt;
    const cfgSpeed = typeof cfg.playerSpeed === "number" ? (cfg.playerSpeed as number) : 1;
    const cfgBounces = typeof cfg.bounces === "number" ? (cfg.bounces as number) : MAX_BOUNCES;

    const tankByPid = new Map<string, EngineEntity>();
    let shells: EngineEntity[] = [];
    for (const e of api.local()) {
      if (e.kind === "etank") tankByPid.set(String((e.data as TankData).pid), e);
      else if (e.kind === "eshell") shells.push(e);
    }

    const inputByPid = new Map<string, InputState>();
    for (const p of api.players()) inputByPid.set(p.id, p.input);

    const tanks: EngineEntity[] = [];
    for (const p of api.players()) {
      const existing = tankByPid.get(p.id);
      if (existing) {
        tanks.push(existing);
      } else {
        const sp = clearSpawn(WALLS);
        tanks.push({
          key: `etank:${p.id}`,
          kind: "etank",
          x: sp.x,
          y: sp.y,
          vx: 0,
          vy: 0,
          angle: 0,
          data: { pid: p.id, score: 0, boostUntil: 0, lastFire: 0, boosted: false, role: "normal" } satisfies TankData,
        });
      }
    }
    if (tanks.length === 0) {
      api.setLocal([]);
      return;
    }

    // Roles: in manhunt, the lowest-identity tank is the hunter; the rest run.
    const hunterPid = manhunt ? [...tanks.map((t) => (t.data as TankData).pid)].sort()[0] : null;

    // ---- drive + fire ----
    for (const t of tanks) {
      const td = t.data as TankData;
      const role = manhunt ? (td.pid === hunterPid ? "hunter" : "runner") : "normal";
      const input = inputByPid.get(td.pid) ?? NO_INPUT;
      const boosted = gameTime < td.boostUntil;
      const speedMult = (boosted ? BOOST_MULT : 1) * cfgSpeed;

      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const mag = Math.hypot(dx, dy);
      const nx = mag > 0 ? dx / mag : 0;
      const ny = mag > 0 ? dy / mag : 0;
      const stepX = nx * BASE_SPEED * speedMult * dt;
      const stepY = ny * BASE_SPEED * speedMult * dt;

      let x = t.x;
      let y = t.y;
      if (stepX !== 0) {
        const tx = clamp(x + stepX, TANK_R, FIELD_W - TANK_R);
        if (!hitsAnyWall(tx, y, TANK_R, WALLS)) x = tx;
      }
      if (stepY !== 0) {
        const ty = clamp(y + stepY, TANK_R, FIELD_H - TANK_R);
        if (!hitsAnyWall(x, ty, TANK_R, WALLS)) y = ty;
      }

      let boostUntil = td.boostUntil;
      for (const z of PADS) {
        const zx = z.x * FIELD_W;
        const zy = z.y * FIELD_H;
        const zw = z.w * FIELD_W;
        const zh = z.h * FIELD_H;
        if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) boostUntil = gameTime + BOOST_S;
      }

      const angle = mag > 0 ? Math.atan2(ny, nx) : t.angle ?? 0;

      // Runners can't fire in manhunt.
      let lastFire = td.lastFire;
      if (input.fire && gameTime - lastFire >= FIRE_COOLDOWN_S && role !== "runner") {
        shells.push({
          key: `eshell:${shellSeq++}`,
          kind: "eshell",
          x: x + Math.cos(angle) * (TANK_R + SHELL_R + 2),
          y: y + Math.sin(angle) * (TANK_R + SHELL_R + 2),
          vx: Math.cos(angle) * SHELL_SPEED,
          vy: Math.sin(angle) * SHELL_SPEED,
          angle,
          data: { ownerPid: td.pid, bouncesLeft: cfgBounces, age: 0 } satisfies ShellData,
        });
        lastFire = gameTime;
      }

      t.x = x;
      t.y = y;
      t.angle = angle;
      t.data = { pid: td.pid, score: td.score, boostUntil, lastFire, boosted: gameTime < boostUntil, role };
    }

    // ---- shells: move, bounce, hit ----
    const keptShells: EngineEntity[] = [];
    for (const s of shells) {
      const sd = s.data as ShellData;
      let bounces = sd.bouncesLeft ?? MAX_BOUNCES;
      const age = (sd.age ?? 0) + 1;
      let vx = s.vx ?? 0;
      let vy = s.vy ?? 0;
      let x = s.x;
      let y = s.y;

      let nxp = x + vx * dt;
      if (nxp < SHELL_R || nxp > FIELD_W - SHELL_R || hitsAnyWall(nxp, y, SHELL_R, WALLS)) {
        vx = -vx;
        bounces--;
        nxp = x + vx * dt;
      }
      x = clamp(nxp, SHELL_R, FIELD_W - SHELL_R);

      let nyp = y + vy * dt;
      if (nyp < SHELL_R || nyp > FIELD_H - SHELL_R || hitsAnyWall(x, nyp, SHELL_R, WALLS)) {
        vy = -vy;
        bounces--;
        nyp = y + vy * dt;
      }
      y = clamp(nyp, SHELL_R, FIELD_H - SHELL_R);

      if (bounces < 0) continue;

      let hit = false;
      for (const tnk of tanks) {
        const tnkd = tnk.data as TankData;
        const sameOwner = tnkd.pid === sd.ownerPid;
        if (sameOwner && age < GRACE_TICKS) continue;
        if (Math.hypot(x - tnk.x, y - tnk.y) < SHELL_R + TANK_R) {
          if (!sameOwner) {
            const shooter = tanks.find((t) => (t.data as TankData).pid === sd.ownerPid);
            if (shooter) (shooter.data as TankData).score += 1;
          }
          const sp = clearSpawn(WALLS);
          tnk.x = sp.x;
          tnk.y = sp.y;
          tnk.vx = 0;
          tnk.vy = 0;
          hit = true;
          break;
        }
      }
      if (hit) continue;

      s.x = x;
      s.y = y;
      s.vx = vx;
      s.vy = vy;
      s.data = { ownerPid: sd.ownerPid, bouncesLeft: bounces, age };
      keptShells.push(s);
    }
    shells = keptShells;

    api.setLocal([...tanks, ...shells]);
  },

  render(api) {
    const myId = api.me();
    const manhunt = !!api.config().manhunt;
    const ents = api.entities();

    // Find my tank + role for the manhunt POV.
    let myTank: (typeof ents)[number] | null = null;
    let myRole = "normal";
    for (const e of ents) {
      if (e.kind !== "etank") continue;
      try {
        const d = JSON.parse(e.data) as TankData;
        if (d.pid === myId) {
          myTank = e;
          myRole = d.role ?? "normal";
        }
      } catch {
        /* ignore */
      }
    }

    if (manhunt && myRole === "hunter" && myTank) {
      renderHunterView(api, myTank, ents, myId);
      return;
    }

    // Normal view (runner sees the whole map; non-manhunt is unchanged).
    api.draw.rect(0, 0, 800, 600, 0xe9eef2);
    for (let x = 100; x < 800; x += 100) api.draw.line(x, 0, x, 600, 0x000000, 1, 0.04);
    for (let y = 100; y < 600; y += 100) api.draw.line(0, y, 800, y, 0x000000, 1, 0.04);
    drawPads(api, PADS);
    drawWalls(api, WALLS);
    for (const e of ents) {
      if (e.kind === "etank") {
        const { pid, boosted, role } = parseTank(e);
        // In manhunt, mark the hunter so runners know who to flee.
        if (manhunt && role === "hunter") api.draw.circle(e.x, e.y, TANK_R + 7, 0xef4444, 0.22);
        drawTank(api, e.x, e.y, e.angle ?? 0, !!myId && pid === myId, boosted);
      } else if (e.kind === "eshell") {
        api.draw.circle(e.x, e.y, SHELL_R, 0x111111);
      }
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTank(e: any): { pid: string; boosted: boolean; role: string } {
  try {
    const d = JSON.parse(e.data) as TankData;
    return { pid: d.pid ?? "", boosted: !!d.boosted, role: d.role ?? "normal" };
  } catch {
    return { pid: "", boosted: false, role: "normal" };
  }
}

function inCone(px: number, py: number, hx: number, hy: number, angle: number): boolean {
  const dx = px - hx;
  const dy = py - hy;
  const dist = Math.hypot(dx, dy);
  if (dist < TANK_R) return true;
  if (dist > CONE_LEN) return false;
  let da = Math.atan2(dy, dx) - angle;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  return Math.abs(da) <= CONE_HALF;
}

// The hunter's POV: grayed-out map with a flashlight cone; runners are only
// visible inside the cone.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderHunterView(api: EngineApi, hunter: any, ents: readonly any[], myId: string | null) {
  const hx = hunter.x;
  const hy = hunter.y;
  const ha = hunter.angle ?? 0;

  api.draw.rect(0, 0, 800, 600, 0x14171d); // dark, grayed-out map

  // flashlight cone (lit floor)
  const c1x = hx + Math.cos(ha - CONE_HALF) * CONE_LEN;
  const c1y = hy + Math.sin(ha - CONE_HALF) * CONE_LEN;
  const c2x = hx + Math.cos(ha + CONE_HALF) * CONE_LEN;
  const c2y = hy + Math.sin(ha + CONE_HALF) * CONE_LEN;
  api.draw.triangle(hx, hy, c1x, c1y, c2x, c2y, 0xdfe6ee, 0.92);
  api.draw.circle(hx, hy, 26, 0xdfe6ee, 0.92); // a little glow around the hunter

  drawWalls(api, WALLS); // the maze structure stays faintly visible

  for (const e of ents) {
    if (e.kind === "etank") {
      const { pid, boosted } = parseTank(e);
      if (pid === myId) {
        drawTank(api, e.x, e.y, e.angle ?? 0, true, boosted);
      } else if (inCone(e.x, e.y, hx, hy, ha)) {
        drawTank(api, e.x, e.y, e.angle ?? 0, false, boosted); // runner revealed by the light
      }
    } else if (e.kind === "eshell") {
      api.draw.circle(e.x, e.y, SHELL_R, 0xf5c518); // the hunter's tracers
    }
  }
}

function drawWalls(api: EngineApi, walls: Wall[]) {
  const T = 8;
  for (const w of walls) {
    let rx: number, ry: number, rw: number, rh: number;
    if (w[0] === w[2]) {
      rx = w[0] - T / 2;
      ry = Math.min(w[1], w[3]);
      rw = T;
      rh = Math.abs(w[3] - w[1]);
    } else {
      rx = Math.min(w[0], w[2]);
      ry = w[1] - T / 2;
      rw = Math.abs(w[2] - w[0]);
      rh = T;
    }
    api.draw.roundedRect(rx, ry, rw, rh, 3, 0x3b3f47);
    api.draw.roundedRect(rx, ry, rw, Math.min(3, rh), 2, 0x565b66);
  }
  api.draw.strokeRoundedRect(3, 3, 794, 594, 6, 0x3b3f47, 6);
}

function drawPads(api: EngineApi, zones: Zone[]) {
  for (const z of zones) {
    const rx = z.x * 800;
    const ry = z.y * 600;
    const rw = z.w * 800;
    const rh = z.h * 600;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    api.draw.roundedRect(rx, ry, rw, rh, 8, 0x23262d, 0.94);
    api.draw.strokeRoundedRect(rx, ry, rw, rh, 8, 0x0e1013, 2);
    api.draw.roundedRect(rx + 3, ry + 3, rw - 6, 4, 2, 0x33373f);
    const ux = z.dir[0];
    const uy = z.dir[1];
    const arm = Math.min(rw, rh) * 0.34;
    const spacing = (Math.abs(ux) > Math.abs(uy) ? rw : rh) * 0.22;
    const px = -uy;
    const py = ux;
    for (let k = -1; k <= 1; k++) {
      const ox = cx + ux * spacing * k;
      const oy = cy + uy * spacing * k;
      const tx = ox + ux * arm * 0.5;
      const ty = oy + uy * arm * 0.5;
      const b1x = ox - ux * arm * 0.5 + px * arm * 0.62;
      const b1y = oy - uy * arm * 0.5 + py * arm * 0.62;
      const b2x = ox - ux * arm * 0.5 - px * arm * 0.62;
      const b2y = oy - uy * arm * 0.5 - py * arm * 0.62;
      api.draw.line(b1x, b1y, tx, ty, 0xf5c518, 5, 0.95);
      api.draw.line(tx, ty, b2x, b2y, 0xf5c518, 5, 0.95);
    }
  }
}

function drawTank(api: EngineApi, x: number, y: number, angle: number, mine: boolean, boosted: boolean) {
  api.draw.rect(x - 9, y - 9, 18, 18, mine ? 0x22c55e : 0xef4444);
  api.draw.strokeRect(x - 9, y - 9, 18, 18, boosted ? 0xf5c518 : 0x111111, boosted ? 3 : 2);
  api.draw.save();
  api.draw.translate(x, y);
  api.draw.rotate(angle);
  api.draw.rect(0, -2, 13, 4, 0x111111);
  api.draw.restore();
}
