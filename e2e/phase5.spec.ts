import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppWindow = Window & { __APP__: any };

const GID = "1"; // seeded Tank game

async function joinRoom(page: Page, name: string) {
  await page.goto(`/game/${GID}`);
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
  await page.evaluate(
    (gid) => (window as unknown as AppWindow).__APP__.setCurrentGameId(gid),
    GID
  );
  await page.evaluate(
    (args) => {
      const [gid, n] = args as [string, string];
      return (window as unknown as AppWindow).__APP__.callReducer("joinGame", {
        gameId: BigInt(gid),
        name: n,
      });
    },
    [GID, name]
  );
}

test("AI edit (canned /api/edit) applies and hot-reloads to both clients", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await joinRoom(a, "A");
  await joinRoom(b, "B");

  // Clean baseline.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );
  await a.waitForFunction(
    () =>
      Math.abs(
        ((window as unknown as AppWindow).__APP__.getRules()?.playerSpeed ??
          -1) - 1
      ) < 0.01,
    null,
    { timeout: 10_000 }
  );

  // Open the on-demand chat drawer, then type a plain-English edit and submit.
  await a.click('[data-testid="edit-open"]');
  await a.fill(
    '[data-testid="edit-input"]',
    "make everyone twice as fast and shells bounce 5 times"
  );
  await a.click('[data-testid="edit-submit"]');
  await expect(a.getByTestId("edit-status")).toContainText("done", {
    timeout: 10_000,
  });

  // Both clients see the new rules live.
  const ok = () => {
    const r = (window as unknown as AppWindow).__APP__.getRules();
    return (
      Math.abs((r?.playerSpeed ?? -1) - 2) < 0.01 &&
      r?.projectileBounces === 5
    );
  };
  await a.waitForFunction(ok, null, { timeout: 10_000 });
  await b.waitForFunction(ok, null, { timeout: 10_000 });

  // An unsupported request fails gracefully (no crash, friendly message).
  await a.fill('[data-testid="edit-input"]', "order me a pizza");
  await a.click('[data-testid="edit-submit"]');
  await expect(a.getByTestId("edit-status")).toContainText("can't", {
    timeout: 10_000,
  });

  // Restore defaults for manual smoke testing.
  await a.evaluate(
    (gid) =>
      (window as unknown as AppWindow).__APP__.callReducer("resetGame", {
        gameId: BigInt(gid),
      }),
    GID
  );

  await ctxA.close();
  await ctxB.close();
});
