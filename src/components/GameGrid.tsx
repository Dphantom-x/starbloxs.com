"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStdb } from "./StdbProvider";

export default function GameGrid() {
  const { connected, mod } = useStdb();
  const router = useRouter();
  const [remixing, setRemixing] = useState<string | null>(null);
  const games = mod ? mod.getGamesRaw() : [];
  const myId = mod ? mod.getIdentityHex() : null;

  async function remix(gameId: string) {
    if (!mod || remixing) return;
    setRemixing(gameId);
    const newId = await mod.remixGameAndWait(gameId);
    setRemixing(null);
    if (newId) router.push(`/game/${newId}`);
  }

  return (
    <main className="min-h-screen p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Blox</h1>
        <p className="mt-1 text-sm text-gray-500">
          {connected ? "Connected" : "Connecting…"} · pick a game, make one by
          talking to AI, or remix any game
        </p>
      </header>

      <div
        data-testid="game-grid"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
      >
        {games.map((g) => {
          const id = g.gameId.toString();
          const mine = !!myId && g.owner.toHexString() === myId;
          return (
            <div key={id} className="relative">
              <Link
                href={`/game/${id}`}
                data-testid="game-card"
                data-game-type={g.gameType}
                data-game-id={id}
                className="block rounded-xl border border-black/10 p-5 pt-9 transition-shadow hover:shadow-lg dark:border-white/15"
              >
                <div className="text-3xl">
                  {g.gameType === "flappy" ? "🐤" : "🎮"}
                </div>
                <div className="mt-3 font-bold">{g.name}</div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {g.gameType}
                </div>
              </Link>
              <button
                data-testid="remix-btn"
                data-remix-id={id}
                onClick={() => remix(id)}
                disabled={remixing === id}
                className="absolute right-2 top-2 rounded-md border border-black/15 bg-white/80 px-2 py-0.5 text-[10px] font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:bg-black/40 dark:hover:bg-white/10"
              >
                {remixing === id ? "…" : "Make it mine"}
              </button>
              {mine && (
                <button
                  data-testid="delete-btn"
                  data-delete-id={id}
                  onClick={() => mod?.deleteGame(id)}
                  title="Delete this game"
                  className="absolute left-2 top-2 rounded-md border border-black/15 bg-white/80 px-1.5 py-0.5 text-[10px] hover:bg-red-100 dark:border-white/20 dark:bg-black/40"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        <Link
          href="/create"
          data-testid="create-tile"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/20 p-5 text-center transition-shadow hover:shadow-lg dark:border-white/25"
        >
          <div className="text-3xl">＋</div>
          <div className="mt-3 font-bold">Create with AI</div>
          <div className="text-xs text-gray-500">describe a game</div>
        </Link>
      </div>
    </main>
  );
}
