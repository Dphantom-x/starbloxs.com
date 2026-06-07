"use client";

// Live game editor for Option-B ENGINE games (DEMO 2). Prompt -> cannedEdit ->
// merge into the game's live engine_config (mod.setEngineConfig). The running
// host reads api.config() every tick, so the change lands on the next frame for
// EVERY player — no redeploy, no reconnect, state preserved. Visually identical
// to EditChat (same classes + testids); the difference is it writes config, not
// a game_rules patch, and the agent is the deterministic cannedEdit responder.
import { useEffect, useRef, useState } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Marble } from "./ui";
import { cannedEdit } from "@/lib/createAgent";

const ENGINE_SUGGESTIONS: Record<string, string[]> = {
  etank: ["manhunt", "everyone 2× faster", "shells bounce more", "lights on"],
  eflappy: ["more gravity", "wider gaps", "no collision", "faster pipes"],
};

type Msg = { who: "me" | "ai"; text: string; applied?: boolean; refused?: boolean };
type Term = { id: number; lines: string[] };

export default function EngineEditChat({
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
      text:
        gameType === "etank"
          ? "Tell me how to change the match — try “manhunt”, “everyone 2× faster”, or “shells bounce more”. It applies live for everyone."
          : "Tell me how to change the game — try “more gravity”, “wider gaps”, or “no collision”. It applies live for everyone.",
    },
  ]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState<Term | null>(null);
  const termId = useRef(0);
  // Accumulated config: seeded from the live cache, merged on each edit so two
  // quick edits don't clobber each other before the round-trip lands.
  const configRef = useRef<Record<string, unknown>>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [log, status]);

  const suggestions = ENGINE_SUGGESTIONS[gameType] ?? ENGINE_SUGGESTIONS.etank;

  function send(val?: string) {
    const t = (val ?? text).trim();
    if (!t || !mod || busy) return;
    setText("");
    setLog((l) => [...l, { who: "me", text: t }]);
    setBusy(true);
    setStatus("thinking…");

    // Deterministic agent (a live model would swap in here — same contract).
    const step = cannedEdit(gameType, t);

    // Brief "thinking" beat so the marble spins like the real model would.
    window.setTimeout(() => {
      if (step.kind === "config") {
        // Re-seed from the live cache (picks up any edit another player made),
        // then merge this patch and write the whole config back.
        const live = mod.getEngineConfigRaw();
        if (live) {
          try {
            configRef.current = { ...configRef.current, ...JSON.parse(live.config) };
          } catch {
            /* keep local accumulator */
          }
        }
        configRef.current = { ...configRef.current, ...step.patch };
        mod.setEngineConfig(gameId, JSON.stringify(configRef.current));

        setLog((l) => [...l, { who: "ai", text: step.reply, applied: true }]);
        setStatus("applied ✓ — live for everyone");
        termId.current += 1;
        setTerm({ id: termId.current, lines: step.lines });
      } else {
        setLog((l) => [...l, { who: "ai", text: step.text, refused: true }]);
        setStatus("no change");
      }
      setBusy(false);
    }, 360);
  }

  return (
    <div className="panel chat" data-testid="edit-chat">
      <div className="chat-head">
        <Marble size={30} busy={busy} />
        <div className="chat-head-text">
          <div className="chat-title">Edit with AI</div>
          <div className="chat-sub" data-testid="edit-status">
            {status ?? "change the live game by describing it"}
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
              <span className="msg-done mono">live</span>
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

      {/* AI "code changes" terminal — flashes the real engine_config write */}
      <div className="ai-terminal" data-testid="ai-terminal">
        <div className="term-bar">
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-name mono">engine_config · live</span>
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
