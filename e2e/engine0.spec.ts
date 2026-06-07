import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

// Phase 0 gate: the host's client-side tick advances an entity and commits it;
// SpacetimeDB syncs it; both the host and a second (viewer) client render it.
test("engine: host sim commits, syncs, and all clients see it move", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  const errA: string[] = [];
  a.on("pageerror", (e) => errA.push(String(e)));

  await a.goto("/engine-test?host=1");
  await a.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined",
    null,
    { timeout: 20_000 }
  );
  // A box appears: the host spawned it and the commit round-tripped through STDB.
  await a.waitForFunction(
    () => (window as unknown as W).__ENGINE__.boxCount() >= 1,
    null,
    { timeout: 15_000 }
  );

  // Wait for the host to actively drive the box (counter changes), then confirm
  // it keeps rising — robust to any stale leftover value from a previous run.
  const tInit = await a.evaluate(() => (window as unknown as W).__ENGINE__.firstBoxT());
  await a.waitForFunction((p) => (window as unknown as W).__ENGINE__.firstBoxT() !== p, tInit, { timeout: 8_000 });
  const tA = await a.evaluate(() => (window as unknown as W).__ENGINE__.firstBoxT());
  await a.waitForFunction((p) => (window as unknown as W).__ENGINE__.firstBoxT() > p + 5, tA, { timeout: 8_000 });

  // A second client (no ?host) renders the SAME synced entity — multiplayer sync.
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto("/engine-test");
  await b.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined",
    null,
    { timeout: 20_000 }
  );
  await b.waitForFunction(
    () => (window as unknown as W).__ENGINE__.boxCount() >= 1,
    null,
    { timeout: 15_000 }
  );
  // The viewer sees the host's monotonic counter advancing — live sync, no host role.
  await b.waitForFunction(
    () => (window as unknown as W).__ENGINE__.firstBoxT() > 0,
    null,
    { timeout: 15_000 }
  );
  const bt1 = await b.evaluate(() => (window as unknown as W).__ENGINE__.firstBoxT());
  await b.waitForFunction((p) => (window as unknown as W).__ENGINE__.firstBoxT() > p + 3, bt1, { timeout: 8_000 });

  expect(errA).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
