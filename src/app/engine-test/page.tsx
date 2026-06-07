"use client";

// Engine harness for the gates. `?host=1` runs the host sim; any other client
// renders from the synced cache. `?game=proof|controls|flappy` picks the game.
// Exposes window.__ENGINE__ for the Playwright gates + a flappy game-over overlay.
import { useEffect, useRef, useState } from "react";
import { useStdb } from "@/components/StdbProvider";
import { mountEngine } from "@/engine/runtime";
import { proofGame } from "@/games/proof";
import { controlsGame } from "@/games/controls";
import { flappyGame } from "@/games/flappy";
import { tankGame } from "@/games/tank";
import { compileGameModule } from "@/engine/loader";
import { GENERATED_GAMES } from "@/games/generated";
import type { GameModule } from "@/engine/types";

const GAME_IDS: Record<string, string> = {
  proof: "9000001",
  controls: "9000002",
  flappy: "9000003",
  tank: "9000004",
};
const GAMES = { proof: proofGame, controls: controlsGame, flappy: flappyGame, tank: tankGame };
const PIPE_W = 70;

export default function EngineTestPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { mod, connected } = useStdb();
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const [isFlappy, setIsFlappy] = useState(false);

  useEffect(() => {
    if (!ref.current || !mod || !connected) return;
    const params = new URLSearchParams(window.location.search);
    const isHost = params.get("host") === "1";
    const gk = params.get("game");
    let game: GameModule;
    let gameId: string;
    if (gk === "gen") {
      // Compile an AI-generated game from its CODE STRING through the real loader
      // — the "string -> compile -> run" pipeline, genuinely exercised.
      const entry = GENERATED_GAMES[params.get("id") ?? ""];
      if (!entry) return;
      try {
        game = compileGameModule(entry.code);
      } catch (err) {
        console.error("[engine-test] generated game failed to compile:", err);
        return;
      }
      gameId = entry.gameId;
      setIsFlappy(false);
    } else {
      const gameKey: keyof typeof GAMES =
        gk === "controls" || gk === "flappy" || gk === "tank" ? gk : "proof";
      setIsFlappy(gameKey === "flappy");
      game = GAMES[gameKey];
      gameId = GAME_IDS[gameKey];
    }
    mod.setCurrentGameId(gameId);

    let destroyed = false;
    let cleanup = () => {};
    (async () => {
      const Phaser = (await import("phaser")).default;
      if (destroyed || !ref.current) return;
      cleanup = mountEngine(ref.current, { Phaser, mod, gameId, host: () => isHost, game });
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyOf = (e: any) => {
      try {
        return JSON.parse(e.data).__key ?? "";
      } catch {
        return "";
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const birdState = (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = mod.getEntitiesRaw().find((e: any) => {
        if (e.kind !== "fbird") return false;
        try {
          return JSON.parse(e.data).pid === id;
        } catch {
          return false;
        }
      });
      if (!b) return null;
      try {
        const d = JSON.parse(b.data);
        return { x: b.x, y: b.y, alive: d.alive !== false, score: d.score ?? 0 };
      } catch {
        return null;
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__ENGINE__ = {
      ready: () => true,
      host: () => isHost,
      myId: () => mod.getIdentityHex(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: (kind: string) => mod.getEntitiesRaw().filter((e: any) => e.kind === kind).length,
      // Generic helpers for the generated-game gameplay tests.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      all: () => mod.getEntitiesRaw().map((e: any) => ({ kind: e.kind, x: e.x, y: e.y })),
      dataOf: (kind: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = mod.getEntitiesRaw().find((x: any) => x.kind === kind);
        if (!e) return null;
        try {
          return JSON.parse(e.data);
        } catch {
          return null;
        }
      },
      firstOf: (kind: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = mod.getEntitiesRaw().find((x: any) => x.kind === kind);
        return e ? { x: e.x, y: e.y } : null;
      },
      pos: (key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = mod.getEntitiesRaw().find((x: any) => keyOf(x) === key);
        return e ? { x: e.x, y: e.y } : null;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      boxCount: () => mod.getEntitiesRaw().filter((e: any) => e.kind === "box").length,
      firstBoxT: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = mod.getEntitiesRaw().find((e: any) => e.kind === "box");
        if (!b) return -1;
        try {
          return (JSON.parse(b.data).t as number) ?? -1;
        } catch {
          return -1;
        }
      },
      pipeGaps: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = mod.getEntitiesRaw().find((e: any) => e.kind === "fpipe");
        if (!p) return -1;
        try {
          return (JSON.parse(p.data).gaps ?? []).length;
        } catch {
          return -1;
        }
      },
      birdState,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tankState: (id: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = mod.getEntitiesRaw().find((e: any) => {
          if (e.kind !== "etank") return false;
          try {
            return JSON.parse(e.data).pid === id;
          } catch {
            return false;
          }
        });
        if (!t) return null;
        try {
          const d = JSON.parse(t.data);
          return { x: t.x, y: t.y, boosted: !!d.boosted, score: d.score ?? 0 };
        } catch {
          return null;
        }
      },
      // The y a simple bot should aim for: nearest upcoming pipe's gap closest to the bird.
      aimGap: (id: string) => {
        const bird = birdState(id);
        if (!bird) return 300;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pipes = mod.getEntitiesRaw().filter((e: any) => e.kind === "fpipe");
        let best: { gaps: number[] } | null = null;
        let bestDx = Infinity;
        for (const p of pipes) {
          const dx = p.x - bird.x;
          if (dx > -PIPE_W && dx < bestDx) {
            bestDx = dx;
            try {
              best = { gaps: JSON.parse(p.data).gaps ?? [] };
            } catch {
              best = { gaps: [] };
            }
          }
        }
        if (!best || best.gaps.length === 0) return 300;
        let g = best.gaps[0];
        let md = Infinity;
        for (const c of best.gaps) {
          const d = Math.abs(bird.y - c);
          if (d < md) {
            md = d;
            g = c;
          }
        }
        return g;
      },
    };

    // Poll my flappy bird for the game-over overlay.
    const iv = window.setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const id = w.__ENGINE__?.myId?.();
      const s = id ? w.__ENGINE__?.birdState?.(id) : null;
      setDead(!!s && !s.alive);
      setScore(s ? s.score : 0);
    }, 200);

    return () => {
      destroyed = true;
      cleanup();
      clearInterval(iv);
    };
  }, [mod, connected]);

  return (
    <main className="page" style={{ display: "block" }}>
      <div className="page-inner">
        <h1 className="hero-title" style={{ fontSize: 28, marginBottom: 14 }}>
          Engine test
        </h1>
        <div style={{ position: "relative", width: "100%", maxWidth: 800, margin: "0 auto" }}>
          <div
            ref={ref}
            data-testid="engine-canvas"
            className="game-canvas-host"
            style={{ width: "100%", height: 600, borderRadius: 12, overflow: "hidden", background: "#0e0f12" }}
          />
          {isFlappy && dead && (
            <div
              data-testid="engine-gameover"
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(10,12,16,.5)",
                backdropFilter: "blur(2px)",
                borderRadius: 12,
              }}
            >
              <div className="card" style={{ padding: "24px 28px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="hero-title" style={{ fontSize: 26 }}>Game over</div>
                <div className="mono" style={{ color: "var(--muted)" }}>score {score}</div>
                <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  Tap <b>Space</b> to play again
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
