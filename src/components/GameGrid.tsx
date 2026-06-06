"use client";

// Starblox home: hero + create tile, search/type filters, and procedural game
// cards grouped into "Your games" / "Community". Cards open the lobby; the
// per-card remix ("Make it mine") clones and jumps straight into the new room.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Marble, GameThumb, Page } from "./ui";
import { rulesSummary } from "@/lib/rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerHex(g: any): string | null {
  return g?.owner && typeof g.owner.toHexString === "function"
    ? g.owner.toHexString()
    : null;
}

function CreateTile() {
  return (
    <Link href="/create" className="create-tile" data-testid="create-tile">
      <div className="create-tile-mark">
        <Marble size={40} />
      </div>
      <div className="create-tile-plus">
        <Icon name="plus" size={18} />
      </div>
      <div>
        <div className="create-tile-title">Create with AI</div>
        <div className="create-tile-sub">describe a game · it gets built</div>
      </div>
    </Link>
  );
}

type CardGame = {
  id: string;
  type: string;
  name: string;
  mine: boolean;
  playing: number;
  rules: string[];
};

function GameCard({
  game,
  onOpen,
  onRemix,
  onDelete,
  remixing,
}: {
  game: CardGame;
  onOpen: (g: CardGame) => void;
  onRemix: (g: CardGame) => void;
  onDelete: (g: CardGame) => void;
  remixing: boolean;
}) {
  const typeLabel = game.type === "flappy" ? "FLAPPY" : "TANKS";
  return (
    <div
      className="gcard card"
      data-testid="game-card"
      data-game-type={game.type}
      data-game-id={game.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(game)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(game);
        }
      }}
    >
      <div className="gcard-thumb">
        <GameThumb type={game.type} />
        <div className="gcard-play">
          <span className="play-fab">
            <Icon name="play" size={20} />
          </span>
        </div>
        {game.playing > 0 && (
          <span className="live-pill">
            <span className="live-dot" />
            {game.playing} playing
          </span>
        )}
        {game.mine && (
          <button
            className="gcard-del"
            data-testid="delete-btn"
            data-delete-id={game.id}
            title="Delete game"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(game);
            }}
          >
            <Icon name="x" size={15} />
          </button>
        )}
        <button
          className={"gcard-remix btn btn-chrome btn-sm" + (remixing ? " is-busy" : "")}
          data-testid="remix-btn"
          data-remix-id={game.id}
          disabled={remixing}
          onClick={(e) => {
            e.stopPropagation();
            onRemix(game);
          }}
        >
          {remixing ? (
            <span className="dots">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <>
              <Icon name="remix" size={14} /> Make it mine
            </>
          )}
        </button>
      </div>
      <div className="gcard-body">
        <div className="gcard-head">
          <h3 className="gcard-name">{game.name}</h3>
          <span className="type-tag">{typeLabel}</span>
        </div>
        <div className="gcard-rules">
          {game.rules.map((r, i) => (
            <span className="mini-chip" key={i}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  games,
  onOpen,
  onRemix,
  onDelete,
  remixingId,
}: {
  title: string;
  games: CardGame[];
  onOpen: (g: CardGame) => void;
  onRemix: (g: CardGame) => void;
  onDelete: (g: CardGame) => void;
  remixingId: string | null;
}) {
  if (games.length === 0) return null;
  return (
    <section className="gsection">
      <div className="gsection-head">
        <h2 className="gsection-title">{title}</h2>
        <span className="gsection-count mono">{games.length}</span>
      </div>
      <div className="grid">
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            onOpen={onOpen}
            onRemix={onRemix}
            onDelete={onDelete}
            remixing={remixingId === g.id}
          />
        ))}
      </div>
    </section>
  );
}

export default function GameGrid() {
  const { connected, mod } = useStdb();
  const router = useRouter();
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "tanks" | "flappy">("all");

  const myId = mod ? mod.getIdentityHex() : null;
  const rulesById = new Map<string, unknown>();
  if (mod) {
    for (const r of mod.getAllRulesRaw()) rulesById.set(r.gameId.toString(), r);
  }

  const games: CardGame[] = mod
    ? mod.getGamesRaw().map((g) => {
        const id = g.gameId.toString();
        return {
          id,
          type: g.gameType,
          name: g.name,
          mine: !!myId && ownerHex(g) === myId,
          playing: mod.getPlayersForRaw(id).length,
          rules: rulesSummary(g.gameType, rulesById.get(id), 3),
        };
      })
    : [];

  const match = (g: CardGame) =>
    (filter === "all" || g.type === filter) &&
    (q.trim() === "" || g.name.toLowerCase().includes(q.toLowerCase()));

  const visible = games.filter(match);
  const yours = visible.filter((g) => g.mine);
  const community = visible.filter((g) => !g.mine);

  const open = (g: CardGame) => router.push(`/lobby/${g.id}`);
  const onDelete = (g: CardGame) => mod?.deleteGame(g.id);
  const onRemix = async (g: CardGame) => {
    if (!mod || remixingId) return;
    setRemixingId(g.id);
    const newId = await mod.remixGameAndWait(g.id);
    setRemixingId(null);
    if (newId) router.push(`/game/${newId}`);
  };

  const filters: [typeof filter, string][] = [
    ["all", "All"],
    ["tanks", "Tanks"],
    ["flappy", "Flappy"],
  ];

  return (
    <Page>
      <div className="home-hero fade-up">
        <div className="hero-copy">
          <div className="eyebrow">
            {connected ? "Connected" : "Connecting…"} · live multiplayer
          </div>
          <h1 className="hero-title">
            Games, made and
            <br />
            remade by talking.
          </h1>
          <p className="hero-sub">
            Pick something to play, spin up a new game by describing it, or remix
            anything into your own.
          </p>
        </div>
        <div className="hero-create">
          <CreateTile />
        </div>
      </div>

      <div className="home-toolbar fade-up" style={{ animationDelay: ".05s" }}>
        <div className="search">
          <Icon name="search" size={17} style={{ color: "var(--muted-2)" }} />
          <input
            className="search-input"
            placeholder="Search games…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="filters">
          {filters.map(([v, l]) => (
            <button
              key={v}
              className={"chip" + (filter === v ? " chip-on" : "")}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        className="fade-up"
        style={{ animationDelay: ".1s" }}
        data-testid="game-grid"
      >
        <Section
          title="Your games"
          games={yours}
          onOpen={open}
          onRemix={onRemix}
          onDelete={onDelete}
          remixingId={remixingId}
        />
        <Section
          title="Community"
          games={community}
          onOpen={open}
          onRemix={onRemix}
          onDelete={onDelete}
          remixingId={remixingId}
        />
        {visible.length === 0 && (
          <div className="empty pop-in">
            <Marble size={44} />
            <p>
              {games.length === 0
                ? connected
                  ? "No games yet — create the first one."
                  : "Connecting to the live server…"
                : `No games match “${q}”.`}
            </p>
            {games.length > 0 && (
              <button
                className="btn btn-chrome"
                onClick={() => {
                  setQ("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
