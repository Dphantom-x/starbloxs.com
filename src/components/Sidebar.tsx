"use client";

// Left labeled rail (Roblox-app feel): the Starblox wordmark on top, then
// icon + label rows side by side, notification badges on the right, and the
// account row at the bottom. Only Home navigates; the rest toast "coming soon".
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Wordmark, Avatar, type IconName } from "./ui";

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
      <Link className="side-brand" href="/landing" title="Starblox" aria-label="Starblox home">
        <Wordmark size={30} />
      </Link>
      <div className="side-items">
        <Link
          className={"side-item" + (active === "home" ? " is-active" : "")}
          href="/"
          title="Home"
          onClick={() => setActive("home")}
        >
          <span className="side-ic">
            <Icon name="home" size={21} />
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
              <Icon name={it.icon} size={21} />
            </span>
            <span className="side-label">{it.label}</span>
            {it.badge ? <span className="side-badge">{it.badge}</span> : null}
          </button>
        ))}
      </div>
      <button
        className="side-account"
        title={ME}
        onClick={() => {
          setActive("profile");
          onToast(`Signed in as ${ME}`, "user");
        }}
      >
        <Avatar name={ME} c1="#aeb4c0" c2="#6b7280" status="online" size={34} />
        <span className="side-account-meta">
          <span className="side-account-name">{ME}</span>
          <span className="side-account-status">Online</span>
        </span>
      </button>
    </nav>
  );
}
