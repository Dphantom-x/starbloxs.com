import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __APP__: any };

// Phase 8 capstone — the full dress rehearsal in ONE continuous journey:
//   DEMO 1: make a Tank from scratch by talking → build → test → Publish & Play,
//   DEMO 2: a 2nd player joins → speak "manhunt" → it flips the live match for
//           everyone (hunter/runner split), mid-game, no reconnect.
// This is the demo the runbook walks through; if this is green, the demo is real.

async function waitConnected(p: Page) {
  await p.waitForFunction(() => typeof (window as unknown as W).__APP__ !== "undefined", null, { timeout: 15_000 });
  await p.waitForFunction(() => (window as unknown as W).__APP__.connected() === true, null, { timeout: 15_000 });
}

const roleSplit = (p: Page) =>
  p.evaluate(() => {
    const w = window as unknown as W;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tanks = w.__APP__.getEntities().filter((e: any) => e.kind === "etank");
    let hunters = 0;
    let runners = 0;
    for (const t of tanks) {
      try {
        const r = JSON.parse(t.data).role;
        if (r === "hunter") hunters++;
        else if (r === "runner") runners++;
      } catch {
        /* ignore */
      }
    }
    return { total: tanks.length, hunters, runners };
  });

test("DEMO 1+2: talk a Tank into existence, publish, then flip it to manhunt live for everyone", async ({
  browser,
}, testInfo) => {
  // ---------- DEMO 1: create a Tank by talking ----------
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  const errsA: string[] = [];
  a.on("pageerror", (e) => errsA.push(String(e)));
  await a.goto("/create");
  await waitConnected(a);

  await a.fill('[data-testid="create-input"]', "a multiplayer tank arena with bouncing shells");
  await a.click('[data-testid="create-submit"]');

  // One clarifying question → answer it (the canned agent then confirms a Tank).
  await a.waitForSelector('[data-testid="clarify-input"]', { timeout: 15_000 });
  await a.fill('[data-testid="clarify-input"]', "yes, bounce them off the walls");
  await a.click('[data-testid="clarify-submit"]');

  // Build terminal → verification video → Publish & Play.
  await expect(a.getByTestId("test-video")).toBeVisible({ timeout: 20_000 });
  await a.waitForSelector('[data-testid="create-confirm"]', { timeout: 25_000 });
  await a.click('[data-testid="create-confirm"]');

  // Land in the live engine room with a real tank on the pseudo-engine.
  await a.waitForURL(/\/game\/\d+$/, { timeout: 15_000 });
  const gid = a.url().match(/\/game\/(\d+)/)?.[1] as string;
  expect(gid).toBeTruthy();
  await expect(a.getByTestId("game-room")).toBeVisible();
  await a.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as W).__APP__.getEntities().some((e: any) => e.kind === "etank"),
    null,
    { timeout: 15_000 }
  );

  // ---------- DEMO 2: a 2nd player joins, then we go manhunt live ----------
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  const errsB: string[] = [];
  b.on("pageerror", (e) => errsB.push(String(e)));
  await b.goto(`/game/${gid}`);
  await waitConnected(b);
  for (const p of [a, b]) {
    await p.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as unknown as W).__APP__.getEntities().filter((e: any) => e.kind === "etank").length >= 2,
      null,
      { timeout: 15_000 }
    );
  }

  // Speak the edit through the real Edit-with-AI UI.
  await a.getByTestId("edit-open").click();
  await expect(a.getByTestId("edit-input")).toBeVisible();
  await a.getByTestId("edit-input").fill("manhunt");
  await a.getByTestId("edit-submit").click();

  // It lands live for BOTH players: manhunt config + a 1-hunter/rest-runners split.
  for (const p of [a, b]) {
    await p.waitForFunction(
      () => {
        const w = window as unknown as W;
        if (w.__APP__.getEngineConfig()?.manhunt !== true) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tanks = w.__APP__.getEntities().filter((e: any) => e.kind === "etank");
        if (tanks.length < 2) return false;
        let hunters = 0;
        for (const t of tanks) {
          try {
            if (JSON.parse(t.data).role === "hunter") hunters++;
          } catch {
            /* ignore */
          }
        }
        return hunters === 1;
      },
      null,
      { timeout: 12_000 }
    );
  }
  const split = await roleSplit(a);
  expect(split).toEqual({ total: 2, hunters: 1, runners: 1 });

  // Nobody reconnected — the whole journey was one continuous live session.
  expect(await a.evaluate(() => (window as unknown as W).__APP__.connected())).toBe(true);
  expect(await b.evaluate(() => (window as unknown as W).__APP__.connected())).toBe(true);

  // Capture the finale: one screen is the hunter's blacked-out flashlight POV.
  await a.screenshot({ path: testInfo.outputPath("demo-hunter-or-runner-A.png") });
  await b.screenshot({ path: testInfo.outputPath("demo-hunter-or-runner-B.png") });
  await testInfo.attach("demo-A", { path: testInfo.outputPath("demo-hunter-or-runner-A.png"), contentType: "image/png" });
  await testInfo.attach("demo-B", { path: testInfo.outputPath("demo-hunter-or-runner-B.png"), contentType: "image/png" });

  // Cleanup (owner-only delete).
  await a.evaluate((id) => (window as unknown as W).__APP__.callReducer("deleteGame", { gameId: BigInt(id) }), gid);

  expect(errsA).toEqual([]);
  expect(errsB).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
