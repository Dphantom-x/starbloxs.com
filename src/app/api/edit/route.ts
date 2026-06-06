// Server-side AI edit endpoint. Hides the Anthropic key. Returns a validated
// rules patch. Uses canned responses in TEST_MODE / when no key is present, so
// the whole pipeline is testable and demo-safe without a live model call.
import { RulesPatchSchema, cannedPatch } from "@/lib/mechanics";

export const runtime = "nodejs";

type Mode = "create" | "edit";

type Body = {
  prompt?: string;
  gameType?: string;
  players?: { name: string; score: number }[];
  mode?: Mode;
};

function systemPrompt(
  gameType: string,
  players: { name: string; score: number }[],
  mode: Mode
): string {
  if (mode === "create") {
    return [
      `You are the editing brain of a multiplayer game platform on SpacetimeDB.`,
      `Create a NEW game: choose game_type ('tanks' or 'flappy') and set initial rules using ONLY the schema keys, within range.`,
      `ALWAYS include game_type. Emit the smallest set of keys that realizes the request.`,
    ].join(" ");
  }
  const roster = players.length
    ? players.map((p) => `${p.name} (score ${p.score})`).join(", ")
    : "no players yet";
  return [
    `You are the editing brain of a multiplayer ${gameType} game on SpacetimeDB.`,
    `Translate the user's request into a rules patch using ONLY the schema keys, within range.`,
    `Current players: ${roster}.`,
    `Resolve "one/random/the loser/the leader/everyone else" to the per_player target enum.`,
    `When EDITING a running game do NOT set game_type. Emit the smallest faithful set of keys.`,
  ].join(" ");
}

export async function POST(req: Request): Promise<Response> {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body */
  }
  const prompt = String(body.prompt ?? "").trim();
  const gameType = String(body.gameType ?? "tanks");
  const players = Array.isArray(body.players) ? body.players : [];
  const mode: Mode = body.mode === "create" ? "create" : "edit";

  if (!prompt) {
    return Response.json(
      { error: "Tell me what you'd like to change." },
      { status: 200 }
    );
  }

  // Use canned patches when there's no key, or when explicitly forced
  // (demo-day safety). NOT tied to TEST_MODE, so a live demo can keep the
  // window.__APP__ surface + demo buttons AND use the real model.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const forceCanned = !apiKey || process.env.AI_CANNED === "1";

  if (forceCanned) {
    const canned = cannedPatch(prompt, mode);
    if (!canned) {
      return Response.json(
        {
          error:
            "I can't do that one yet — try speed, bounces, gravity, gaps, roles, boosts, or sparks.",
        },
        { status: 200 }
      );
    }
    const parsed = RulesPatchSchema.safeParse(canned);
    return parsed.success
      ? Response.json({ patch: parsed.data, source: "canned" })
      : Response.json({ error: "invalid patch" }, { status: 200 });
  }

  // Live Claude path (Opus by default; override with ANTHROPIC_MODEL).
  try {
    const { generateObject } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const model = anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8");
    const sys = systemPrompt(gameType, players, mode);

    const first = await generateObject({
      model,
      schema: RulesPatchSchema,
      prompt: `${sys}\n\nRequest: ${prompt}`,
    });
    let parsed = RulesPatchSchema.safeParse(first.object);
    if (!parsed.success) {
      const retry = await generateObject({
        model,
        schema: RulesPatchSchema,
        prompt: `${sys}\n\nRequest: ${prompt}\n\nYour previous output was invalid (${JSON.stringify(
          parsed.error.issues
        ).slice(0, 400)}). Return a corrected patch.`,
      });
      parsed = RulesPatchSchema.safeParse(retry.object);
    }
    if (!parsed.success) {
      return Response.json(
        { error: "I couldn't turn that into a valid edit. Try rephrasing." },
        { status: 200 }
      );
    }
    return Response.json({ patch: parsed.data, source: "llm" });
  } catch {
    const canned = cannedPatch(prompt, mode);
    if (canned) {
      return Response.json({ patch: canned, source: "canned-fallback" });
    }
    return Response.json(
      { error: "The AI editor is unavailable right now." },
      { status: 200 }
    );
  }
}
