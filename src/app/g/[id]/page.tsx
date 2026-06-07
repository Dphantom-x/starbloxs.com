"use client";

// Clean play page for an AI-generated gallery game. Mounts the registry game
// (compiled from its code string) on a fixed shared gameId, so opening /g/<id>
// in two windows plays together. No DB game row needed — the engine syncs via
// commit_entities / engine_input on that gameId.
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useStdb } from "@/components/StdbProvider";
import RoomQR from "@/components/RoomQR";
import { Conn, Page, BackLink, Icon } from "@/components/ui";
import { GENERATED_GAMES } from "@/games/generated";

const GeneratedCanvas = dynamic(() => import("@/components/GeneratedCanvas"), {
  ssr: false,
});

export default function GeneratedPlay() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const entry = GENERATED_GAMES[id];
  const { connected, error } = useStdb();
  const [theater, setTheater] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("sb-theater", theater);
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(t);
  }, [theater]);
  useEffect(() => () => document.body.classList.remove("sb-theater"), []);

  if (!entry) {
    return (
      <Page max={760}>
        <BackLink />
        <div className="notfound pop-in" style={{ paddingTop: 60, textAlign: "center" }}>
          <h2>That game doesn’t exist</h2>
          <p>Pick one from the gallery on the home page.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page max={1320} testId="generated-room" className={"room" + (theater ? " is-theater" : "")}>
      <div className="room-top">
        <BackLink />
        <div className="room-title-row">
          <div className="room-titles">
            <h1 className="room-name">{entry.name}</h1>
            <div className="room-meta">
              <Conn connected={connected} error={error} />
              <span className="dot-sep">·</span>
              <span className="room-controls mono">arrow keys to move · space to act</span>
              <span className="ai-pill">AI-generated</span>
            </div>
          </div>
          <RoomQR />
        </div>
      </div>

      <div className="room-stage-wrap">
        <div className="canvas-stage room-stage">
          <div className="canvas-host game-fill">
            <GeneratedCanvas genId={id} />
            <div className="canvas-scan" />
          </div>
          <span className="canvas-badge mono">800 × 600 · live</span>
          <div className="stage-controls">
            <button
              className="stage-btn"
              aria-label={theater ? "Exit fullscreen" : "Fullscreen"}
              title={theater ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setTheater((t) => !t)}
            >
              <Icon name={theater ? "shrink" : "expand"} size={18} />
            </button>
          </div>
        </div>
        <p className="gen-blurb">{entry.summary.join(" · ")}</p>
      </div>
    </Page>
  );
}
