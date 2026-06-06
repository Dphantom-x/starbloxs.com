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

test("firing spawns a shell that moves", async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const errs: string[] = [];
  a.on("pageerror", (e) => errs.push(String(e)));

  await joinRoom(a, "A");
  await a.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__
        .getEntities()
        .some((e: { kind: string }) => e.kind === "tank"),
    null,
    { timeout: 15_000 }
  );

  // Hold fire.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("setInput", {
        gameId: BigInt(gid),
        up: false,
        down: false,
        left: false,
        right: false,
        fire: true,
      }),
    GID
  );

  // A shell appears…
  await a.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__
        .getEntities()
        .some((e: { kind: string }) => e.kind === "shell"),
    null,
    { timeout: 15_000 }
  );
  const p0 = await a.evaluate(() => {
    const s = (window as unknown as AppWindow).__APP__
      .getEntities()
      .find((e: { kind: string }) => e.kind === "shell");
    return s ? { x: s.x, y: s.y } : null;
  });
  expect(p0).not.toBeNull();

  // …and a shell is observed away from that spawn point (it moved/bounced).
  await a.waitForFunction(
    (p) => {
      const s = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find((e: { kind: string }) => e.kind === "shell");
      return (
        !!s &&
        (Math.abs(s.x - (p as { x: number }).x) > 4 ||
          Math.abs(s.y - (p as { y: number }).y) > 4)
      );
    },
    p0,
    { timeout: 8_000 }
  );

  expect(errs).toEqual([]);
  await ctx.close();
});

test("a hit increments the shooter's score", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await joinRoom(a, "A");
  await joinRoom(b, "B");
  const aId: string = await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );

  // Place A and B facing each other in the open central arena.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
        gameId: BigInt(gid),
        x: 340,
        y: 300,
        angle: 0,
      }),
    GID
  );
  await b.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
        gameId: BigInt(gid),
        x: 430,
        y: 300,
        angle: 0,
      }),
    GID
  );

  // Wait until A's tank is at the placed spot (synced).
  await a.waitForFunction(
    (id) => {
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find(
          (x: { owner: string; kind: string }) =>
            x.owner === id && x.kind === "tank"
        );
      return !!e && Math.abs(e.x - 340) < 4 && Math.abs(e.y - 300) < 4;
    },
    aId,
    { timeout: 10_000 }
  );

  const score0: number = await a.evaluate((id) => {
    const p = (window as unknown as AppWindow).__APP__
      .getPlayers()
      .find((p: { identity: string }) => p.identity === id);
    return p ? (p.score as number) : 0;
  }, aId);

  // A fires toward B.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("setInput", {
        gameId: BigInt(gid),
        up: false,
        down: false,
        left: false,
        right: false,
        fire: true,
      }),
    GID
  );

  // A's score increments when the shell hits B.
  await a.waitForFunction(
    (args) => {
      const [id, s0] = args as [string, number];
      const p = (window as unknown as AppWindow).__APP__
        .getPlayers()
        .find((p: { identity: string }) => p.identity === id);
      return !!p && p.score > s0;
    },
    [aId, score0],
    { timeout: 15_000 }
  );

  await ctxA.close();
  await ctxB.close();
});
