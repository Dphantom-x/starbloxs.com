"use client";

// Landing / "what is Starblox" page — the rundown (hackathon3.1 design, latest).
// Big brand-head wordmark with a faded ghost logo behind it, a two-column hero
// (copy + auto-looping clip carousel) with the Instagram link in the CTA row, a
// "How it works" strip, the light "why" band (two hurdles + SpacetimeDB), and a
// showcase. No top bar / sidebar here (full-width marketing page).
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useStdb } from "@/components/StdbProvider";
import { Icon, Marble, GameThumb, Page, Avatar, Wordmark, InstagramLink, type IconName } from "@/components/ui";
import { FRIENDS } from "@/lib/friends";

type Clip = { id: "describe" | "build" | "publish"; src: string | null; kicker: string; label: string; cap: string };

const CLIPS: Clip[] = [
  { id: "describe", src: null, kicker: "Clip 1", label: "Describe it", cap: "Type a sentence — the agent starts thinking." },
  { id: "build", src: null, kicker: "Clip 2", label: "It builds & tests it", cap: "The agent writes the game, runs it, fixes what breaks." },
  { id: "publish", src: null, kicker: "Clip 3", label: "Publish & play", cap: "One click — friends join by link or QR and play." },
];

function MockDescribe() {
  return (
    <div className="clip-mock mock-describe">
      <div className="md-promptbar">
        <Marble size={22} busy />
        <span className="md-typed">
          a multiplayer flappy bird, tall, birds collide<span className="md-caret" />
        </span>
      </div>
      <div className="md-think">
        <span className="md-think-dot" />
        <span className="md-think-dot" />
        <span className="md-think-dot" />
        <span className="md-think-label">designing your game…</span>
      </div>
    </div>
  );
}

function MockBuild() {
  const lines = [
    "spawn(bird, { gravity: 0.4 })",
    "pipe.gap = 3  // three gaps",
    "field.height *= 1.6  // tall",
    "on(collide, knockback)",
    "✓ build ok · running tests",
  ];
  return (
    <div className="clip-mock mock-build">
      <div className="mb-code">
        {lines.map((l, i) => (
          <div className="mb-line" style={{ animationDelay: i * 0.5 + "s" }} key={i}>
            <span className="mb-ln">{i + 1}</span>
            <span className={"mb-txt" + (i === lines.length - 1 ? " ok" : "")}>{l}</span>
          </div>
        ))}
      </div>
      <div className="mb-preview">
        <GameThumb type="flappy" size="mini" />
      </div>
    </div>
  );
}

function MockPublish() {
  return (
    <div className="clip-mock mock-publish">
      <div className="mp-qr">
        <QRCode value="starblox.app/game/sky" size={104} />
      </div>
      <div className="mp-side">
        <div className="mp-live">
          <span className="live-dot" />5 joined
        </div>
        <div className="mp-avatars">
          {FRIENDS.slice(0, 5).map((f, i) => (
            <span className="mp-av" style={{ animationDelay: i * 0.25 + "s", zIndex: 5 - i }} key={i}>
              <Avatar name={f.name} pfp={f.pfp} c1={f.c1} c2={f.c2} size={34} />
            </span>
          ))}
        </div>
        <div className="mp-url mono">starblox.app/game/sky</div>
      </div>
    </div>
  );
}

function ClipStage({ clip, active }: { clip: Clip; active: boolean }) {
  if (clip.src) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video className="clip-video" src={clip.src} muted loop autoPlay playsInline />;
  }
  return (
    <div className={"clip-stage-inner" + (active ? " is-active" : "")}>
      {clip.id === "describe" && <MockDescribe />}
      {clip.id === "build" && <MockBuild />}
      {clip.id === "publish" && <MockPublish />}
      <span className="clip-placeholder-tag">
        <Icon name="play" size={11} /> {clip.kicker} · muted · loops
      </span>
    </div>
  );
}

function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % CLIPS.length), 4200);
    return () => clearInterval(t);
  }, [paused]);
  const clip = CLIPS[i];
  return (
    <div className="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="carousel-stage">
        {CLIPS.map((c, idx) => (
          <div key={c.id} className={"carousel-slide" + (idx === i ? " on" : "")}>
            <ClipStage clip={c} active={idx === i} />
          </div>
        ))}
        <button className="carousel-arrow left" onClick={() => setI((n) => (n - 1 + CLIPS.length) % CLIPS.length)} aria-label="Previous">
          <Icon name="back" size={18} />
        </button>
        <button className="carousel-arrow right" onClick={() => setI((n) => (n + 1) % CLIPS.length)} aria-label="Next">
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <div className="carousel-foot">
        <div className="carousel-cap">
          <span className="carousel-step">{clip.label}</span>
          <span className="carousel-sub">{clip.cap}</span>
        </div>
        <div className="carousel-dots">
          {CLIPS.map((c, idx) => (
            <button key={c.id} className={"cdot" + (idx === i ? " on" : "")} onClick={() => setI(idx)} aria-label={c.label} />
          ))}
        </div>
      </div>
    </div>
  );
}

const STEPS: { n: string; icon: IconName; title: string; body: string }[] = [
  { n: "1", icon: "message", title: "Describe it", body: "Tell the AI the game you want, in plain words." },
  { n: "2", icon: "bolt", title: "It builds & tests it", body: "The agent writes a real game, runs it, fixes what breaks, and shows you a clip of it working." },
  { n: "3", icon: "qr", title: "Publish & play", body: "One click; friends join by link or QR, instantly, multiplayer." },
  { n: "4", icon: "remix", title: "Reshape it anytime", body: "Want it different? Just ask. Mid-match, for everyone, no reload." },
];

function HowItWorks() {
  return (
    <section className="lp-how fade-up" style={{ animationDelay: ".1s" }}>
      <div className="lp-section-head">
        <span className="eyebrow">How it works</span>
        <h2 className="lp-h2">A sentence becomes a playable, multiplayer game.</h2>
      </div>
      <div className="how-grid">
        {STEPS.map((s) => (
          <div className="how-step" key={s.n}>
            <div className="how-top">
              <span className="how-n">{s.n}</span>
              <span className="how-ic">
                <Icon name={s.icon} size={18} />
              </span>
            </div>
            <h3 className="how-title">{s.title}</h3>
            <p className="how-body">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const HURDLES: { n: string; icon: IconName; title: string; body: string }[] = [
  { n: "01", icon: "bolt", title: "Starting", body: "No code, no engine to learn, no blank page. Describe it and it exists." },
  { n: "02", icon: "users", title: "Multiplayer", body: "Real-time sync, servers, netcode — the brutal part, just there. Free, instant, for every game." },
];

function WhyBand() {
  return (
    <section className="lp-why fade-up" style={{ animationDelay: ".14s" }}>
      <div className="why-inner">
        <div className="why-head">
          <span className="why-eyebrow">Why Starblox</span>
          <h2 className="why-title">
            Making games is hard.
            <br />
            We removed the two hardest parts.
          </h2>
        </div>
        <div className="why-grid">
          {HURDLES.map((h) => (
            <div className="why-card" key={h.n}>
              <span className="why-num">{h.n}</span>
              <div className="why-card-main">
                <div className="why-card-top">
                  <span className="why-ic">
                    <Icon name={h.icon} size={17} />
                  </span>
                  <h3 className="why-h">{h.title}</h3>
                  <span className="why-status">
                    <Icon name="check" size={12} /> Handled
                  </span>
                </div>
                <p className="why-body">{h.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="why-powered">
          <span className="why-powered-dot" />
          Multiplayer powered by <strong>SpacetimeDB</strong>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { connected, mod } = useStdb();
  const showcase = mod
    ? mod.getGamesRaw().slice(0, 5).map((g) => {
        const id = g.gameId.toString();
        return { id, type: g.gameType, name: g.name, playing: mod.getPlayersForRaw(id).length };
      })
    : [];

  return (
    <Page max={1180} className="landing">
      <section className="lp-hero fade-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" className="lp-hero-ghost" alt="" draggable={false} />
        <div className="lp-brandhead">
          <Wordmark size={130} className="lp-brandmark" />
        </div>
        <div className="lp-hero-main">
          <div className="lp-hero-copy">
            <div className="eyebrow lp-eyebrow">
              {connected ? "Live multiplayer" : "Connecting…"} · no downloads
            </div>
            <h1 className="lp-title">Games, made and remade by talking.</h1>
            <p className="lp-sub">
              Starblox is a multiplayer arcade where every game is built by describing it. Type an idea,
              play it with friends in seconds, and reshape the rules mid-match — just by asking.
            </p>
            <div className="lp-cta">
              <Link href="/create" className="btn btn-primary btn-lg">
                <Marble size={20} /> Create with AI
              </Link>
              <Link href="/" className="btn btn-chrome btn-lg">
                <Icon name="play" size={17} /> Browse games
              </Link>
              <InstagramLink size={26} className="ig-hero" />
            </div>
          </div>
          <div className="lp-hero-clip">
            <HeroCarousel />
          </div>
        </div>
      </section>

      <HowItWorks />
      <WhyBand />

      <section className="lp-showcase fade-up" style={{ animationDelay: ".18s" }}>
        <div className="lp-showcase-head">
          <h2 className="lp-showcase-title">Jump into a match</h2>
          <Link href="/" className="backlink" style={{ color: "var(--ink-soft)" }}>
            See all games <Icon name="arrow" size={15} />
          </Link>
        </div>
        <div className="lp-showcase-grid">
          {showcase.map((g) => (
            <Link key={g.id} href={`/lobby/${g.id}`} className="lp-tile card">
              <GameThumb type={g.type} />
              <div className="lp-tile-foot">
                <span className="lp-tile-name">{g.name}</span>
                {g.playing > 0 && (
                  <span className="lp-tile-live">
                    <span className="live-dot" />
                    {g.playing}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}
