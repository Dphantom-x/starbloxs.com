"use client";

// Mounts an Option-B engine game inside the real room. Picks the game module by
// type and elects a host (smallest identity among the game's engine_input rows,
// re-evaluated each frame so it migrates if the host leaves). Loaded via
// next/dynamic({ ssr:false }) so Phaser never runs during SSR.
import { useEffect, useRef } from "react";
import { useStdb } from "./StdbProvider";
import { mountEngine } from "@/engine/runtime";
import { flappyGame } from "@/games/flappy";
import { tankGame } from "@/games/tank";
import type { GameModule } from "@/engine/types";

const MODULES: Record<string, GameModule> = { eflappy: flappyGame, etank: tankGame };

export default function EngineCanvas({
  gameId,
  gameType,
}: {
  gameId: string;
  gameType: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mod } = useStdb();

  useEffect(() => {
    if (!ref.current || !mod) return;
    const game = MODULES[gameType] ?? flappyGame;

    // Host election: the lowest identity among this game's engine_input rows.
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
    };
  }, [mod, gameId, gameType]);

  return <div ref={ref} data-testid="game-canvas" className="game-canvas-host" />;
}
