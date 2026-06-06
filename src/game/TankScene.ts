// Tank Trouble scene: maze walls, small colored tanks with barrels, bouncing
// shells, and gold chevron SPEED PADS. Reads everything from the synced cache;
// pushes arrow-key + space input to set_input. Redraws walls/pads when the map
// rotates (every few points the server loads a new random maze).

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPhaser = any;
type Mod = typeof import("@/lib/spacetime");

interface Opts {
  mod: Mod;
  gameId: string;
}

const SHELL_RADIUS = 4;

function ownerHex(owner: any): string | null {
  if (!owner) return null;
  if (typeof owner.toHexString === "function") return owner.toHexString();
  if (owner.value && typeof owner.value.toHexString === "function") {
    return owner.value.toHexString();
  }
  return null;
}

type Zone = { x: number; y: number; w: number; h: number; dir: [number, number] };

export function createTankScene(Phaser: AnyPhaser, { mod, gameId }: Opts) {
  const tanks = new Map<string, { body: any; barrel: any }>();
  const shells = new Map<string, any>();
  let myId: string | null = null;
  let cursors: any = null;
  let wallSig = "";
  let boostSig = "";
  let last = { up: false, down: false, left: false, right: false, fire: false };

  const drawWalls = (g: any, walls: number[][]) => {
    g.clear();
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
      g.fillStyle(0x3b3f47, 1);
      g.fillRoundedRect(rx, ry, rw, rh, 3);
      g.fillStyle(0x565b66, 1);
      g.fillRoundedRect(rx, ry, rw, Math.min(3, rh), 2);
    }
    g.lineStyle(6, 0x3b3f47, 1);
    g.strokeRoundedRect(3, 3, 794, 594, 6);
  };

  const drawPads = (g: any, zones: Zone[]) => {
    g.clear();
    for (const z of zones) {
      const rx = z.x * 800;
      const ry = z.y * 600;
      const rw = z.w * 800;
      const rh = z.h * 600;
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      // metallic plate
      g.fillStyle(0x23262d, 0.94);
      g.fillRoundedRect(rx, ry, rw, rh, 8);
      g.lineStyle(2, 0x0e1013, 1);
      g.strokeRoundedRect(rx, ry, rw, rh, 8);
      g.fillStyle(0x33373f, 1);
      g.fillRoundedRect(rx + 3, ry + 3, rw - 6, 4, 2);
      // gold chevrons pointing the boost direction
      const ux = z.dir?.[0] ?? 1;
      const uy = z.dir?.[1] ?? 0;
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
        g.lineStyle(5, 0xf5c518, 0.95);
        g.beginPath();
        g.moveTo(b1x, b1y);
        g.lineTo(tx, ty);
        g.lineTo(b2x, b2y);
        g.strokePath();
      }
    }
  };

  return {
    key: "tank",
    create(this: any) {
      myId = mod.getIdentityHex();
      cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
      this.add.rectangle(400, 300, 800, 600, 0xe9eef2).setDepth(-4);
      // faint floor grid
      const grid = this.add.graphics();
      grid.setDepth(-3);
      grid.lineStyle(1, 0x000000, 0.04);
      for (let x = 100; x < 800; x += 100) {
        grid.lineBetween(x, 0, x, 600);
      }
      for (let y = 100; y < 600; y += 100) {
        grid.lineBetween(0, y, 800, y);
      }
      this.boostLayer = this.add.graphics();
      this.boostLayer.setDepth(-2);
      this.wallsLayer = this.add.graphics();
      this.wallsLayer.setDepth(-1);
    },
    update(this: any) {
      if (!myId) myId = mod.getIdentityHex();

      // Redraw walls + pads only when the map changes (rotation / edits).
      const mf = mod.getMapFeaturesRaw();
      if (mf) {
        try {
          const parsed = JSON.parse(mf.features) as {
            walls?: number[][];
            boost_zones?: Zone[];
          };
          const walls = parsed.walls ?? [];
          const zones = parsed.boost_zones ?? [];
          const ws = JSON.stringify(walls);
          if (ws !== wallSig) {
            drawWalls(this.wallsLayer, walls);
            wallSig = ws;
          }
          const bs = JSON.stringify(zones);
          if (bs !== boostSig) {
            drawPads(this.boostLayer, zones);
            boostSig = bs;
          }
        } catch {
          /* not ready */
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

      const nowMicros = Date.now() * 1000;
      const ents = mod.getEntitiesRaw();
      const seenTanks = new Set<string>();
      const seenShells = new Set<string>();
      for (const e of ents) {
        const id = e.entityId.toString();
        if (e.kind === "tank") {
          seenTanks.add(id);
          const mine = ownerHex(e.owner) === myId;
          let boosted = false;
          try {
            boosted = (JSON.parse(e.data).boostUntil ?? 0) > nowMicros;
          } catch {
            boosted = false;
          }
          let g = tanks.get(id);
          if (!g) {
            const body = this.add
              .rectangle(e.x, e.y, 18, 18, mine ? 0x22c55e : 0xef4444)
              .setStrokeStyle(2, 0x111111);
            const barrel = this.add
              .rectangle(e.x, e.y, 13, 4, 0x111111)
              .setOrigin(0, 0.5);
            g = { body, barrel };
            tanks.set(id, g);
          }
          const tx = mine ? e.x : Phaser.Math.Linear(g.body.x, e.x, 0.3);
          const ty = mine ? e.y : Phaser.Math.Linear(g.body.y, e.y, 0.3);
          g.body.x = tx;
          g.body.y = ty;
          g.body.setStrokeStyle(boosted ? 3 : 2, boosted ? 0xf5c518 : 0x111111);
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
