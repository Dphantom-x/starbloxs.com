// Sandbox Worker — runs UNTRUSTED, model-generated game logic in isolation. A
// Web Worker has no DOM, no window, and no access to the page; the only thing the
// game code can touch is the `api` we build here from the messages the host
// sends. This is the isolation boundary that makes running AI-authored code safe.
//
// Split of responsibility: the host's authoritative tick() (game logic) runs HERE
// and posts the committed entities back, which the host writes to SpacetimeDB
// exactly as the trusted path does. render() stays on the main thread and may
// only call the curated DrawApi (which exposes nothing but draw ops). So neither
// half of generated code gets ambient authority.
//
// This file is a self-contained worker (no imports of DOM-coupled modules).

/* eslint-disable @typescript-eslint/no-explicit-any */

type Entity = { key: string; kind: string; x: number; y: number; vx?: number; vy?: number; angle?: number; data?: any };

let mod: { id: string; init?: (api: any) => void; tick: (api: any) => void } | null = null;
let local: Entity[] = [];

const NOOP = () => {};
const NOOP_DRAW = new Proxy({}, { get: () => NOOP }); // draw is a no-op inside tick

function compile(source: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(`"use strict"; return (${source});`);
  const value = factory();
  const m = typeof value === "function" ? value() : value;
  if (!m || typeof m.tick !== "function") throw new Error("module has no tick()");
  return m;
}

self.onmessage = (ev: MessageEvent) => {
  const m = ev.data as
    | { t: "load"; source: string }
    | { t: "tick"; dt: number; players: { id: string; input: any }[]; config: Record<string, any>; me?: string };

  try {
    if (m.t === "load") {
      const game = compile(m.source);
      mod = game;
      local = [];
      if (game.init) game.init(makeApi(1 / 30, [], {}, null));
      (self as any).postMessage({ t: "ready" });
      return;
    }
    if (m.t === "tick" && mod) {
      const game = mod;
      const api = makeApi(m.dt, m.players, m.config, m.me ?? null);
      game.tick(api);
      (self as any).postMessage({ t: "entities", entities: local });
    }
  } catch (e) {
    (self as any).postMessage({ t: "error", error: (e as Error).message });
  }
};

// The exact EngineApi surface a game gets — built only from message data, so the
// worker grants no ambient capability.
function makeApi(dt: number, players: { id: string; input: any }[], config: Record<string, any>, me: string | null) {
  return {
    dt,
    isHost: true,
    entities: () => local,
    local: () => local,
    setLocal: (arr: Entity[]) => { local = arr; },
    input: () => (players[0]?.input ?? { up: false, down: false, left: false, right: false, fire: false }),
    players: () => players,
    me: () => me,
    config: () => config,
    draw: NOOP_DRAW,
  };
}
