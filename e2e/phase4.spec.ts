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

// Place A at (290,300), hold right for 400ms, return its x-displacement.
async function measureRight(page: Page, aId: string): Promise<number> {
  await page.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("debugPlace", {
        gameId: BigInt(gid),
        x: 290,
        y: 300,
        angle: 0,
      }),
    GID
  );
  await page.waitForFunction(
    (id) => {
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find(
          (x: { owner: string; kind: string }) =>
            x.owner === id && x.kind === "tank"
        );
      return !!e && Math.abs(e.x - 290) < 6;
    },
    aId,
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
  const x: number = await page.evaluate((id) => {
    const e = (window as unknown as AppWindow).__APP__
      .getEntities()
      .find(
        (x: { owner: string; kind: string }) =>
          x.owner === id && x.kind === "tank"
      );
    return e ? (e.x as number) : 290;
  }, aId);
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
  return x - 290;
}

async function setRule(page: Page, patch: object) {
  await page.evaluate(
    (pj) => (window as unknown as AppWindow).__APP__.forceEdit(pj),
    JSON.stringify(patch)
  );
}

test("rules edits hot-reload to all players, change behavior, and clamp", async ({
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

  // Clean baseline.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 1
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );

  const dxSlow = await measureRight(a, aId);
  expect(dxSlow).toBeGreaterThan(20);

  // Edit on A → both clients see player_speed = 2 (the hot-reload).
  await setRule(a, { player_speed: 2 });
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 2
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );
  await b.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 2
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );

  const dxFast = await measureRight(a, aId);
  expect(dxFast).toBeGreaterThan(dxSlow * 1.6); // ~2x faster

  // Out-of-range patch is clamped server-side (0.25..4).
  await setRule(a, { player_speed: 999 });
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 4
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );
  await b.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 4
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );

  // Another rule (projectile_bounces) propagates to both clients too.
  await setRule(a, { projectile_bounces: 5 });
  await a.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__.getRules()?.projectileBounces ===
      5,
    null,
    { timeout: 10_000 }
  );
  await b.waitForFunction(
    () =>
      (window as unknown as AppWindow).__APP__.getRules()?.projectileBounces ===
      5,
    null,
    { timeout: 10_000 }
  );

  // Restore defaults so manual smoke testing sees a clean game.
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
