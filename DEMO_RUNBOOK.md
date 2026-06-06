# Starblox — Demo runbook (click-by-click)

What to **click**, what to **say**, and what to **expect** — to record the demo video.

---

## Pre-flight (5 min before recording)
1. **Deploy must be current.** The live Vercel site must have the latest build
   (immersive room, mobile controls, Flappy game-over, Tank maze + speed pads).
   If you only `git push` the frontend, you ALSO need the module republished to
   Maincloud (`spacetime publish starblox-prod --server maincloud -y`) — otherwise
   new client + old server = broken. Do both, then verify the site connects.
2. **Pre-warm Maincloud:** open the live URL ~30s before recording (free tier sleeps
   when idle, so the *first* connect can take a couple seconds; after that it's instant).
3. **Two side-by-side windows** on the same game URL = your reliable "live for everyone"
   shot (Window A = you, Window B = a friend). Optional wow: a **phone** to scan the QR.
4. Confirm both windows show the green **Connected** dot (no red banner).
5. Keep the **Safe commands** list (bottom) handy. Canned-AI mode = deterministic, so
   stick to those phrases.

---

## The script — Act by act

### Act 1 — Hook (~15s) · Home (`/`)
- **Click:** nothing — you're on the home page.
- **Say:** *"This is Starblox. Every game here was made — and is changed — just by talking to an AI, and it's all live multiplayer. Let me make one from scratch."*
- **Expect:** hero "Games, made and remade by talking," green **Connected**, cards for Tank Trouble + Flappy Arena.

### Act 2 — Make a game by describing it (~40s) · `/create`
- **Click:** the **"Create with AI"** tile (hero, right).
- **Type** in the box: `a multiplayer flappy bird, tall, with a few gaps, and birds that collide` → **Enter**.
- **Expect:** marble spins ("designing…"), then a **preview card** — *"Looks like… {name}"*, FLAPPY tag, rule chips (Tall field · gaps · Birds collide).
- **Say:** *"It understood it — tall field, multiple gaps, birds that knock each other. Looks right."*
- **Click:** **"Looks good — create."**
- **Expect:** dropped into the live room; yellow bird + green capped pipes flying.

### Act 3 — Instantly live & multiplayer (~30s) · Room
- **Say:** *"It's already a real multiplayer game — no build step."*
- **Reliable:** bring up **Window B** (same URL) side-by-side → **Expect** a 2nd bird in **both** windows, in sync.
- **Wow (optional):** **Click "Scan to join"** → QR + link → scan with phone → **Expect** the phone joins the same match, showing a **TAP TO FLAP** button.

### Act 4 — Develop it live, by talking (~45s) · Edit with AI
- **Click:** the **"Edit with AI"** button (bottom-right of the game). A chat panel slides in.
- **Type (one at a time, pause ~1s each):**
  - `make the gaps wider`
  - `lower the gravity`
- **Say:** *"I'm changing the rules in plain English — watch the other screen."*
- **Expect:** the little **terminal** flashes the real change (`~ pipe_gap: 1.8 … ✓ hot-reloaded · live`), and gameplay changes in **both** windows at once.
- **Beat:** fly into a pipe wall → **Expect** the **Game Over card** (SCORE / BEST / **Play again**). **Say:** *"Score, restart — and only the player who died sees it."* Click **Play again**.

### Act 5 — Showpiece: Tank maze + speed pads (~45s)
- **Click:** **"back to games"** → **Tank Trouble** card → lobby → **Play** (or **Create with AI** → `a tank game with bouncy shells`).
- **Say:** *"Same engine, a maze game — there are three mazes that rotate as you play."*
- **Expect:** a corridor maze + small tanks. Drive (arrows), fire (space).
- **Click "Edit with AI"** → type `add a speed blitz` (or click the **"add boost strips"** chip).
- **Expect:** **gold-chevron speed pads** appear at random spots.
- **Drive a tank over a pad.**
- **Say:** *"Drive over one → a speed boost for five seconds."*
- **Expect:** the tank gets a gold outline + visibly speeds up ~5s.
- **Optional:** click **⤢ fullscreen** → game goes edge-to-edge.

### Act 6 — Remix + close (~20s)
- **Click:** **"back to games"** → hover any game → **"Make it mine."**
- **Say:** *"Anyone can remix any game into their own copy — the original is untouched."*
- **Expect:** you land in a new room you own (a "(remix)" copy).
- **Close:** *"Games, made and remade just by talking — live for everyone. That's Starblox."*

---

## Safe commands (guaranteed in canned mode)
- **Flappy:** `make the gaps wider` · `lower the gravity` · `let the birds collide` · `make the field taller`
- **Tank:** `make shells bounce more` · `everyone moves 2× faster` · `rapid fire` · `add a speed blitz`
- Clicking the chat **suggestion chips** is the safest move (one click, always maps).
- **Avoid on camera:** a "manhunt" prompt — it applies rules but doesn't render visuals yet, so it looks like nothing happened. Off-script prompts may return *"I can't do that one yet."*

## Gotchas & fallbacks
- **Cold start:** pre-warm Maincloud or the first edit looks laggy.
- **Network hiccup:** the per-room **demo preset chips** (Speed blitz, Bouncy shells, Low gravity…) apply the same changes instantly with no AI round-trip — a perfect silent fallback.
- **Red "Disconnected" banner:** the env/db is wrong — fix before filming (shouldn't happen post-deploy).

## Recording tips
- Two side-by-side windows = safest "live for everyone" shot; phone-QR = bigger wow if you can film it.
- Keep each edit to one command + a ~1s pause so the change reads as *live*, not pre-baked.
- Use **fullscreen** for the tank finale.
