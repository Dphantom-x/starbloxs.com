import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

const GID = "2"; // seeded Flappy game

async function joinRoom(page: Page, name: string) {
  await page.goto(`/game/${GID}`);
  await page.waitForFunction(
    () => typeof (window as unknown as AppWindow).__APP__ !== "undefined",
    null,
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__APP__.connected() === true,
    null,
    { timeout: 15_000 }
  );
  await page.evaluate(
    (gid) => (window as unknown as AppWindow).__APP__.setCurrentGameId(gid),
    GID
  );
  await page.evaluate(
    (args) => {
      const [gid, n] = args as [string, string];
      return (window as unknown as AppWindow).__APP__.callReducer("joinGame", {
        gameId: BigInt(gid),
        name: n,
      });
    },
    [GID, name]
  );
}

async function setRule(page: Page, patch: object) {
  await page.evaluate(
    (pj) => (window as unknown as AppWindow).__APP__.forceEdit(pj),
    JSON.stringify(patch)
  );
}

// An x with maximum clearance from any pipe column (so a brief free-fall there
// won't collide with a scrolling pipe).
async function safeX(page: Page): Promise<number> {
  const xs: number[] = await page.evaluate(() =>
    (window as unknown as AppWindow).__APP__
      .getEntities()
      .filter((e: { kind: string }) => e.kind === "pipe")
      .map((p: { x: number }) => p.x)
  );
  if (xs.length === 0) return 400;
  let best = 400;
  let bestClear = -Infinity;
  for (let x = 90; x <= 710; x += 10) {
    let clear = Infinity;
    for (const px of xs) {
      const d = x < px ? px - x : x > px + 70 ? x - (px + 70) : -1;
      clear = Math.min(clear, d);
    }
    if (clear > bestClear) {
      bestClear = clear;
      best = x;
    }
  }
  return best;
}

// Place the bird mid-field at a pipe-free x and return its downward velocity
// after a short free-fall (reflects gravity-from-rules, uncorrupted by pipes).
async function measureVy(page: Page, id: string): Promise<number> {
  await page.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("setInput", {
        gameId: BigInt(gid),
        up: false,
        down: false,
        left: false,
        right: false,
        fire: false,
      }),
    GID
  );
  const x = await safeX(page);
  await page.evaluate(
    (args) => {
      const [gid, px] = args as [string, number];
      return (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
        gameId: BigInt(gid),
        x: px,
        y: 300,
        angle: 0,
      });
    },
    [GID, x]
  );
  await page.waitForFunction(
    (args) => {
      const [bid, px] = args as [string, number];
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find(
          (z: { owner: string; kind: string }) =>
            z.owner === bid && z.kind === "bird"
        );
      return !!e && Math.abs(e.x - px) < 8 && Math.abs(e.y - 300) < 12;
    },
    [id, x],
    { timeout: 8_000 }
  );
  await page.waitForTimeout(150);
  return page.evaluate((bid) => {
    const e = (window as unknown as AppWindow).__APP__
      .getEntities()
      .find(
        (z: { owner: string; kind: string }) =>
          z.owner === bid && z.kind === "bird"
      );
    return e ? (e.vy as number) : 0;
  }, id);
}

test("flappy: gravity-from-rules, multi-gap pipes, bird collision", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await joinRoom(a, "A");
  await joinRoom(b, "B");
  const aId: string = await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );
  const bId: string = await b.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );

  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );

  // --- gravity from rules affects fall speed (measured pipe-free) ---
  await setRule(a, { gravity: 2 });
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.gravity ?? -1) - 2
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );
  const vyHigh = await measureVy(a, aId);

  await setRule(a, { gravity: 0.5 });
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.gravity ?? -1) -
          0.5
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );
  const vyLow = await measureVy(a, aId);

  expect(vyHigh).toBeGreaterThan(100);
  expect(vyHigh).toBeGreaterThan(vyLow * 2);

  // --- gaps_per_pipe = 3 -> every pipe exposes 3 gaps ---
  await setRule(a, { gaps_per_pipe: 3 });
  await a.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__.getRules()?.gapsPerPipe === 3,
    null,
    { timeout: 10_000 }
  );
  await a.waitForFunction(
    () => {
      const pipes = (window as unknown as AppWindow).__APP__
        .getEntities()
        .filter((e: { kind: string }) => e.kind === "pipe");
      return (
        pipes.length > 0 &&
        pipes.every((p: { data: string }) => {
          try {
            return JSON.parse(p.data).gaps.length === 3;
          } catch {
            return false;
          }
        })
      );
    },
    null,
    { timeout: 10_000 }
  );

  // --- bird_collision: two overlapping birds separate ---
  await setRule(a, { bird_collision: true });
  await a.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__.getRules()?.birdCollision ===
      true,
    null,
    { timeout: 10_000 }
  );
  for (const page of [a, b]) {
    await page.evaluate(
      (gid) =>
        (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
          gameId: BigInt(gid),
          x: 400,
          y: 200,
          angle: 0,
        }),
      GID
    );
  }
  await a.waitForFunction(
    (args) => {
      const [ida, idb] = args as [string, string];
      const ents = (window as unknown as AppWindow).__APP__.getEntities();
      const ba = ents.find(
        (e: { owner: string; kind: string }) =>
          e.owner === ida && e.kind === "bird"
      );
      const bb = ents.find(
        (e: { owner: string; kind: string }) =>
          e.owner === idb && e.kind === "bird"
      );
      return ba && bb && Math.abs(ba.x - bb.x) > 12;
    },
    [aId, bId],
    { timeout: 10_000 }
  );

  // The flappy AI prompts from SMOKE_TESTS now map (canned) and apply live.
  // Note: gravity 0.45 comes back from f32 as 0.4499998 -> tolerance compare.
  await a.fill('[data-testid="edit-input"]', "lower gravity and widen the gaps");
  await a.click('[data-testid="edit-submit"]');
  await expect(a.getByTestId("edit-status")).toContainText("done", {
    timeout: 10_000,
  });
  await a.waitForFunction(
    () => {
      const r = (window as unknown as AppWindow).__APP__.getRules();
      return (
        r &&
        Math.abs(r.gravity - 0.45) < 0.02 &&
        Math.abs(r.pipeGap - 1.8) < 0.02
      );
    },
    null,
    { timeout: 10_000 }
  );

  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );

  await ctxA.close();
  await ctxB.close();
});
