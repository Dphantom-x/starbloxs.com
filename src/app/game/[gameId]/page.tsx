"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStdb } from "@/components/StdbProvider";
import DemoControls from "@/components/DemoControls";
import EditChat from "@/components/EditChat";
import Scoreboard from "@/components/Scoreboard";
import TouchControls from "@/components/TouchControls";
import GameOverCard from "@/components/GameOverCard";
import RoomQR from "@/components/RoomQR";
import { Conn, Page, BackLink, Icon, Marble } from "@/components/ui";
import { controlsHint } from "@/lib/rules";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
});

export default function GameRoom() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const { mod, connected, error } = useStdb();
  const joined = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [theater, setTheater] = useState(false);

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

  // The game stage changes size when entering/leaving theater mode; nudge
  // Phaser's scale manager to re-fit the canvas, and hide the app chrome so the
  // game is truly edge-to-edge.
  useEffect(() => {
    document.body.classList.toggle("sb-theater", theater);
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(t);
  }, [theater]);
  useEffect(() => () => document.body.classList.remove("sb-theater"), []);

  // Esc leaves fullscreen.
  useEffect(() => {
    if (!theater) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTheater(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theater]);

  const game = mod
    ? mod.getGamesRaw().find((g) => g.gameId.toString() === gameId)
    : undefined;
  const gameType = game?.gameType ?? "tanks";

  // NB: no `route-fade` here — its transform would make the fixed theater stage
  // anchor to this <main> instead of the viewport (i.e. not truly fullscreen).
  const roomClass =
    "room" +
    (theater ? " is-theater" : "") +
    (chatOpen ? " is-chatting" : "");

  return (
    <Page max={1320} testId="game-room" className={roomClass}>
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

      <div className="room-stage-wrap">
        <div className="canvas-stage room-stage">
          <div className="canvas-host game-fill">
            <GameCanvas gameId={gameId} />
            <div className="canvas-scan" />
          </div>

          {/* slim live scoreboard overlaid on the game */}
          <div className="stage-overlay stage-score">
            <Scoreboard gameId={gameId} gameType={gameType} compact />
          </div>

          <span className="canvas-badge mono">800 × 600 · live</span>

          {/* floating stage controls */}
          <div className="stage-controls">
            <button
              className="stage-btn"
              data-testid="fullscreen-toggle"
              aria-label={theater ? "Exit fullscreen" : "Fullscreen"}
              title={theater ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setTheater((t) => !t)}
            >
              <Icon name={theater ? "shrink" : "expand"} size={18} />
            </button>
            {!chatOpen && (
              <button
                className="stage-btn stage-btn-ai"
                data-testid="edit-open"
                onClick={() => setChatOpen(true)}
              >
                <Marble size={18} />
                <span>Edit with AI</span>
              </button>
            )}
          </div>

          {/* mobile / touch controls (CSS-gated to coarse / narrow screens) */}
          <TouchControls gameId={gameId} gameType={gameType} />

          {/* flappy game-over card (only when my bird has died) */}
          {gameType === "flappy" && <GameOverCard gameId={gameId} />}

          {/* chat drawer — slides in from the right on demand */}
          <div
            className={"chat-drawer" + (chatOpen ? " open" : "")}
            data-testid="chat-drawer"
            aria-hidden={!chatOpen}
          >
            <EditChat
              gameId={gameId}
              gameType={gameType}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>

        <DemoControls gameId={gameId} gameType={gameType} />
      </div>
    </Page>
  );
}
