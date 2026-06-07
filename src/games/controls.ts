// Phase-1 controls game: the host gives every player a box and moves it by THAT
// player's synced input. Proves the client→host input channel + per-player
// avatars + multiplayer (others see your box move). The same plumbing Flappy/Tank
// need (each player's flap/drive comes through here).
import type { EngineEntity, GameModule } from "@/engine/types";

const SPEED = 240;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const controlsGame: GameModule = {
  id: "controls",
  tick(api) {
    const prev = new Map(api.local().map((e) => [e.key, e]));
    const next: EngineEntity[] = [];
    for (const p of api.players()) {
      const key = `pbox:${p.id}`;
      const box: EngineEntity =
        prev.get(key) ?? { key, kind: "pbox", x: 400, y: 300, vx: 0, vy: 0, angle: 0, data: { pid: p.id } };
      const dx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
      const dy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
      box.x = clamp(box.x + dx * SPEED * api.dt, 24, 776);
      box.y = clamp(box.y + dy * SPEED * api.dt, 24, 576);
      next.push(box);
    }
    api.setLocal(next); // players who left simply drop out
  },
  render(api) {
    const myId = api.me();
    for (const e of api.entities()) {
      if (e.kind !== "pbox") continue;
      let pid = "";
      try {
        pid = JSON.parse(e.data).pid ?? "";
      } catch {
        pid = "";
      }
      const mine = !!myId && pid === myId;
      api.draw.roundedRect(e.x - 22, e.y - 22, 44, 44, 10, mine ? 0x22c55e : 0x3b82f6);
      api.draw.strokeRoundedRect(e.x - 22, e.y - 22, 44, 44, 10, 0x0c0d10, 2);
    }
  },
};
