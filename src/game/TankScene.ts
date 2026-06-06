// Phase 3 Tank Trouble scene: grey maze walls, colored tanks with barrels,
// small bouncing shells. Reads everything from the synced cache; pushes
// arrow-key input + space-to-fire to set_input. Factory so Phaser stays client-only.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPhaser = any;
type Mod = typeof import("@/lib/spacetime");

interface Opts {
  mod: Mod;
  gameId: string;
}

function ownerHex(owner: any): string | null {
  if (!owner) return null;
  if (typeof owner.toHexString === "function") return owner.toHexString();
  if (owner.value && typeof owner.value.toHexString === "function") {
    return owner.value.toHexString();
  }
  return null;
}

export function createTankScene(Phaser: AnyPhaser, { mod, gameId }: Opts) {
  const tanks = new Map<string, { body: any; barrel: any }>();
  const shells = new Map<string, any>();
  let myId: string | null = null;
  let cursors: any = null;
  let wallsDrawn = false;
  let last = { up: false, down: false, left: false, right: false, fire: false };

  return {
    key: "tank",
    create(this: any) {
      myId = mod.getIdentityHex();
      cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
      this.add.rectangle(400, 300, 800, 600, 0xe9eef2);
      this.wallsLayer = this.add.graphics();
    },
    update(this: any) {
      if (!myId) myId = mod.getIdentityHex();

      // Draw maze walls once they've synced.
      if (!wallsDrawn) {
        const mf = mod.getMapFeaturesRaw();
        if (mf) {
          try {
            const parsed = JSON.parse(mf.features) as { walls?: number[][] };
            const walls = parsed.walls ?? [];
            const g = this.wallsLayer;
            g.clear();
            g.lineStyle(7, 0x6b7280, 1);
            for (const w of walls) {
              g.beginPath();
              g.moveTo(w[0], w[1]);
              g.lineTo(w[2], w[3]);
              g.strokePath();
            }
            g.lineStyle(8, 0x4b5563, 1);
            g.strokeRect(3, 3, 794, 594);
            wallsDrawn = true;
          } catch {
            /* not ready */
          }
        }
      }

      // Input on change (arrows = move, space = fire).
      const cur = {
        up: !!cursors.up.isDown,
        down: !!cursors.down.isDown,
        left: !!cursors.left.isDown,
        right: !!cursors.right.isDown,
        fire: !!(cursors.space && cursors.space.isDown),
      };
      if (
        cur.up !== last.up ||
        cur.down !== last.down ||
        cur.left !== last.left ||
        cur.right !== last.right ||
        cur.fire !== last.fire
      ) {
        mod.setInput(gameId, cur);
        last = cur;
      }

      // Render entities.
      const ents = mod.getEntitiesRaw();
      const seenTanks = new Set<string>();
      const seenShells = new Set<string>();
      for (const e of ents) {
        const id = e.entityId.toString();
        if (e.kind === "tank") {
          seenTanks.add(id);
          const mine = ownerHex(e.owner) === myId;
          let g = tanks.get(id);
          if (!g) {
            const body = this.add
              .rectangle(e.x, e.y, 26, 26, mine ? 0x22c55e : 0xef4444)
              .setStrokeStyle(2, 0x111111);
            const barrel = this.add
              .rectangle(e.x, e.y, 18, 6, 0x111111)
              .setOrigin(0, 0.5);
            g = { body, barrel };
            tanks.set(id, g);
          }
          const tx = mine ? e.x : Phaser.Math.Linear(g.body.x, e.x, 0.3);
          const ty = mine ? e.y : Phaser.Math.Linear(g.body.y, e.y, 0.3);
          g.body.x = tx;
          g.body.y = ty;
          g.barrel.x = tx;
          g.barrel.y = ty;
          g.barrel.rotation = e.angle;
        } else if (e.kind === "shell") {
          seenShells.add(id);
          let s = shells.get(id);
          if (!s) {
            s = this.add.circle(e.x, e.y, SHELL_RADIUS, 0x111111);
            shells.set(id, s);
          }
          s.x = Phaser.Math.Linear(s.x, e.x, 0.5);
          s.y = Phaser.Math.Linear(s.y, e.y, 0.5);
        }
      }
      for (const [id, g] of tanks) {
        if (!seenTanks.has(id)) {
          g.body.destroy();
          g.barrel.destroy();
          tanks.delete(id);
        }
      }
      for (const [id, s] of shells) {
        if (!seenShells.has(id)) {
          s.destroy();
          shells.delete(id);
        }
      }
    },
  };
}

const SHELL_RADIUS = 4;
