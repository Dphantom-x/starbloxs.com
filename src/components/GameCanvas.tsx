"use client";

// Phaser mount. Loaded via next/dynamic({ ssr: false }) from the room page so
// Phaser (browser-only) never runs during SSR. Picks the scene by game type.
import { useEffect, useRef } from "react";
import { useStdb } from "./StdbProvider";

export default function GameCanvas({ gameId }: { gameId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mod } = useStdb();

  useEffect(() => {
    if (!containerRef.current || !mod) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let game: any = null;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { createTankScene } = await import("@/game/TankScene");
      const { createFlappyScene } = await import("@/game/FlappyScene");

      // Wait for the game row to sync so we mount the right scene.
      let type: string | undefined;
      for (let i = 0; i < 50 && !destroyed; i++) {
        type = mod
          .getGamesRaw()
          .find((x) => x.gameId.toString() === gameId)?.gameType;
        if (type) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (destroyed || !containerRef.current) return;

      const scene =
        type === "flappy"
          ? createFlappyScene(Phaser, { mod, gameId })
          : createTankScene(Phaser, { mod, gameId });

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#e9eef2",
        // Logical resolution stays 800x600 (all scenes assume it); Phaser's
        // scale manager fits + centers the canvas into the parent and remaps
        // input internally, so the game stays crisp at any display size.
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 800,
          height: 600,
        },
        scene,
      });
    })();

    return () => {
      destroyed = true;
      if (game) game.destroy(true);
    };
  }, [mod, gameId]);

  return (
    <div ref={containerRef} data-testid="game-canvas" className="game-canvas-host" />
  );
}
