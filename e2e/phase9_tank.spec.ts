import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };
const GID = "1"; // seeded Tank game

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

const forceEdit = (page: Page, patch: object) =>
  page.evaluate(
    (pj) => (window as unknown as AppWindow).__APP__.forceEdit(pj),
    JSON.stringify(patch)
  );

// Place A at (startX,300), hold right 400ms, return x-displacement.
async function measureRight(page: Page, id: string, startX: number): Promise<number> {
  await page.evaluate(
    (args) => {
      const [gid, sx] = args as [string, number];
      return (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
        gameId: BigInt(gid),
        x: sx,
        y: 300,
        angle: 0,
      });
    },
    [GID, startX]
  );
  await page.waitForFunction(
    (args) => {
      const [bid, sx] = args as [string, number];
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find((z: { owner: string; kind: string }) => z.owner === bid && z.kind === "tank");
      return !!e && Math.abs(e.x - sx) < 6;
    },
    [id, startX],
    { timeout: 10_000 }
  );
  await page.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("setInput", {
        gameId: BigInt(gid),
        up: false,
        down: false,
        left: false,
        right: true,
        fire: false,
      }),
    GID
  );
  await page.waitForTimeout(400);
  const x: number = await page.evaluate((bid) => {
    const e = (window as unknown as AppWindow).__APP__
      .getEntities()
      .find((z: { owner: string; kind: string }) => z.owner === bid && z.kind === "tank");
    return e ? (e.x as number) : 0;
  }, id);
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
  await page.waitForTimeout(120);
  return x - startX;
}

test("tank: a speed pad grants a timed buff (faster after driving over it)", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await joinRoom(a, "A");
  const aId: string = await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", { gameId: BigInt(gid) }),
    GID
  );

  // Baseline speed, no pad.
  await forceEdit(a, { player_speed: 1, boost_zones: [] });
  await a.waitForFunction(
    () => ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ?? 0) === 1,
    null,
    { timeout: 10_000 }
  );
  const base = await measureRight(a, aId, 290);

  // A pad over the start area → driving through grants a 2× buff for 5s.
  await forceEdit(a, {
    boost_zones: [{ x: 0.3, y: 0.45, w: 0.18, h: 0.12, dir: [1, 0], strength: 2 }],
  });
  await a.waitForTimeout(250); // let the pad patch land in map_features
  const buffed = await measureRight(a, aId, 250); // 250px is inside the pad (240–384)

  expect(base).toBeGreaterThan(40);
  expect(buffed).toBeGreaterThan(base * 1.5);

  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", { gameId: BigInt(gid) }),
    GID
  );
  await ctx.close();
});
