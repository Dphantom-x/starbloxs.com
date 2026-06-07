import { test, expect } from "@playwright/test";

// Records the tank verification clip — the engine Tank equivalent of
// engine3_video's Flappy clip. A scripted driver moves the tank around, fires
// shells, and crosses a speed pad; the run is captured to a .webm that the create
// flow plays as "the AI tested it" for tank games. Copy the produced video to
// public/tank-verification.webm.
test.use({ video: "on" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

test("engine tank: scripted drive + fire (recorded)", async ({ page }, testInfo) => {
  await page.goto("/engine-test?game=tank&host=1");
  await page.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined" && !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  const id: string = await page.evaluate(() => (window as unknown as W).__ENGINE__.myId());
  await page.waitForFunction((i) => (window as unknown as W).__ENGINE__.tankState(i) !== null, id, { timeout: 15_000 });
  await page.locator('[data-testid="engine-canvas"]').click(); // keyboard focus

  const p0 = await page.evaluate((i) => (window as unknown as W).__ENGINE__.tankState(i), id);

  // A little patrol that reads as "playing": drive each way, firing as we go.
  const leg = async (key: string, ms: number) => {
    await page.keyboard.down(key);
    // fire a couple of shells mid-leg
    await page.waitForTimeout(ms / 2);
    await page.keyboard.down("Space");
    await page.waitForTimeout(90);
    await page.keyboard.up("Space");
    await page.waitForTimeout(ms / 2);
    await page.keyboard.up(key);
    await page.waitForTimeout(120);
  };

  await leg("ArrowLeft", 900); // crosses the full-height boost lane at spawn → boost
  await leg("ArrowDown", 700);
  await leg("ArrowRight", 900);
  await leg("ArrowUp", 700);
  await leg("ArrowLeft", 700);

  const p1 = await page.evaluate((i) => (window as unknown as W).__ENGINE__.tankState(i), id);
  expect(Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y)).toBeGreaterThan(15); // it really drove

  // A frame for the visual proof.
  await page.screenshot({ path: testInfo.outputPath("tank-engine.png") });
  await testInfo.attach("tank-engine", { path: testInfo.outputPath("tank-engine.png"), contentType: "image/png" });
});
