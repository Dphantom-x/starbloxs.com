// Browser-only SpacetimeDB connection singleton.
//
// Owns: the WebSocket connection, anonymous-identity token persistence, table
// subscriptions, and synchronous reads of the local client cache. React
// components, the Phaser scenes, and the window.__APP__ test surface all read
// through this module. Verified against the generated bindings + spacetimedb
// 2.4.1 type defs (conn.db.<camelCaseName>.iter()/onInsert/onUpdate/onDelete).
import { DbConnection } from "@/module_bindings";

const URI = process.env.NEXT_PUBLIC_STDB_URI ?? "ws://localhost:3000";
const DB = process.env.NEXT_PUBLIC_STDB_DB ?? "blox";
const TOKEN_KEY = "blox.stdb.token";

let conn: DbConnection | null = null;
let connected = false;
let identityHex: string | null = null;
let currentGameId: bigint | null = null;

// Surfaced to the UI so a failed/misconfigured connection isn't a silent,
// forever "Connecting…". `configErrorSticky` keeps a config message (e.g. a
// placeholder DB name) from being overwritten by the SDK's generic WS error.
let connectError: string | null = null;
let configErrorSticky = false;
export function getConnectError(): string | null {
  return connectError;
}
/** A DB name like `<unique-name>` or empty means the env var was never filled in. */
function looksLikePlaceholder(v: string): boolean {
  const s = v.trim();
  return s === "" || s.includes("<") || s.includes(">");
}

// Lightweight change bus so React re-renders and Phaser polls see fresh cache.
let version = 0;
const listeners = new Set<() => void>();
function emit(): void {
  version++;
  for (const fn of listeners) fn();
}
/** Monotonic counter that bumps on every cache change (for React subscriptions). */
export function getVersion(): number {
  return version;
}
export function onChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isConnected(): boolean {
  return connected;
}
export function getIdentityHex(): string | null {
  return identityHex;
}
export function getConnection(): DbConnection | null {
  return conn;
}
export function getCurrentGameId(): bigint | null {
  return currentGameId;
}
export function setCurrentGameId(id: bigint | string | null): void {
  currentGameId =
    id === null ? null : typeof id === "string" ? BigInt(id) : id;
  emit();
}

/** Idempotent: builds the connection once, restoring the saved identity token. */
export function connect(): DbConnection {
  if (conn) return conn;
  if (typeof window === "undefined") {
    throw new Error("SpacetimeDB connect() is browser-only");
  }

  const savedToken = window.localStorage.getItem(TOKEN_KEY) ?? undefined;

  // Catch the most common deploy mistake before the WS even opens: the
  // `<unique-name>` placeholder pasted verbatim into NEXT_PUBLIC_STDB_DB.
  if (looksLikePlaceholder(DB)) {
    connectError =
      `NEXT_PUBLIC_STDB_DB is a placeholder ("${DB}") — set it to your real ` +
      `database name (the one you published to Maincloud). URI=${URI}`;
    configErrorSticky = true;
  }

  let builder = DbConnection.builder()
    .withUri(URI)
    .withDatabaseName(DB)
    .onConnect((c, identity, token) => {
      connected = true;
      connectError = null;
      configErrorSticky = false;
      identityHex = identity.toHexString();
      try {
        window.localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* private mode / storage disabled — non-fatal */
      }

      // Bump the change bus on every row mutation across all tables.
      const bump = (): void => emit();
      c.db.game.onInsert(bump);
      c.db.game.onUpdate(bump);
      c.db.game.onDelete(bump);
      c.db.game_rules.onInsert(bump);
      c.db.game_rules.onUpdate(bump);
      c.db.game_rules.onDelete(bump);
      c.db.map_features.onInsert(bump);
      c.db.map_features.onUpdate(bump);
      c.db.map_features.onDelete(bump);
      c.db.player.onInsert(bump);
      c.db.player.onUpdate(bump);
      c.db.player.onDelete(bump);
      c.db.entity.onInsert(bump);
      c.db.entity.onUpdate(bump);
      c.db.entity.onDelete(bump);

      // Phase 0: subscribe to everything (tiny). Later phases narrow by game_id
      // with `SELECT * FROM entity WHERE game_id = X`.
      c.subscriptionBuilder()
        .onApplied(() => emit())
        .subscribeToAllTables();
      emit();
    })
    .onConnectError((_ctx, err) => {
      console.error("[stdb] connect error:", err);
      if (!configErrorSticky) {
        connectError =
          `Couldn't reach the SpacetimeDB server at ${URI} (database "${DB}"). ` +
          `Check NEXT_PUBLIC_STDB_URI / NEXT_PUBLIC_STDB_DB.`;
      }
      emit();
    })
    .onDisconnect((_ctx, err) => {
      connected = false;
      if (err) {
        console.warn("[stdb] disconnected:", err);
        if (!configErrorSticky) {
          connectError = `Disconnected from ${URI} (database "${DB}").`;
        }
      }
      emit();
    });

  if (savedToken) builder = builder.withToken(savedToken);

  conn = builder.build();

  // Belt-and-suspenders: if the socket neither connects nor errors (e.g. it
  // just hangs against a wrong host), surface a hint rather than spin forever.
  window.setTimeout(() => {
    if (!connected && !connectError) {
      connectError =
        `Still can't reach ${URI} (database "${DB}"). ` +
        `Check NEXT_PUBLIC_STDB_URI / NEXT_PUBLIC_STDB_DB.`;
      emit();
    }
  }, 10_000);

  return conn;
}

// ---- synchronous cache reads (filtered by the current game when one is set) ----

export function getGamesRaw() {
  if (!conn) return [];
  return [...conn.db.game.iter()];
}

export function getEntitiesRaw() {
  if (!conn) return [];
  const all = [...conn.db.entity.iter()];
  return currentGameId === null
    ? all
    : all.filter((e) => e.gameId === currentGameId);
}

export function getPlayersRaw() {
  if (!conn) return [];
  const all = [...conn.db.player.iter()];
  return currentGameId === null
    ? all
    : all.filter((p) => p.gameId === currentGameId);
}

export function getRulesRaw() {
  if (!conn || currentGameId === null) return null;
  for (const r of conn.db.game_rules.iter()) {
    if (r.gameId === currentGameId) return r;
  }
  return null;
}

export function getMapFeaturesRaw() {
  if (!conn || currentGameId === null) return null;
  for (const m of conn.db.map_features.iter()) {
    if (m.gameId === currentGameId) return m;
  }
  return null;
}

/** All game_rules rows (for per-card rule chips on the home/lobby screens). */
export function getAllRulesRaw() {
  if (!conn) return [];
  return [...conn.db.game_rules.iter()];
}

/** Players in a specific game, regardless of the current game filter. */
export function getPlayersForRaw(gameId: string) {
  if (!conn) return [];
  const gid = BigInt(gameId);
  return [...conn.db.player.iter()].filter((p) => p.gameId === gid);
}

// ---- reducer calls (camelCase args; gameId is a bigint) ----

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

export function joinGame(gameId: string, name: string): void {
  if (!conn) return;
  conn.reducers.joinGame({ gameId: BigInt(gameId), name });
}

export function setInput(gameId: string, input: InputState): void {
  if (!conn) return;
  conn.reducers.setInput({ gameId: BigInt(gameId), ...input });
}

/** Option B engine: host commits its authoritative entity set for a game (~30Hz). */
export function commitEntities(gameId: string, entitiesJson: string): void {
  if (!conn) return;
  conn.reducers.commitEntities({ gameId: BigInt(gameId), entities: entitiesJson });
}

/** Option B engine: publish this client's input for an engine game. */
export function setEngineInput(gameId: string, inputJson: string): void {
  if (!conn) return;
  conn.reducers.setEngineInput({ gameId: BigInt(gameId), input: inputJson });
}

/** Synced per-player input rows for the current engine game (host reads these). */
export function getEngineInputsRaw() {
  if (!conn) return [];
  const all = [...conn.db.engine_input.iter()];
  return currentGameId === null ? all : all.filter((r) => r.gameId === currentGameId);
}

/** Option B engine: write a game's live config (the live-edit path). */
export function setEngineConfig(gameId: string, configJson: string): void {
  if (!conn) return;
  conn.reducers.setEngineConfig({ gameId: BigInt(gameId), config: configJson });
}

/** The current engine game's live config row (or null). */
export function getEngineConfigRaw() {
  if (!conn || currentGameId === null) return null;
  for (const r of conn.db.engine_config.iter()) {
    if (r.gameId === currentGameId) return r;
  }
  return null;
}

/** Apply a (client-validated) rules patch directly — the live hot-reload. */
export function applyRulesPatch(gameId: string, patchJson: string): void {
  if (!conn) return;
  conn.reducers.applyRulesPatch({ gameId: BigInt(gameId), patch: patchJson });
}

export function resetGame(gameId: string): void {
  if (!conn) return;
  conn.reducers.resetGame({ gameId: BigInt(gameId) });
}

/** Flappy: revive the caller's bird after a game-over and start a fresh run. */
export function respawn(gameId: string): void {
  if (!conn) return;
  conn.reducers.respawn({ gameId: BigInt(gameId) });
}

// ---- create / remix (Phase 7) ----
// Reducers can't return values, so resolve the new game's id by watching the
// cache for a new game owned by me appearing after the call.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerHexOf(g: any): string | null {
  return g.owner && typeof g.owner.toHexString === "function"
    ? g.owner.toHexString()
    : null;
}

function waitForMyNewGame(before: Set<string>): Promise<string | null> {
  return new Promise((resolve) => {
    const me = identityHex;
    let done = false;
    let off: () => void = () => {};
    let timer: ReturnType<typeof setTimeout>;
    const finish = (id: string | null) => {
      if (done) return;
      done = true;
      off();
      clearTimeout(timer);
      resolve(id);
    };
    const check = () => {
      for (const g of getGamesRaw()) {
        const idStr = g.gameId.toString();
        if (before.has(idStr)) continue;
        if (!me || ownerHexOf(g) === me) {
          finish(idStr);
          return;
        }
      }
    };
    off = onChange(check);
    timer = setTimeout(() => finish(null), 8000);
    check();
  });
}

export function createGameAndWait(
  gameType: string,
  name: string
): Promise<string | null> {
  if (!conn) return Promise.resolve(null);
  const before = new Set(getGamesRaw().map((g) => g.gameId.toString()));
  const p = waitForMyNewGame(before);
  conn.reducers.createGame({ gameType, name });
  return p;
}

export function remixGameAndWait(gameId: string): Promise<string | null> {
  if (!conn) return Promise.resolve(null);
  const before = new Set(getGamesRaw().map((g) => g.gameId.toString()));
  const p = waitForMyNewGame(before);
  conn.reducers.remixGame({ gameId: BigInt(gameId) });
  return p;
}

export function deleteGame(gameId: string): void {
  if (!conn) return;
  conn.reducers.deleteGame({ gameId: BigInt(gameId) });
}
