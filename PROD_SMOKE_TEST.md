# Starblox — Production smoke test (run on the LIVE site before the demo)

A click-by-click verification of **everything you'll do in the demo**, run against
the **production** app on your domain. Each step has a ✅ **checkpoint** — if one
fails, stop and fix before the next. Do this end-to-end at least once the day of
the demo.

> The demo is **network-light**: the AI dialogue, the "writing code" terminal, and
> the verification video are all deterministic/baked-in (no live LLM call). The one
> true network dependency is the **SpacetimeDB multiplayer sync** — so production
> only works if the **Maincloud module is current** and the **Vercel env points at
> Maincloud**. Part 0 verifies exactly that.

---

## Part 0 — Pre-flight (the part that makes prod actually work)

### 0.1 — Republish the module to Maincloud  ⚠️ REQUIRED
The new features (create flow + manhunt live-edit) need reducers/tables that only
exist in the **new** module: `commit_entities`, `set_engine_input`,
`set_engine_config`, and the `engine_input` / `engine_config` tables. If Maincloud
still has the old module, engine games will **fail on prod** even though the site
loads. You must publish from **your** SpacetimeDB account (it owns the prod DB):

```bash
spacetime login                                   # your Maincloud account
spacetime publish <your-prod-db> --server maincloud   # e.g. starblox-prod
```

✅ **Checkpoint** — the new reducers exist on prod:
```bash
spacetime logs <your-prod-db> --server maincloud | tail        # publishes cleanly
spacetime sql  <your-prod-db> --server maincloud "SELECT game_id, name, game_type FROM game"
```
(If you renamed/!forget the DB name, `spacetime list --server maincloud` lists it.)

> Publishing **hot-swaps** without disconnecting clients and **keeps existing
> data**. It does not wipe your games.

### 0.2 — Verify Vercel Production env vars
In **Vercel → your project → Settings → Environment Variables (Production)**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_STDB_URI` | `wss://maincloud.spacetimedb.com`  (note **wss://**) |
| `NEXT_PUBLIC_STDB_DB`  | your exact prod DB name (must match 0.1) |
| `ANTHROPIC_API_KEY` | *(optional — leave unset to keep the AI "canned"/deterministic for the demo)* |
| `NEXT_PUBLIC_TEST_MODE` | *(optional — `1` enables the fallback demo-preset chips; unset for a clean prod)* |

> **Linking your custom domain does NOT require any env change.** The domain only
> changes the *frontend URL*; the env vars above point at the *backend*. The room
> QR / share links use `window.location`, so they auto-adapt to whatever domain
> serves the page. If you changed any env var, **redeploy** so it takes effect.

✅ **Checkpoint** — env saved for **Production**, values match 0.1, and you
triggered a redeploy if anything changed.

### 0.3 — Confirm the live build + connection
- Open your domain (the production URL).
- ✅ **Checkpoint** — the page loads, and the header shows the green **Connected**
  dot (no red "Disconnected" banner). A red banner = wrong `STDB_URI`/`STDB_DB`.

### 0.4 — Warm + identities
- Open the site ~30s before recording (Maincloud free tier sleeps when idle; the
  first connect can lag, then it's instant).
- Have **two distinct identities** ready: **one normal window + one incognito
  window** (or two browsers / a phone). Two tabs in the *same* browser share one
  identity = one player. **Open the window you want as the hunter FIRST** (lowest
  identity = hunter).

---

## Part 1 — Home loads & connects (~10s)
- Go to your domain `/`.
- ✅ **Checkpoint:** green **Connected**; game cards render with the right genre
  thumbnails (Tank = maze, Flappy = sky/pipes); no console errors that break the page.

## Part 2 — DEMO 1: make a game by talking (~50s) · `/create`
1. Click **Create** → you're on `/create`.
2. Type **`a multiplayer tank arena with bouncing shells`** → Enter / **Start**.
   ✅ The AI replies with **one** clarifying question.
3. Answer **`yes, bounce them off the walls`** → send.
   ✅ A **terminal** flashes real `tank.ts` engine code line-by-line.
   ✅ A **verification video** plays. *(Note: the cached clip is the **Flappy**
   verification video — it plays for any game type. If showing a Flappy clip while
   "building a tank" bothers you on camera, either create a **Flappy** in DEMO 1,
   or ask me to record a tank clip / make it type-aware — see "Known polish" below.)*
   ✅ A **Publish & Play** button appears with the game name + rule chips.
4. Click **Publish & Play**.
   ✅ **Checkpoint:** the URL becomes `/game/<id>` and you're in a live room — a
   corridor **maze + a tank**, running. Drive = **arrows**, fire = **space**.

## Part 3 — Live multiplayer (~20s)
1. Copy the `/game/<id>` URL into your **second identity** (incognito / 2nd browser
   / phone via the **Scan to join** QR).
2. ✅ **Checkpoint:** **both** windows now show **two tanks**, moving in sync. Drive
   in one → it moves in the other.

## Part 4 — DEMO 2: change it live, by talking (~40s) · Edit with AI
> Keep **both windows visible**. The window you opened **first** is the hunter.
1. In the **first** window, click **Edit with AI** (bottom-right). A panel slides in.
2. Type **`manhunt`** → send. *(Or click the **manhunt** suggestion chip.)*
   ✅ The little terminal flashes `engine_config (live) · ~ manhunt: true · ✓ host
   picked it up next tick`.
   ✅ **Checkpoint (the money shot):** *instantly, mid-match, no reload* — the first
   window goes **dark with a flashlight cone** (it's the hunter; it only sees runners
   caught in the light). The second window **stays lit but can no longer fire**.
3. Drive the hunter's cone over the runner → the runner appears in the light → fire
   to tag them.
   ✅ **Checkpoint:** the runner respawns; the hunter's shot registered. No
   disconnect, no page reload happened on either side.

## Part 5 — Extra live edits (optional, ~20s)
In the same panel, one at a time (~1s pause each):
- **`lights on`** → ✅ back to free-for-all, full visibility, everyone shoots.
- **`everyone 2× faster`** → ✅ both tanks visibly speed up.
- **`shells bounce more`** → ✅ shells ricochet further off the walls.
- **`⤢ fullscreen`** (stage top-right) → ✅ edge-to-edge for the finale.

## Part 6 — Safety nets (good to verify once)
- ✅ Clicking the **suggestion chips** instead of typing also applies (one click).
- ✅ An off-script phrase (e.g. `make it rain`) returns a friendly "try one of
  these" and **does not** break the match.
- ✅ (If `NEXT_PUBLIC_TEST_MODE=1`) the room's **demo-preset chips** apply changes
  with no AI round-trip — your silent fallback if anything feels laggy.

---

## Pass / fail summary
Tick all before you record:
- [ ] 0.1 module republished to Maincloud (new reducers present)
- [ ] 0.2 Vercel Production env = `wss://maincloud.spacetimedb.com` + correct DB
- [ ] 0.3 live site shows green **Connected** on your domain
- [ ] 0.4 warmed + two distinct identities ready (hunter window opened first)
- [ ] Part 2 create → terminal → video → Publish → in the room
- [ ] Part 3 second identity joins → two tanks in sync
- [ ] Part 4 `manhunt` → hunter goes dark+flashlight, runner can't fire, live for both
- [ ] Part 5 at least one extra edit lands live

## Known polish (optional, not blockers)
- **Verification clip is always the Flappy one.** Creating a Tank in DEMO 1 still
  shows the Flappy test video. Fix options: create a Flappy in DEMO 1, or I can
  record a Tank clip and show the right one per game type.

## If prod breaks during pre-flight — fast rollback
- **Frontend:** in Vercel → Deployments → the previous good deploy → **Promote to
  Production** (instant revert to the last working site).
- **Backend:** re-publish the previous module commit to Maincloud (publishing is a
  hot-swap; you can roll forward/back freely). Existing game data is preserved.
- **Red banner / can't connect:** 99% of the time it's `NEXT_PUBLIC_STDB_URI`
  (must be `wss://maincloud.spacetimedb.com`) or a `NEXT_PUBLIC_STDB_DB` mismatch.
