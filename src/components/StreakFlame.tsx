"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ClientPortal } from "@/components/ClientPortal";
import { InfoHint } from "@/components/InfoHint";
import { rankForPoints, nextRank, rankProgress, computePoints, RANKS } from "@/lib/ranks";
import { BUS, onBus } from "@/lib/bus";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_LABELS_SK = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const DAY_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type StreakData = {
  points: number;
  goal: number;
  totals: Map<string, number>;
};

export function StreakFlame() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [previewRank, setPreviewRank] = useState<string | null>(null);
  const [data, setData] = useState<StreakData | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      Promise.all([fetch("/api/meals?summary=all"), fetch("/api/settings")])
        .then(async ([m, s]) => {
          if (!m.ok || !s.ok) throw new Error();
          const md = await m.json();
          const sd = await s.json();
          const goal: number = sd.user?.goalKcal ?? 2000;
          const totals: { date: string; totalKcal: number }[] = md.totals || [];
          const scores: { date: string; points: number }[] = md.scores || [];
          const points = computePoints(totals, scores, goal);
          if (active) setData({ points, goal, totals: new Map(totals.map((x) => [x.date, x.totalKcal])) });
        })
        .catch(() => {
          if (active) setData({ points: 0, goal: 2000, totals: new Map() });
        });
    };
    load();
    // LIVE: prepočet hneď keď sa kdekoľvek pridá/zmaže jedlo (lokálne aj z iného zariadenia)
    return onBus(BUS.meals, load);
  }, []);

  const points = data?.points ?? 0;
  const rank = rankForPoints(points);
  const next = nextRank(points);
  const progress = rankProgress(points);
  const toNext = next ? next.min - points : 0;

  // dnešný stav: +1 (zelený deň – modrá), −1 (biely/červený deň – červená), bez jedla → žiadna indikácia
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayKcal = data?.totals.get(todayKey);
  const todayDelta = todayKcal == null ? 0 : todayKcal > data!.goal - 500 && todayKcal <= data!.goal + 100 ? 1 : -1;

  // farba bodov: mínus = červená, nula = biela, viac = zelená
  const pointsCls = points < 0 ? "text-red-500 dark:text-red-400" : points === 0 ? "text-zinc-900 dark:text-white" : "text-emerald-500 dark:text-emerald-400";

  // current month mini calendar
  const cells = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let lead = first.getDay() - 1;
    if (lead < 0) lead = 6;
    const arr: (null | { day: number; date: string })[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, date: `${currentMonth()}-${String(d).padStart(2, "0")}` });
    }
    return arr;
  }, []);

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 hover:scale-105 active:scale-95 transition" title={`${points} ${t("stats.points").toLowerCase()}`}>
        {/* rank odznak + názov pod ním + glow po obryse odznaku */}
        <span className="flex flex-col items-center gap-0.5">
          <motion.img
            src={rank.img}
            alt={t(`rank.${rank.key}`)}
            animate={{ filter: [`drop-shadow(0 0 9px ${rank.color}cc)`, `drop-shadow(0 0 26px ${rank.color})`, `drop-shadow(0 0 9px ${rank.color}cc)`] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="h-11 w-11 object-contain"
          />
          <span className="text-[8px] sm:text-[9px] font-black tracking-wide text-zinc-500 dark:text-zinc-400 uppercase leading-none">{t(`rank.${rank.key}`)}</span>
        </span>
        <span className={`font-black text-lg sm:text-xl leading-none tabular-nums ${pointsCls}`}>
          {data?.points ?? "…"}
        </span>
        {todayDelta === 1 && (
          <motion.span key="plus" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-xs font-black text-blue-500 dark:text-blue-400 leading-none">
            +1
          </motion.span>
        )}
        {todayDelta === -1 && (
          <motion.span key="minus" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-xs font-black text-red-500 dark:text-red-400 leading-none">
            −1
          </motion.span>
        )}
      </button>

      <ClientPortal active={open}>
      {/* Points & rank modal – calendar + rank progress */}
      <AnimatePresence>
        {open && data && (
          <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-t-4xl p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 z-10">
                <h3 className="font-extrabold">{t("rank.all")}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* kalendár – presmeruje do History tabu priamo k mesiacnemu kalendáru */}
                  <button
                    onClick={() => {
                      setOpen(false);
                      try {
                        sessionStorage.setItem("fitcal_open_calendar", "1");
                      } catch {}
                      window.dispatchEvent(new CustomEvent("fitcal:openCalendar"));
                      if (window.location.pathname !== "/") router.push("/");
                    }}
                    title={t("cal.title")}
                    aria-label={t("cal.title")}
                    className="h-8 w-8 rounded-xl bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 flex items-center justify-center hover:brightness-95 active:scale-95 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <path d="M3 10h18" />
                    </svg>
                  </button>
                  <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center font-bold">✕</button>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Progress do ďalšieho ranku – úplne hore */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 mb-1">
                    <span>{t(`rank.${rank.key}`)}</span>
                    <span>{next ? `${toNext} ${t("rank.next")}` : t("rank.max")}</span>
                    <span>{next ? t(`rank.${next.key}`) : "🏆"}</span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-fitcal-mint to-fitcal-orange"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(progress * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Rank hero – badge + názov + podtitul + glow po obryse */}
                <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 flex items-center gap-4">
                  <motion.img
                    src={rank.img}
                    alt={t(`rank.${rank.key}`)}
                    animate={{ filter: [`drop-shadow(0 0 16px ${rank.color}dd)`, `drop-shadow(0 0 44px ${rank.color})`, `drop-shadow(0 0 16px ${rank.color}dd)`] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    className="h-20 w-20 object-contain shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black text-white leading-tight truncate">{t(`rank.${rank.key}`)}</span>
                      <InfoHint text={t("stats.pointsInfo")} label={t("stats.points")} />
                    </div>
                    <p className="text-xs font-semibold text-zinc-400 leading-snug">{t(`rank.${rank.key}.sub`)}</p>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className={`text-2xl font-black leading-none tabular-nums ${pointsCls}`}>{points}</span>
                      <span className="text-[10px] font-bold text-zinc-500">{t("stats.points")}</span>
                    </div>
                  </div>
                </div>

                {/* All ranks – rozbaliteľná mriežka všetkých rankov */}
                <button
                  onClick={() => setShowAllRanks((v) => !v)}
                  className={`w-full rounded-2xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.99] ${
                    showAllRanks
                      ? "bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                  {t("rank.allButton")}
                  <motion.span animate={{ rotate: showAllRanks ? 180 : 0 }} className="inline-block text-[10px]">▼</motion.span>
                </button>
                <AnimatePresence>
                  {showAllRanks && (
                    <motion.div
                      key="allranks"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {RANKS.map((r, idx) => {
                          const isCurrent = r.key === rank.key;
                          return (
                            <div
                              key={r.key}
                              className={`relative flex flex-col items-center justify-center rounded-2xl p-1.5 text-center bg-zinc-50 dark:bg-zinc-800/60 border ${isCurrent ? "border-fitcal-mint ring-1 ring-fitcal-mint/40" : "border-zinc-100 dark:border-zinc-800"}`}
                            >
                              {/* klik → náhľad odznaku; glow po obryse (drop-shadow) */}
                              <div
                                className="w-full aspect-square rounded-xl bg-zinc-950 flex items-center justify-center overflow-hidden select-none cursor-pointer active:scale-95 transition"
                                onClick={() => {
                                  setPreviewRank(r.key);
                                  navigator.vibrate?.(20);
                                }}
                              >
                                <motion.img
                                  src={r.img}
                                  alt={t(`rank.${r.key}`)}
                                  animate={{ filter: [`drop-shadow(0 0 8px ${r.color}bb)`, `drop-shadow(0 0 22px ${r.color})`, `drop-shadow(0 0 8px ${r.color}bb)`] }}
                                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: idx * 0.12 }}
                                  className="max-h-[82%] max-w-[84%] object-contain pointer-events-none"
                                  draggable={false}
                                />
                              </div>
                              <div className="text-[8px] font-bold text-zinc-400 tabular-nums">
                                {r.max === Infinity ? `${r.min}+` : `${r.min}–${r.max}`} {t("rank.pointsShort")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[9px] font-medium text-zinc-400 text-center mt-1.5">
                        {locale === "sk" ? "Klikni na odznak pre zväčšenie a progress" : "Tap a badge for preview and progress"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Calendar – circles connected by a line while the streak continues */}
                <div>
                  <div className="grid grid-cols-7 gap-1">
                    {(locale === "sk" ? DAY_LABELS_SK : DAY_LABELS_EN).map((d) => (
                      <div key={d} className="text-center text-[9px] font-bold tracking-widest text-zinc-400 uppercase pb-0.5">
                        {d}
                      </div>
                    ))}
                    {cells.map((c, i) => {
                      if (!c) return <div key={`e-${i}`} />;
                      const kcal = data.totals.get(c.date);
                      const low = kcal != null && kcal <= data.goal - 500; // biele – low day
                      const ok = kcal != null && kcal > data.goal - 500 && kcal <= data.goal + 100; // zelená – v cieli
                      const over = kcal != null && !low && !ok; // červená – nad cieľom
                      const isToday = c.date === new Date().toISOString().slice(0, 10);
                      const dow = (new Date(c.date + "T00:00:00").getDay() + 6) % 7; // 0 = Mon
                      const nextCell = cells[i + 1];
                      const nextKcal = nextCell ? data.totals.get(nextCell.date) : undefined;
                      const nextOk = nextKcal != null && nextKcal > data.goal - 500 && nextKcal <= data.goal + 100;
                      const connRight = ok && nextOk && dow < 6;
                      return (
                        <div key={c.date} className="relative aspect-square">
                          {/* connector drawn behind the circles – only within the same week */}
                          {connRight && <span className="absolute left-1/2 top-1/2 -translate-y-1/2 w-full h-[5px] bg-emerald-500 rounded-full" />}
                          <div
                            title={kcal != null ? `${c.date}: ${kcal} kcal` : c.date}
                            className={`absolute inset-[3px] z-10 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                              low
                                ? "bg-white dark:bg-zinc-100 text-zinc-700 border-2 border-zinc-300"
                                : ok
                                  ? "bg-emerald-500 text-white"
                                  : over
                                    ? "bg-red-500 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                            } ${isToday ? "ring-2 ring-blue-500" : ""}`}
                          >
                            {c.day}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex items-center justify-center gap-3 flex-wrap text-[9px] font-bold text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-white border border-zinc-400 dark:bg-zinc-100 inline-block" /> {t("cal.legendUnder")} (≤ {data.goal - 500})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {t("cal.legendOk")}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> {t("cal.legendOver")} (≥ {data.goal + 101})
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
          </>
        )}
        </AnimatePresence>

        {/* Lightbox – zväčšený odznak po long-press */}
        <AnimatePresence>
          {previewRank && (
            <motion.div
              key="lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewRank(null)}
              className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-6"
            >
              <motion.img
                key={previewRank}
                initial={{ scale: 0.7, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    filter: [
                      `drop-shadow(0 0 30px ${RANKS.find((x) => x.key === previewRank)?.color ?? "#fff"}dd)`,
                      `drop-shadow(0 0 70px ${RANKS.find((x) => x.key === previewRank)?.color ?? "#fff"})`,
                      `drop-shadow(0 0 30px ${RANKS.find((x) => x.key === previewRank)?.color ?? "#fff"}dd)`,
                    ],
                  }}
                transition={{ scale: { type: "spring", stiffness: 220, damping: 18 }, filter: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }}
                src={`/ranks/${previewRank}.png?v=6`}
                alt={t(`rank.${previewRank}`)}
                className="max-h-[55vh] max-w-full object-contain"
                draggable={false}
              />
              <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }} className="text-center mt-5 w-full max-w-xs">
                <div className="text-2xl font-black text-white">{t(`rank.${previewRank}`)}</div>
                <div className="text-sm font-semibold text-zinc-400 mt-1">{t(`rank.${previewRank}.desc`)}</div>

                {/* progress v rámci ranku – podľa aktuálnych bodov */}
                {(() => {
                  const pr = RANKS.find((x) => x.key === previewRank)!;
                  const idx = RANKS.indexOf(pr);
                  const next = RANKS[idx + 1] ?? null;
                  let progress = 0;
                  let label = "";
                  if (!next || points >= next.min) {
                    progress = points >= pr.min ? 1 : 0;
                    label = points >= pr.min ? t("rank.max") : `${t("rank.need")} ${pr.min - points} ${t("rank.pointsShort")}`;
                  } else if (points >= pr.min) {
                    progress = (points - pr.min) / (next.min - pr.min);
                    label = `${next.min - points} ${t("rank.next")}`;
                  } else {
                    progress = 0;
                    label = `${t("rank.need")} ${pr.min - points} ${t("rank.pointsShort")}`;
                  }
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 mb-1">
                        <span>{pr.min}+</span>
                        <span>{label}</span>
                        <span>{next ? `${next.min}+` : "🏆"}</span>
                      </div>
                      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${points >= pr.min ? "bg-gradient-to-r from-fitcal-mint to-fitcal-orange" : "bg-zinc-600"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(progress * 100)}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-zinc-500 mt-1.5">
                        {points} {t("stats.points").toLowerCase()}
                      </div>
                    </div>
                  );
                })()}

                <div className="text-xs font-bold text-zinc-500 mt-3">{locale === "sk" ? "Kdekoľvek ťukni pre zatvorenie" : "Tap anywhere to close"}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ClientPortal>
    </>
  );
}
