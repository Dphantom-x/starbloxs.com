// window.__APP__ debug surface (mounted only when NEXT_PUBLIC_TEST_MODE === '1').
//
// Phaser renders to a <canvas> Playwright can't read, so we expose synced state
// and imperative reducer calls here. Everything returned must be JSON-safe, so
// rows are serialized: bigint -> string, Identity/ConnectionId -> hex string.
import * as stdb from "./spacetime";

function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = v as any;
    if (typeof obj.toHexString === "function") return obj.toHexString(); // Identity / ConnectionId
    // option / sum-type wrapper { tag: 'some'|'none', value? }
    if (typeof obj.tag === "string" && ("value" in obj || obj.tag === "none")) {
      return obj.tag === "none" ? null : plain(obj.value);
    }
    if (Array.isArray(v)) return v.map(plain);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) out[k] = plain(obj[k]);
    return out;
  }
  return v;
}
function plainRow(row: unknown): Record<string, unknown> {
  return plain(row) as Record<string, unknown>;
}

type Reducers = Record<string, (...args: unknown[]) => void>;

export function mountTestHooks(): void {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "1") return;

  (window as unknown as { __APP__: unknown }).__APP__ = {
    connected: () => stdb.isConnected(),
    identity: () => stdb.getIdentityHex(),
    currentGameId: () => {
      const g = stdb.getCurrentGameId();
      return g === null ? null : g.toString();
    },
    setCurrentGameId: (id: string | null) => stdb.setCurrentGameId(id),
    getGames: () => stdb.getGamesRaw().map(plainRow),
    getRules: () => {
      const r = stdb.getRulesRaw();
      return r ? plainRow(r) : null;
    },
    getEntities: () => stdb.getEntitiesRaw().map(plainRow),
    getPlayers: () => stdb.getPlayersRaw().map(plainRow),
    // Option-B engine: the current game's live config (parsed) + raw input rows.
    getEngineConfig: () => {
      const c = stdb.getEngineConfigRaw();
      if (!c) return null;
      try {
        return JSON.parse(c.config) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
    getEngineInputs: () => stdb.getEngineInputsRaw().map(plainRow),
    // Generic reducer call. Reducer accessors are camelCase of the snake_case name.
    callReducer: async (name: string, args?: unknown) => {
      const conn = stdb.getConnection();
      if (!conn) throw new Error("not connected");
      const reducers = (conn as unknown as { reducers: Reducers }).reducers;
      const fn = reducers[name];
      if (typeof fn !== "function") throw new Error(`unknown reducer: ${name}`);
      if (args === undefined) fn();
      else fn(args);
    },
    // Bypass the LLM and apply a rules patch directly. Wired in Phase 4/5 when
    // the apply_rules_patch reducer exists.
    forceEdit: async (patchJson: string) => {
      const conn = stdb.getConnection();
      if (!conn) throw new Error("not connected");
      const gid = stdb.getCurrentGameId();
      if (gid === null) throw new Error("no current game selected");
      const reducers = (conn as unknown as { reducers: Reducers }).reducers;
      const fn = reducers["applyRulesPatch"];
      if (typeof fn !== "function") {
        throw new Error("applyRulesPatch not available yet (added in Phase 4/5)");
      }
      fn({ gameId: gid, patch: patchJson });
    },
  };
}
