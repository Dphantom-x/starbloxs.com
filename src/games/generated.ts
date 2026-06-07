// AI-generated games — the gallery. Each `code` below is a plain-JS game module
// (a factory string) authored by Claude against the engine SDK (see
// src/lib/gamegen.ts SDK_CONTRACT) — the SAME format and the SAME generative act
// the live /api/create pipeline performs, done here at dev-time by the model.
//
// These are NOT hand-imported modules: the harness + loader COMPILE these strings
// at runtime via engine/loader.compileGameModule and the engine runs them, so the
// "string -> compile -> run" pipeline is genuinely exercised. Each is multiplayer
// (one entity per player from api.players()) and uses its own entity `kind`s so
// the legacy server tick ignores it. Recorded gameplay lives in public/gallery/.

export type GeneratedEntry = {
  id: string;
  gameId: string; // harness game_id for /engine-test?game=gen&id=...
  name: string;
  prompt: string; // the sentence this was generated from
  summary: string[];
  kinds: string[]; // entity kinds (for tests + culling)
  code: string; // runnable factory string (compiled by the loader)
};

// ---- dodge: avoid the falling blocks; fire to respawn ----
const DODGE = `(function () {
  var W = 800, H = 600, PR = 14, RR = 13, SPEED = 280;
  return {
    id: "dodge",
    _spawn: 0,
    _seq: 0,
    tick: function (api) {
      var dt = api.dt;
      var locals = api.local();
      var byPid = {};
      var rocks = [];
      for (var i = 0; i < locals.length; i++) {
        var e = locals[i];
        if (e.kind === "ddp") byPid[e.data.pid] = e;
        else if (e.kind === "ddr") rocks.push(e);
      }
      var inputs = api.players();
      var out = [];
      for (var p = 0; p < inputs.length; p++) {
        var pl = inputs[p];
        var ent = byPid[pl.id];
        if (!ent) ent = { key: "ddp:" + pl.id, kind: "ddp", x: W / 2, y: H - 70, data: { pid: pl.id, alive: true, score: 0 } };
        var inp = pl.input;
        if (ent.data.alive) {
          var dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
          var dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
          ent.x = Math.max(PR, Math.min(W - PR, ent.x + dx * SPEED * dt));
          ent.y = Math.max(PR, Math.min(H - PR, ent.y + dy * SPEED * dt));
          ent.data.score = Math.round(((ent.data.score || 0) + dt) * 10) / 10;
        } else if (inp.fire) {
          ent.data.alive = true; ent.x = W / 2; ent.y = H - 70; ent.data.score = 0;
        }
        out.push(ent);
      }
      this._spawn += dt;
      if (this._spawn >= 0.4) {
        this._spawn = 0; this._seq += 1;
        var rx = 24 + (((this._seq * 137) % 1000) / 1000) * (W - 48);
        rocks.push({ key: "ddr:" + this._seq, kind: "ddr", x: rx, y: -24, data: { spd: 190 + (this._seq * 47) % 170 } });
      }
      var kept = [];
      for (var r = 0; r < rocks.length; r++) {
        var rk = rocks[r];
        rk.y += (rk.data.spd || 220) * dt;
        if (rk.y > H + 30) continue;
        for (var k in byPid) {
          var pe = byPid[k];
          if (pe.data.alive && Math.abs(pe.x - rk.x) < PR + RR && Math.abs(pe.y - rk.y) < PR + RR) pe.data.alive = false;
        }
        kept.push(rk);
      }
      api.setLocal(out.concat(kept));
    },
    render: function (api) {
      var me = api.me();
      api.draw.gradientRect(0, 0, 800, 600, 0x0e1430, 0x1a2350);
      for (var x = 40; x < 800; x += 40) api.draw.line(x, 0, x, 600, 0x223366, 1, 0.18);
      var ents = api.entities();
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i]; var d; try { d = JSON.parse(e.data); } catch (z) { d = {}; }
        if (e.kind === "ddr") {
          api.draw.roundedRect(e.x - 13, e.y - 13, 26, 26, 6, 0xff5a4d);
          api.draw.roundedRect(e.x - 13, e.y - 13, 26, 7, 4, 0xffb0a6, 0.8);
        } else if (e.kind === "ddp") {
          var mine = !!me && d.pid === me;
          var col = d.alive === false ? 0x556070 : (mine ? 0x38e08a : 0xf5c518);
          api.draw.circle(e.x, e.y, 14, col);
          api.draw.strokeCircle(e.x, e.y, 14, 0x0b1020, 3);
          api.draw.circle(e.x - 4, e.y - 4, 4, 0xffffff, 0.6);
        }
      }
    }
  };
})`;

// ---- snake: grid classic; eat food to grow, don't hit a wall or yourself ----
const SNAKE = `(function () {
  var CELL = 25, COLS = 32, ROWS = 24, STEP = 0.12;
  function px(c) { return c * CELL + CELL / 2; }
  return {
    id: "snake",
    _acc: 0,
    _seq: 0,
    tick: function (api) {
      var locals = api.local();
      var snakes = {}, food = null;
      for (var i = 0; i < locals.length; i++) { var e = locals[i]; if (e.kind === "snk") snakes[e.data.pid] = e; else if (e.kind === "food") food = e; }
      var inputs = api.players();
      var order = [];
      for (var p = 0; p < inputs.length; p++) {
        var pl = inputs[p]; var s = snakes[pl.id];
        if (!s) { var sx = 4 + p * 5, sy = 6 + p * 3; s = { key: "snk:" + pl.id, kind: "snk", x: px(sx), y: px(sy), data: { pid: pl.id, dir: [1, 0], segs: [[sx, sy], [sx - 1, sy], [sx - 2, sy]], grow: 0, score: 0 } }; }
        var inp = pl.input, d = s.data.dir, nd = d;
        if (inp.left && d[0] !== 1) nd = [-1, 0]; else if (inp.right && d[0] !== -1) nd = [1, 0]; else if (inp.up && d[1] !== 1) nd = [0, -1]; else if (inp.down && d[1] !== -1) nd = [0, 1];
        s.data.dir = nd; order.push(s);
      }
      if (!food) { this._seq += 1; var fx = 2 + (this._seq * 73) % (COLS - 4), fy = 2 + (this._seq * 131) % (ROWS - 4); food = { key: "food", kind: "food", x: px(fx), y: px(fy), data: { cx: fx, cy: fy } }; }
      this._acc += api.dt;
      if (this._acc >= STEP) {
        this._acc -= STEP;
        for (var k = 0; k < order.length; k++) {
          var sn = order[k], head = sn.data.segs[0], nh = [head[0] + sn.data.dir[0], head[1] + sn.data.dir[1]], idx = k;
          var dead = nh[0] < 0 || nh[0] >= COLS || nh[1] < 0 || nh[1] >= ROWS;
          if (!dead) for (var z = 0; z < sn.data.segs.length; z++) if (sn.data.segs[z][0] === nh[0] && sn.data.segs[z][1] === nh[1]) { dead = true; break; }
          if (dead) { var rx = 4 + idx * 5, ry = 6 + idx * 3; sn.data.segs = [[rx, ry], [rx - 1, ry], [rx - 2, ry]]; sn.data.dir = [1, 0]; sn.data.grow = 0; sn.data.score = 0; sn.x = px(rx); sn.y = px(ry); continue; }
          sn.data.segs.unshift(nh);
          if (food && nh[0] === food.data.cx && nh[1] === food.data.cy) { sn.data.grow += 3; sn.data.score = (sn.data.score || 0) + 1; food = null; }
          if (sn.data.grow > 0) sn.data.grow -= 1; else sn.data.segs.pop();
          sn.x = px(nh[0]); sn.y = px(nh[1]);
          if (!food) { this._seq += 1; var nfx = 2 + (this._seq * 73) % (COLS - 4), nfy = 2 + (this._seq * 131) % (ROWS - 4); food = { key: "food", kind: "food", x: px(nfx), y: px(nfy), data: { cx: nfx, cy: nfy } }; }
        }
      }
      var out = order.slice(); if (food) out.push(food); api.setLocal(out);
    },
    render: function (api) {
      var me = api.me(); api.draw.rect(0, 0, 800, 600, 0x0c1118);
      for (var gx = 0; gx <= 800; gx += 25) api.draw.line(gx, 0, gx, 600, 0x1b2433, 1, 0.5);
      for (var gy = 0; gy <= 600; gy += 25) api.draw.line(0, gy, 800, gy, 0x1b2433, 1, 0.5);
      var ents = api.entities();
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i], d; try { d = JSON.parse(e.data); } catch (z) { d = {}; }
        if (e.kind === "food") { api.draw.circle(e.x, e.y, 8, 0xff5a7a); api.draw.circle(e.x - 2, e.y - 2, 3, 0xffd0dc, 0.8); }
        else if (e.kind === "snk") {
          var mine = !!me && d.pid === me, body = mine ? 0x38e08a : 0xf5a623, headc = mine ? 0x7df0b6 : 0xffcf6b, segs = d.segs || [];
          for (var s = segs.length - 1; s >= 0; s--) { var c = segs[s]; api.draw.roundedRect(c[0] * 25 + 2, c[1] * 25 + 2, 21, 21, 5, s === 0 ? headc : body); }
        }
      }
    }
  };
})`;

// ---- breakout: a paddle + ball; clear the bricks (fire to serve) ----
const BREAKOUT = `(function () {
  var W = 800, H = 600, PADW = 92, PADH = 14, PADY = 560, BR = 8, BSPD = 330;
  return {
    id: "breakout",
    _init: false,
    tick: function (api) {
      var dt = api.dt, locals = api.local();
      var pads = {}, balls = {}, bricks = [];
      for (var i = 0; i < locals.length; i++) { var e = locals[i]; if (e.kind === "bpad") pads[e.data.pid] = e; else if (e.kind === "bball") balls[e.data.pid] = e; else if (e.kind === "bbrick") bricks.push(e); }
      if (!this._init) {
        this._init = true; var cols = 10, rows = 5, bw = 70, bh = 24, gap = 6, x0 = (W - (cols * (bw + gap) - gap)) / 2, y0 = 70;
        for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) bricks.push({ key: "bbrick:" + c + "_" + r, kind: "bbrick", x: x0 + c * (bw + gap) + bw / 2, y: y0 + r * (bh + gap) + bh / 2, data: { w: bw, h: bh, hue: r } });
      }
      var inputs = api.players(), out = [];
      for (var p = 0; p < inputs.length; p++) {
        var pl = inputs[p], inp = pl.input;
        var pad = pads[pl.id]; if (!pad) pad = { key: "bpad:" + pl.id, kind: "bpad", x: W / 2, y: PADY, data: { pid: pl.id, score: 0 } };
        pad.x = Math.max(PADW / 2, Math.min(W - PADW / 2, pad.x + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 480 * dt));
        out.push(pad);
        var ball = balls[pl.id]; if (!ball) ball = { key: "bball:" + pl.id, kind: "bball", x: pad.x, y: PADY - 24, vx: 0, vy: 0, data: { pid: pl.id, stuck: true } };
        if (ball.data.stuck) { ball.x = pad.x; ball.y = PADY - 24; if (inp.fire) { ball.data.stuck = false; ball.vx = BSPD * 0.45; ball.vy = -BSPD; } out.push(ball); continue; }
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); } if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); }
        if (ball.vy > 0 && ball.y > PADY - PADH && ball.y < PADY + PADH && Math.abs(ball.x - pad.x) < PADW / 2 + BR) { ball.vy = -Math.abs(ball.vy); ball.vx = BSPD * 0.6 * ((ball.x - pad.x) / (PADW / 2)); }
        for (var b = 0; b < bricks.length; b++) { var bk = bricks[b]; if (bk.data.dead) continue; if (Math.abs(ball.x - bk.x) < bk.data.w / 2 + BR && Math.abs(ball.y - bk.y) < bk.data.h / 2 + BR) { bk.data.dead = true; ball.vy = -ball.vy; pad.data.score = (pad.data.score || 0) + 1; break; } }
        if (ball.y > H + 20) { ball.data.stuck = true; ball.vx = 0; ball.vy = 0; }
        out.push(ball);
      }
      var kept = []; for (var b2 = 0; b2 < bricks.length; b2++) if (!bricks[b2].data.dead) kept.push(bricks[b2]);
      if (kept.length === 0) this._init = false;
      api.setLocal(out.concat(kept));
    },
    render: function (api) {
      var me = api.me(); api.draw.gradientRect(0, 0, 800, 600, 0x10131c, 0x1c2233);
      var ents = api.entities(), hues = [0x4dd0e1, 0x7e57c2, 0x66bb6a, 0xffca28, 0xef5350];
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i], d; try { d = JSON.parse(e.data); } catch (z) { d = {}; }
        if (e.kind === "bbrick") { api.draw.roundedRect(e.x - (d.w || 70) / 2, e.y - (d.h || 24) / 2, d.w || 70, d.h || 24, 4, hues[(d.hue || 0) % hues.length]); api.draw.roundedRect(e.x - (d.w || 70) / 2, e.y - (d.h || 24) / 2, d.w || 70, 5, 2, 0xffffff, 0.25); }
        else if (e.kind === "bpad") { api.draw.roundedRect(e.x - 46, e.y - 7, 92, 14, 7, (!!me && d.pid === me) ? 0x38e08a : 0x90a4ae); }
        else if (e.kind === "bball") { api.draw.circle(e.x, e.y, 8, 0xffffff); api.draw.circle(e.x - 2, e.y - 2, 3, 0xbfd8ff, 0.8); }
      }
    }
  };
})`;

// ---- asteroids: rotate, thrust, shoot; rocks split when hit ----
const ASTEROIDS = `(function () {
  var W = 800, H = 600;
  function wrap(v, m) { if (v < 0) return v + m; if (v > m) return v - m; return v; }
  return {
    id: "asteroids",
    _init: false,
    _seq: 0,
    tick: function (api) {
      var dt = api.dt, locals = api.local();
      var ships = {}, bullets = [], rocks = [];
      for (var i = 0; i < locals.length; i++) { var e = locals[i]; if (e.kind === "aship") ships[e.data.pid] = e; else if (e.kind === "abul") bullets.push(e); else if (e.kind === "arock") rocks.push(e); }
      if (!this._init) { this._init = true; for (var a = 0; a < 5; a++) { this._seq += 1; var ang = this._seq * 1.7; rocks.push({ key: "arock:" + this._seq, kind: "arock", x: 100 + (this._seq * 173) % 600, y: 70 + (this._seq * 97) % 180, vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, data: { r: 34, seq: this._seq } }); } }
      var inputs = api.players(), out = [];
      for (var p = 0; p < inputs.length; p++) {
        var pl = inputs[p], inp = pl.input, sh = ships[pl.id];
        if (!sh) sh = { key: "aship:" + pl.id, kind: "aship", x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, data: { pid: pl.id, score: 0, cd: 0 } };
        if (inp.left) sh.angle -= 3.2 * dt; if (inp.right) sh.angle += 3.2 * dt;
        if (inp.up) { sh.vx += Math.cos(sh.angle) * 260 * dt; sh.vy += Math.sin(sh.angle) * 260 * dt; }
        sh.vx *= 0.99; sh.vy *= 0.99; sh.x = wrap(sh.x + sh.vx * dt, W); sh.y = wrap(sh.y + sh.vy * dt, H);
        sh.data.cd = Math.max(0, (sh.data.cd || 0) - dt);
        if (inp.fire && sh.data.cd <= 0) { sh.data.cd = 0.26; this._seq += 1; bullets.push({ key: "abul:" + this._seq, kind: "abul", x: sh.x + Math.cos(sh.angle) * 16, y: sh.y + Math.sin(sh.angle) * 16, vx: Math.cos(sh.angle) * 470, vy: Math.sin(sh.angle) * 470, data: { owner: pl.id, life: 1.1 } }); }
        out.push(sh);
      }
      var keptB = []; for (var b = 0; b < bullets.length; b++) { var bl = bullets[b]; bl.x = wrap(bl.x + bl.vx * dt, W); bl.y = wrap(bl.y + bl.vy * dt, H); bl.data.life = (bl.data.life || 1) - dt; if (bl.data.life > 0) keptB.push(bl); }
      var keptR = [], newR = [];
      for (var r = 0; r < rocks.length; r++) {
        var rk = rocks[r]; rk.x = wrap(rk.x + rk.vx * dt, W); rk.y = wrap(rk.y + rk.vy * dt, H);
        var hit = -1; for (var b2 = 0; b2 < keptB.length; b2++) { var bb = keptB[b2]; if (bb.data.dead) continue; if (Math.hypot(bb.x - rk.x, bb.y - rk.y) < rk.data.r) { hit = b2; break; } }
        if (hit >= 0) { keptB[hit].data.dead = true; var sh2 = ships[keptB[hit].data.owner]; if (sh2) sh2.data.score = (sh2.data.score || 0) + 1; if (rk.data.r > 18) for (var s = 0; s < 2; s++) { this._seq += 1; var ang2 = rk.data.seq * 1.3 + s * 2.1; newR.push({ key: "arock:" + this._seq, kind: "arock", x: rk.x, y: rk.y, vx: Math.cos(ang2) * 95, vy: Math.sin(ang2) * 95, data: { r: rk.data.r * 0.55, seq: this._seq } }); } continue; }
        keptR.push(rk);
      }
      var keptB2 = []; for (var z = 0; z < keptB.length; z++) if (!keptB[z].data.dead) keptB2.push(keptB[z]);
      if (keptR.length + newR.length === 0) this._init = false;
      api.setLocal(out.concat(keptB2, keptR, newR));
    },
    render: function (api) {
      var me = api.me(); api.draw.rect(0, 0, 800, 600, 0x05060d);
      for (var s = 0; s < 40; s++) api.draw.circle((s * 137) % 800, (s * 89) % 600, 1, 0xffffff, 0.5);
      var ents = api.entities();
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i], d; try { d = JSON.parse(e.data); } catch (z) { d = {}; }
        if (e.kind === "arock") { api.draw.strokeCircle(e.x, e.y, d.r || 30, 0x9fb0c8, 2); api.draw.circle(e.x, e.y, (d.r || 30) * 0.4, 0x2a3550, 0.6); }
        else if (e.kind === "abul") { api.draw.circle(e.x, e.y, 3, 0xffe08a); }
        else if (e.kind === "aship") { var a = e.angle || 0, col = (!!me && d.pid === me) ? 0x6ef0a6 : 0xff8a65; api.draw.triangle(e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, e.x + Math.cos(a + 2.5) * 12, e.y + Math.sin(a + 2.5) * 12, e.x + Math.cos(a - 2.5) * 12, e.y + Math.sin(a - 2.5) * 12, col); }
      }
    }
  };
})`;

export const GENERATED_GAMES: Record<string, GeneratedEntry> = {
  dodge: {
    id: "dodge",
    gameId: "9000101",
    name: "Meteor Dash",
    prompt: "a game where you dodge falling blocks and survive as long as you can, multiplayer",
    summary: ["Multiplayer", "Dodge the falling blocks", "Survive for score", "Fire to respawn"],
    kinds: ["ddp", "ddr"],
    code: DODGE,
  },
  snake: {
    id: "snake",
    gameId: "9000102",
    name: "Garden Snake",
    prompt: "multiplayer snake on a grid — eat to grow, don't crash into a wall or yourself",
    summary: ["Multiplayer", "Grid movement", "Eat food to grow", "Crash resets you"],
    kinds: ["snk", "food"],
    code: SNAKE,
  },
  breakout: {
    id: "breakout",
    gameId: "9000103",
    name: "Brick Buster",
    prompt: "a breakout game — a paddle and a ball, clear all the bricks",
    summary: ["Paddle + ball", "Clear the bricks", "Fire to serve", "Score per brick"],
    kinds: ["bpad", "bball", "bbrick"],
    code: BREAKOUT,
  },
  asteroids: {
    id: "asteroids",
    gameId: "9000104",
    name: "Belt Runner",
    prompt: "asteroids — fly a ship, rotate and thrust, shoot rocks that split apart",
    summary: ["Rotate + thrust", "Shoot the rocks", "Rocks split when hit", "Screen wraps"],
    kinds: ["aship", "abul", "arock"],
    code: ASTEROIDS,
  },
};

export const GENERATED_LIST: GeneratedEntry[] = Object.values(GENERATED_GAMES);
