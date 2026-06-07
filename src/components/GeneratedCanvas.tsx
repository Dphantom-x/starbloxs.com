"use client";

// Mounts an AI-generated gallery game by compiling its registry code STRING
// through the loader. The code ships in the client bundle, so every player has
// it — multiplayer-safe (unlike room games whose source is per-device). Each
// generated game has a fixed gameId, so everyone who opens /g/<id> shares one
// live instance. Host = lowest identity among this game's engine_input rows.
import { useEffect, useRef } from "react";
import { useStdb } from "./StdbProvider";
import { mountEngine } from "@/engine/runtime";
import { compileGameModule } from "@/engine/loader";
import { GENERATED_GAMES } from "@/games/generated";

export default function GeneratedCanvas({ genId }: { genId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { mod } = useStdb();

  useEffect(() => {
    if (!ref.current || !mod) return;
    const entry = GENERATED_GAMES[genId];
    if (!entry) return;

    let game;
    try {
      game = compileGameModule(entry.code);
    } catch (err) {
      console.error("[generated] failed to compile:", err);
      return;
    }
    const gameId = entry.gameId;
    mod.setCurrentGameId(gameId); // so input/entity reads filter to this game

    const host = () => {
      const me = mod.getIdentityHex();
      if (!me) return false;
      const ids = mod
        .getEngineInputsRaw()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.identity.toHexString() as string)
        .sort();
      return ids.length > 0 && ids[0] === me;
    };

    let destroyed = false;
    let cleanup = () => {};
    (async () => {
      const Phaser = (await import("phaser")).default;
      if (destroyed || !ref.current) return;
      cleanup = mountEngine(ref.current, { Phaser, mod, gameId, host, game });
    })();
    return () => {
      destroyed = true;
      cleanup();
      mod.setCurrentGameId(null);
    };
  }, [mod, genId]);

  return <div ref={ref} data-testid="game-canvas" className="game-canvas-host" />;
}
