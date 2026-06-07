// The create-agent contract. A live Claude integration (behind an API key) and
// this deterministic "canned" responder both fulfill the SAME interface, so the
// UI/flow/terminal/test-capture are identical with or without a key — adding a
// key is a one-line switch (mirrors how /api/edit already works). The canned
// path is NOT a hardcoded movie: it returns the same shape the real model would,
// and the `code` it "writes" is the REAL rebuilt game-file source that runs.

export type Turn = { role: "user" | "ai"; text: string };

export type CreateStep =
  | { kind: "question"; text: string }
  | {
      kind: "confirmed";
      gameType: "eflappy" | "etank";
      name: string;
      summary: string[];
      code: string;
    };

// Real excerpts of the rebuilt game files (src/games/flappy.ts, tank.ts) — the
// same code that actually loads and runs. The terminal flashes this.
const FLAPPY_CODE = `// flappy.ts — rebuilt on the Starblox engine
export const flappyGame = {
  id: "flappy",
  tick(api) {                       // host-authoritative, 30Hz
    for (const e of birds) {
      const flap = !!(input.up || input.fire);
      let vy = e.vy + GRAVITY_BASE * gravity * api.dt;
      if (flap && !bd.wasFlap) vy = -FLAP_IMPULSE;     // tap to rise
      let y = e.y + vy * api.dt;

      // forgiving collision: glide along the gap lip, die on a head-on wall
      const center = gaps.find(c => Math.abs(y - c) <= gapH / 2);
      if (center === undefined) { bd.alive = false; }  // hit the side → game over
      else { y = clampToLip(y, center, gapH); }
      e.y = y; e.vy = vy;
    }
    if (birdCollision) pushApartOverlappingBirds(birds);
    api.setLocal([...birds, ...pipes]);
  },
  render(api) {
    api.draw.gradientRect(0, 0, 800, 600, 0x9bd7ef, 0xb6e4f3);   // sky
    for (const p of pipes) drawCappedPipe(api, p);               // green pipes
    for (const b of birds) {
      api.draw.save();
      api.draw.translate(b.x, b.y);
      api.draw.rotate(clamp(b.vy / 700, -0.5, 1.3));             // tilt
      api.draw.roundedRect(4, 5, 30, 22, 9, b.mine ? 0xf7d51d : 0xf0962f);
      api.draw.circle(27, 12, 5.5, 0xffffff);                    // eye
      api.draw.roundedRect(31, 15, 10, 7, 2, 0xf3781e);          // beak
      api.draw.restore();
    }
  },
};`;

const TANK_CODE = `// tank.ts — rebuilt on the Starblox engine
export const tankGame = {
  id: "tank",
  tick(api) {
    for (const t of tanks) {                 // axis-separated maze collision
      if (!hitsAnyWall(tx, t.y, TANK_R, WALLS)) t.x = tx;
      if (!hitsAnyWall(t.x, ty, TANK_R, WALLS)) t.y = ty;
      if (overPad(t)) t.boostUntil = now + BOOST_S;   // speed pads
      if (input.fire && ready) spawnShell(t, angle); // bouncing shells
    }
    for (const s of shells) {                 // bounce + hit → score → respawn
      if (wallOrEdge(s)) { s.vx = -s.vx; s.bounces--; }
      if (hitsTank(s)) { score(s.ownerPid); respawn(hitTank); drop(s); }
    }
    api.setLocal([...tanks, ...shells]);
  },
  render(api) {
    drawMaze(api, WALLS);
    drawSpeedPads(api, PADS);                 // gold chevrons
    for (const t of tanks) drawTankWithBarrel(api, t);
  },
};`;

function isFlappy(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return p.includes("flap") || p.includes("bird");
}

// Deterministic stand-in for the live agent. Turn 1 → ONE clarifying question;
// after the user's reply → "confirmed" + the validated game config + real code.
export function cannedCreate(history: Turn[]): CreateStep {
  const users = history.filter((t) => t.role === "user");
  const flappy = isFlappy(users[0]?.text ?? "");
  if (users.length <= 1) {
    return {
      kind: "question",
      text: flappy
        ? "A multiplayer Flappy — nice. Should the pipes kill you on any contact, or only a head-on hit on the side?"
        : "A multiplayer tank arena — got it. Should the shells bounce off the walls?",
    };
  }
  return flappy
    ? {
        kind: "confirmed",
        gameType: "eflappy",
        name: "Flappy Arena",
        summary: ["Multiplayer", "Forgiving collision (die on the side)", "Birds collide", "Multi-gap pipes"],
        code: FLAPPY_CODE,
      }
    : {
        kind: "confirmed",
        gameType: "etank",
        name: "Tank Trouble",
        summary: ["Multiplayer", "Bouncing shells", "Corridor maze", "Speed pads"],
        code: TANK_CODE,
      };
}

// ---- live edit (DEMO 2) ----
// The running game reads `api.config()` every tick, so an edit is just a config
// write the host applies on the next frame — no redeploy, no reconnect. This
// deterministic responder maps plain English to a config patch (the same shape a
// live model would emit) and the REAL terminal lines that get flashed. The patch
// is MERGED into the game's existing engine_config.

export type EngineEditStep =
  | { kind: "refused"; text: string }
  | {
      kind: "config";
      patch: Record<string, unknown>; // keys merged into engine_config
      reply: string; // chat acknowledgement
      lines: string[]; // terminal "code change" lines
    };

function has(p: string, ...words: string[]): boolean {
  return words.some((w) => p.includes(w));
}

function fmtConfigVal(v: unknown): string {
  return typeof v === "string" ? `"${v}"` : String(v);
}

function configLines(patch: Record<string, unknown>, note: string): string[] {
  const lines = ["$ starblox apply → engine_config (live)"];
  for (const [k, v] of Object.entries(patch)) lines.push(`~ ${k}: ${fmtConfigVal(v)}`);
  const ms = 5 + ((Object.keys(patch).length * 7) % 11);
  lines.push(`✓ host picked it up next tick · ${note} · ${ms}ms`);
  return lines;
}

function tankEdit(p: string): EngineEditStep | null {
  if (has(p, "manhunt", "hunter", "flashlight", "hide and seek", "hide & seek", "one vs", "1 vs", "seeker", "predator")) {
    const patch = { manhunt: true };
    return {
      kind: "config",
      patch,
      reply:
        "Manhunt — one hunter on a blacked-out map with a flashlight cone; everyone else is a runner who can't shoot. The hunter wins by tagging runners with a shot.",
      lines: [
        "$ starblox apply → engine_config (live)",
        "~ manhunt: true",
        "→ role = (lowest id ? 'hunter' : 'runner')   // tank.ts tick",
        "→ runners: fire disabled                      // if (role !== 'runner')",
        "→ hunter POV: dark map + flashlight cone       // renderHunterView()",
        "✓ host picked it up next tick · live for everyone · 9ms",
      ],
    };
  }
  if (has(p, "lights on", "normal", "reset", "free for all", "free-for-all", "deathmatch", "turn off manhunt", "no manhunt", "everyone can shoot")) {
    const patch = { manhunt: false };
    return { kind: "config", patch, reply: "Back to free-for-all — full visibility, everyone shoots.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "faster", "fast", "2x", "2×", "speed up", "quick", "speedy", "zoom")) {
    const patch = { playerSpeed: 2 };
    return { kind: "config", patch, reply: "Everyone moves 2× faster.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "slower", "slow")) {
    const patch = { playerSpeed: 0.6 };
    return { kind: "config", patch, reply: "Tanks slowed to a crawl.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "bounce", "bouncy", "bouncier", "ricochet", "rebound")) {
    const patch = { bounces: 4 };
    return { kind: "config", patch, reply: "Shells now ricochet up to 4× off the walls.", lines: configLines(patch, "live for everyone") };
  }
  return null;
}

function flappyEdit(p: string): EngineEditStep | null {
  if (has(p, "harder", "heavier", "more gravity", "fall faster", "heavy")) {
    const patch = { gravity: 1.4 };
    return { kind: "config", patch, reply: "Heavier gravity — the birds drop faster.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "easier", "floaty", "float", "less gravity", "lower gravity", "lighter")) {
    const patch = { gravity: 0.7 };
    return { kind: "config", patch, reply: "Floatier birds — gentler gravity.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "wider", "bigger gap", "wide")) {
    const patch = { pipeGap: 1.4 };
    return { kind: "config", patch, reply: "Wider gaps — easier to thread.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "narrow", "tighter", "tight", "smaller gap")) {
    const patch = { pipeGap: 0.72 };
    return { kind: "config", patch, reply: "Tighter gaps — good luck.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "no collision", "ghost", "pass through", "stop colliding")) {
    const patch = { birdCollision: false };
    return { kind: "config", patch, reply: "Birds pass through each other now.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "collide", "collision", "bump")) {
    const patch = { birdCollision: true };
    return { kind: "config", patch, reply: "Birds bump into each other again.", lines: configLines(patch, "live for everyone") };
  }
  if (has(p, "faster pipes", "speed up the pipes", "fast pipes")) {
    const patch = { pipeSpeed: 1.5 };
    return { kind: "config", patch, reply: "Pipes scroll 50% faster.", lines: configLines(patch, "live for everyone") };
  }
  return null;
}

export function cannedEdit(gameType: string, prompt: string): EngineEditStep {
  const p = prompt.toLowerCase().trim();
  const step = gameType === "etank" ? tankEdit(p) : gameType === "eflappy" ? flappyEdit(p) : null;
  if (step) return step;
  const hint =
    gameType === "etank"
      ? 'Try "manhunt", "everyone 2× faster", or "shells bounce more".'
      : 'Try "more gravity", "wider gaps", or "no collision".';
  return { kind: "refused", text: `I can change this game live — ${hint}` };
}
