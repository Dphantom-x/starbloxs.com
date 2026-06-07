import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

async function waitConnected(page: Page) {
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
}

test("DEMO 1: create an engine game by talking → build → test → publish → room", async ({
  browser,
}, testInfo) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/create");
  await waitConnected(a);

  // Describe the game.
  await a.fill('[data-testid="create-input"]', "make a multiplayer flappy bird with collision");
  await a.click('[data-testid="create-submit"]');

  // The AI asks ONE clarifying question → we answer (the forgiving-collision branch).
  await a.waitForSelector('[data-testid="clarify-input"]', { timeout: 15_000 });
  await a.fill('[data-testid="clarify-input"]', "only kill me if I hit the side of a pipe");
  await a.click('[data-testid="clarify-submit"]');

  // The terminal flashes the real game-file code, the verification video plays,
  // then Publish appears.
  await expect(a.getByTestId("test-video")).toBeVisible({ timeout: 20_000 });
  await a.waitForSelector('[data-testid="create-confirm"]', { timeout: 25_000 });
  await a.screenshot({ path: testInfo.outputPath("create-flow.png") });
  await testInfo.attach("create-flow", { path: testInfo.outputPath("create-flow.png"), contentType: "image/png" });
  await a.click('[data-testid="create-confirm"]');

  // We land in the live engine room.
  await a.waitForURL(/\/game\/\d+$/, { timeout: 15_000 });
  const newId = a.url().match(/\/game\/(\d+)/)?.[1] as string;
  expect(newId).toBeTruthy();
  await expect(a.getByTestId("game-room")).toBeVisible();

  // It's a REAL engine Flappy — a bird spawns and runs on the pseudo-engine.
  await a.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as AppWindow).__APP__.getEntities().some((e: any) => e.kind === "fbird"),
    null,
    { timeout: 15_000 }
  );

  // Cleanup (owner-only delete).
  await a.evaluate(
    (id) =>
      (window as unknown as AppWindow).__APP__.callReducer("deleteGame", {
        gameId: BigInt(id),
      }),
    newId
  );
});

test("remix clones a game into a new one I own (original untouched)", async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/");
  await waitConnected(a);
  await a.waitForFunction(
    () => (window as unknown as AppWindow).__APP__.getGames().length >= 2,
    null,
    { timeout: 15_000 }
  );

  // Give game 1 a distinctive rule so we can verify the clone copies it.
  await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.callReducer("applyRulesPatch", {
      gameId: BigInt(1),
      patch: JSON.stringify({ player_speed: 3.5 }),
    })
  );
  await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.setCurrentGameId("1")
  );
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ?? 0) -
          3.5
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );

  // Remix the tank (game 1).
  await a.click('[data-testid="remix-btn"][data-remix-id="1"]');
  await a.waitForURL(/\/game\/\d+$/, { timeout: 15_000 });
  const newId = a.url().match(/\/game\/(\d+)/)?.[1] as string;
  expect(newId).not.toBe("1");

  // The clone is a tank with the copied player_speed.
  await a.waitForFunction(
    () => {
      const r = (window as unknown as AppWindow).__APP__.getRules();
      return (
        r &&
        r.gameType === "tanks" &&
        Math.abs((r.playerSpeed ?? 0) - 3.5) < 0.01
      );
    },
    null,
    { timeout: 15_000 }
  );

  // The original game still exists.
  const has1 = await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__
      .getGames()
      .some((g: { gameId: string }) => g.gameId === "1")
  );
  expect(has1).toBe(true);

  // Cleanup: delete the remix, restore game 1.
  await a.evaluate(
    (id) =>
      (window as unknown as AppWindow).__APP__.callReducer("deleteGame", {
        gameId: BigInt(id),
      }),
    newId
  );
  await a.evaluate(() =>
    (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
      gameId: BigInt(1),
    })
  );
});
