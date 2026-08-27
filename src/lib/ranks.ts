// Bodový systém rankov – zelený deň = +1 bod, ne-zelený deň = −1 bod
export interface RankTier {
  min: number;
  max: number; // Infinity pre posledný
  key: string;
  img: string;
  color: string; // glow farba ranku
}

export const RANKS: RankTier[] = [
  { min: 0, max: 7, key: "rookie", img: "/ranks/rookie.png?v=6", color: "#22c55e" },
  { min: 8, max: 14, key: "beginner", img: "/ranks/beginner.png?v=6", color: "#4ade80" },
  { min: 15, max: 30, key: "novice", img: "/ranks/novice.png?v=6", color: "#22d3ee" },
  { min: 31, max: 60, key: "intermediate", img: "/ranks/intermediate.png?v=6", color: "#eab308" },
  { min: 61, max: 90, key: "advanced", img: "/ranks/advanced.png?v=6", color: "#f97316" },
  { min: 91, max: 120, key: "expert", img: "/ranks/expert.png?v=6", color: "#ef4444" },
  { min: 121, max: 240, key: "master", img: "/ranks/master.png?v=6", color: "#8b5cf6" },
  { min: 241, max: 365, key: "grandmaster", img: "/ranks/grandmaster.png?v=6", color: "#ec4899" },
  { min: 366, max: Infinity, key: "ultimate", img: "/ranks/ultimate.png?v=6", color: "#fbbf24" },
];

export function rankForPoints(points: number): RankTier {
  const p = Math.max(0, Math.floor(points));
  for (const r of RANKS) {
    if (p >= r.min && p <= r.max) return r;
  }
  return RANKS[0];
}

export function nextRank(points: number): RankTier | null {
  const cur = rankForPoints(points);
  const idx = RANKS.indexOf(cur);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

// Progress 0–1 k ďalšiemu ranku (1 = maximálny rank)
export function rankProgress(points: number): number {
  const cur = rankForPoints(points);
  const next = nextRank(points);
  if (!next) return 1;
  const span = next.min - cur.min;
  return Math.min(1, Math.max(0, (Math.max(0, points) - cur.min) / span));
}

export function pointsFromTotals(totals: { totalKcal: number }[], goal: number): number {
  let pts = 0;
  for (const t of totals) {
    if (t.totalKcal > goal - 500 && t.totalKcal <= goal + 100) pts += 1;
    else pts -= 1;
  }
  return pts;
}

// Logika: za ka�d� de� max �1 bod.
// - minul� dni: zamknut� v ledgeri (dayScores) � mazanie jed�l ich u� nezmen�
// - dne�ok: live pod�a aktu�lneho s��tu (zamkne sa zajtra)
export function computePoints(
  totals: { date: string; totalKcal: number }[],
  scores: { date: string; points: number }[],
  goal: number
): number {
  const today = new Date().toISOString().slice(0, 10);
  let pts = 0;
  for (const s of scores) pts += s.points;
  for (const t of totals) {
    if (t.date >= today) {
      pts += t.totalKcal > goal - 500 && t.totalKcal <= goal + 100 ? 1 : -1;
    }
  }
  return pts;
}







