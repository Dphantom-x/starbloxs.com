// Engine runtime: mounts Phaser, publishes this client's input, runs the host's
// fixed-step tick (~30Hz) which commits the authoritative entity set, and renders
// every frame on ALL clients from the synced cache. The "pseudo-engine" host loop.
import type {
  DrawApi,
  EngineApi,
  EngineEntity,
  EnginePlayer,
  GameModule,
  InputState,
  SyncedEntity,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mod = typeof import("@/lib/spacetime");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPhaser = any;

const TICK_MS = 33; // ~30Hz fixed host tick

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDraw(g: any): DrawApi {
  return {
    rect: (x, y, w, h, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillRect(x, y, w, h); },
    roundedRect: (x, y, w, h, r, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillRoundedRect(x, y, w, h, r); },
    circle: (x, y, r, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillCircle(x, y, r); },
    triangle: (x0, y0, x1, y1, x2, y2, color, alpha = 1) => { g.fillStyle(color, alpha); g.fillTriangle(x0, y0, x1, y1, x2, y2); },
    strokeRect: (x, y, w, h, color, width = 2, alpha = 1) => { g.lineStyle(width, color, alpha); g.strokeRect(x, y, w, h); },
    strokeRoundedRect: (x, y, w, h, r, color, width = 2, alpha = 1) => { g.lineStyle(width, color, alpha); g.strokeRoundedRect(x, y, w, h, r); },
    strokeCircle: (x, y, r, color, width = 2, alpha = 1) => { g.lineStyle(width, color, alpha); g.strokeCircle(x, y, r); },
    line: (x1, y1, x2, y2, color, width = 2, alpha = 1) => { g.lineStyle(width, color, alpha); g.lineBetween(x1, y1, x2, y2); },
    gradientRect: (x, y, w, h, top, bottom, alpha = 1) => { g.fillGradientStyle(top, top, bottom, bottom, alpha); g.fillRect(x, y, w, h); },
    save: () => g.save(),
    restore: () => g.restore(),
    translate: (x, y) => g.translateCanvas(x, y),
    rotate: (rad) => g.rotateCanvas(rad),
    scale: (sx, sy) => g.scaleCanvas(sx, sy),
  };
}

const NOOP = () => {};
const NOOP_DRAW: DrawApi = {
  rect: NOOP, roundedRect: NOOP, circle: NOOP, triangle: NOOP,
  strokeRect: NOOP, strokeRoundedRect: NOOP, strokeCircle: NOOP,
  line: NOOP, gradientRect: NOOP, save: NOOP, restore: NOOP, translate: NOOP, rotate: NOOP, scale: NOOP,
};

function parseInput(s: string): InputState {
  try {
    const o = JSON.parse(s);
    return { up: !!o.up, down: !!o.down, left: !!o.left, right: !!o.right, fire: !!o.fire };
  } catch {
    return { up: false, down: false, left: false, right: false, fire: false };
  }
}

export function mountEngine(
  container: HTMLElement,
  {
    Phaser,
    mod,
    gameId,
    host,
    game,
  }: {
    Phaser: AnyPhaser;
    mod: Mod;
    gameId: string;
    host: () => boolean; // re-evaluated each frame (supports host election / migration)
    game: GameModule;
  }
): () => void {
  let local: EngineEntity[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursors: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gfx: any = null;
  let acc = 0;
  let lastSent: string | null = null;

  const readInput = (): InputState => ({
    up: !!(cursors && (cursors.up?.isDown || cursors.space?.isDown)),
    down: !!(cursors && cursors.down?.isDown),
    left: !!(cursors && cursors.left?.isDown),
    right: !!(cursors && cursors.right?.isDown),
    fire: !!(cursors && cursors.space?.isDown),
  });

  const api: EngineApi = {
    gameId,
    isHost: host(),
    dt: TICK_MS / 1000,
    entities: () => mod.getEntitiesRaw() as unknown as readonly SyncedEntity[],
    local: () => local,
    setLocal: (arr) => { local = arr; },
    input: readInput,
    players: () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod.getEngineInputsRaw() as any[]).map(
        (r): EnginePlayer => ({ id: r.identity.toHexString(), input: parseInput(r.input) })
      ),
    me: () => mod.getIdentityHex(),
    config: () => {
      const c = mod.getEngineConfigRaw();
      if (!c) return {};
      try {
        return JSON.parse(c.config) as Record<string, unknown>;
      } catch {
        return {};
      }
    },
    draw: NOOP_DRAW,
  };

  const scene = {
    key: "engine",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(this: any) {
      gfx = this.add.graphics();
      api.draw = makeDraw(gfx);
      cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
      if (game.init) game.init(api);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(this: any, _t: number, delta: number) {
      // Every client publishes its own input (the host reads all of them).
      const s = JSON.stringify(readInput());
      if (s !== lastSent) {
        mod.setEngineInput(gameId, s);
        lastSent = s;
      }

      if (host()) {
        acc += delta;
        let ticked = false;
        let guard = 0;
        while (acc >= TICK_MS && guard < 5) {
          game.tick(api);
          acc -= TICK_MS;
          ticked = true;
          guard++;
        }
        if (ticked) mod.commitEntities(gameId, JSON.stringify(local));
      }
      if (gfx) gfx.clear();
      game.render(api);
    },
  };

  const pg = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: "#0e0f12",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800, height: 600 },
    scene,
  });

  return () => {
    try {
      pg.destroy(true);
    } catch {
      /* already torn down */
    }
  };
}
