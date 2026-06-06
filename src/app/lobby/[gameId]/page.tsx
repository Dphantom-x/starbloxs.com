"use client";

// Starblox lobby / game detail — the intermediate page between the home grid
// and a live room. Shows a preview, a real scannable share QR, the rules, who's
// currently playing, and the Play / Make-it-mine / Delete actions. All data is
// read live from the SpacetimeDB cache; nothing here joins the match (that
// happens in the room).
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { useStdb } from "@/components/StdbProvider";
import { Icon, Marble, GameThumb, Page, BackLink } from "@/components/ui";
import { rulesSummary, gameBlurb } from "@/lib/rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerHex(g: any): string | null {
  return g?.owner && typeof g.owner.toHexString === "function"
    ? g.owner.toHexString()
    : null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idHex(identity: any): string {
  return identity && typeof identity.toHexString === "function"
    ? identity.toHexString()
    : String(identity);
}

const AV_COLORS = ["#ef4444", "#fb923c", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981"];

function PlayerRow({
  name,
  you,
  color,
}: {
  name: string;
  you: boolean;
  color: string;
}) {
  return (
    <div className={"player-row" + (you ? " is-you" : "")}>
      <span className="player-av" style={{ background: color }}>
        {(name || "?")[0]}
      </span>
      <span className="player-name">{name}</span>
      {you && <span className="you-badge">YOU</span>}
      <span className="player-status mono">in match</span>
    </div>
  );
}

export default function Lobby() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const { mod, connected } = useStdb();
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [roomUrl, setRoomUrl] = useState("");

  useEffect(() => {
    setRoomUrl(`${window.location.origin}/game/${gameId}`);
  }, [gameId]);

  const game = mod
    ? mod.getGamesRaw().find((g) => g.gameId.toString() === gameId)
    : undefined;

  if (!game) {
    const loading = !mod || !connected || (mod && mod.getGamesRaw().length === 0);
    return (
      <Page max={620}>
        <BackLink />
        <div className="notfound pop-in" style={{ paddingTop: 60 }}>
          <Marble size={48} busy={!!loading} />
          <h2 style={{ marginTop: 18 }}>
            {loading ? "Loading game…" : "This game doesn’t exist"}
          </h2>
          {!loading && (
            <>
              <p>It may have been deleted. Try another from the games hub.</p>
              <button className="btn btn-primary" onClick={() => router.push("/")}>
                Back to games
              </button>
            </>
          )}
        </div>
      </Page>
    );
  }

  const myId = mod ? mod.getIdentityHex() : null;
  const type = game.gameType;
  const mine = !!myId && ownerHex(game) === myId;
  const rulesRow = mod
    ? mod.getAllRulesRaw().find((r) => r.gameId.toString() === gameId)
    : undefined;
  const rules = rulesSummary(type, rulesRow, 6);

  const players = (mod ? mod.getPlayersForRaw(gameId) : []).map((p, i) => {
    const you = idHex(p.identity) === myId;
    return {
      name: you ? "You" : String(p.name),
      you,
      color: you ? "var(--you)" : AV_COLORS[i % AV_COLORS.length],
    };
  });
  const playing = players.length;

  const remix = async () => {
    if (!mod || remixing) return;
    setRemixing(true);
    const newId = await mod.remixGameAndWait(gameId);
    setRemixing(false);
    if (newId) router.push(`/game/${newId}`);
  };
  const del = () => {
    mod?.deleteGame(gameId);
    router.push("/");
  };

  return (
    <Page max={1040}>
      <BackLink />
      <div className="lobby fade-up">
        {/* left: preview + share */}
        <div className="lobby-preview">
          <div className="lobby-thumb card">
            <GameThumb type={type} size="lg" />
          </div>
          <div className="lobby-share panel">
            <div className="share-head">
              <div>
                <div className="eyebrow">Share · scan to join</div>
                <div className="share-url mono">{roomUrl}</div>
              </div>
              <button
                className="btn btn-chrome btn-sm"
                onClick={() => setShare((s) => !s)}
              >
                <Icon name="qr" size={15} /> {share ? "Hide" : "Show QR"}
              </button>
            </div>
            {share && roomUrl && (
              <div className="share-qr pop-in">
                <div className="qr" style={{ padding: 10 }}>
                  <QRCode value={roomUrl} size={150} />
                </div>
                <p className="share-note">
                  Point a phone camera here to jump straight into the match.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* right: details */}
        <div className="lobby-detail">
          <div className="lobby-owner">
            <span className={"owner-tag " + (mine ? "owner-you" : "owner-player")}>
              {mine ? "Created by you" : "By a player"}
            </span>
            <span className="type-tag">{type === "flappy" ? "FLAPPY" : "TANKS"}</span>
          </div>
          <h1 className="lobby-name">{game.name}</h1>
          <p className="lobby-blurb">{gameBlurb(type)}</p>

          <div className="lobby-rules">
            <div className="lobby-rules-label">Rules</div>
            <div className="gcard-rules" style={{ marginTop: 8 }}>
              {rules.map((r, i) => (
                <span className="rule-chip" key={i}>
                  <span className="rule-dot" />
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="lobby-players panel">
            <div className="players-head">
              <span>
                <Icon name="users" size={16} /> Live players
              </span>
              <span className="players-count mono">
                {playing > 0 ? playing + " playing now" : "be the first"}
              </span>
            </div>
            {players.length > 0 ? (
              <div className="players-list">
                {players.map((p, i) => (
                  <PlayerRow key={i} {...p} />
                ))}
              </div>
            ) : (
              <div className="players-empty">
                No one’s playing yet — hop in and start a match.
              </div>
            )}
          </div>

          <div className="lobby-cta">
            <button
              className="btn btn-primary btn-lg"
              data-testid="lobby-play"
              onClick={() => router.push(`/game/${gameId}`)}
            >
              <Icon name="play" size={17} /> {playing > 0 ? "Join match" : "Play"}
            </button>
            <button
              className={"btn btn-chrome btn-lg" + (remixing ? " is-busy" : "")}
              disabled={remixing}
              onClick={remix}
            >
              {remixing ? (
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  <Icon name="remix" size={16} /> Make it mine
                </>
              )}
            </button>
            {mine && (
              <button className="btn btn-ghost btn-danger btn-lg" onClick={del}>
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
