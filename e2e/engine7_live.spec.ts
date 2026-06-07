import { test, expect, type Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __APP__: any };

// Phase 7 gate (DEMO 2): a published engine Tank is edited LIVE — the host reads
// api.config() every tick, so speaking "manhunt" is just a config write that
// lands on the next frame for EVERYONE, mid-match, with no reconnect. We assert:
//   • the live engine_config gets manhunt:true (via the real Edit-with-AI UI),
//   • the host assigns roles next tick — exactly one hunter, the rest runners,
//   • the SECOND player sees the same config + role split (synced), and
//   • nobody reconnected and the tanks were preserved (state intact).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roleCounts = (p: Page) =>
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

const amHunter = (p: Page) =>
  p.evaluate(() => {
    const w = window as unknown as W;
    const me = w.__APP__.identity();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mine = w.__APP__.getEntities().find((e: any) => {
      if (e.kind !== "etank") return false;
      try {
        return JSON.parse(e.data).pid === me;
      } catch {
        return false;
      }
    });
    if (!mine) return false;
    try {
      return JSON.parse(mine.data).role === "hunter";
    } catch {
      return false;
    }
  });

test("engine live-edit: 'manhunt' flips the running Tank to hunter/runner for everyone", async ({ browser }, testInfo) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  const errsA: string[] = [];
  a.on("pageerror", (e) => errsA.push(String(e)));
  await a.goto("/");
  await a.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });

  // "Publish" an engine Tank (what the create flow does for real in DEMO 1).
  await a.evaluate(() =>
    (window as unknown as W).__APP__.callReducer("createGame", { gameType: "etank", name: "E2E Manhunt" })
  );
  const gid: string = await a
    .waitForFunction(
      () => {
        const w = window as unknown as W;
        const me = w.__APP__.identity();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mine = w.__APP__.getGames().filter((g: any) => g.gameType === "etank" && g.owner === me);
        return mine.length ? mine[mine.length - 1].gameId : null;
      },
      null,
      { timeout: 12_000 }
    )
    .then((h) => h.jsonValue() as Promise<string>);

  // A enters the room → engine mounts, A is elected host, a tank spawns.
  await a.goto(`/game/${gid}`);
  await a.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });
  await expect(a.getByTestId("game-room")).toBeVisible();
  await a.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as unknown as W).__APP__.getEntities().some((e: any) => e.kind === "etank"),
    null,
    { timeout: 15_000 }
  );

  // A second player joins → now TWO tanks exist (both clients see them).
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  const errsB: string[] = [];
  b.on("pageerror", (e) => errsB.push(String(e)));
  await b.goto(`/game/${gid}`);
  await b.waitForFunction(() => (window as unknown as W).__APP__?.connected() === true, null, { timeout: 20_000 });
  for (const p of [a, b]) {
    await p.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as unknown as W).__APP__.getEntities().filter((e: any) => e.kind === "etank").length >= 2,
      null,
      { timeout: 15_000 }
    );
  }

  // Pre-edit: no manhunt, everyone is "normal" (no hunter/runner split).
  const pre = await roleCounts(a);
  expect(pre.total).toBe(2);
  expect(pre.hunters).toBe(0);

  // --- the live edit, through the REAL Edit-with-AI UI on player A ---
  await a.getByTestId("edit-open").click();
  await expect(a.getByTestId("edit-input")).toBeVisible();
  await a.getByTestId("edit-input").fill("manhunt");
  await a.getByTestId("edit-submit").click();

  // The terminal flashes the real engine_config write…
  await expect(a.getByTestId("ai-terminal")).toContainText("manhunt: true", { timeout: 8_000 });

  // …and the live config carries manhunt:true to BOTH players (synced).
  for (const p of [a, b]) {
    await p.waitForFunction(
      () => (window as unknown as W).__APP__.getEngineConfig()?.manhunt === true,
      null,
      { timeout: 10_000 }
    );
  }

  // The host applies it next tick: exactly one hunter, the rest runners — and
  // the SECOND player sees the same split (it's in the synced entity state).
  for (const p of [a, b]) {
    await p.waitForFunction(
      () => {
        const w = window as unknown as W;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tanks = w.__APP__.getEntities().filter((e: any) => e.kind === "etank");
        if (tanks.length < 2) return false;
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
        return hunters === 1 && runners === tanks.length - 1;
      },
      null,
      { timeout: 12_000 }
    );
  }
  const post = await roleCounts(a);
  expect(post.total).toBe(2);
  expect(post.hunters).toBe(1);
  expect(post.runners).toBe(1);

  // Exactly ONE of the two players is the hunter (the role split is per-identity).
  const [ha, hb] = [await amHunter(a), await amHunter(b)];
  expect(ha).not.toEqual(hb);

  // No reconnect, tanks preserved (the edit was live, not a restart).
  expect(await a.evaluate(() => (window as unknown as W).__APP__.connected())).toBe(true);
  expect(await b.evaluate(() => (window as unknown as W).__APP__.connected())).toBe(true);

  // Visual proof: the hunter sees the blacked-out map + flashlight cone; the
  // runner still sees the lit arena. (Whichever page is the hunter shows dark.)
  await a.screenshot({ path: testInfo.outputPath("manhunt-A.png") });
  await b.screenshot({ path: testInfo.outputPath("manhunt-B.png") });
  await testInfo.attach("manhunt-A", { path: testInfo.outputPath("manhunt-A.png"), contentType: "image/png" });
  await testInfo.attach("manhunt-B", { path: testInfo.outputPath("manhunt-B.png"), contentType: "image/png" });

  // clean up the test fixture so it doesn't accumulate in the local DB
  await a.evaluate((id) => (window as unknown as W).__APP__.callReducer("deleteGame", { gameId: BigInt(id) }), gid);
  expect(errsA).toEqual([]);
  expect(errsB).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
