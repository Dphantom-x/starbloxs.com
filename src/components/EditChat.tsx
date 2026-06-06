"use client";

// Plain-English game editor as a chat panel: prompt -> /api/edit ->
// applyRulesPatch (live for all players). The marble spins while thinking and
// the subtitle doubles as the live status line (data-testid="edit-status").
// On a successful edit, a little terminal above the input flashes the REAL
// patch as if it were code being written — theatrical, but truthful.
import { useEffect, useRef, useState } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Marble } from "./ui";

const EDIT_SUGGESTIONS: Record<string, string[]> = {
  tanks: [
    "make shells bounce more",
    "everyone moves 2× faster",
    "add boost strips",
    "rapid fire",
  ],
  flappy: [
    "make the gaps wider",
    "lower the gravity",
    "let birds collide",
    "make the field taller",
  ],
};

type Msg = { who: "me" | "ai"; text: string; applied?: boolean; refused?: boolean };
type Term = { id: number; lines: string[] };

function fmtVal(v: unknown): string {
  if (Array.isArray(v)) return `[${v.length}]`;
  if (v && typeof v === "object") return "{…}";
  return String(v);
}
function patchToLines(patch: Record<string, unknown>, players: number): string[] {
  const entries = Object.entries(patch).filter(([k]) => k !== "game_type");
  const lines = ["$ starblox apply → game_rules"];
  for (const [k, v] of entries) lines.push(`~ ${k}: ${fmtVal(v)}`);
  const ms = 6 + Math.floor(Math.random() * 9);
  lines.push(`✓ hot-reloaded · live for ${players} · ${ms}ms`);
  return lines;
}

export default function EditChat({
  gameId,
  gameType,
  onClose,
}: {
  gameId: string;
  gameType: string;
  onClose?: () => void;
}) {
  const { mod } = useStdb();
  const [log, setLog] = useState<Msg[]>([
    {
      who: "ai",
      text: "Tell me how to change the game — speed, bounces, gravity, gaps, and more.",
    },
  ]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState<Term | null>(null);
  const termId = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [log, status]);

  const suggestions = EDIT_SUGGESTIONS[gameType] ?? EDIT_SUGGESTIONS.tanks;

  async function send(val?: string) {
    const t = (val ?? text).trim();
    if (!t || !mod || busy) return;
    setText("");
    setLog((l) => [...l, { who: "me", text: t }]);
    setBusy(true);
    setStatus("thinking…");
    try {
      const players = mod
        .getPlayersRaw()
        .map((p) => ({ name: String(p.name), score: Number(p.score) }));
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: t, gameType, players }),
      });
      const data = (await res.json()) as {
        patch?: Record<string, unknown>;
        error?: string;
      };
      if (data.patch) {
        mod.applyRulesPatch(gameId, JSON.stringify(data.patch));
        setLog((l) => [...l, { who: "ai", text: t, applied: true }]);
        setStatus("done ✓");
        termId.current += 1;
        setTerm({ id: termId.current, lines: patchToLines(data.patch, players.length || 1) });
      } else {
        const msg = data.error ?? "no change";
        setLog((l) => [...l, { who: "ai", text: msg, refused: true }]);
        setStatus(msg);
      }
    } catch {
      const msg = "something went wrong";
      setLog((l) => [...l, { who: "ai", text: msg, refused: true }]);
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat" data-testid="edit-chat">
      <div className="chat-head">
        <Marble size={30} busy={busy} />
        <div className="chat-head-text">
          <div className="chat-title">Edit with AI</div>
          <div className="chat-sub" data-testid="edit-status">
            {status ?? "change the game by describing it"}
          </div>
        </div>
        {onClose && (
          <button
            className="chat-close"
            data-testid="edit-close"
            aria-label="Close chat"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <div className="chat-body" ref={bodyRef}>
        {log.map((m, i) => (
          <div
            key={i}
            className={"msg msg-" + m.who + (m.refused ? " msg-refused" : "")}
          >
            {m.who === "ai" && m.applied && (
              <span className="msg-ic">
                <Icon name="check" size={12} />
              </span>
            )}
            <span className="msg-text">{m.text}</span>
            {m.who === "ai" && m.applied && (
              <span className="msg-done mono">done</span>
            )}
          </div>
        ))}
        {busy && (
          <div className="msg msg-ai msg-think">
            <span className="dots">
              <span />
              <span />
              <span />
            </span>{" "}
            thinking…
          </div>
        )}
      </div>

      <div className="chat-suggest">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="suggest-chip"
            disabled={busy}
            onClick={() => send(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* AI "code changes" terminal — flashes the real patch as file edits */}
      <div className="ai-terminal" data-testid="ai-terminal">
        <div className="term-bar">
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-name mono">game_rules · live patch</span>
        </div>
        <div className="term-body mono" key={term?.id ?? "idle"}>
          {term ? (
            term.lines.map((l, i) => (
              <div
                className="term-line"
                data-kind={l[0]}
                style={{ animationDelay: i * 60 + "ms" }}
                key={i}
              >
                {l}
              </div>
            ))
          ) : (
            <div className="term-idle">$ awaiting edits…</div>
          )}
        </div>
      </div>

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="chat-input"
          data-testid="edit-input"
          placeholder="Tell the AI how to change the game…"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon"
          data-testid="edit-submit"
          disabled={busy || !text.trim()}
        >
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
