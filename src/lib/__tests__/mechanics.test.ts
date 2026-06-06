import { describe, it, expect } from "vitest";
import { RulesPatchSchema, cannedPatch } from "../mechanics";

describe("RulesPatchSchema", () => {
  it("accepts a valid global patch", () => {
    expect(
      RulesPatchSchema.safeParse({ player_speed: 2, projectile_bounces: 5 })
        .success
    ).toBe(true);
  });

  it("accepts per_player + boost_zones", () => {
    const patch = {
      per_player: [{ target: "random", role: "hunter", vision_radius: 3 }],
      boost_zones: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1, dir: [1, 0], strength: 2 }],
    };
    expect(RulesPatchSchema.safeParse(patch).success).toBe(true);
  });

  it("rejects out-of-range numbers", () => {
    expect(RulesPatchSchema.safeParse({ player_speed: 999 }).success).toBe(false);
    expect(RulesPatchSchema.safeParse({ projectile_bounces: 50 }).success).toBe(
      false
    );
  });

  it("rejects unknown keys (.strict)", () => {
    expect(RulesPatchSchema.safeParse({ teleport: true }).success).toBe(false);
  });

  it("rejects bad enums", () => {
    expect(
      RulesPatchSchema.safeParse({ per_player: [{ target: "everyone" }] })
        .success
    ).toBe(false);
    expect(RulesPatchSchema.safeParse({ game_type: "racing" }).success).toBe(
      false
    );
  });

  it("rejects a float for an int-only field", () => {
    expect(RulesPatchSchema.safeParse({ projectile_bounces: 3.5 }).success).toBe(
      false
    );
  });
});

describe("cannedPatch", () => {
  it("maps the combined demo/test prompt", () => {
    expect(
      cannedPatch("make everyone twice as fast and shells bounce 5 times")
    ).toMatchObject({ player_speed: 2, projectile_bounces: 5 });
  });

  it("maps the manhunt prompt", () => {
    const p = cannedPatch(
      "turn it into a manhunt with a hunter and black out the map"
    );
    expect(p?.per_player?.some((e) => e.role === "hunter")).toBe(true);
    expect(p?.wall_graze_sparks).toBe(true);
  });

  it("maps the flappy smoke-test prompts", () => {
    expect(cannedPatch("lower gravity and widen the gaps")).toMatchObject({
      gravity: 0.45,
      pipe_gap: 1.8,
    });
    expect(
      cannedPatch("let the birds knock into each other")
    ).toMatchObject({ bird_collision: true });
  });

  it("every canned patch is itself schema-valid", () => {
    const prompts = [
      "make everyone twice as fast and shells bounce 5 times",
      "turn it into a manhunt, hunter, black out the map, sparks",
      "spawn boost strips and give the loser a laser",
      "make tanks slower",
      "rapid fire",
      "low gravity",
      "make it tall",
      "lower gravity and widen the gaps",
      "let the birds knock into each other",
    ];
    for (const pr of prompts) {
      const patch = cannedPatch(pr);
      expect(patch, pr).not.toBeNull();
      expect(RulesPatchSchema.safeParse(patch).success, pr).toBe(true);
    }
  });

  it("returns null for an unsupported request", () => {
    expect(cannedPatch("order me a pizza")).toBeNull();
  });
});

describe("cannedPatch (create mode)", () => {
  it("picks flappy + initial rules from a create prompt", () => {
    const p = cannedPatch(
      "a multiplayer flappy bird, tall, 3 gaps, birds collide",
      "create"
    );
    expect(p?.game_type).toBe("flappy");
    expect(p?.gaps_per_pipe).toBe(3);
    expect((p?.field_height ?? 0) > 1).toBe(true);
    expect(p?.bird_collision).toBe(true);
  });

  it("defaults to tanks for a tank create prompt", () => {
    const p = cannedPatch("a tank game with bouncy shells", "create");
    expect(p?.game_type).toBe("tanks");
  });

  it("create patches are schema-valid", () => {
    for (const pr of [
      "a multiplayer flappy bird, tall, 3 gaps, birds collide",
      "a tank game with bouncy shells",
      "make a flappy game",
    ]) {
      const patch = cannedPatch(pr, "create");
      expect(patch, pr).not.toBeNull();
      expect(RulesPatchSchema.safeParse(patch).success, pr).toBe(true);
    }
  });
});
