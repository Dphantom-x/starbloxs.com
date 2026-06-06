"use client";

// Plain-English game editor: prompt -> /api/edit -> applyRulesPatch (live for
// all players). The server returns a validated patch; the module re-clamps it.
import { useState } from "react";
import { useStdb } from "./StdbProvider";

export default function EditChat({
  gameId,
  gameType,
}: {
  gameId: string;
  gameType: string;
}) {
  const { mod } = useStdb();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || !mod || busy) return;
    setBusy(true);
    setStatus("thinking…");
    try {
      const players = mod
        .getPlayersRaw()
        .map((p) => ({ name: String(p.name), score: Number(p.score) }));
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text, gameType, players }),
      });
      const data = (await res.json()) as {
        patch?: unknown;
        error?: string;
      };
      if (data.patch) {
        mod.applyRulesPatch(gameId, JSON.stringify(data.patch));
        setStatus("done ✓");
        setPrompt("");
      } else {
        setStatus(data.error ?? "no change");
      }
    } catch {
      setStatus("something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      data-testid="edit-chat"
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        data-testid="edit-input"
        placeholder="Tell the AI how to change the game…"
        className="min-w-0 flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
      />
      <button
        type="submit"
        disabled={busy}
        data-testid="edit-submit"
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Edit
      </button>
      {status && (
        <span data-testid="edit-status" className="text-xs text-gray-500">
          {status}
        </span>
      )}
    </form>
  );
}
