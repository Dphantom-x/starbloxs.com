"use client";

// Cached one-click rule edits — game-type aware. For manually verifying the
// live hot-reload (Phase 4) and as the network-independent demo-day fallback.
// Only shown when NEXT_PUBLIC_TEST_MODE === '1'.
import { useStdb } from "./StdbProvider";

const TANK_PRESETS: { label: string; patch: object }[] = [
  { label: "Speed ×2", patch: { player_speed: 2 } },
  { label: "Bouncy shells", patch: { projectile_bounces: 6 } },
  { label: "Fast shells", patch: { projectile_speed: 2.5 } },
  { label: "Rapid fire", patch: { fire_cooldown_ms: 150 } },
  {
    label: "Boost strips",
    patch: {
      boost_zones: [
        { x: 0.15, y: 0.45, w: 0.18, h: 0.12, dir: [1, 0], strength: 3 },
        { x: 0.62, y: 0.3, w: 0.18, h: 0.12, dir: [-1, 0], strength: 3 },
      ],
    },
  },
];

const FLAPPY_PRESETS: { label: string; patch: object }[] = [
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
  if (!mod || process.env.NEXT_PUBLIC_TEST_MODE !== "1") return null;

  const presets = gameType === "flappy" ? FLAPPY_PRESETS : TANK_PRESETS;
  const apply = (patch: object) =>
    mod.applyRulesPatch(gameId, JSON.stringify(patch));

  return (
    <div
      data-testid="demo-controls"
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-gray-400">demo:</span>
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => apply(p.patch)}
          className="rounded-md border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => mod.resetGame(gameId)}
        className="rounded-md border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        Reset
      </button>
    </div>
  );
}
