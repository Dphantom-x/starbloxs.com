"use client";

// Cached one-click rule edits — game-type aware. For manually verifying the
// live hot-reload and as the network-independent demo-day fallback. Only shown
// when NEXT_PUBLIC_TEST_MODE === '1'.
import { useState } from "react";
import { useStdb } from "./StdbProvider";

// Speed pads at random spots (matches the "speed blitz" AI edit).
function randomPads() {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  return {
    boost_zones: Array.from({ length: 3 }, () => ({
      x: +(0.1 + Math.random() * 0.68).toFixed(2),
      y: +(0.12 + Math.random() * 0.6).toFixed(2),
      w: 0.13,
      h: 0.13,
      dir: dirs[Math.floor(Math.random() * dirs.length)],
      strength: 2,
    })),
  };
}

type Preset = { label: string; patch: object | (() => object) };

const TANK_PRESETS: Preset[] = [
  { label: "Speed ×2", patch: { player_speed: 2 } },
  { label: "Bouncy shells", patch: { projectile_bounces: 6 } },
  { label: "Fast shells", patch: { projectile_speed: 2.5 } },
  { label: "Rapid fire", patch: { fire_cooldown_ms: 150 } },
  { label: "Speed blitz", patch: randomPads },
];

const FLAPPY_PRESETS: Preset[] = [
  { label: "Low gravity", patch: { gravity: 0.45 } },
  { label: "Heavy gravity", patch: { gravity: 2.2 } },
  { label: "Wide gaps", patch: { pipe_gap: 1.8 } },
  { label: "More gaps", patch: { gaps_per_pipe: 4 } },
  { label: "Birds collide", patch: { bird_collision: true } },
  { label: "Tall field", patch: { field_height: 2 } },
];

export default function DemoControls({
  gameId,
  gameType,
}: {
  gameId: string;
  gameType: string;
}) {
  const { mod } = useStdb();
  const [active, setActive] = useState<string | null>(null);
  if (!mod || process.env.NEXT_PUBLIC_TEST_MODE !== "1") return null;

  const presets = gameType === "flappy" ? FLAPPY_PRESETS : TANK_PRESETS;
  const apply = (label: string, patch: object | (() => object)) => {
    setActive(label);
    const resolved = typeof patch === "function" ? patch() : patch;
    mod.applyRulesPatch(gameId, JSON.stringify(resolved));
  };

  return (
    <div className="panel demo" data-testid="demo-controls">
      <span className="demo-label mono">demo</span>
      <div className="demo-presets">
        {presets.map((p) => (
          <button
            key={p.label}
            className={"chip" + (active === p.label ? " chip-on" : "")}
            onClick={() => apply(p.label, p.patch)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setActive(null);
          mod.resetGame(gameId);
        }}
      >
        Reset
      </button>
    </div>
  );
}
