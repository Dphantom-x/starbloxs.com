"use client";

// Landing / "what is Starblox" page — the rundown. Reachable from the brand
// wordmark + sidebar logo. The games hub stays at "/". Ported from the design.
import Link from "next/link";
import { useStdb } from "@/components/StdbProvider";
import { Icon, Marble, LogoMark, GameThumb, Page, type IconName } from "@/components/ui";

function Feature({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <div className="feat">
      <span className="feat-ic">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="feat-title">{title}</h3>
      <p className="feat-body">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const { connected, mod } = useStdb();
  const showcase = mod
    ? mod.getGamesRaw().slice(0, 5).map((g) => {
        const id = g.gameId.toString();
        return {
          id,
          type: g.gameType,
          name: g.name,
          playing: mod.getPlayersForRaw(id).length,
        };
      })
    : [];

  return (
    <Page max={1120} className="landing">
      <section className="lp-hero fade-up">
        <LogoMark size={92} glow />
        <div className="eyebrow lp-eyebrow">
          {connected ? "Live multiplayer" : "Connecting…"} · no downloads
        </div>
        <h1 className="lp-title">Games, made and remade by talking.</h1>
        <p className="lp-sub">
          Starblox is a multiplayer arcade where every game is built by
          describing it. Type an idea, play it with friends in seconds, and
          reshape the rules mid-match — just by asking.
        </p>
        <div className="lp-cta">
          <Link href="/" className="btn btn-primary btn-lg">
            <Icon name="play" size={17} /> Browse games
          </Link>
          <Link href="/create" className="btn btn-chrome btn-lg">
            <Marble size={20} /> Create with AI
          </Link>
        </div>
      </section>

      <section className="lp-feats fade-up" style={{ animationDelay: ".06s" }}>
        <Feature
          icon="bolt"
          title="Describe it, play it"
          body="Say what you want — “tanks with bouncy shells,” “tall flappy with three gaps.” The AI builds a real, playable game on the spot."
        />
        <Feature
          icon="remix"
          title="Remix anything"
          body="Found a game you like? Make it yours in one tap, then tweak the speed, gravity, or rules until it feels right."
        />
        <Feature
          icon="qr"
          title="Play with friends instantly"
          body="Every match has a link and a QR code. Friends scan, join, and you're all playing together — no installs, no accounts."
        />
      </section>

      <section className="lp-showcase fade-up" style={{ animationDelay: ".12s" }}>
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
