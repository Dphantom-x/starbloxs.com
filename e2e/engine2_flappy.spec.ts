import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

// Phase 2 gate: the rebuilt Flappy runs ON THE ENGINE — birds fall under gravity,
// flapping raises them, and pipes scroll with multiple gaps. (Death/game-over +
// pixel-polish land in Phase 3.)
test("engine flappy: gravity falls, flap rises, pipes scroll with 3 gaps", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const errs: string[] = [];
  a.on("pageerror", (e) => errs.push(String(e)));

  await a.goto("/engine-test?game=flappy&host=1");
  await a.waitForFunction(
    () =>
      typeof (window as unknown as W).__ENGINE__ !== "undefined" &&
      !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  const id: string = await a.evaluate(() => (window as unknown as W).__ENGINE__.myId());

  // My bird exists.
  await a.waitForFunction(
    (i) => (window as unknown as W).__ENGINE__.pos(`fbird:${i}`) !== null,
    id,
    { timeout: 15_000 }
  );

  // Gravity: with no input the bird falls (y increases).
  const y1 = await a.evaluate((i) => (window as unknown as W).__ENGINE__.pos(`fbird:${i}`).y, id);
  await a.waitForTimeout(500);
  const y2 = await a.evaluate((i) => (window as unknown as W).__ENGINE__.pos(`fbird:${i}`).y, id);
  expect(y2).toBeGreaterThan(y1 + 10);

  // Flap: repeated taps (down ~100ms so the host catches the rising edge) lift it
  // back above where it had fallen to.
  await a.locator('[data-testid="engine-canvas"]').click();
  for (let n = 0; n < 6; n++) {
    await a.keyboard.down("ArrowUp");
    await a.waitForTimeout(100);
    await a.keyboard.up("ArrowUp");
    await a.waitForTimeout(100);
  }
  const y3 = await a.evaluate((i) => (window as unknown as W).__ENGINE__.pos(`fbird:${i}`).y, id);
  expect(y3).toBeLessThan(y2);

  // Pipes: four exist, each with 3 gaps, scrolling left.
  await a.waitForFunction(
    () => (window as unknown as W).__ENGINE__.count("fpipe") >= 4,
    null,
    { timeout: 10_000 }
  );
  expect(await a.evaluate(() => (window as unknown as W).__ENGINE__.pipeGaps())).toBe(3);
  const px1 = await a.evaluate(() => (window as unknown as W).__ENGINE__.pos("fpipe:0").x);
  await a.waitForTimeout(500);
  const px2 = await a.evaluate(() => (window as unknown as W).__ENGINE__.pos("fpipe:0").x);
  expect(px2).toBeLessThan(px1);

  expect(errs).toEqual([]);
  await ctx.close();
});
