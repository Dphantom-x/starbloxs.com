# Deploy guide (Phase 8)

The app runs fully locally today. This is the guided path to put it on the
internet and make it phone-joinable. **We'll do this together when you're ready
with accounts** — nothing here is automated yet.

## 1. Backend → SpacetimeDB Maincloud
1. `spacetime login` (GitHub auth — opens a browser).
2. Pick a **globally unique** database name (Maincloud names are global), e.g.
   `blox-<yourhandle>`.
3. Publish:
   ```
   spacetime publish <unique-name> --server maincloud
   ```
   - Updating later = the same command (hot-swaps, no client disconnect).
   - **Never** pass `--delete-data` on Maincloud (it wipes the live demo).
4. `init` auto-seeds Tank Trouble + Flappy Arena on first publish.
5. Sanity check: `spacetime sql <unique-name> --server maincloud "SELECT game_id, name FROM game"`.

## 2. Frontend → Vercel
1. Push the repo to GitHub, import into Vercel (or use the `vercel` CLI).
2. Set Environment Variables (Project → Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_STDB_URI` | `wss://maincloud.spacetimedb.com` |
   | `NEXT_PUBLIC_STDB_DB` | `<unique-name>` (same as 1.2) |
   | `NEXT_PUBLIC_TEST_MODE` | `1` (keeps the on-screen demo buttons) |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (omit to stay canned) |
   | `ANTHROPIC_MODEL` | `claude-opus-4-8` (optional) |
3. Deploy. Every device connects directly to Maincloud — laptop on Wi-Fi +
   phone on cellular = the **same match**, no tunneling.

> Verify at deploy time: confirm the SDK accepts `wss://maincloud.spacetimedb.com`
> as `withUri`. If Maincloud expects a different WS URL/path, update
> `NEXT_PUBLIC_STDB_URI` accordingly (the client reads it from env — no code change).

## 3. Cross-device / phone join
- Open the deployed URL, enter a room, click **📱 Scan to join**.
- Scan with a phone (any network) → it joins the SAME match.

## 4. Demo-day hardening (already built in)
- **On-screen demo buttons** (`DemoControls`, game-type aware) apply cached
  patches instantly — network-independent.
- **`AI_CANNED=1`** forces canned responses if the live model is slow/down.
- **Pre-warm Maincloud** (open the app) right before going on stage — the free
  tier scales to zero when idle (sub-second resume).
- Keep **two laptop browser windows** ready as the no-network fallback.
- The per-room **Reset** button restores defaults between run-throughs (never
  `--delete-data` on stage).
