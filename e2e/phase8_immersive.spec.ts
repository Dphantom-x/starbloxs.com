import { test, expect, devices, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };
const GID = "1"; // seeded Tank game

async function ready(page: Page) {
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

test("mobile: touch controls are shown and drive the tank", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const m = await ctx.newPage();
  await m.goto(`/game/${GID}`);
  await ready(m);

  // The on-screen controls appear on the narrow/touch viewport.
  await expect(m.getByTestId("touch-controls")).toBeVisible();
  await expect(m.getByTestId("touch-fire")).toBeVisible();

  // My tank spawns (auto-join on connect).
  await m.waitForFunction(
    () => {
      const me = (window as unknown as AppWindow).__APP__.identity();
      return (window as unknown as AppWindow).__APP__
        .getEntities()
        .some((e: { owner: string; kind: string }) => e.owner === me && e.kind === "tank");
    },
    null,
    { timeout: 15_000 }
  );

  const pos = () =>
    m.evaluate(() => {
      const me = (window as unknown as AppWindow).__APP__.identity();
      const e = (window as unknown as AppWindow).__APP__
        .getEntities()
        .find((x: { owner: string; kind: string }) => x.owner === me && x.kind === "tank");
      return e ? { x: e.x as number, y: e.y as number } : null;
    });

  const press = async (id: string, ms: number) => {
    await m.locator(`[data-testid="${id}"]`).dispatchEvent("pointerdown");
    await m.waitForTimeout(ms);
    await m.locator(`[data-testid="${id}"]`).dispatchEvent("pointerup");
  };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  // Hold a direction → the tank moves. Try right, then down if a wall blocks it.
  const p0 = (await pos())!;
  await press("touch-right", 650);
  let p1 = (await pos())!;
  let moved = dist(p0, p1) > 4;
  if (!moved) {
    await press("touch-down", 650);
    const p2 = (await pos())!;
    moved = dist(p1, p2) > 4;
  }
  expect(moved).toBe(true);

  await ctx.close();
});

test("desktop: fullscreen toggle, on-demand chat, and the AI change terminal", async ({
  page,
}) => {
  await page.goto(`/game/${GID}`);
  await ready(page);

  // Fullscreen (theater) toggles on and off.
  await expect(page.locator("main.is-theater")).toHaveCount(0);
  await page.click('[data-testid="fullscreen-toggle"]');
  await expect(page.locator("main.is-theater")).toHaveCount(1);
  await page.click('[data-testid="fullscreen-toggle"]');
  await expect(page.locator("main.is-theater")).toHaveCount(0);

  // Chat is hidden until you ask for it.
  await expect(page.getByTestId("edit-input")).toBeHidden();
  await page.click('[data-testid="edit-open"]');
  await expect(page.getByTestId("edit-input")).toBeVisible();

  // Type + apply an edit; the change hot-reloads.
  await page.fill('[data-testid="edit-input"]', "make shells bounce more");
  await page.click('[data-testid="edit-submit"]');
  await expect(page.getByTestId("edit-status")).toContainText("done", {
    timeout: 10_000,
  });

  // The terminal flashes the real change.
  await expect(page.getByTestId("ai-terminal")).toContainText("game_rules");
  await expect(page.getByTestId("ai-terminal")).toContainText("projectile_bounces");
  await expect(page.getByTestId("ai-terminal")).toContainText("hot-reloaded");

  // Restore defaults for the next run / manual smoke testing.
  await page.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );
});
