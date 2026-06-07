"use client";

// DEMO 1 — "make a game by talking". A real agent loop: clarify (one question) →
// confirm → build (a terminal flashes the REAL rebuilt game-file code) → test
// (plays the captured verification video) → Publish & Play (creates the engine
// game and drops you into the live multiplayer room). The agent's words are the
// deterministic `cannedCreate` responder (a live key would swap it in — same UI).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStdb } from "./StdbProvider";
import { Icon, Marble, Page, BackLink } from "./ui";
import { cannedCreate, type CreateStep, type Turn } from "@/lib/createAgent";

type Phase = "idle" | "clarifying" | "building" | "testing" | "ready";
type Confirmed = Extract<CreateStep, { kind: "confirmed" }>;

const EXAMPLES = [
  "make a multiplayer flappy bird with collision",
  "a multiplayer tank arena with bouncing shells",
];

export default function CreateFlow() {
  const { mod, connected } = useStdb();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [termLines, setTermLines] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const termRef = useRef<HTMLDivElement>(null);

  const busy = phase === "building" || phase === "testing";

  function submitPrompt() {
    const t = text.trim();
    if (!t || !connected) return;
    const step = cannedCreate([{ role: "user", text: t }]);
    if (step.kind === "question") {
      setTurns([{ role: "user", text: t }, { role: "ai", text: step.text }]);
      setPhase("clarifying");
    }
  }

  function submitReply() {
    const r = reply.trim();
    if (!r) return;
    const h: Turn[] = [...turns, { role: "user", text: r }];
    const step = cannedCreate(h);
    setReply("");
    if (step.kind === "confirmed") {
      setTurns([...h, { role: "ai", text: "Confirmed — building it now." }]);
      setConfirmed(step);
      setPhase("building");
    } else {
      setTurns([...h, { role: "ai", text: step.text }]);
    }
  }

  // building: flash the real game-file code, then advance to testing.
  useEffect(() => {
    if (phase !== "building" || !confirmed) return;
    const lines = confirmed.code.split("\n");
    setTermLines([]);
    let i = 0;
    const iv = window.setInterval(() => {
      i += 1;
      setTermLines(lines.slice(0, i));
      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
      if (i >= lines.length) {
        window.clearInterval(iv);
        window.setTimeout(() => setPhase("testing"), 600);
      }
    }, 70);
    return () => window.clearInterval(iv);
  }, [phase, confirmed]);

  // testing: let the verification clip play, then reveal Publish.
  useEffect(() => {
    if (phase !== "testing") return;
    const t = window.setTimeout(() => setPhase("ready"), 4200);
    return () => window.clearTimeout(t);
  }, [phase]);

  async function publish() {
    if (!mod || !confirmed) return;
    try {
      const id = await mod.createGameAndWait(confirmed.gameType, confirmed.name);
      if (!id) {
        setErr("could not create the game");
        return;
      }
      router.push(`/game/${id}`);
    } catch {
      setErr("something went wrong");
    }
  }

  function startOver() {
    setPhase("idle");
    setTurns([]);
    setConfirmed(null);
    setTermLines([]);
    setText("");
    setErr("");
  }

  return (
    <Page max={760} testId="create-page">
      <BackLink />
      <div className="create-wrap fade-up">
        <div className="create-mark">
          <Marble size={48} busy={busy} />
        </div>
        <h1 className="create-title">Create a game with AI</h1>

        {phase === "idle" && (
          <>
            <p className="create-subtitle">
              Describe a game — the AI designs it with you, builds it, tests it,
              and you publish it. Live, multiplayer, no code.
            </p>
            <div className="prompt-box">
              <textarea
                className="prompt-input"
                data-testid="create-input"
                rows={2}
                placeholder="e.g. make a multiplayer flappy bird with collision"
                value={text}
                disabled={!connected}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
              />
              <div className="prompt-foot">
                <span className="prompt-hint mono">
                  {connected ? "⏎ to start" : "connecting…"}
                </span>
                <button
                  className="btn btn-primary"
                  data-testid="create-submit"
                  disabled={!text.trim() || !connected}
                  onClick={submitPrompt}
                >
                  Start <Icon name="arrow" size={15} />
                </button>
              </div>
            </div>
            <div className="examples">
              <span className="examples-label">Try</span>
              <div className="examples-chips">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} className="chip" onClick={() => setText(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {phase !== "idle" && (
          <div className="card" style={{ width: "100%", padding: 16, marginTop: 8, textAlign: "left" }}>
            <div className="chat-body" style={{ maxHeight: 190, padding: 0 }}>
              {turns.map((t, i) => (
                <div key={i} className={"msg " + (t.role === "user" ? "msg-me" : "msg-ai")}>
                  {t.role === "ai" && (
                    <span className="msg-ic">
                      <Icon name="check" size={11} />
                    </span>
                  )}
                  <span>{t.text}</span>
                </div>
              ))}
            </div>

            {phase === "clarifying" && (
              <div className="chat-input-row" style={{ marginTop: 10, borderRadius: 12, borderTop: "none" }}>
                <input
                  className="chat-input"
                  data-testid="clarify-input"
                  autoFocus
                  placeholder="answer the AI…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitReply();
                  }}
                />
                <button className="btn btn-primary btn-sm" data-testid="clarify-submit" onClick={submitReply}>
                  <Icon name="send" size={14} />
                </button>
              </div>
            )}

            {phase === "building" && (
              <div className="ai-terminal" style={{ margin: "12px 0 0" }}>
                <div className="term-bar">
                  <span className="term-dot" />
                  <span className="term-dot" />
                  <span className="term-dot" />
                  <span className="term-name">writing {confirmed?.gameType}.ts</span>
                </div>
                <div className="term-body" ref={termRef} style={{ maxHeight: 220 }}>
                  {termLines.map((l, i) => (
                    <div key={i} className="term-line">
                      {l || " "}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(phase === "testing" || phase === "ready") && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="eyebrow">
                  {phase === "testing" ? "Running its tests…" : "Tests passed ✓ — here it is, working"}
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={confirmed?.gameType === "etank" ? "/tank-verification.webm" : "/flappy-verification.webm"}
                  autoPlay
                  muted
                  loop
                  playsInline
                  data-testid="test-video"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line)" }}
                />
              </div>
            )}

            {phase === "ready" && confirmed && (
              <div style={{ marginTop: 14 }}>
                <h3 className="preview-name">{confirmed.name}</h3>
                <div className="gcard-rules">
                  {confirmed.summary.map((s, i) => (
                    <span key={i} className="mini-chip">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="preview-actions" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" data-testid="create-confirm" onClick={publish}>
                    <Icon name="play" size={15} /> Publish &amp; Play
                  </button>
                  <button className="btn btn-ghost" onClick={startOver}>
                    Start over
                  </button>
                </div>
              </div>
            )}

            {err && (
              <div className="status-err" style={{ marginTop: 10 }}>
                <Icon name="x" size={14} /> {err}
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
