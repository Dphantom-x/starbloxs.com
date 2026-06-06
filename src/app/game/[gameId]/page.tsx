"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStdb } from "@/components/StdbProvider";
import DemoControls from "@/components/DemoControls";
import EditChat from "@/components/EditChat";
import Scoreboard from "@/components/Scoreboard";
import RoomQR from "@/components/RoomQR";
import { Conn, Page, BackLink } from "@/components/ui";
import { controlsHint } from "@/lib/rules";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
});

export default function GameRoom() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const { mod, connected, error } = useStdb();
  const joined = useRef(false);

  // Filter the entity/player cache to this game.
  useEffect(() => {
    if (!mod) return;
    mod.setCurrentGameId(gameId);
    return () => mod.setCurrentGameId(null);
  }, [mod, gameId]);

  // Join once connected (spawns this player's tank / bird).
  useEffect(() => {
    if (!mod || !connected || joined.current) return;
    joined.current = true;
    mod.joinGame(gameId, "Player");
  }, [mod, connected, gameId]);

  const game = mod
    ? mod.getGamesRaw().find((g) => g.gameId.toString() === gameId)
    : undefined;
  const gameType = game?.gameType ?? "tanks";

  return (
    <Page max={1240} testId="game-room">
      <div className="room-top">
        <BackLink />
        <div className="room-title-row">
          <div className="room-titles">
            <h1 className="room-name">{game?.name ?? `Room ${gameId}`}</h1>
            <div className="room-meta">
              <Conn connected={connected} error={error} />
              <span className="dot-sep">·</span>
              <span className="room-controls mono">{controlsHint(gameType)}</span>
              <span className="room-id mono" data-testid="room-title">
                Room {gameId}
              </span>
            </div>
          </div>
          <RoomQR />
        </div>
      </div>

      <div className="room-grid">
        <div className="room-main">
          <div className="canvas-stage">
            <div className="canvas-host">
              <GameCanvas gameId={gameId} />
              <div className="canvas-scan" />
              <span className="canvas-badge mono">800 × 600 · live</span>
            </div>
          </div>
          <DemoControls gameId={gameId} gameType={gameType} />
        </div>
        <aside className="room-rail">
          <EditChat gameId={gameId} gameType={gameType} />
          <Scoreboard gameId={gameId} gameType={gameType} />
        </aside>
      </div>
    </Page>
  );
}
