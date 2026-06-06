"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStdb } from "@/components/StdbProvider";
import DemoControls from "@/components/DemoControls";
import EditChat from "@/components/EditChat";
import RoomQR from "@/components/RoomQR";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idHex(identity: any): string {
  if (identity && typeof identity.toHexString === "function") {
    return identity.toHexString();
  }
  return String(identity);
}

export default function GameRoom() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const { mod, connected } = useStdb();
  const joined = useRef(false);

  // Filter the entity/player cache to this game.
  useEffect(() => {
    if (!mod) return;
    mod.setCurrentGameId(gameId);
    return () => mod.setCurrentGameId(null);
  }, [mod, gameId]);

  // Join once connected (spawns this player's tank).
  useEffect(() => {
    if (!mod || !connected || joined.current) return;
    joined.current = true;
    mod.joinGame(gameId, "Player");
  }, [mod, connected, gameId]);

  const players = mod ? mod.getPlayersRaw() : [];
  const myId = mod ? mod.getIdentityHex() : null;
  const game = mod
    ? mod.getGamesRaw().find((g) => g.gameId.toString() === gameId)
    : undefined;
  const gameType = game?.gameType ?? "tanks";

  return (
    <main data-testid="game-room" className="min-h-screen p-6 font-sans">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← back to games
      </Link>
      <h1 className="mt-2 text-2xl font-bold" data-testid="room-title">
        Room {gameId}
      </h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-xs text-gray-500">
          {connected ? "connected" : "connecting…"} ·{" "}
          {gameType === "flappy"
            ? "up / space to flap"
            : "arrow keys to drive · space to fire"}
        </p>
        <RoomQR />
      </div>

      <GameCanvas gameId={gameId} />

      <EditChat gameId={gameId} gameType={gameType} />

      <div
        data-testid="scoreboard"
        className="mt-3 flex flex-wrap items-center gap-4"
      >
        {players.map((p) => {
          const mine = idHex(p.identity) === myId;
          return (
            <div key={idHex(p.identity)} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: mine ? "#22c55e" : "#ef4444" }}
              />
              <span className="font-mono text-sm">
                {p.name}: <b data-testid="score">{p.score}</b>
              </span>
            </div>
          );
        })}
      </div>

      <DemoControls gameId={gameId} gameType={gameType} />
    </main>
  );
}
