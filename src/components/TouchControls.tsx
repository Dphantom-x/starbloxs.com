"use client";

// On-screen controls for touch devices (no keyboard). They push the same
// {up,down,left,right,fire} input the keyboard does, straight to set_input —
// the Phaser scene never sends input on mobile (no keys held), so there's no
// conflict. CSS shows these only on coarse-pointer / narrow screens.
import { useRef } from "react";
import { useStdb } from "./StdbProvider";
import { Icon } from "./ui";

type Dir = "up" | "down" | "left" | "right";

export default function TouchControls({
  gameId,
  gameType,
}: {
  gameId: string;
  gameType: string;
}) {
  const { mod } = useStdb();
  const state = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  });

  if (!mod) return null;

  const send = () => mod.setInput(gameId, { ...state.current });
  const set = (k: Dir | "fire", v: boolean) => {
    if (state.current[k] === v) return;
    state.current[k] = v;
    send();
  };
  // press/release helpers wired to pointer events (preventDefault stops the
  // touch from scrolling/zooming the page while you play).
  const hold = (k: Dir | "fire") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      set(k, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      set(k, false);
    },
    onPointerLeave: () => set(k, false),
    onPointerCancel: () => set(k, false),
  });

  if (gameType === "flappy") {
    return (
      <div className="touch-controls flappy" data-testid="touch-controls">
        <button className="touch-flap" data-testid="touch-flap" {...hold("up")}>
          <Icon name="bolt" size={18} /> TAP TO FLAP
        </button>
      </div>
    );
  }

  return (
    <div className="touch-controls tanks" data-testid="touch-controls">
      <div className="dpad">
        <button className="dbtn up" data-testid="touch-up" aria-label="up" {...hold("up")}>
          <Icon name="arrow" size={22} style={{ transform: "rotate(-90deg)" }} />
        </button>
        <button className="dbtn left" data-testid="touch-left" aria-label="left" {...hold("left")}>
          <Icon name="arrow" size={22} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button className="dbtn right" data-testid="touch-right" aria-label="right" {...hold("right")}>
          <Icon name="arrow" size={22} />
        </button>
        <button className="dbtn down" data-testid="touch-down" aria-label="down" {...hold("down")}>
          <Icon name="arrow" size={22} style={{ transform: "rotate(90deg)" }} />
        </button>
      </div>
      <button className="fire-btn" data-testid="touch-fire" aria-label="fire" {...hold("fire")}>
        <Icon name="bolt" size={20} />
        <span>FIRE</span>
      </button>
    </div>
  );
}
