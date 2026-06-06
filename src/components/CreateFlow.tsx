"use client";

// Phase 7 "make a game by talking": prompt -> /api/edit (mode: create) ->
// create_game(game_type) -> apply_rules_patch(newId, patch) -> open the room.
// Reuses the exact same pipeline as editing.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStdb } from "./StdbProvider";

export default function CreateFlow() {
  const { mod, connected } = useStdb();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || !mod || busy) return;
    setBusy(true);
    setStatus("designing your game…");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text, mode: "create" }),
      });
      const data = (await res.json()) as {
        patch?: Record<string, unknown>;
        error?: string;
      };
      if (!data.patch) {
        setStatus(data.error ?? "I couldn't build that — try a tank or flappy game.");
        setBusy(false);
        return;
      }
      const patch = data.patch;
      const gameType = patch.game_type === "flappy" ? "flappy" : "tanks";
      const name = gameType === "flappy" ? "Flappy (AI)" : "Tank (AI)";
      setStatus("creating…");
      const newId = await mod.createGameAndWait(gameType, name);
      if (!newId) {
        setStatus("could not create the game");
        setBusy(false);
        return;
      }
      await mod.applyRulesPatch(newId, JSON.stringify(patch));
      router.push(`/game/${newId}`);
    } catch {
      setStatus("something went wrong");
      setBusy(false);
    }
  }

  return (
    <main data-testid="create-page" className="min-h-screen p-8 font-sans">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← back to games
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Create a game with AI</h1>
      <p className="mb-4 text-gray-500">
        Describe a game in plain English and the AI builds it.
      </p>

      <form onSubmit={submit} data-testid="create-form" className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          data-testid="create-input"
          placeholder="e.g. a multiplayer Flappy Bird, tall, with a few gaps, and birds that collide"
          className="min-w-0 flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          type="submit"
          disabled={busy || !connected}
          data-testid="create-submit"
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Create
        </button>
      </form>
      {status && (
        <p data-testid="create-status" className="mt-3 text-sm text-gray-500">
          {status}
        </p>
      )}
      <p className="mt-6 text-xs text-gray-400">
        Try: “a multiplayer flappy bird, tall, 3 gaps, birds collide” · “a tank
        game with bouncy shells”
      </p>
    </main>
  );
}
