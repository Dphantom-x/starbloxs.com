# Deploy guide (Phase 8)

The app runs fully locally today. This is the guided path to put it on the
internet and make it phone-joinable. **We'll do this together when you're ready
with accounts** — nothing here is automated yet.

## 1. Backend → SpacetimeDB Maincloud
> Throughout this guide, **`starblox-prod` is a stand-in** — pick your own
> **globally unique** name (Maincloud names are global) and use that exact
> string everywhere below. Do **not** type angle brackets anywhere.

1. `spacetime login` (GitHub auth — opens a browser).
2. Choose your database name, e.g. `starblox-prod` or `blox-yourhandle`.
3. Publish (swap in your name):
   ```
   spacetime publish starblox-prod --server maincloud
   ```
   - Updating later = the same command (hot-swaps, no client disconnect).
   - **Never** pass `--delete-data` on Maincloud (it wipes the live demo).
4. `init` auto-seeds Tank Trouble + Flappy Arena on first publish.
5. Sanity check: `spacetime sql starblox-prod --server maincloud "SELECT game_id, name FROM game"`.

## 2. Frontend → Vercel
1. Push the repo to GitHub, import into Vercel (or use the `vercel` CLI).
2. Set Environment Variables (Project → Settings → Environment Variables).
   **Type the actual values — no angle brackets, no quotes:**
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_STDB_URI` | `wss://maincloud.spacetimedb.com` |
   | `NEXT_PUBLIC_STDB_DB` | the exact name from step 1.2 (e.g. `starblox-prod`) |
   | `NEXT_PUBLIC_TEST_MODE` | `1` (keeps the on-screen demo buttons) |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (omit to stay canned) |
   | `ANTHROPIC_MODEL` | `claude-opus-4-8` (optional) |
3. **Redeploy** after changing env vars (Vercel only bakes `NEXT_PUBLIC_*` in at
   build time — editing the var without a redeploy changes nothing).
4. Every device connects directly to Maincloud — laptop on Wi-Fi + phone on
   cellular = the **same match**, no tunneling.

### Troubleshooting — stuck on "Connecting…" / "Disconnected"
The app now shows a red banner with the URL it tried. Common causes:
- **You pasted a placeholder.** If the banner or the WS URL contains `<...>` or
  `%3C...%3E`, `NEXT_PUBLIC_STDB_DB` still holds the literal `<unique-name>` —
  set it to your real db name and redeploy.
- **Module not published.** Run step 1.3; confirm with
  `spacetime list --server maincloud` (your db should be listed).
- **Edited env but didn't redeploy.** See step 3.
- **Wrong WS host/scheme.** Confirm `NEXT_PUBLIC_STDB_URI=wss://maincloud.spacetimedb.com`.

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
