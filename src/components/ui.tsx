// Starblox shared UI primitives (ported from the Claude Design bundle).
// Pure presentational — no SpacetimeDB wiring here.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type IconName =
  | "back" | "plus" | "x" | "check" | "copy" | "qr" | "share" | "play"
  | "remix" | "trash" | "dots" | "bolt" | "send" | "users" | "search"
  | "arrow" | "trophy";

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

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brick" style={{ width: size, height: size }}>
      <span className="stud" />
      <span className="stud" />
      <span className="stud" />
      <span className="stud" />
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
  if (type === "flappy") {
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
