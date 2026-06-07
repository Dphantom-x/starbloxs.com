import { test, expect, type Page } from "@playwright/test";

// Each test PROVES an AI-generated game (a CODE STRING in src/games/generated.ts)
// is compiled through the real loader (engine/loader.compileGameModule) and
// actually plays — then records the gameplay. Videos are copied to public/gallery/.
test.use({ video: "on" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Window & { __ENGINE__: any };

async function boot(page: Page, id: string) {
  await page.goto(`/engine-test?game=gen&id=${id}&host=1`);
  await page.waitForFunction(
    () => typeof (window as unknown as W).__ENGINE__ !== "undefined" && !!(window as unknown as W).__ENGINE__.myId(),
    null,
    { timeout: 20_000 }
  );
  await page.locator('[data-testid="engine-canvas"]').click();
}
const count = (page: Page, kind: string) => page.evaluate((k) => (window as unknown as W).__ENGINE__.count(k), kind);
const firstOf = (page: Page, kind: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((k) => (window as unknown as W).__ENGINE__.firstOf(k), kind);
const moved = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) =>
  a && b ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : 0;
async function drive(page: Page, keys: string[], ms = 340) {
  for (const k of keys) {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    await page.keyboard.up(k);
    await page.waitForTimeout(110);
  }
}
function watch(page: Page) {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

test("generated 'dodge' compiles from a string and plays", async ({ page }, testInfo) => {
  const errs = watch(page);
  await boot(page, "dodge");
  await page.waitForFunction(() => (window as unknown as W).__ENGINE__.count("ddp") >= 1, null, { timeout: 15_000 });
  const p0 = await firstOf(page, "ddp");
  await drive(page, ["ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowRight"]);
  expect(moved(p0, await firstOf(page, "ddp"))).toBeGreaterThan(15);
  await page.waitForFunction(() => (window as unknown as W).__ENGINE__.count("ddr") >= 1, null, { timeout: 8_000 });
  await page.screenshot({ path: testInfo.outputPath("dodge.png") });
  expect(errs).toEqual([]);
});

test("generated 'snake' compiles from a string and plays", async ({ page }, testInfo) => {
  const errs = watch(page);
  await boot(page, "snake");
  await page.waitForFunction(
    () => (window as unknown as W).__ENGINE__.count("snk") >= 1 && (window as unknown as W).__ENGINE__.count("food") >= 1,
    null,
    { timeout: 15_000 }
  );
  const h0 = await firstOf(page, "snk");
  await drive(page, ["ArrowDown", "ArrowRight", "ArrowDown"], 450);
  await page.waitForTimeout(400);
  expect(moved(h0, await firstOf(page, "snk"))).toBeGreaterThan(10); // the snake advanced on the grid
  await page.screenshot({ path: testInfo.outputPath("snake.png") });
  expect(errs).toEqual([]);
});

test("generated 'breakout' compiles from a string and plays", async ({ page }, testInfo) => {
  const errs = watch(page);
  await boot(page, "breakout");
  await page.waitForFunction(
    () => (window as unknown as W).__ENGINE__.count("bpad") >= 1 && (window as unknown as W).__ENGINE__.count("bbrick") >= 40,
    null,
    { timeout: 15_000 }
  );
  const pad0 = await firstOf(page, "bpad");
  await drive(page, ["ArrowRight", "ArrowRight"]); // slide one way so net displacement is clear
  expect(moved(pad0, await firstOf(page, "bpad"))).toBeGreaterThan(15); // paddle moves
  await drive(page, ["Space"], 200); // serve the ball
  await page.waitForTimeout(600);
  const ball = await firstOf(page, "bball");
  expect(ball && ball.y).toBeLessThan(520); // the served ball flew up off the paddle
  await page.screenshot({ path: testInfo.outputPath("breakout.png") });
  expect(errs).toEqual([]);
});

test("generated 'asteroids' compiles from a string and plays", async ({ page }, testInfo) => {
  const errs = watch(page);
  await boot(page, "asteroids");
  await page.waitForFunction(
    () => (window as unknown as W).__ENGINE__.count("aship") >= 1 && (window as unknown as W).__ENGINE__.count("arock") >= 4,
    null,
    { timeout: 15_000 }
  );
  const s0 = await firstOf(page, "aship");
  await page.keyboard.down("ArrowUp"); // thrust
  await page.waitForTimeout(550);
  await page.keyboard.up("ArrowUp");
  expect(moved(s0, await firstOf(page, "aship"))).toBeGreaterThan(8); // the ship accelerated + moved
  await drive(page, ["ArrowLeft"], 250);
  await page.keyboard.down("Space"); // shoot
  await page.waitForTimeout(140);
  await page.keyboard.up("Space");
  await page.waitForFunction(() => (window as unknown as W).__ENGINE__.count("abul") >= 1, null, { timeout: 5_000 });
  await page.screenshot({ path: testInfo.outputPath("asteroids.png") });
  expect(errs).toEqual([]);
});

test("generated 'evilgenie' compiles from a string and plays", async ({ page }, testInfo) => {
  const errs = watch(page);
  await boot(page, "evilgenie");
  // wisher + wish orbs existing proves the module compiled + ran (and draw.text did not throw).
  await page.waitForFunction(
    () => (window as unknown as W).__ENGINE__.count("egw") >= 1 && (window as unknown as W).__ENGINE__.count("ego") >= 3,
    null,
    { timeout: 15_000 }
  );
  const p0 = await firstOf(page, "egw");
  // sweep through the wish field so the genie grants (and twists) a few wishes for the clip
  await drive(page, ["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowRight", "ArrowLeft", "ArrowDown"], 320);
  expect(moved(p0, await firstOf(page, "egw"))).toBeGreaterThan(15);
  await page.screenshot({ path: testInfo.outputPath("evilgenie.png") });
  expect(errs).toEqual([]);
});
