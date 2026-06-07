// The game store — where a game's source lives so it can be loaded and played.
// Generated games (from /api/create) and the hand-written reference games are
// stored the SAME way, so "publish" means "persist the module the pipeline
// produced," and "join" means "load that module and run it."
//
// Today this is backed by localStorage (single device) — enough to prove the
// publish→load loop. The cross-device production upgrade is a SpacetimeDB
// `game_code` table (game_id pk, source, game_type, owner), written on publish
// and read on join — the same pattern as the existing engine_config table. That
// is the one change needed to make published AI games load on any device.
import { SEED_GAMES, type GameType, type GeneratedGame } from "./gamegen";

const KEY = "blox.gamecode.v1";

type Store = Record<string, GeneratedGame>; // gameId -> generated module

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}
function write(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — non-fatal */
  }
}

/** Persist the module a game was created from (called on publish). */
export function saveGameSource(gameId: string, game: GeneratedGame): void {
  const s = read();
  s[gameId] = game;
  write(s);
}

/** Load a game's stored module (called on join). Null if none stored. */
export function getGameSource(gameId: string): GeneratedGame | null {
  return read()[gameId] ?? null;
}

/** The seed reference game for a genre — the captured pipeline output we ship. */
export function seedFor(gameType: GameType): GeneratedGame {
  return SEED_GAMES[gameType];
}

/** Whether a game has stored AI-authored source (vs. a built-in reference game). */
export function hasGeneratedSource(gameId: string): boolean {
  return !!read()[gameId];
}
