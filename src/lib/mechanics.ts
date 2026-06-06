// THE MECHANIC LIBRARY — the fixed universe of legal AI edits (BUILD_SPEC §7).
// The Zod schema below is what /api/edit validates the model output against, and
// what the server-side apply_rules_patch re-clamps. The AI can ONLY emit these
// keys, in range. Unknown keys are rejected (.strict()).
import { z } from "zod";

const PerPlayer = z
  .object({
    target: z
      .enum(["random", "loser", "leader", "all_others"])
      .describe("which player(s) this override applies to"),
    speed_override: z.number().min(0.25).max(4).optional().describe(
      "this player's movement multiplier (1 = normal)"
    ),
    weapon: z.enum(["normal", "laser"]).optional(),
    role: z.enum(["normal", "hunter", "runner"]).optional(),
    vision_radius: z
      .number()
      .min(0)
      .max(10)
      .optional()
      .describe("0 = full map; otherwise a fog reveal radius 2-10"),
  })
  .strict();

const BoostZone = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    dir: z.tuple([z.number(), z.number()]),
    strength: z.number().min(1).max(3),
  })
  .strict();

export const RulesPatchSchema = z
  .object({
    game_type: z.enum(["tanks", "flappy"]).optional().describe(
      "only set when CREATING a new game; omit when editing an existing one"
    ),
    // ---- global ----
    player_speed: z.number().min(0.25).max(4).optional().describe(
      "global movement speed multiplier; 1 = normal"
    ),
    win_score: z.number().int().min(1).max(100).optional(),
    projectile_bounces: z.number().int().min(0).max(10).optional().describe(
      "how many times tank shells bounce off walls"
    ),
    projectile_speed: z.number().min(0.5).max(3).optional(),
    fire_cooldown_ms: z.number().int().min(100).max(3000).optional(),
    gravity: z.number().min(0.2).max(3).optional().describe(
      "flappy gravity multiplier; 1 = normal"
    ),
    field_height: z.number().min(1).max(3).optional().describe(
      "flappy playfield height multiplier (taller)"
    ),
    gaps_per_pipe: z.number().int().min(1).max(5).optional().describe(
      "number of safe gaps in each flappy pipe column"
    ),
    pipe_gap: z.number().min(0.5).max(2).optional(),
    pipe_speed: z.number().min(0.5).max(3).optional(),
    bird_collision: z.boolean().optional().describe(
      "whether flappy birds collide with each other"
    ),
    // ---- per-player (tanks) ----
    per_player: z.array(PerPlayer).optional(),
    // ---- spatial (tanks) ----
    boost_zones: z.array(BoostZone).optional().describe(
      "directional speed strips; coords normalized 0..1 of the field"
    ),
    // ---- cosmetic (client) ----
    wall_graze_sparks: z.boolean().optional().describe(
      "particle burst when a tank scrapes a wall"
    ),
  })
  .strict();

export type RulesPatch = z.infer<typeof RulesPatchSchema>;

/** `n` speed pads at random spots (normalized 0..1), each pointing a random way. */
function randomBoostZones(n: number): NonNullable<RulesPatch["boost_zones"]> {
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const zones: NonNullable<RulesPatch["boost_zones"]> = [];
  for (let i = 0; i < n; i++) {
    zones.push({
      x: +(0.1 + Math.random() * 0.68).toFixed(2),
      y: +(0.12 + Math.random() * 0.6).toFixed(2),
      w: 0.13,
      h: 0.13,
      dir: dirs[Math.floor(Math.random() * dirs.length)],
      strength: 2,
    });
  }
  return zones;
}

/**
 * Deterministic prompt -> patch mapping used when there's no ANTHROPIC_API_KEY
 * or in test mode. Also the network-independent demo-day fallback. Patches are
 * validated by RulesPatchSchema before use.
 */
export function cannedPatch(
  prompt: string,
  mode: "create" | "edit" = "edit"
): RulesPatch | null {
  const p = prompt.toLowerCase();

  // CREATE mode: the AI picks a game type + initial rules for a brand-new game.
  if (mode === "create") {
    if (p.includes("flappy") || p.includes("bird")) {
      const patch: RulesPatch = { game_type: "flappy" };
      if (p.includes("tall")) patch.field_height = 2.5;
      const gm = p.match(/(\d+)\s*(?:safe\s*|different\s*)?gap/);
      if (gm) {
        patch.gaps_per_pipe = Math.max(1, Math.min(5, parseInt(gm[1], 10)));
      } else if (
        p.includes("few gap") ||
        p.includes("several gap") ||
        p.includes("different gap") ||
        p.includes("multiple gap")
      ) {
        patch.gaps_per_pipe = 3;
      }
      if (p.includes("collide") || p.includes("knock") || p.includes("bump")) {
        patch.bird_collision = true;
      }
      return patch;
    }
    // Default: a tank game (optionally tweaked).
    const patch: RulesPatch = { game_type: "tanks" };
    if (p.includes("bounc")) patch.projectile_bounces = 5;
    if (p.includes("fast") || p.includes("speed")) patch.player_speed = 1.6;
    return patch;
  }

  // Combined demo/test prompt: "twice as fast and shells bounce 5 times"
  if (
    (p.includes("twice") || p.includes("2x") || p.includes("double")) &&
    p.includes("bounce")
  ) {
    return { player_speed: 2, projectile_bounces: 5 };
  }

  // Manhunt remix
  if (
    p.includes("manhunt") ||
    p.includes("horror") ||
    (p.includes("hunter") && (p.includes("black out") || p.includes("blackout")))
  ) {
    return {
      wall_graze_sparks: true,
      per_player: [
        { target: "random", role: "hunter", vision_radius: 3 },
        { target: "all_others", role: "runner", vision_radius: 3 },
      ],
    };
  }

  // Boost strips + laser backup prompt
  if (p.includes("boost") && p.includes("laser")) {
    return {
      projectile_bounces: 4,
      boost_zones: randomBoostZones(3),
      per_player: [
        { target: "loser", speed_override: 0.6, weapon: "laser" },
        { target: "all_others", speed_override: 1.25 },
      ],
    };
  }

  // Speed pads ("speed blitz" / boost pads / strips) at random spots.
  if (
    p.includes("speed blitz") ||
    p.includes("blitz") ||
    p.includes("boost") ||
    p.includes("speed pad") ||
    p.includes("strip")
  ) {
    return { boost_zones: randomBoostZones(3) };
  }

  // Flappy combined prompts (from SMOKE_TESTS.md)
  // "lower gravity and widen the gaps"
  if (
    p.includes("gravity") &&
    (p.includes("gap") || p.includes("widen") || p.includes("wider"))
  ) {
    return { gravity: 0.45, pipe_gap: 1.8 };
  }
  // "let the birds knock into each other"
  if (p.includes("knock") || p.includes("collide") || p.includes("bump")) {
    return { bird_collision: true };
  }

  // Single-effect fallbacks
  if (p.includes("slow")) return { player_speed: 0.6 };
  if (p.includes("fast") || p.includes("speed")) return { player_speed: 2 };
  if (p.includes("bounc")) return { projectile_bounces: 6 };
  if (p.includes("rapid") || p.includes("machine gun"))
    return { fire_cooldown_ms: 150 };
  if (
    p.includes("lower gravity") ||
    p.includes("less gravity") ||
    p.includes("low gravity") ||
    p.includes("floaty")
  )
    return { gravity: 0.5 };
  if (
    p.includes("heavy gravity") ||
    p.includes("high gravity") ||
    p.includes("more gravity")
  )
    return { gravity: 2.2 };
  if (p.includes("widen") || p.includes("wider") || p.includes("wide gap"))
    return { pipe_gap: 1.8 };
  if (
    p.includes("more gaps") ||
    p.includes("a few gaps") ||
    p.includes("several gaps")
  )
    return { gaps_per_pipe: 4 };
  if (p.includes("tall")) return { field_height: 2.5, gaps_per_pipe: 3 };

  return null;
}
