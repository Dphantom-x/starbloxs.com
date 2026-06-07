// Flappy, rebuilt as a game FILE on the pseudo-engine. The host runs this tick
// (ported from the server tick) and commits entities; every client renders from
// the synced cache. Uses kinds `fbird`/`fpipe` so the legacy server tick never
// touches it.
//
// Phase 3: the render ports the EXACT `FlappyScene.ts` routines (tilting/flapping
// bird, capped Mario-style pipes, sky/clouds/ground) — pixel-identical to the
// original — plus death → tap-Space-to-restart.
import type { EngineApi, EngineEntity, GameModule, InputState } from "@/engine/types";

const H_BASE = 600;
const BIRD_R = 14;
const BIRD_X0 = 150;
const GRAVITY_BASE = 1300;
const FLAP_IMPULSE = 430;
const PIPE_W = 70;
const PIPE_SPEED_BASE = 150;
const GAP_BASE = 165;
const PIPE_SPACING = 300;
const NUM_PIPES = 4;
const PIPE_START_X = 850;

const CFG = {
  gravity: 1,
  fieldHeight: 1,
  gapsPerPipe: 3,
  pipeGap: 1,
  pipeSpeed: 1,
  birdCollision: true,
};

// Live, per-game tunables: api.config() (the live-edit path) layered over the
// defaults, so an empty config behaves EXACTLY as before but a config write
// (e.g. "more gravity", "wider gaps") takes effect on the host's next tick.
function cfg(api: EngineApi) {
  const o = api.config();
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  return {
    gravity: num(o.gravity, CFG.gravity),
    fieldHeight: num(o.fieldHeight, CFG.fieldHeight),
    gapsPerPipe: num(o.gapsPerPipe, CFG.gapsPerPipe),
    pipeGap: num(o.pipeGap, CFG.pipeGap),
    pipeSpeed: num(o.pipeSpeed, CFG.pipeSpeed),
    birdCollision: typeof o.birdCollision === "boolean" ? o.birdCollision : CFG.birdCollision,
  };
}

type BirdData = { pid: string; alive: boolean; score: number; wasFlap: boolean };
type PipeData = { gaps: number[]; gapsCount: number; scoredBy: string[] };

const NO_INPUT: InputState = { up: false, down: false, left: false, right: false, fire: false };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

let flapFrame = 0; // drives the wing-flap animation

function makeGaps(n: number, H: number): number[] {
  const margin = 110;
  const lo = margin;
  const hi = Math.max(margin + 1, H - margin);
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) gaps.push(Math.round(lo + Math.random() * (hi - lo)));
  return gaps;
}

export const flappyGame: GameModule = {
  id: "flappy",
  tick(api) {
    const dt = api.dt;
    const c = cfg(api);
    const H = H_BASE * c.fieldHeight;
    const gapH = GAP_BASE * c.pipeGap;
    const pipeSpeed = PIPE_SPEED_BASE * c.pipeSpeed;

    const inputByPid = new Map<string, InputState>();
    for (const p of api.players()) inputByPid.set(p.id, p.input);

    const birdByPid = new Map<string, EngineEntity>();
    let pipes: EngineEntity[] = [];
    for (const e of api.local()) {
      if (e.kind === "fbird") {
        const pid = String((e.data as BirdData | undefined)?.pid ?? "");
        if (pid) birdByPid.set(pid, e);
      } else if (e.kind === "fpipe") {
        pipes.push(e);
      }
    }

    const birds: EngineEntity[] = [];
    for (const p of api.players()) {
      const existing = birdByPid.get(p.id);
      birds.push(
        existing ?? {
          key: `fbird:${p.id}`,
          kind: "fbird",
          x: BIRD_X0,
          y: 200,
          vx: 0,
          vy: 0,
          angle: 0,
          data: { pid: p.id, alive: true, score: 0, wasFlap: false } satisfies BirdData,
        }
      );
    }
    if (birds.length === 0) {
      api.setLocal([]);
      return;
    }

    const bySlot = new Map(pipes.map((p) => [p.key, p]));
    let rightmost = PIPE_START_X - PIPE_SPACING;
    for (const p of pipes) if (p.x > rightmost) rightmost = p.x;
    const ensured: EngineEntity[] = [];
    for (let i = 0; i < NUM_PIPES; i++) {
      const key = `fpipe:${i}`;
      let p = bySlot.get(key);
      if (!p) {
        rightmost += PIPE_SPACING;
        p = {
          key,
          kind: "fpipe",
          x: rightmost,
          y: 0,
          vx: -pipeSpeed,
          vy: 0,
          angle: 0,
          data: { gaps: makeGaps(c.gapsPerPipe, H), gapsCount: c.gapsPerPipe, scoredBy: [] } satisfies PipeData,
        };
      }
      ensured.push(p);
    }
    pipes = ensured;

    const deadSet = new Set<string>();
    for (const b of birds) {
      const bd = b.data as BirdData;
      if (!bd.alive) deadSet.add(bd.pid);
    }

    let maxX = 0;
    for (const p of pipes) if (p.x > maxX) maxX = p.x;
    for (const p of pipes) {
      const pd = p.data as PipeData;
      let gaps = pd.gaps ?? [];
      let scoredBy = pd.scoredBy ?? [];
      let x = p.x - pipeSpeed * dt;
      if (x < -PIPE_W) {
        maxX += PIPE_SPACING;
        x = maxX;
        gaps = makeGaps(c.gapsPerPipe, H);
        scoredBy = [];
      }
      for (const bird of birds) {
        const bd = bird.data as BirdData;
        if (deadSet.has(bd.pid)) continue;
        if (x + PIPE_W < bird.x && !scoredBy.includes(bd.pid)) {
          scoredBy.push(bd.pid);
          bd.score = (bd.score ?? 0) + 1;
        }
      }
      p.x = x;
      p.vx = -pipeSpeed;
      p.data = { gaps, gapsCount: c.gapsPerPipe, scoredBy };
    }

    for (const e of birds) {
      const bd = e.data as BirdData;
      const input = inputByPid.get(bd.pid) ?? NO_INPUT;
      const flap = !!(input.up || input.fire);

      // Dead bird: a fresh flap (rising edge) restarts; otherwise it stays frozen.
      if (deadSet.has(bd.pid)) {
        if (flap && !bd.wasFlap) {
          bd.alive = true;
          bd.score = 0;
          bd.wasFlap = true;
          e.x = BIRD_X0;
          e.y = 200;
          e.vx = 0;
          e.vy = 0;
        } else {
          bd.wasFlap = flap;
          e.vx = 0;
          e.vy = 0;
        }
        continue;
      }

      let vy = (e.vy ?? 0) + GRAVITY_BASE * c.gravity * dt;
      if (flap && !bd.wasFlap) vy = -FLAP_IMPULSE;
      let y = e.y + vy * dt;
      if (y < BIRD_R) {
        y = BIRD_R;
        if (vy < 0) vy = 0;
      }
      if (y > H - BIRD_R) {
        y = H - BIRD_R;
        if (vy > 0) vy = 0;
      }
      let died = false;
      for (const p of pipes) {
        const px = p.x;
        if (e.x + BIRD_R > px && e.x - BIRD_R < px + PIPE_W) {
          const gaps = (p.data as PipeData).gaps ?? [];
          const center = gaps.find((c) => Math.abs(y - c) <= gapH / 2);
          if (center === undefined) {
            died = true;
            break;
          }
          const top = center - gapH / 2 + BIRD_R;
          const bot = center + gapH / 2 - BIRD_R;
          if (top > bot) {
            died = true;
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
      e.vx = 0;
      bd.wasFlap = flap;
      if (died) {
        e.vy = 0;
        bd.alive = false;
      } else {
        e.vy = vy;
        e.y = y;
      }
    }

    if (c.birdCollision) {
      for (let i = 0; i < birds.length; i++) {
        for (let j = i + 1; j < birds.length; j++) {
          const a = birds[i];
          const b = birds[j];
          if (deadSet.has((a.data as BirdData).pid) || deadSet.has((b.data as BirdData).pid)) continue;
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
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }

    api.setLocal([...birds, ...pipes]);
  },

  render(api) {
    flapFrame++;
    const myId = api.me();
    const c = cfg(api);
    const H = H_BASE * c.fieldHeight;
    const scaleY = 600 / H;
    const gapH = GAP_BASE * c.pipeGap;

    // sky + clouds + ground (ported from FlappyScene.create)
    api.draw.gradientRect(0, 0, 800, 600, 0x9bd7ef, 0xb6e4f3);
    drawCloud(api, 140, 110, 1);
    drawCloud(api, 560, 80, 1.3);
    drawCloud(api, 680, 200, 0.9);
    api.draw.rect(0, 586, 800, 14, 0xded895);
    api.draw.rect(0, 586, 800, 5, 0x9bc24a);
    api.draw.strokeRect(0, 586, 800, 14, 0x6f8f33, 2);

    // pipes
    for (const e of api.entities()) {
      if (e.kind !== "fpipe") continue;
      let gaps: number[] = [];
      try {
        gaps = (JSON.parse(e.data) as PipeData).gaps ?? [];
      } catch {
        gaps = [];
      }
      const sorted = [...gaps].sort((a, b) => a - b);
      let top = 0;
      for (const c of sorted) {
        const gapTop = c - gapH / 2;
        const gapBot = c + gapH / 2;
        if (gapTop > top) drawSeg(api, e.x, top * scaleY, gapTop * scaleY, top > 0, true);
        top = Math.max(top, gapBot);
      }
      if (top < H) drawSeg(api, e.x, top * scaleY, H * scaleY, top > 0, false);
    }

    // birds
    for (const e of api.entities()) {
      if (e.kind !== "fbird") continue;
      let pid = "";
      let alive = true;
      try {
        const d = JSON.parse(e.data) as BirdData;
        pid = d.pid ?? "";
        alive = d.alive !== false;
      } catch {
        /* defaults */
      }
      drawBird(api, e.x, e.y * scaleY, e.vy ?? 0, !!myId && pid === myId, alive);
    }
  },
};

function drawCloud(api: EngineApi, cx: number, cy: number, s: number) {
  api.draw.circle(cx, cy, 18 * s, 0xffffff, 0.85);
  api.draw.circle(cx + 22 * s, cy + 4, 14 * s, 0xffffff, 0.85);
  api.draw.circle(cx - 20 * s, cy + 5, 13 * s, 0xffffff, 0.85);
  api.draw.rect(cx - 30 * s, cy, 60 * s, 16 * s, 0xffffff, 0.85);
}

// Capped green Mario-style pipe segment (ported from FlappyScene.drawSeg).
function drawSeg(api: EngineApi, px: number, y: number, yBot: number, capTop: boolean, capBot: boolean) {
  const h = yBot - y;
  api.draw.rect(px, y, PIPE_W, h, 0x5cc23a);
  api.draw.rect(px + 5, y, 7, h, 0x8ee06a);
  api.draw.rect(px + PIPE_W - 11, y, 7, h, 0x3a8f24);
  api.draw.strokeRect(px, y, PIPE_W, h, 0x215c12, 3);
  const capH = 18;
  const drawCap = (cy: number) => {
    api.draw.rect(px - 6, cy, PIPE_W + 12, capH, 0x5cc23a);
    api.draw.rect(px - 2, cy + 3, 8, capH - 6, 0x8ee06a);
    api.draw.strokeRect(px - 6, cy, PIPE_W + 12, capH, 0x215c12, 3);
  };
  if (capBot) drawCap(y + h - capH);
  if (capTop) drawCap(y);
}

// Tilting, flapping bird (ported from FlappyScene.drawBird, immediate-mode).
function drawBird(api: EngineApi, x: number, y: number, vy: number, mine: boolean, alive: boolean) {
  const body = !alive ? 0x9aa0ab : mine ? 0xf7d51d : 0xf0962f;
  const ink = 0x222222;
  const tilt = clamp(vy / 700, -0.5, 1.3);
  const wingUp = Math.floor(flapFrame / 6) % 2 === 0 || vy < -50;

  api.draw.save();
  api.draw.translate(x, y);
  api.draw.rotate(tilt);
  api.draw.scale(0.83, 0.83); // 46x34 figure shown at ~38x28
  api.draw.translate(-19, -16); // center it
  // body
  api.draw.roundedRect(4, 5, 30, 22, 9, body);
  api.draw.strokeRoundedRect(4, 5, 30, 22, 9, ink, 3);
  // cream belly
  api.draw.roundedRect(8, 16, 15, 9, 5, 0xfdf3d0);
  // wing (moves with the flap)
  const wy = wingUp ? 8 : 15;
  api.draw.roundedRect(8, wy, 14, 8, 4, 0xfff7e0);
  api.draw.strokeRoundedRect(8, wy, 14, 8, 4, ink, 2.5);
  // eye
  api.draw.circle(27, 12, 5.5, 0xffffff);
  api.draw.strokeCircle(27, 12, 5.5, ink, 2.5);
  api.draw.circle(29, 12, 2.3, 0x111111);
  // beak
  api.draw.roundedRect(31, 15, 10, 7, 2, 0xf3781e);
  api.draw.strokeRoundedRect(31, 15, 10, 7, 2, ink, 2.5);
  api.draw.restore();
}
