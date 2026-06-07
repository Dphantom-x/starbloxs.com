"use client";

// Persistent Starblox shell: left icon rail + metallic top bar + a toast host,
// plus the `.ready` animation gate. Content is visible by default; `.ready` is
// added after first paint so entrance animations play (never frozen at opacity:0).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useStdb } from "./StdbProvider";
import { Icon, Conn, Wordmark, InstagramLink, Toasts, type IconName, type Toast } from "./ui";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const { connected, error } = useStdb();
  const pathname = usePathname();
  const onGames = pathname === "/";
  // The landing page is a full-width marketing page — no left rail there.
  const isLanding = pathname === "/landing";

  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const toast = useCallback((msg: string, icon?: IconName) => {
    const id = ++tid.current;
    setToasts((ts) => [...ts, { id, msg, icon }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      document.documentElement.classList.add("ready")
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={"app app-sheen" + (isLanding ? "" : " has-sidebar")}>
      {!isLanding && <Sidebar onToast={toast} />}
      <div className="app-main">
        <header className="topbar">
          <Link href="/landing" className="brand" aria-label="Starblox home">
            <Wordmark size={20} />
          </Link>
          <div className="topbar-right">
            <Link
              href="/"
              className={"topnav-link" + (onGames ? " is-active" : "")}
            >
              Browse games
            </Link>
            <InstagramLink />
            <Conn connected={connected} error={error} />
            <span className="topbar-div" />
            <button
              className="btn btn-ghost btn-icon"
              title="Settings"
              onClick={() => toast("Settings · coming soon", "gear")}
            >
              <Icon name="gear" size={18} />
            </button>
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
        <Toasts items={toasts} />
      </div>
    </div>
  );
}
