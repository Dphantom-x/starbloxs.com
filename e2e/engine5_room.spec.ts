import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __APP__: any };

// Phase 5 gate: a real engine game (created like a published game) runs in the
// actual room, with an auto-elected host, and syncs to a second player who joins.
test("engine room: a created engine game runs and syncs to a 2nd player", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await a.goto("/");
  await a.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });

  // "Publish" an engine Flappy game (the create flow does this for real in Phase 6).
  await a.evaluate(() =>
    (window as unknown as W).__APP__.callReducer("createGame", { gameType: "eflappy", name: "E2E Engine Flappy" })
  );
  const gid: string = await a
    .waitForFunction(
      () => {
        const w = window as unknown as W;
        const me = w.__APP__.identity();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mine = w.__APP__.getGames().filter((g: any) => g.gameType === "eflappy" && g.owner === me);
        return mine.length ? mine[mine.length - 1].gameId : null;
      },
      null,
      { timeout: 12_000 }
    )
    .then((h) => h.jsonValue() as Promise<string>);

  // Enter the room → the engine mounts, elects this client as host, and runs.
  await a.goto(`/game/${gid}`);
  await a.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });
  await expect(a.getByTestId("game-room")).toBeVisible();
  await a.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as W).__APP__.getEntities().some((e: any) => e.kind === "fbird"),
    null,
    { timeout: 15_000 }
  );

  // A second player joins the same room → sees the synced world + gets a 2nd bird.
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(`/game/${gid}`);
  await b.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });
  await b.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as W).__APP__.getEntities().filter((e: any) => e.kind === "fbird").length >= 2,
    null,
    { timeout: 15_000 }
  );
  await a.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as W).__APP__.getEntities().filter((e: any) => e.kind === "fbird").length >= 2,
    null,
    { timeout: 15_000 }
  );

  await ctxA.close();
  await ctxB.close();
});
