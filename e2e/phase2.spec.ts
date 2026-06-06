import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

const GID = "1"; // seeded Tank game

async function bootstrap(page: Page) {
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
}

test("two players see each other move in real time", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errs: string[] = [];
  a.on("pageerror", (e) => errs.push("A: " + String(e)));
  b.on("pageerror", (e) => errs.push("B: " + String(e)));

  await bootstrap(a);
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("joinGame", {
        gameId: BigInt(gid),
        name: "A",
      }),
    GID
  );
  const aId: string = await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );

  // Phaser mounted its canvas (the visual layer renders).
  await expect(
    a.locator('[data-testid="game-canvas"] canvas')
  ).toBeVisible({ timeout: 10_000 });

  // A's OWN entity (matched by owner identity — robust to any stale rows).
  await a.waitForFunction(
    (id) =>
      (window as unknown as AppWindow).__APP__
        .getEntities()
        .some((e: { owner: string }) => e.owner === id),
    aId,
    { timeout: 15_000 }
  );

  await bootstrap(b);
  await b.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("joinGame", {
        gameId: BigInt(gid),
        name: "B",
      }),
    GID
  );

  // B sees A's entity.
  await b.waitForFunction(
    (id) =>
      (window as unknown as AppWindow).__APP__
        .getEntities()
        .some((e: { owner: string }) => e.owner === id),
    aId,
    { timeout: 15_000 }
  );

  const aX = (page: Page) =>
    page.evaluate((id) => {
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find((x: { owner: string }) => x.owner === id);
      return e ? (e.x as number) : null;
    }, aId);

  const bx0 = (await aX(b)) as number;
  expect(typeof bx0).toBe("number");

  // A holds "right".
  await a.evaluate(
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

  // B sees A's entity move right (pushed via subscription).
  await b.waitForFunction(
    (args) => {
      const [id, x0] = args as [string, number];
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find((x: { owner: string }) => x.owner === id);
      return !!e && e.x > x0 + 5;
    },
    [aId, bx0],
    { timeout: 15_000 }
  );

  // A's own cache reflects the same movement.
  const ax1 = (await aX(a)) as number;
  expect(ax1).toBeGreaterThan(bx0 + 5);

  // Stop input so it doesn't drift into the wall.
  await a.evaluate(
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

  expect(errs).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
