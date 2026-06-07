// Friends "crew" for the games-hub session strip + the landing publish mock.
// Visual mock — no backend. PFPs live in public/pfp/. Ported from the design.
export type Friend = {
  name: string;
  pfp: string;
  c1: string;
  c2: string;
  status: "in" | "online" | "idle";
  game?: string;
};

export const ME = "Maxy"; // signed-in player's display name

export const FRIENDS: Friend[] = [
  { name: "Dawn Keebals", pfp: "/pfp/dawn.png", c1: "#34d399", c2: "#059669", status: "in", game: "Tank Trouble" },
  { name: "lou natic", pfp: "/pfp/lou.png", c1: "#60a5fa", c2: "#2563eb", status: "in", game: "Flappy Arena" },
  { name: "Jenny Tull", pfp: "/pfp/jenny.png", c1: "#fb923c", c2: "#ea580c", status: "online" },
  { name: "Willie Stroker", pfp: "/pfp/willie.png", c1: "#c084fc", c2: "#7c3aed", status: "online" },
  { name: "al beback", pfp: "/pfp/al.png", c1: "#f472b6", c2: "#db2777", status: "idle" },
  { name: "Ben Dover", pfp: "/pfp/ben.png", c1: "#22d3ee", c2: "#0891b2", status: "in", game: "Bouncy Blitz" },
  { name: "justin case", pfp: "/pfp/justin.png", c1: "#facc15", c2: "#ca8a04", status: "idle" },
];
