// Phase 6 Flappy scene — classic look: a tilting, flapping yellow bird and
// green capped (Mario-style) pipes over a sky + ground. The world height is
// 600 * field_height; we scale it into the fixed 800x600 canvas so a "taller"
// field zooms out. All positions come from the synced cache.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPhaser = any;
type Mod = typeof import("@/lib/spacetime");

interface Opts {
  mod: Mod;
  gameId: string;
}

const FLAPPY_BASE_H = 600;
const PIPE_W = 70;
const GAP_BASE = 165;
const BIRD_R = 14;

function ownerHex(owner: any): string | null {
  if (!owner) return null;
  if (typeof owner.toHexString === "function") return owner.toHexString();
  if (owner.value && typeof owner.value.toHexString === "function") {
    return owner.value.toHexString();
  }
  return null;
}

// Draw a chunky retro flappy bird into a graphics object (box ~44x32, facing
// right). `wingUp` toggles the wing for the flap animation.
function drawBird(g: any, wingUp: boolean, mine: boolean) {
  const body = mine ? 0xf7d51d : 0xf0962f; // yellow (you) / orange (others)
  const ink = 0x222222;
  g.clear();
  // body
  g.fillStyle(body, 1);
  g.lineStyle(3, ink, 1);
  g.fillRoundedRect(4, 5, 30, 22, 9);
  g.strokeRoundedRect(4, 5, 30, 22, 9);
  // cream belly
  g.fillStyle(0xfdf3d0, 1);
  g.fillRoundedRect(8, 16, 15, 9, 5);
  // wing (moves with the flap)
  const wy = wingUp ? 8 : 15;
  g.fillStyle(0xfff7e0, 1);
  g.lineStyle(2.5, ink, 1);
  g.fillRoundedRect(8, wy, 14, 8, 4);
  g.strokeRoundedRect(8, wy, 14, 8, 4);
  // eye
  g.fillStyle(0xffffff, 1);
  g.lineStyle(2.5, ink, 1);
  g.fillCircle(27, 12, 5.5);
  g.strokeCircle(27, 12, 5.5);
  g.fillStyle(0x111111, 1);
  g.fillCircle(29, 12, 2.3);
  // beak
  g.fillStyle(0xf3781e, 1);
  g.lineStyle(2.5, ink, 1);
  g.fillRoundedRect(31, 15, 10, 7, 2);
  g.strokeRoundedRect(31, 15, 10, 7, 2);
}

export function createFlappyScene(Phaser: AnyPhaser, { mod, gameId }: Opts) {
  const birds = new Map<string, any>();
  const pipes = new Map<string, any>();
  let myId: string | null = null;
  let cursors: any = null;
  let lastFlap = false;
  let frame = 0;

  const mkBird = (scene: any, key: string, wingUp: boolean, mine: boolean) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    drawBird(g, wingUp, mine);
    g.generateTexture(key, 46, 34);
    g.destroy();
  };

  // Draw a single capped green pipe segment [topY, botY] (world coords) at px.
  const drawSeg = (
    g: any,
    px: number,
    topY: number,
    botY: number,
    scaleY: number,
    capTop: boolean,
    capBot: boolean
  ) => {
    const y = topY * scaleY;
    const h = (botY - topY) * scaleY;
    // shaft
    g.fillStyle(0x5cc23a, 1);
    g.fillRect(px, y, PIPE_W, h);
    g.fillStyle(0x8ee06a, 1); // left highlight
    g.fillRect(px + 5, y, 7, h);
    g.fillStyle(0x3a8f24, 1); // right shade
    g.fillRect(px + PIPE_W - 11, y, 7, h);
    g.lineStyle(3, 0x215c12, 1);
    g.strokeRect(px, y, PIPE_W, h);
    // caps (the wider lip at the gap-facing opening)
    const capH = 18;
    const drawCap = (cy: number) => {
      g.fillStyle(0x5cc23a, 1);
      g.fillRect(px - 6, cy, PIPE_W + 12, capH);
      g.fillStyle(0x8ee06a, 1);
      g.fillRect(px - 2, cy + 3, 8, capH - 6);
      g.lineStyle(3, 0x215c12, 1);
      g.strokeRect(px - 6, cy, PIPE_W + 12, capH);
    };
    if (capBot) drawCap(y + h - capH);
    if (capTop) drawCap(y);
  };

  return {
    key: "flappy",
    create(this: any) {
      myId = mod.getIdentityHex();
      cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.addCapture(["UP", "SPACE"]);

      // sky gradient + a couple of clouds
      const sky = this.add.graphics();
      sky.fillGradientStyle(0x9bd7ef, 0x9bd7ef, 0x87ceeb, 0xb6e4f3, 1);
      sky.fillRect(0, 0, 800, 600);
      const cloud = (cx: number, cy: number, s: number) => {
        sky.fillStyle(0xffffff, 0.85);
        sky.fillCircle(cx, cy, 18 * s);
        sky.fillCircle(cx + 22 * s, cy + 4, 14 * s);
        sky.fillCircle(cx - 20 * s, cy + 5, 13 * s);
        sky.fillRect(cx - 30 * s, cy, 60 * s, 16 * s);
      };
      cloud(140, 110, 1);
      cloud(560, 80, 1.3);
      cloud(680, 200, 0.9);

      // ground strip at the bottom
      const ground = this.add.graphics();
      ground.fillStyle(0xded895, 1);
      ground.fillRect(0, 586, 800, 14);
      ground.fillStyle(0x9bc24a, 1);
      ground.fillRect(0, 586, 800, 5);
      ground.lineStyle(2, 0x6f8f33, 1);
      ground.strokeRect(0, 586, 800, 14);
      ground.setDepth(5);

      mkBird(this, "bird_you_up", true, true);
      mkBird(this, "bird_you_dn", false, true);
      mkBird(this, "bird_oth_up", true, false);
      mkBird(this, "bird_oth_dn", false, false);
    },
    update(this: any) {
      if (!myId) myId = mod.getIdentityHex();
      frame++;
      const wingUp = Math.floor(frame / 6) % 2 === 0;
      const rules = mod.getRulesRaw();
      const fieldH = rules ? rules.fieldHeight : 1;
      const pipeGap = rules ? rules.pipeGap : 1;
      const H = FLAPPY_BASE_H * fieldH;
      const scaleY = 600 / H;
      const gapH = GAP_BASE * pipeGap;

      // Flap on up/space (server does the rising-edge impulse).
      const flap = !!(
        cursors.up.isDown ||
        (cursors.space && cursors.space.isDown)
      );
      if (flap !== lastFlap) {
        mod.setInput(gameId, {
          up: flap,
          down: false,
          left: false,
          right: false,
          fire: false,
        });
        lastFlap = flap;
      }

      const ents = mod.getEntitiesRaw();
      const seenB = new Set<string>();
      const seenP = new Set<string>();
      for (const e of ents) {
        const id = e.entityId.toString();
        if (e.kind === "bird") {
          seenB.add(id);
          const mine = ownerHex(e.owner) === myId;
          let g = birds.get(id);
          if (!g) {
            g = this.add.image(e.x, e.y * scaleY, mine ? "bird_you_dn" : "bird_oth_dn");
            g.setDisplaySize(38, 28);
            g.setDepth(6);
            birds.set(id, g);
          }
          const ty = e.y * scaleY;
          g.x = mine ? e.x : Phaser.Math.Linear(g.x, e.x, 0.3);
          g.y = mine ? ty : Phaser.Math.Linear(g.y, ty, 0.3);
          // tilt from vertical velocity (nose up rising, nose down falling)
          const targetRot = Phaser.Math.Clamp((e.vy ?? 0) / 700, -0.5, 1.3);
          g.rotation = Phaser.Math.Linear(g.rotation, targetRot, 0.25);
          // flap animation (only while alive-ish / moving up)
          const up = wingUp || (e.vy ?? 0) < -50;
          g.setTexture(mine ? (up ? "bird_you_up" : "bird_you_dn") : up ? "bird_oth_up" : "bird_oth_dn");
        } else if (e.kind === "pipe") {
          seenP.add(id);
          let g = pipes.get(id);
          if (!g) {
            g = this.add.graphics();
            g.setDepth(3);
            pipes.set(id, g);
          }
          let gaps: number[] = [];
          try {
            gaps = JSON.parse(e.data).gaps ?? [];
          } catch {
            gaps = [];
          }
          const sorted = [...gaps].sort((a, b) => a - b);
          g.clear();
          let top = 0;
          for (const c of sorted) {
            const gapTop = c - gapH / 2;
            const gapBot = c + gapH / 2;
            if (gapTop > top) {
              // solid segment [top, gapTop]; its bottom faces the gap below.
              drawSeg(g, e.x, top, gapTop, scaleY, top > 0, true);
            }
            top = Math.max(top, gapBot);
          }
          if (top < H) {
            // final segment to the floor; its top faces the gap above (if any).
            drawSeg(g, e.x, top, H, scaleY, top > 0, false);
          }
        }
      }
      for (const [id, g] of birds)
        if (!seenB.has(id)) {
          g.destroy();
          birds.delete(id);
        }
      for (const [id, g] of pipes)
        if (!seenP.has(id)) {
          g.destroy();
          pipes.delete(id);
        }
    },
  };
}
