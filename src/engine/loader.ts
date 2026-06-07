// The loader — turns a game-code STRING (from the generation pipeline or the game
// store) into a runnable GameModule the engine can mount. Generated games and the
// hand-written reference games flow through the SAME path: source -> compile ->
// validate -> run. This is the "cartridge slot" that makes AI-authored games real.
//
// Generated code is plain JS (no transpile dep) shaped as a factory that returns
// { id, init?, tick, render } — see src/lib/gamegen.ts SDK_CONTRACT.
//
// SANDBOXING: compileGameModule() evaluates on the main thread and is meant for
// TRUSTED source (our seed games, dev). UNTRUSTED model-generated code should run
// in the Worker sandbox (src/engine/sandbox.worker.ts), which has no DOM, window,
// or network — only the curated message API. runInSandbox() below is the entry
// point for that path. (The live demo runs the trusted reference modules directly
// for reliability; the sandbox is the isolation boundary for generated games.)
import type { GameModule } from "./types";
import { isRunnableModule } from "@/lib/gamegen";

export class GameLoadError extends Error {}

/**
 * Compile a game-code string into a GameModule (main thread). The source must
 * evaluate to either the module object or a factory returning it. Throws
 * GameLoadError if it doesn't produce a runnable { id, tick, render }.
 *
 * Trusted source only — for untrusted generated code use runInSandbox().
 */
export function compileGameModule(source: string): GameModule {
  let produced: unknown;
  try {
    // Evaluate the source in strict mode and take its value. We intentionally do
    // NOT thread DOM/network in; a generated module may only use the `api` it is
    // handed each frame (per the SDK contract).
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const factory = new Function(`"use strict"; return (${source});`);
    const value = factory();
    produced = typeof value === "function" ? value() : value;
  } catch (e) {
    throw new GameLoadError(`game code threw while compiling: ${(e as Error).message}`);
  }
  if (!isRunnableModule(produced)) {
    throw new GameLoadError("game code did not produce a runnable { id, tick, render } module");
  }
  return produced;
}

/** True if `source` compiles to a runnable module (used by the build→fix loop). */
export function canCompile(source: string): { ok: true } | { ok: false; error: string } {
  try {
    compileGameModule(source);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- sandboxed execution (untrusted, model-generated code) ----
// The engine's host runs tick() (logic) and every client runs render(). For
// untrusted code, tick() runs inside a Web Worker that can't touch the page; the
// worker posts the committed entities back, which the host writes to SpacetimeDB
// exactly as today. This is the production isolation path; it is scaffolded here
// with the real message protocol so the engine can adopt it without redesign.
export type SandboxMsg =
  | { t: "load"; source: string }
  | { t: "tick"; dt: number; players: { id: string; input: unknown }[]; config: Record<string, unknown> }
  | { t: "ready" }
  | { t: "entities"; entities: unknown[] }
  | { t: "error"; error: string };

export type SandboxHandle = {
  tick(dt: number, players: { id: string; input: unknown }[], config: Record<string, unknown>): void;
  onEntities(cb: (entities: unknown[]) => void): void;
  onError(cb: (error: string) => void): void;
  dispose(): void;
};

/**
 * Run untrusted game code in the Worker sandbox. Returns a handle the host uses
 * to drive tick and receive committed entities. The worker enforces isolation
 * (no DOM/window/network). Falls back gracefully where Workers are unavailable
 * (SSR): callers should feature-detect `typeof Worker !== "undefined"`.
 */
export function runInSandbox(source: string): SandboxHandle {
  if (typeof Worker === "undefined") {
    throw new GameLoadError("Worker sandbox unavailable in this environment");
  }
  const worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url));
  let onEnts: (e: unknown[]) => void = () => {};
  let onErr: (e: string) => void = () => {};
  worker.onmessage = (ev: MessageEvent<SandboxMsg>) => {
    const m = ev.data;
    if (m.t === "entities") onEnts(m.entities);
    else if (m.t === "error") onErr(m.error);
  };
  worker.postMessage({ t: "load", source } satisfies SandboxMsg);
  return {
    tick: (dt, players, config) => worker.postMessage({ t: "tick", dt, players, config } satisfies SandboxMsg),
    onEntities: (cb) => { onEnts = cb; },
    onError: (cb) => { onErr = cb; },
    dispose: () => worker.terminate(),
  };
}
