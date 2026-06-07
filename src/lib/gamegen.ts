// The generation brain's contract. This is the REAL pipeline that turns a plain
// sentence into a runnable game module for the Starblox pseudo-engine. It is used
// by /api/create: with an ANTHROPIC_API_KEY the model generates against this
// contract; without a key the route returns a CAPTURED output of this same
// pipeline (the seed games below) so the demo runs offline. The cache is a
// snapshot of this machine's output — not a substitute for it.
//
// A generated game is plain JS (no build step) that evaluates to a factory:
//   (function(){ return { id, init?(api), tick(api), render(api) } })
// The loader (src/engine/loader.ts) compiles that string and the engine runs it
// exactly like the hand-written reference games (src/games/*.ts).

import type { GameModule } from "@/engine/types";

export type GameType = "eflappy" | "etank";

// What the model must return (validated in /api/create + by the loader).
export type GeneratedGame = {
  gameType: GameType; // which engine genre the generated module targets
  name: string;
  summary: string[]; // human bullet points shown in the create UI
  code: string; // the runnable module-factory source (see header)
};

// ---- the SDK the generated code targets (fed to the model as the spec) ----
// Kept in sync with engine/types.ts. This is the whole API a game may use; the
// loader executes generated code with nothing else in scope (the sandbox).
export const SDK_CONTRACT = `
You write games for the Starblox pseudo-engine. A game is a plain-JS factory that
returns a module object — NO imports, NO DOM, NO network, NO globals beyond the
\`api\` it is given each frame:

  (function () {
    return {
      id: "my-game",
      init: function (api) {},      // optional, once
      tick: function (api) {},      // host-only, ~30Hz: mutate + commit entities
      render: function (api) {},    // every client, every frame: draw from synced state
    };
  })

api (EngineApi):
  api.dt            -> fixed timestep seconds (~1/30)
  api.entities()    -> readonly synced entities [{kind,x,y,vx,vy,angle,data(json string)}]
  api.local()       -> the host's authoritative entity list (mutate in tick)
  api.setLocal(arr) -> commit the host's entities (call at the end of tick)
  api.input()       -> { up,down,left,right,fire } for THIS client
  api.players()     -> [{ id, input }] every player's synced input (host reads all)
  api.me()          -> my identity hex (or null)
  api.config()      -> live per-game config object (the live-edit knobs)
  api.draw          -> immediate-mode 2D, 800x600, colors 0xRRGGBB:
     rect, roundedRect, circle, triangle, strokeRect, strokeRoundedRect,
     strokeCircle, line, gradientRect, save, restore, translate, rotate, scale,
     text(x, y, string, size?, color?, align?)  // align "left"|"center"|"right"

An entity is { key:string, kind:string, x, y, vx?, vy?, angle?, data?:object }.
Use a unique \`kind\` per game so the legacy server tick ignores it (e.g. "gbird").
Spawn one entity per player using api.players(); read input from api.players().
Keep tick deterministic and cheap. Draw the whole scene each render().
Return ONLY the factory source — no markdown fences, no prose.
`.trim();

// One clarifying question per genre (the agent's first turn). The live model is
// prompted to ask one; the cached path returns these verbatim.
export function clarifyingQuestion(prompt: string): string {
  return isFlappy(prompt)
    ? "A multiplayer Flappy — should the pipes kill you on any contact, or only a head-on hit on the side?"
    : "A multiplayer tank arena — should the shells bounce off the walls?";
}

export function isFlappy(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return p.includes("flap") || p.includes("bird") || p.includes("fly");
}

// ---- the model's instruction for the "build the game" turn ----
export function buildGenerationPrompt(history: { role: string; text: string }[]): string {
  const convo = history.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
  return [
    SDK_CONTRACT,
    "",
    "Here is the conversation describing the game the user wants:",
    convo,
    "",
    "Produce a complete, runnable game module factory (per the contract) that realizes it.",
    "Pick the closest genre kind (flappy-like => gameType 'eflappy', tank/arena => 'etank').",
    "Return JSON: { gameType, name, summary (3-4 bullets), code }.",
  ].join("\n");
}

// ---- CAPTURED outputs of this pipeline (demo mode / no key) ----
// These are real, runnable reference games — the same ones the loader runs and
// the seed entries in the game store. In demo mode the route returns one of
// these, tagged source:"cached", so the offline demo shows true pipeline output.
export const SEED_GAMES: Record<GameType, GeneratedGame> = {
  eflappy: {
    gameType: "eflappy",
    name: "Flappy Arena",
    summary: ["Multiplayer", "Forgiving collision (die on the side)", "Birds collide", "Multi-gap pipes"],
    code: "/* reference module — see src/games/flappy.ts (compiled & loaded via engine/loader.ts) */",
  },
  etank: {
    gameType: "etank",
    name: "Tank Trouble",
    summary: ["Multiplayer", "Bouncing shells", "Corridor maze", "Speed pads"],
    code: "/* reference module — see src/games/tank.ts (compiled & loaded via engine/loader.ts) */",
  },
};

// Validate that a generated module is structurally usable before we store/run it.
export function validateGeneratedShape(g: Partial<GeneratedGame>): g is GeneratedGame {
  return (
    !!g &&
    (g.gameType === "eflappy" || g.gameType === "etank") &&
    typeof g.name === "string" &&
    Array.isArray(g.summary) &&
    typeof g.code === "string" &&
    g.code.length > 0
  );
}

// A compiled GameModule must expose tick + render (the loader also checks this).
export function isRunnableModule(m: unknown): m is GameModule {
  const o = m as GameModule | null;
  return !!o && typeof o.tick === "function" && typeof o.render === "function" && typeof o.id === "string";
}
