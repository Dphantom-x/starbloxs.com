import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

test("connects to SpacetimeDB and exposes an empty entity cache", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto("/");

  // The debug surface mounts only in test mode.
  await page.waitForFunction(
    () => typeof (window as unknown as AppWindow).__APP__ !== "undefined",
    null,
    { timeout: 15_000 }
  );

  // Connection establishes over the WebSocket.
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__APP__.connected() === true,
    null,
    { timeout: 15_000 }
  );

  // Identity is a non-empty hex string (anonymous identity issued by the server).
  const identity = await page.evaluate(() =>
    (window as unknown as AppWindow).__APP__.identity()
  );
  expect(identity).toBeTruthy();
  expect(typeof identity).toBe("string");

  // Entity cache is present and empty (no games/entities created yet).
  const entities = await page.evaluate(() =>
    (window as unknown as AppWindow).__APP__.getEntities()
  );
  expect(Array.isArray(entities)).toBe(true);
  expect(entities.length).toBe(0);

  // No uncaught errors during connect + subscribe (would catch e.g. a bad
  // table accessor that aborts the subscription).
  expect(pageErrors).toEqual([]);
});
