// The build agent — the "it builds it, tests it, and fixes what breaks" loop,
// made real. It drives the create pipeline client-side:
//
//   describe -> /api/create (clarify) -> reply -> /api/create (generate)
//            -> compile-check the generated module (engine/loader)
//            -> if it doesn't compile, ask the model to fix it -> repeat
//
// In LIVE mode (ANTHROPIC_API_KEY set) the generated code is real, so the
// compile-check + fix loop genuinely runs. In DEMO mode the route returns a
// captured pipeline output (a reference game) and we skip the compile gate, since
// the cached payload is an illustrative snapshot, not a fresh module. Same UI
// either way.
import type { CreateStep, Turn } from "./createAgent";
import { canCompile } from "@/engine/loader";

export type CreateResult = { step: CreateStep; source: string };

/** One turn of the create conversation through the real endpoint. */
export async function requestCreateStep(history: Turn[]): Promise<CreateResult> {
  const res = await fetch("/api/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ history }),
  });
  const data = (await res.json()) as { step?: CreateStep; source?: string; error?: string };
  if (!data.step) throw new Error(data.error ?? "no step");
  return { step: data.step, source: data.source ?? "cached" };
}

/**
 * Generate the game and verify it runs. Returns the confirmed step plus how many
 * fix attempts it took. Only live (model-generated) code is compile-gated; a
 * captured demo output passes straight through.
 */
export async function buildGame(history: Turn[], maxFixes = 2): Promise<CreateResult & { attempts: number; compiled: boolean }> {
  let result = await requestCreateStep(history);
  let attempts = 1;

  // Live, runnable code → compile-check; on failure, ask for a fix and retry.
  while (
    result.source === "llm" &&
    result.step.kind === "confirmed" &&
    !canCompile(result.step.code).ok &&
    attempts <= maxFixes
  ) {
    const err = canCompile(result.step.code);
    const fixTurn: Turn = {
      role: "user",
      text: `The previous game code failed to load: ${err.ok ? "" : err.error}. Return a corrected, runnable module.`,
    };
    result = await requestCreateStep([...history, fixTurn]);
    attempts += 1;
  }

  const compiled = result.step.kind === "confirmed" && result.source === "llm" ? canCompile(result.step.code).ok : true;
  return { ...result, attempts, compiled };
}
