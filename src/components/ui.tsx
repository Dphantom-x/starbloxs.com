// Starblox shared UI primitives (ported from the Claude Design bundle).
// Pure presentational — no SpacetimeDB wiring here.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "back" | "plus" | "x" | "check" | "copy" | "qr" | "share" | "play"
  | "remix" | "trash" | "dots" | "bolt" | "send" | "users" | "search"
  | "arrow" | "trophy" | "expand" | "shrink"
  | "home" | "user" | "message" | "avatar" | "cube" | "gear";

export function Icon({
  name,
  size = 18,
  stroke = 1.8,
  style,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
  };
  switch (name) {
    case "back": return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "x": return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "check": return <svg {...p}><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
    case "copy": return <svg {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 012-2h8" /></svg>;
    case "qr": return <svg {...p}><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><path d="M14 14h2v2M20 14v6M14 20h2" /></svg>;
    case "share": return <svg {...p}><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8" /></svg>;
    case "play": return <svg {...p}><path d="M7 5.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" /></svg>;
    case "remix": return <svg {...p}><path d="M4 7h11a4 4 0 014 4M20 17H9a4 4 0 01-4-4" /><path d="M17 4l3 3-3 3M7 14l-3 3 3 3" /></svg>;
    case "trash": return <svg {...p}><path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" /></svg>;
    case "dots": return <svg {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
    case "bolt": return <svg {...p}><path d="M13 3l-8 10h6l-1 8 8-10h-6z" /></svg>;
    case "send": return <svg {...p}><path d="M5 12l15-7-6 15-2.5-6z" /></svg>;
    case "users": return <svg {...p}><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><path d="M16 7a3 3 0 010 6M20.5 19a5.5 5.5 0 00-3-4.9" /></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>;
    case "arrow": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "trophy": return <svg {...p}><path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 19h6M10 15.5V19M14 15.5V19" /></svg>;
    case "expand": return <svg {...p}><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></svg>;
    case "shrink": return <svg {...p}><path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" /></svg>;
    case "home": return <svg {...p}><path d="M3.5 11.5L12 4l8.5 7.5" /><path d="M5.5 10v9h13v-9" /><path d="M10 19v-5h4v5" /></svg>;
    case "user": return <svg {...p}><circle cx="12" cy="8.4" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></svg>;
    case "message": return <svg {...p}><path d="M5 5.5h14a1 1 0 011 1V15a1 1 0 01-1 1H9l-4 3.4V6.5a1 1 0 011-1z" /></svg>;
    case "avatar": return <svg {...p}><circle cx="12" cy="5" r="2.7" /><path d="M12 7.7v6M6.7 10.6h10.6M12 13.7L8.3 20M12 13.7L15.7 20" /></svg>;
    case "cube": return <svg {...p}><path d="M12 3.2l8 4v9.6l-8 4-8-4V7.2z" /><path d="M4.2 7.4L12 11.4l7.8-4M12 11.4V20.6" /></svg>;
    case "gear": return <svg {...p}><circle cx="12" cy="12" r="3.1" /><path d="M12 2.6v3.1M12 18.3v3.1M21.4 12h-3.1M5.7 12H2.6M18.6 5.4l-2.2 2.2M7.6 16.4l-2.2 2.2M18.6 18.6l-2.2-2.2M7.6 7.6L5.4 5.4" /></svg>;
    default: return null;
  }
}

export function Marble({ size = 28, busy = false }: { size?: number; busy?: boolean }) {
  return (
    <span className={"marble" + (busy ? " marble-busy" : "")} style={{ width: size, height: size }}>
      <span className="marble-hi" />
    </span>
  );
}

export function Conn({
  connected,
  error,
}: {
  connected: boolean;
  error?: string | null;
}) {
  const state = error ? "error" : connected ? "on" : "connecting";
  const label = error ? "Disconnected" : connected ? "Connected" : "Connecting…";
  return (
    <span className={"conn " + state}>
      <span className="conn-dot" />
      {label}
    </span>
  );
}

export type Toast = { id: number; msg: string; icon?: IconName; tone?: "good" | "bad" };

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className={"toast pop-in " + (t.tone ?? "")}>
          {t.icon && <Icon name={t.icon} size={16} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// Centered page wrapper with a max-width inner column (matches the design's Page).
export function Page({
  children,
  max = 1120,
  testId,
  className = "",
}: {
  children: ReactNode;
  max?: number;
  testId?: string;
  className?: string;
}) {
  return (
    <main className={"page " + className} data-testid={testId}>
      <div className="page-inner" style={{ maxWidth: max }}>
        {children}
      </div>
    </main>
  );
}

export function BackLink({
  href = "/",
  label = "back to games",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link className="backlink" href={href}>
      <Icon name="back" size={15} /> {label}
    </Link>
  );
}

// The Starblox star-hole mark (processed transparent PNG in /public).
export function LogoMark({ size = 30, glow = false }: { size?: number; glow?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Starblox"
      width={size}
      height={size}
      className={"logomark" + (glow ? " logomark-glow" : "")}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

// Wordmark with the logo standing in for the "t" in Starblox.
export function Wordmark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={"wm-inline " + className} style={{ fontSize: size }}>
      <span className="wm-part">S</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="t" className="wm-t" draggable={false} />
      <span className="wm-part">arblox</span>
    </span>
  );
}

// Instagram link with the classic rainbow gradient (top bar).
export function InstagramLink({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <a
      className={"ig-link " + className}
      href="https://www.instagram.com/ig.aldo_o/"
      target="_blank"
      rel="noopener noreferrer"
      title="Follow @ig.aldo_o on Instagram"
      aria-label="Instagram"
    >
      <svg width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <radialGradient id="igGrad" cx="30%" cy="107%" r="135%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)" />
        <rect x="6.3" y="6.3" width="11.4" height="11.4" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="16.3" cy="7.7" r="1.05" fill="#fff" />
      </svg>
    </a>
  );
}

// Colored avatar disc with initials (or a profile photo) + an optional status ring.
export function Avatar({
  name,
  c1,
  c2,
  status,
  size = 38,
  pfp,
}: {
  name: string;
  c1: string;
  c2: string;
  status?: "in" | "online" | "idle" | "offline";
  size?: number;
  pfp?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  const statusColor =
    status === "in" || status === "online"
      ? "var(--you-soft)"
      : status === "idle"
        ? "var(--flap-you)"
        : "var(--muted-2)";
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {pfp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar-img" src={pfp} alt={name} draggable={false} />
      ) : (
        <span
          className="avatar-disc"
          style={{ background: `linear-gradient(160deg, ${c1}, ${c2})`, fontSize: size * 0.4 }}
        >
          {initials}
        </span>
      )}
      {status && <span className="avatar-status" style={{ background: statusColor }} />}
    </span>
  );
}

// Procedural game thumbnail (tiny scenes from simple shapes).
export function GameThumb({
  type,
  size = "card",
}: {
  type: string;
  size?: "card" | "lg" | "mini";
}) {
  // Engine games carry genre-prefixed types (eflappy/etank) — show their genre.
  if (type === "flappy" || type === "eflappy") {
    return (
      <div className={"thumb thumb-" + size} data-type="flappy">
        <div className="thumb-sky">
          <div className="pipe pipe-a"><span className="pipe-top" /><span className="pipe-bot" /></div>
          <div className="pipe pipe-b"><span className="pipe-top tall" /><span className="pipe-bot short" /></div>
          <div className="bird bird-you" />
          <div className="bird bird-other" />
          <div className="cloud cloud-1" />
          <div className="cloud cloud-2" />
        </div>
      </div>
    );
  }
  return (
    <div className={"thumb thumb-" + size} data-type="tanks">
      <div className="thumb-field">
        <div className="wall wall-1" />
        <div className="wall wall-2" />
        <div className="tank tank-you"><span className="barrel" /></div>
        <div className="tank tank-enemy"><span className="barrel" /></div>
        <div className="shell" />
      </div>
    </div>
  );
}
