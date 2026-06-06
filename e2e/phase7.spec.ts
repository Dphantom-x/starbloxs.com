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

test("create a flappy game by talking", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/create");
  await waitConnected(a);

  await a.fill(
    '[data-testid="create-input"]',
    "a multiplayer flappy bird, tall, 3 gaps, birds collide"
  );
  await a.click('[data-testid="create-submit"]');

  // The preview confirm step appears (derived from the real AI patch).
  await a.waitForSelector('[data-testid="create-confirm"]', { timeout: 15_000 });
  await a.click('[data-testid="create-confirm"]');

  await a.waitForURL(/\/game\/\d+$/, { timeout: 15_000 });
  const newId = a.url().match(/\/game\/(\d+)/)?.[1] as string;
  expect(newId).toBeTruthy();

  // The new game has the AI-chosen type + initial rules, live.
  await a.waitForFunction(
    () => {
      const r = (window as unknown as AppWindow).__APP__.getRules();
      return (
        r &&
        r.gameType === "flappy" &&
        r.gapsPerPipe === 3 &&
        r.fieldHeight > 1 &&
        r.birdCollision === true
      );
    },
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
