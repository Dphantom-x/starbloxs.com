"use client";

// Live scoreboard for the current room. Reads players + win target straight
// from the SpacetimeDB cache; bars fill toward the win score.
import { useStdb } from "./StdbProvider";
import { Icon } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idHex(identity: any): string {
  return identity && typeof identity.toHexString === "function"
    ? identity.toHexString()
    : String(identity);
}

export default function Scoreboard({
  gameId,
}: {
  gameId: string;
  gameType?: string;
}) {
  const { mod } = useStdb();
  const myId = mod ? mod.getIdentityHex() : null;
  const rules = mod
    ? mod.getAllRulesRaw().find((r) => r.gameId.toString() === gameId)
    : undefined;
  const target =
    rules && Number(rules.winScore) > 0 ? Number(rules.winScore) : 10;

  const players = (mod ? mod.getPlayersForRaw(gameId) : [])
    .map((p) => ({
      id: idHex(p.identity),
      name: String(p.name),
      score: Number(p.score),
      you: idHex(p.identity) === myId,
    }))
    .sort((a, b) => b.score - a.score);
  const leader = players.length ? players[0].score : 0;

  return (
    <div className="panel scoreboard" data-testid="scoreboard">
      <div className="score-head">
        <span>
          <Icon name="trophy" size={15} /> Scoreboard
        </span>
        <span className="score-target mono">first to {target}</span>
      </div>
      <div className="score-list">
        {players.length === 0 && (
          <div className="score-empty">No players yet — join to appear here.</div>
        )}
        {players.map((p) => (
          <div
            key={p.id}
            className={"score-row" + (p.you ? " is-you" : "")}
          >
            <span
              className="score-sq"
              style={{ background: p.you ? "var(--you)" : "var(--enemy)" }}
            />
            <span className="score-name">
              {p.you ? "You" : p.name}
              {p.you && <span className="you-badge">YOU</span>}
            </span>
            <div className="score-bar">
              <span
                style={{
                  width: Math.min(100, (p.score / target) * 100) + "%",
                  background: p.you ? "var(--you)" : "var(--enemy)",
                }}
              />
            </div>
            <span
              data-testid="score"
              className={"score-val mono" + (p.score === leader && p.score > 0 ? " lead" : "")}
            >
              {p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
