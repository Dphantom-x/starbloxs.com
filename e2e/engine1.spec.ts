import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

// Phase 1 gate: a client's keyboard input flows through engine_input to the host,
// the host moves THAT client's avatar, and a second client sees it move (sync).
test("engine: per-player input moves your avatar; others see it", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  const errA: string[] = [];
  a.on("pageerror", (e) => errA.push(String(e)));

  await a.goto("/engine-test?game=controls&host=1");
  await a.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined" &&
          !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  const aId: string = await a.evaluate(() => (window as unknown as W).__ENGINE__.myId());

  // The host spawned my box (from my published input row).
  await a.waitForFunction(
    (id) => (window as unknown as W).__ENGINE__.pos(`pbox:${id}`) !== null,
    aId,
    { timeout: 15_000 }
  );
  const before = await a.evaluate(
    (id) => (window as unknown as W).__ENGINE__.pos(`pbox:${id}`),
    aId
  );

  // Hold Right ~1s → my input reaches the host → my box moves right.
  await a.locator('[data-testid="engine-canvas"]').click();
  await a.keyboard.down("ArrowRight");
  await a.waitForTimeout(1100);
  await a.keyboard.up("ArrowRight");
  const after = await a.evaluate(
    (id) => (window as unknown as W).__ENGINE__.pos(`pbox:${id}`),
    aId
  );
  expect(after.x).toBeGreaterThan(before.x + 20);

  // A second client joins → two boxes exist → it sees A's box at the moved x.
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto("/engine-test?game=controls");
  await b.waitForFunction(
    () => (window as unknown as W).__ENGINE__?.count?.("pbox") >= 2,
    null,
    { timeout: 15_000 }
  );
  const bSeesA = await b.evaluate(
    (id) => (window as unknown as W).__ENGINE__.pos(`pbox:${id}`),
    aId
  );
  expect(bSeesA).not.toBeNull();
  expect(bSeesA.x).toBeGreaterThan(before.x + 20);

  expect(errA).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
