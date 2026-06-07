// Server-side AI game-CREATE endpoint — the real generation pipeline. Hides the
// key. With ANTHROPIC_API_KEY set it calls Claude to generate a runnable game
// module against the SDK contract (src/lib/gamegen.ts). With no key (or
// AI_CANNED=1) it returns a CAPTURED output of this same pipeline — the
// deterministic `cannedCreate` conversation + a seed reference game — tagged
// source:"cached", so the demo runs offline. Same shape either way, so the create
// UI and tests are identical. Mirrors /api/edit.
import { cannedCreate, type CreateStep, type Turn } from "@/lib/createAgent";
import {
  buildGenerationPrompt,
  clarifyingQuestion,
  validateGeneratedShape,
} from "@/lib/gamegen";

export const runtime = "nodejs";

type Body = { history?: Turn[] };

export async function POST(req: Request): Promise<Response> {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body */
  }
  const history: Turn[] = Array.isArray(body.history) ? body.history : [];
  const users = history.filter((t) => t.role === "user");
  if (users.length === 0) {
    return Response.json({ error: "Describe the game you want to make." }, { status: 200 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const forceCanned = !apiKey || process.env.AI_CANNED === "1";

  // --- Demo mode: a captured output of the pipeline (deterministic, offline). ---
  if (forceCanned) {
    const step = cannedCreate(history);
    return Response.json({ step, source: "cached" });
  }

  // --- Live mode: the real generation pipeline. ---
  // Turn 1 → one clarifying question; after the reply → generate the game.
  if (users.length <= 1) {
    try {
      const { generateText } = await import("ai");
      const { anthropic } = await import("@ai-sdk/anthropic");
      const model = anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8");
      const { text } = await generateText({
        model,
        prompt:
          `You are designing a multiplayer browser game with a user. They said: "${users[0]?.text}". ` +
          `Ask ONE short clarifying question that most changes the design. Question only.`,
      });
      const step: CreateStep = { kind: "question", text: text.trim() || clarifyingQuestion(users[0]?.text ?? "") };
      return Response.json({ step, source: "llm" });
    } catch {
      return Response.json({ step: cannedCreate(history), source: "canned-fallback" }, { status: 200 });
    }
  }

  try {
    const { generateObject } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { z } = await import("zod");
    const model = anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8");

    const schema = z.object({
      gameType: z.enum(["eflappy", "etank"]),
      name: z.string().min(1).max(40),
      summary: z.array(z.string()).min(1).max(6),
      code: z.string().min(1),
    });

    const { object } = await generateObject({
      model,
      schema,
      prompt: buildGenerationPrompt(history),
    });

    if (!validateGeneratedShape(object)) {
      // Generation came back malformed — fall back to a captured output so the
      // user still lands in a game (the build→fix loop lives in buildAgent.ts).
      return Response.json({ step: cannedCreate(history), source: "canned-fallback" }, { status: 200 });
    }

    const step: CreateStep = {
      kind: "confirmed",
      gameType: object.gameType,
      name: object.name,
      summary: object.summary,
      code: object.code,
    };
    return Response.json({ step, generated: object, source: "llm" });
  } catch {
    return Response.json({ step: cannedCreate(history), source: "canned-fallback" }, { status: 200 });
  }
}
