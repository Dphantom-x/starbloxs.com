// The pseudo-engine's public surface (the "SDK" the AI's game code targets).
// General primitives only — nothing game-specific.

// A host-authoritative entity the game's tick mutates and commits each frame.
// `key` is a stable host-assigned id so commits reconcile in place (smooth sync).
export type EngineEntity = {
  key: string;
  kind: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
};

// A synced entity row read back from SpacetimeDB — the render source of truth.
export type SyncedEntity = {
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  data: string;
};

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

// One player's synced input (the host reads all of these to simulate everyone).
export type EnginePlayer = { id: string; input: InputState };

// Immediate-mode 2D draw API over Phaser Graphics. Colors are 0xRRGGBB.
export type DrawApi = {
  rect(x: number, y: number, w: number, h: number, color: number, alpha?: number): void;
  roundedRect(x: number, y: number, w: number, h: number, radius: number, color: number, alpha?: number): void;
  circle(x: number, y: number, r: number, color: number, alpha?: number): void;
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: number, alpha?: number): void;
  strokeRect(x: number, y: number, w: number, h: number, color: number, width?: number, alpha?: number): void;
  strokeRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: number, width?: number, alpha?: number): void;
  strokeCircle(x: number, y: number, r: number, color: number, width?: number, alpha?: number): void;
  line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number, alpha?: number): void;
  gradientRect(x: number, y: number, w: number, h: number, top: number, bottom: number, alpha?: number): void;
  // transform stack (for rotated/scaled sprites like a tilting bird)
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(sx: number, sy: number): void;
};

// What a game module receives every tick/render.
export type EngineApi = {
  gameId: string;
  isHost: boolean;
  dt: number; // fixed timestep seconds (~1/30)
  entities(): readonly SyncedEntity[]; // synced cache (render from this)
  local(): EngineEntity[]; // host's authoritative sim state (mutate in tick)
  setLocal(arr: EngineEntity[]): void;
  input(): InputState; // this client's raw input
  players(): EnginePlayer[]; // every player's synced input (host reads this)
  me(): string | null; // my identity hex
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config(): Record<string, any>; // live per-game config (manhunt mode, tunable knobs)
  draw: DrawApi;
};

// A game = init? + a host-side tick + a per-frame render. The same module loads
// on every client; only the host runs `tick`.
export type GameModule = {
  id: string;
  init?(api: EngineApi): void;
  tick(api: EngineApi): void;
  render(api: EngineApi): void;
};
