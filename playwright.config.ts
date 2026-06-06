import { defineConfig, devices } from "@playwright/test";

// Next runs on :3001 (STDB local server owns :3000). The local SpacetimeDB
// server + published `blox` module must already be running before tests.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // serial: all specs share the same local game/rules
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
