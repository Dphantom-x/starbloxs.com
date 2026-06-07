// Phase-0 proof game: the host moves a single box; every client renders it from
// the synced entity cache. Proves host sim → commit reducer → SpacetimeDB sync →
// all clients render — the whole pseudo-engine plumbing, end to end.
import type { GameModule } from "@/engine/types";

export const proofGame: GameModule = {
  id: "proof",
  init(api) {
    api.setLocal([
      { key: "box1", kind: "box", x: 50, y: 300, vx: 0, vy: 0, angle: 0, data: { t: 0 } },
    ]);
  },
  tick(api) {
    const box = api.local()[0];
    if (!box) return;
    const d = (box.data ??= {});
    d.t = ((d.t as number) ?? 0) + 1; // monotonic counter (proves sim + sync)
    box.x += 160 * api.dt; // drift right (for the visual)
    if (box.x > 760) box.x = 40; // wrap
  },
  render(api) {
    for (const e of api.entities()) {
      if (e.kind !== "box") continue;
      api.draw.rect(e.x - 22, e.y - 22, 44, 44, 0x22c55e);
      api.draw.rect(e.x - 22, e.y - 22, 44, 6, 0x4ade80); // top highlight
    }
  },
};
