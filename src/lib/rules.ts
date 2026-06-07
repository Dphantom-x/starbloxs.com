// Pure helpers that turn a live game_rules row (client camelCase fields) into
// the short human chips the home cards / lobby / create-preview display.
// No SpacetimeDB imports — safe to use in any client component.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RulesRow = any;

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function fmt(n: number): string {
  return `${+n.toFixed(1)}`; // 2.0 -> "2", 1.6 -> "1.6"
}
/** Engine games carry genre-prefixed types (eflappy/etank) — reduce to the genre. */
export function genreOf(gameType: string): "flappy" | "tanks" {
  return gameType === "flappy" || gameType === "eflappy" ? "flappy" : "tanks";
}

/** Short, human rule chips derived from a live rules row. */
export function rulesSummary(
  gameType: string,
  r: RulesRow | null | undefined,
  limit = 3
): string[] {
  if (!r) return genreOf(gameType) === "flappy" ? ["Default field"] : ["Default speed"];
  const out: string[] = [];

  if (genreOf(gameType) === "flappy") {
    if (num(r.fieldHeight, 1) > 1.3) out.push("Tall field");
    const g = num(r.gravity, 1);
    if (g <= 0.7) out.push("Low gravity");
    else if (g >= 1.6) out.push("Heavy gravity");
    const gaps = num(r.gapsPerPipe, 1);
    if (gaps >= 2) out.push(`${gaps} gaps per pipe`);
    if (num(r.pipeGap, 1) >= 1.4) out.push("Wide gaps");
    out.push(r.birdCollision ? "Birds collide" : "Birds pass through");
    if (out.length === 0) out.push("Default field");
  } else {
    const b = num(r.projectileBounces, 0);
    if (b >= 1) out.push(`Shells bounce ${b}×`);
    const sp = num(r.playerSpeed, 1);
    if (sp >= 1.5) out.push(`${fmt(sp)}× speed`);
    else if (sp <= 0.7) out.push("Slow tanks");
    if (num(r.fireCooldownMs, 1000) <= 250) out.push("Rapid fire");
    if (num(r.projectileSpeed, 1) >= 1.5) out.push("Fast shells");
    if (out.length === 0) out.push("Default speed");
  }

  return out.slice(0, limit);
}

/** One-line description for the lobby. */
export function gameBlurb(gameType: string): string {
  return genreOf(gameType) === "flappy"
    ? "Flap through the gaps. Most pipes cleared wins."
    : "Drive, bounce shells off walls — last tank standing.";
}

/** Controls hint shown in the room. */
export function controlsHint(gameType: string): string {
  return genreOf(gameType) === "flappy"
    ? "up / space to flap"
    : "arrow keys to drive · space to fire";
}
