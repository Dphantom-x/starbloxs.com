"use client";

// Persistent Starblox shell: metallic top bar + the `.ready` animation gate.
// Content is visible by default; `.ready` is added after first paint so the
// entrance animations play (and never freeze content at opacity:0).
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Conn, LogoMark } from "./ui";

export default function AppShell({ children }: { children: ReactNode }) {
  const { connected, error } = useStdb();

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      document.documentElement.classList.add("ready")
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="app app-sheen">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Starblox home">
          <LogoMark />
          <span className="wordmark" style={{ fontSize: 19 }}>
            Starblox
          </span>
        </Link>
        <div className="topbar-right">
          <Conn connected={connected} error={error} />
          <span className="topbar-div" />
          <Link href="/create" className="btn btn-chrome btn-sm">
            <Icon name="plus" size={15} /> Create
          </Link>
        </div>
      </header>
      {error && (
        <div className="conn-banner" role="alert">
          <Icon name="x" size={14} /> {error}
        </div>
      )}
      {children}
    </div>
  );
}
