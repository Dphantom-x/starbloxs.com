"use client";

// Flappy game-over card for engine games in the room. Reads my bird's alive
// state from the synced cache; the engine's tap-Space-to-restart revives it.
// Renders nothing until I'm dead.
import { useEffect, useState } from "react";
import { useStdb } from "./StdbProvider";

export default function EngineOverlay({ gameType }: { gameType: string }) {
  const { mod } = useStdb();
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!mod || gameType !== "eflappy") return;
    const iv = window.setInterval(() => {
      const me = mod.getIdentityHex();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = mod.getEntitiesRaw().find((e: any) => {
        if (e.kind !== "fbird") return false;
        try {
          return JSON.parse(e.data).pid === me;
        } catch {
          return false;
        }
      });
      if (!b) {
        setDead(false);
        return;
      }
      try {
        const d = JSON.parse(b.data);
        setDead(d.alive === false);
        setScore(d.score ?? 0);
      } catch {
        setDead(false);
      }
    }, 200);
    return () => window.clearInterval(iv);
  }, [mod, gameType]);

  if (!dead) return null;
  return (
    <div className="gameover-overlay" data-testid="engine-gameover">
      <div className="gameover-card">
        <div className="go-title">Game over</div>
        <div className="go-stats">
          <div className="go-stat">
            <span className="go-stat-label">SCORE</span>
            <span className="go-stat-val">{score}</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Tap <b>Space</b> to play again
        </div>
      </div>
    </div>
  );
}
