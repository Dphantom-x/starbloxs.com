// Phase 6 Flappy scene: sky, scrolling multi-gap green pipes, gravity-driven
// birds. The world height is 600 * field_height; we scale it into the fixed
// 800x600 canvas so a "taller" field zooms out (no canvas resize on live edits).

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

export function createFlappyScene(Phaser: AnyPhaser, { mod, gameId }: Opts) {
  const birds = new Map<string, any>();
  const pipes = new Map<string, any>();
  let myId: string | null = null;
  let cursors: any = null;
  let lastFlap = false;

  return {
    key: "flappy",
    create(this: any) {
      myId = mod.getIdentityHex();
      cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.addCapture(["UP", "SPACE"]);
      this.add.rectangle(400, 300, 800, 600, 0x87ceeb); // sky
    },
    update(this: any) {
      if (!myId) myId = mod.getIdentityHex();
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
            g = this.add
              .circle(e.x, e.y * scaleY, BIRD_R, mine ? 0xfacc15 : 0xfb923c)
              .setStrokeStyle(2, 0x111111);
            birds.set(id, g);
          }
          const ty = e.y * scaleY;
          g.x = mine ? e.x : Phaser.Math.Linear(g.x, e.x, 0.3);
          g.y = mine ? ty : Phaser.Math.Linear(g.y, ty, 0.3);
        } else if (e.kind === "pipe") {
          seenP.add(id);
          let g = pipes.get(id);
          if (!g) {
            g = this.add.graphics();
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
          g.fillStyle(0x22c55e, 1);
          g.lineStyle(2, 0x166534, 1);
          let top = 0;
          for (const c of sorted) {
            const gapTop = c - gapH / 2;
            const gapBot = c + gapH / 2;
            if (gapTop > top) {
              g.fillRect(e.x, top * scaleY, PIPE_W, (gapTop - top) * scaleY);
              g.strokeRect(e.x, top * scaleY, PIPE_W, (gapTop - top) * scaleY);
            }
            top = Math.max(top, gapBot);
          }
          if (top < H) {
            g.fillRect(e.x, top * scaleY, PIPE_W, (H - top) * scaleY);
            g.strokeRect(e.x, top * scaleY, PIPE_W, (H - top) * scaleY);
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
