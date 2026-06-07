"use client";

// Starblox games hub: Roblox-style wordmark banner + search, a friends row,
// and cardless game shelves (My recent / Recommended for you / Sponsored).
// Cards open the lobby; the per-card remix ("Make it mine") clones and jumps
// straight into the new room. SpacetimeDB wiring + all data-testids preserved.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Marble, GameThumb, Page, Wordmark, Avatar } from "./ui";
import { genreOf } from "@/lib/rules";
import { FRIENDS } from "@/lib/friends";
import { GENERATED_LIST, type GeneratedEntry } from "@/games/generated";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerHex(g: any): string | null {
  return g?.owner && typeof g.owner.toHexString === "function"
    ? g.owner.toHexString()
    : null;
}

// Official/seeded titles get featured in the "Sponsored" shelf.
const OFFICIAL_NAMES = new Set(["Tank Trouble", "Flappy Arena"]);

// Real recorded gameplay used as the card image per genre, so the thumbnail
// reflects how the game actually plays (not an abstract mock).
const GENRE_VIDEO: Record<string, string> = {
  tanks: "/tank-verification.webm",
  flappy: "/flappy-verification.webm",
};

function FriendsRow() {
  const online = FRIENDS.filter((f) => f.status === "in" || f.status === "online").length;
  return (
    <div className="frow fade-up" style={{ animationDelay: ".05s" }}>
      <div className="shelf-head">
        <div className="shelf-title">
          Friends <span className="shelf-n">({FRIENDS.length})</span>
        </div>
        <button className="see-all">
          {online} online <Icon name="arrow" size={14} />
        </button>
      </div>
      <div className="frow-rail">
        {FRIENDS.map((f) => {
          const playing = f.status === "in" && f.game;
          const sub = playing
            ? f.game
            : f.status === "online"
              ? "Online"
              : "Away";
          return (
            <button className="friend" key={f.name} title={f.name}>
              <Avatar name={f.name} pfp={f.pfp} c1={f.c1} c2={f.c2} status={f.status} size={64} />
              <div className="friend-name">{f.name}</div>
              <div className={"friend-sub" + (playing ? " playing" : "")}>{sub}</div>
            </button>
          );
        })}
        <button className="friend friend-invite" title="Invite a friend">
          <div className="invite-disc">
            <Icon name="plus" size={24} />
          </div>
          <div className="friend-name">Invite</div>
        </button>
      </div>
    </div>
  );
}

type CardGame = {
  id: string;
  type: string;
  name: string;
  mine: boolean;
  playing: number;
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
  return (
    <div
      className="gcard"
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
        {GENRE_VIDEO[genreOf(game.type)] ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="gcard-video"
            src={GENRE_VIDEO[genreOf(game.type)]}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <GameThumb type={game.type} />
        )}
        <div className="gcard-play">
          <span className="play-fab">
            <Icon name="play" size={20} />
          </span>
        </div>
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
        <h3 className="gcard-name">{game.name}</h3>
        <div className="gcard-players">
          <span className={"players-dot" + (game.playing > 0 ? " on" : "")} />
          {game.playing > 0 ? `${game.playing} playing` : "no one playing"}
        </div>
      </div>
    </div>
  );
}

function Shelf({
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
      <div className="shelf-head">
        <div className="shelf-title">
          {title} <span className="shelf-n">({games.length})</span>
        </div>
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

// A gallery game made by the AI — its recorded gameplay loops as the thumbnail.
function GeneratedCard({
  entry,
  onPlay,
}: {
  entry: GeneratedEntry;
  onPlay: (id: string) => void;
}) {
  return (
    <div
      className="gcard gcard-gen"
      data-testid="game-card"
      data-game-id={entry.id}
      role="button"
      tabIndex={0}
      onClick={() => onPlay(entry.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay(entry.id);
        }
      }}
    >
      <div className="gcard-thumb">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          className="gcard-video"
          src={`/gallery/${entry.id}.webm`}
          autoPlay
          muted
          loop
          playsInline
        />
        <span className="gcard-ai-tag">
          <Marble size={13} /> AI-made
        </span>
        <div className="gcard-play">
          <span className="play-fab">
            <Icon name="play" size={20} />
          </span>
        </div>
      </div>
      <div className="gcard-body">
        <h3 className="gcard-name">{entry.name}</h3>
        <div className="gcard-players">
          <span className="players-dot on" />
          {entry.summary[1] ?? entry.summary[0]}
        </div>
      </div>
    </div>
  );
}

export default function GameGrid() {
  const { connected, mod } = useStdb();
  const router = useRouter();
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "tanks" | "flappy">("all");

  const myId = mod ? mod.getIdentityHex() : null;

  const games: CardGame[] = mod
    ? mod
        .getGamesRaw()
        // Hide leftover automated-test fixtures (named "E2E …") from the hub.
        .filter((g) => !String(g.name).startsWith("E2E "))
        .map((g) => {
        const id = g.gameId.toString();
        return {
          id,
          type: g.gameType,
          name: g.name,
          mine: !!myId && ownerHex(g) === myId,
          playing: mod.getPlayersForRaw(id).length,
        };
      })
    : [];

  const match = (g: CardGame) =>
    (filter === "all" || genreOf(g.type) === filter) &&
    (q.trim() === "" || g.name.toLowerCase().includes(q.toLowerCase()));

  const visible = games.filter(match);
  const yours = visible.filter((g) => g.mine);
  const recommended = visible.filter((g) => !g.mine && !OFFICIAL_NAMES.has(g.name));
  const sponsored = visible.filter((g) => !g.mine && OFFICIAL_NAMES.has(g.name));
  const genGames = GENERATED_LIST.filter(
    (e) => q.trim() === "" || e.name.toLowerCase().includes(q.toLowerCase())
  );

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
      <div className="hub-banner fade-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hub-banner-art" src="/logo.png" alt="" aria-hidden="true" />
        <div className="hub-search">
          <Icon name="search" size={17} style={{ color: "var(--muted-2)" }} />
          <input
            className="hub-search-input"
            placeholder="Search games…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Wordmark size={20} className="hub-wordmark" />
        <div className="hub-greeting">
          <div className="hub-home">Home</div>
          <p className="hub-welcome">
            {connected ? "Welcome back, Maxy!" : "Connecting to the live server…"}
          </p>
        </div>
      </div>

      <FriendsRow />

      <div className="hub-filters fade-up" style={{ animationDelay: ".08s" }}>
        {filters.map(([v, l]) => (
          <button
            key={v}
            className={"chip" + (filter === v ? " chip-on" : "")}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
        <Link
          href="/create"
          className="btn btn-chrome create-pill"
          data-testid="create-tile"
        >
          <Icon name="plus" size={15} /> Create
        </Link>
      </div>

      <div className="fade-up" style={{ animationDelay: ".1s" }} data-testid="game-grid">
        {genGames.length > 0 && (
          <section className="gsection">
            <div className="shelf-head">
              <div className="shelf-title">
                Made by the AI <span className="shelf-n">({genGames.length})</span>
              </div>
            </div>
            <div className="grid">
              {genGames.map((e) => (
                <GeneratedCard key={e.id} entry={e} onPlay={(id) => router.push(`/g/${id}`)} />
              ))}
            </div>
          </section>
        )}
        <Shelf title="My recent" games={yours} onOpen={open} onRemix={onRemix} onDelete={onDelete} remixingId={remixingId} />
        <Shelf title="Recommended for you" games={recommended} onOpen={open} onRemix={onRemix} onDelete={onDelete} remixingId={remixingId} />
        <Shelf title="Sponsored" games={sponsored} onOpen={open} onRemix={onRemix} onDelete={onDelete} remixingId={remixingId} />
        {visible.length === 0 && genGames.length === 0 && (
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
