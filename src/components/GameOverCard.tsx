"use client";

// Flappy game-over card — shows when MY player is dead (player.alive === false).
// Score + best (localStorage) + a "Play again" button that calls respawn().
// Per-player: only the bird that died sees this; everyone else keeps flying.
import { useEffect, useRef, useState } from "react";
import { useStdb } from "./StdbProvider";
import { Icon } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idHex(identity: any): string {
  return identity && typeof identity.toHexString === "function"
    ? identity.toHexString()
    : String(identity);
}

export default function GameOverCard({ gameId }: { gameId: string }) {
  const { mod } = useStdb();
  const myId = mod ? mod.getIdentityHex() : null;
  const me = mod
    ? mod.getPlayersForRaw(gameId).find((p) => idHex(p.identity) === myId)
    : undefined;
  const dead = !!me && me.alive === false;
  const score = me ? Number(me.score) : 0;
  const [best, setBest] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    if (!dead) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    const key = `flappy.best.${gameId}`;
    let b = 0;
    try {
      b = Number(window.localStorage.getItem(key) || 0);
    } catch {
      /* storage disabled */
    }
    const nb = Math.max(b, score);
    try {
      window.localStorage.setItem(key, String(nb));
    } catch {
      /* storage disabled */
    }
    setBest(nb);
  }, [dead, score, gameId]);

  if (!mod || !dead) return null;

  return (
    <div className="gameover-overlay" data-testid="gameover">
      <div className="gameover-card pop-in">
        <div className="go-title">Game Over</div>
        <div className="go-stats">
          <div className="go-stat">
            <span className="go-stat-label mono">SCORE</span>
            <span className="go-stat-val" data-testid="gameover-score">
              {score}
            </span>
          </div>
          <div className="go-stat">
            <span className="go-stat-label mono">BEST</span>
            <span className="go-stat-val">{best}</span>
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg btn-block"
          data-testid="gameover-restart"
          onClick={() => mod.respawn(gameId)}
        >
          <Icon name="play" size={16} /> Play again
        </button>
      </div>
    </div>
  );
}
