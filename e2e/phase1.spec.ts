import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

test("home menu shows seeded games and routes into a room", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto("/");

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

  // The two seeded games sync down.
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__APP__.getGames().length >= 2,
    null,
    { timeout: 15_000 }
  );

  const cards = page.getByTestId("game-card");
  expect(await cards.count()).toBeGreaterThanOrEqual(2);

  // Both game types are present.
  await expect(
    page.locator('[data-testid="game-card"][data-game-type="tanks"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="game-card"][data-game-type="flappy"]')
  ).toBeVisible();

  // Create tile is present.
  await expect(page.getByTestId("create-tile")).toBeVisible();

  // Clicking a real (DB) game card opens its lobby; Play routes into the live
  // room. (AI-gallery cards have no data-game-type and route to /g/<id> instead.)
  const dbCard = page.locator('[data-testid="game-card"][data-game-type="tanks"]').first();
  const firstId = await dbCard.getAttribute("data-game-id");
  await dbCard.click();
  await page.waitForURL(`**/lobby/${firstId}`, { timeout: 10_000 });
  await page.getByTestId("lobby-play").click();
  await page.waitForURL(`**/game/${firstId}`, { timeout: 10_000 });
  await expect(page.getByTestId("game-room")).toBeVisible();
  await expect(page.getByTestId("room-title")).toContainText(`Room ${firstId}`);

  expect(pageErrors).toEqual([]);
});
