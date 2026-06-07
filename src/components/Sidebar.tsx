"use client";

// Left icon rail (Roblox-app feel). Only Home navigates; the rest are visual
// placeholders that toast "coming soon" (no dead pages). Ported from the design.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, LogoMark, Avatar, type IconName } from "./ui";

const SIDE_ITEMS: { id: string; icon: IconName; label: string; badge?: number }[] = [
  { id: "profile", icon: "user", label: "Profile" },
  { id: "messages", icon: "message", label: "Messages", badge: 3 },
  { id: "friends", icon: "users", label: "Friends", badge: 5 },
  { id: "avatar", icon: "avatar", label: "Avatar" },
  { id: "sandbox", icon: "cube", label: "Sandbox" },
];

const ME = "Maxy";

export default function Sidebar({
  onToast,
}: {
  onToast: (msg: string, icon?: IconName) => void;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/" || pathname === "/landing";
  const [active, setActive] = useState("home");
  useEffect(() => {
    if (onHome) setActive("home");
  }, [onHome]);

  return (
    <nav className="sidebar">
      <Link className="side-logo" href="/landing" title="Starblox" aria-label="Starblox home">
        <LogoMark size={46} />
      </Link>
      <div className="side-items">
        <Link
          className={"side-item" + (active === "home" ? " is-active" : "")}
          href="/"
          title="Home"
          onClick={() => setActive("home")}
        >
          <span className="side-ic">
            <Icon name="home" size={22} />
          </span>
          <span className="side-label">Home</span>
        </Link>
        {SIDE_ITEMS.map((it) => (
          <button
            key={it.id}
            className={"side-item" + (active === it.id ? " is-active" : "")}
            title={it.label}
            onClick={() => {
              setActive(it.id);
              onToast(`${it.label} · coming soon`, it.icon === "cube" ? "bolt" : it.icon);
            }}
          >
            <span className="side-ic">
              <Icon name={it.icon} size={22} />
              {it.badge ? <span className="side-badge">{it.badge}</span> : null}
            </span>
            <span className="side-label">{it.label}</span>
          </button>
        ))}
      </div>
      <button
        className="side-account"
        title={ME}
        onClick={() => onToast(`Signed in as ${ME}`, "user")}
      >
        <Avatar name={ME} c1="#aeb4c0" c2="#6b7280" status="online" size={38} />
      </button>
    </nav>
  );
}
