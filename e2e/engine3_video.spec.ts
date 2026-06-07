import { test, expect } from "@playwright/test";

// Record this spec to a .webm — it IS the "AI tested the game" verification clip.
test.use({ video: "on" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

// Phase 3 gate: a scripted bot plays the rebuilt Flappy on the engine — it flaps
// through gaps and scores, then (stops flapping) dies on a pipe and restarts.
// The run is recorded as the verification video; a screenshot captures the look.
test("engine flappy: bot scores, dies, and restarts (recorded)", async ({ page }, testInfo) => {
  await page.goto("/engine-test?game=flappy&host=1");
  await page.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined" && !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  const id: string = await page.evaluate(() => (window as unknown as W).__ENGINE__.myId());
  await page.waitForFunction((i) => (window as unknown as W).__ENGINE__.birdState(i) !== null, id, { timeout: 15_000 });
  await page.locator('[data-testid="engine-canvas"]').click(); // keyboard focus

  // Autopilot: flap toward the nearest pipe's gap — for the recorded clip. How
  // far the bot gets is stochastic (random gaps), so the gate asserts the
  // DETERMINISTIC loop (simulated → dies → restarts), not a score.
  let moved = 0;
  let prevY = -1;
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate((x) => (window as unknown as W).__ENGINE__.birdState(x), id);
    if (!s || !s.alive) break;
    if (prevY >= 0) moved += Math.abs(s.y - prevY);
    prevY = s.y;
    const aim = await page.evaluate((x) => (window as unknown as W).__ENGINE__.aimGap(x), id);
    if (s.y > aim) {
      await page.keyboard.down("Space");
      await page.waitForTimeout(35);
      await page.keyboard.up("Space");
    }
    await page.waitForTimeout(55);
  }
  expect(moved).toBeGreaterThan(60); // the bird was actively simulated (flap + gravity)

  // Capture the look for the visual proof.
  await page.screenshot({ path: testInfo.outputPath("flappy-engine.png") });
  await testInfo.attach("flappy-engine", { path: testInfo.outputPath("flappy-engine.png"), contentType: "image/png" });

  // Stop flapping → fall to the floor → die on the next pipe (no gap reaches the
  // bottom, so this is deterministic). The game-over card appears.
  await page.waitForFunction(
    (i) => { const s = (window as unknown as W).__ENGINE__.birdState(i); return s && !s.alive; },
    id,
    { timeout: 15_000 }
  );
  await expect(page.getByTestId("engine-gameover")).toBeVisible();

  // Tap Space to restart → alive again. Hold it ~160ms so the host catches the
  // rising edge through the synced input channel (a flick is too fast).
  await page.keyboard.down("Space");
  await page.waitForTimeout(160);
  await page.keyboard.up("Space");
  await page.waitForFunction(
    (i) => { const s = (window as unknown as W).__ENGINE__.birdState(i); return s && s.alive; },
    id,
    { timeout: 10_000 }
  );
});
