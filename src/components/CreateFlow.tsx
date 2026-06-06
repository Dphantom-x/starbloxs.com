"use client";

// Phase 7 "make a game by talking", Starblox preview flow:
//   prompt -> /api/edit (mode:create) -> show a preview of what the AI parsed
//   -> confirm -> create_game(game_type) -> apply_rules_patch(newId, patch) -> room.
// The preview is derived from the REAL patch the API returns (one round-trip),
// so "Looks good" creates exactly what was shown.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStdb } from "./StdbProvider";
import { Icon, Marble, GameThumb, Page, BackLink } from "./ui";

const CREATE_EXAMPLES = [
  "a multiplayer flappy bird, tall, 3 gaps, birds collide",
  "a tank game with bouncy shells",
  "tanks with boost pads and rapid fire",
];

const NAMES: Record<string, string[]> = {
  tanks: ["Tank Skirmish", "Iron Duel", "Bounce Brigade", "Shell Shock"],
  flappy: ["Gap Runner", "Sky Hopper", "Pipe Dream", "Flutter Rush"],
};

type Patch = Record<string, unknown>;
type Preview = { type: "tanks" | "flappy"; name: string; rules: string[]; patch: Patch };

function n(v: unknown, f = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : f;
}

function previewFromPatch(patch: Patch): Preview {
  const type = patch.game_type === "flappy" ? "flappy" : "tanks";
  const rules: string[] = [];
  if (type === "flappy") {
    if (n(patch.field_height, 1) >= 2) rules.push("Tall field");
    if (n(patch.gravity, 1) <= 0.7 && "gravity" in patch) rules.push("Low gravity");
    if ("gaps_per_pipe" in patch) rules.push(`${n(patch.gaps_per_pipe, 3)} gaps per pipe`);
    if (n(patch.pipe_gap, 1) >= 1.4) rules.push("Wide gaps");
    if (patch.bird_collision) rules.push("Birds collide");
    if (rules.length === 0) rules.push("Default field", "3 gaps per pipe");
  } else {
    if (n(patch.projectile_bounces, 0) >= 1)
      rules.push(`Shells bounce ${n(patch.projectile_bounces)}×`);
    if (n(patch.player_speed, 1) >= 1.5)
      rules.push(`${+n(patch.player_speed).toFixed(1)}× speed`);
    if (rules.length === 0) rules.push("Default speed", "Shells bounce 5×");
  }
  const pool = NAMES[type];
  const name = pool[Math.floor(Math.random() * pool.length)];
  return { type, name, rules, patch };
}

export default function CreateFlow() {
  const { mod, connected } = useStdb();
  const router = useRouter();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "designing" | "preview" | "creating" | "error"
  >("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const busy = phase === "designing" || phase === "creating";
  const status =
    phase === "designing"
      ? "designing your game…"
      : phase === "creating"
        ? "creating…"
        : null;

  async function submit() {
    const t = text.trim();
    if (!t || !mod || busy || !connected) return;
    setPhase("designing");
    setErr("");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: t, mode: "create" }),
      });
      const data = (await res.json()) as { patch?: Patch; error?: string };
      if (!data.patch) {
        setErr(data.error ?? "I couldn’t build that — try a tank or flappy game.");
        setPhase("error");
        return;
      }
      setPreview(previewFromPatch(data.patch));
      setPhase("preview");
    } catch {
      setErr("something went wrong");
      setPhase("error");
    }
  }

  async function confirm() {
    if (!mod || !preview) return;
    setPhase("creating");
    try {
      const newId = await mod.createGameAndWait(preview.type, preview.name);
      if (!newId) {
        setErr("could not create the game");
        setPhase("error");
        return;
      }
      await mod.applyRulesPatch(newId, JSON.stringify(preview.patch));
      router.push(`/game/${newId}`);
    } catch {
      setErr("something went wrong");
      setPhase("error");
    }
  }

  return (
    <Page max={760} testId="create-page">
      <BackLink />
      <div className="create-wrap fade-up">
        <div className="create-mark">
          <Marble size={56} busy={busy} />
        </div>
        <h1 className="create-title">Create a game with AI</h1>
        <p className="create-subtitle">
          Describe a game in plain English and the AI builds it — live,
          multiplayer, ready to share.
        </p>

        <div className={"prompt-box" + (busy ? " is-busy" : "")}>
          <textarea
            ref={inputRef}
            className="prompt-input"
            data-testid="create-input"
            placeholder="e.g. a multiplayer Flappy Bird, tall, with a few gaps, and birds that collide"
            value={text}
            disabled={busy || phase === "preview"}
            onChange={(e) => {
              setText(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
          />
          <div className="prompt-foot">
            <span className="prompt-hint mono">
              {connected ? "⏎ to build · ⇧⏎ for newline" : "connecting…"}
            </span>
            {phase !== "preview" && (
              <button
                className="btn btn-primary"
                data-testid="create-submit"
                disabled={!text.trim() || busy || !connected}
                onClick={submit}
              >
                {busy ? (
                  <>
                    <span className="dots">
                      <span />
                      <span />
                      <span />
                    </span>{" "}
                    {status}
                  </>
                ) : (
                  <>
                    Create <Icon name="arrow" size={15} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="create-status" data-testid="create-status">
          {phase === "error" && (
            <span className="status-err pop-in">
              <Icon name="x" size={14} /> {err}
            </span>
          )}
          {busy && <span className="status-think">{status}</span>}
        </div>

        {phase === "preview" && preview && (
          <div className="preview-card pop-in">
            <div className="preview-thumb">
              <GameThumb type={preview.type} size="lg" />
            </div>
            <div className="preview-info">
              <div className="eyebrow">Looks like…</div>
              <h3 className="preview-name">{preview.name}</h3>
              <span
                className="type-tag"
                style={{ marginBottom: 12, display: "inline-block" }}
              >
                {preview.type === "flappy" ? "FLAPPY" : "TANKS"}
              </span>
              <div className="gcard-rules">
                {preview.rules.map((r, i) => (
                  <span className="mini-chip" key={i}>
                    {r}
                  </span>
                ))}
              </div>
              <div className="preview-actions">
                <button
                  className="btn btn-primary"
                  data-testid="create-confirm"
                  onClick={confirm}
                >
                  <Icon name="check" size={15} /> Looks good — create
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setPhase("idle");
                    setPreview(null);
                    inputRef.current?.focus();
                  }}
                >
                  Tweak it
                </button>
              </div>
            </div>
          </div>
        )}

        {phase !== "preview" && !busy && (
          <div className="examples">
            <span className="examples-label">Try</span>
            <div className="examples-chips">
              {CREATE_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  className="chip"
                  onClick={() => {
                    setText(ex);
                    if (phase === "error") setPhase("idle");
                    inputRef.current?.focus();
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
