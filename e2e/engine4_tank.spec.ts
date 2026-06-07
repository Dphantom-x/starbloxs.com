import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

// Phase 4 gate: the rebuilt Tank runs ON THE ENGINE — drives (with maze-wall
// collision), fires a moving shell, and a speed pad grants a timed boost.
test("engine tank: drives, fires a moving shell, and a pad boosts it", async ({ browser }, testInfo) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const errs: string[] = [];
  a.on("pageerror", (e) => errs.push(String(e)));

  await a.goto("/engine-test?game=tank&host=1");
  await a.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined" && !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  const id: string = await a.evaluate(() => (window as unknown as W).__ENGINE__.myId());
  await a.waitForFunction((i) => (window as unknown as W).__ENGINE__.tankState(i) !== null, id, { timeout: 15_000 });
  await a.locator('[data-testid="engine-canvas"]').click();

  // Drive Left: the tank moves AND crosses a full-height boost lane (the spawn y
  // is always inside the lane), so the boost is deterministic.
  const p0 = await a.evaluate((i) => (window as unknown as W).__ENGINE__.tankState(i), id);
  await a.keyboard.down("ArrowLeft");
  await a.waitForTimeout(1400);
  await a.keyboard.up("ArrowLeft");
  const p1 = await a.evaluate((i) => (window as unknown as W).__ENGINE__.tankState(i), id);
  expect(Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y)).toBeGreaterThan(15); // moved
  await a.waitForFunction(
    (i) => { const t = (window as unknown as W).__ENGINE__.tankState(i); return t && t.boosted; },
    id,
    { timeout: 8_000 }
  ); // crossed the pad → boosted

  // Fire: a shell spawns and travels.
  await a.keyboard.down("Space");
  await a.waitForTimeout(120);
  await a.keyboard.up("Space");
  await a.waitForFunction(() => (window as unknown as W).__ENGINE__.count("eshell") >= 1, null, { timeout: 8_000 });
  const s0 = await a.evaluate(() => (window as unknown as W).__ENGINE__.firstOf("eshell"));
  await a.waitForTimeout(150);
  const s1 = await a.evaluate(() => (window as unknown as W).__ENGINE__.firstOf("eshell"));
  expect(s0).not.toBeNull();
  if (s1) expect(Math.abs(s1.x - s0.x) + Math.abs(s1.y - s0.y)).toBeGreaterThan(3);

  // Capture the look for the visual proof.
  await a.screenshot({ path: testInfo.outputPath("tank-engine.png") });
  await testInfo.attach("tank-engine", { path: testInfo.outputPath("tank-engine.png"), contentType: "image/png" });

  expect(errs).toEqual([]);
  await ctx.close();
});
