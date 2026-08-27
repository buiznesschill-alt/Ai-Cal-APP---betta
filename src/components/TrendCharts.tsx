"use client";
import { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { BUS, onBus } from "@/lib/bus";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { InfoHint } from "@/components/InfoHint";

const COLORS = ["#00C896", "#F59E0B", "#FF8A3D"];

export function TrendCharts({ userId }: { userId: string }) {
  const { t, locale } = useI18n();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const grid = dark ? "#27272A" : "#f3f4f6";
  const tickFill = dark ? "#A1A1AA" : "#3F3F46";
  const tipStyle = { borderRadius: 16, border: dark ? "1px solid #3F3F46" : "1px solid #e5e7eb", fontSize: 12, fontWeight: 600 as const, backgroundColor: dark ? "#18181B" : "#ffffff", color: dark ? "#F4F4F5" : "#1A1C1E" };

  // custom top banner tooltip – rendered manually above chart, never overlaps dots
  const [range, setRange] = useState<"7" | "30">("7");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [activeKcal, setActiveKcal] = useState<number | null>(null);
  const [activeKcalPos, setActiveKcalPos] = useState<{ x: number; y: number } | null>(null);
  const [activeWeight, setActiveWeight] = useState<number | null>(null);
  const [activeWeightPos, setActiveWeightPos] = useState<{ x: number; y: number } | null>(null);
  const [activeMacro, setActiveMacro] = useState<number | null>(null);
  const [macroTip, setMacroTip] = useState<{ x: number; side: "left" | "right" } | null>(null);
  const macroRef = useRef<HTMLDivElement | null>(null);
  const [activeSplit, setActiveSplit] = useState<number | null>(null);
  const [splitPos, setSplitPos] = useState<{ x: number; y: number } | null>(null);
  const splitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/weights?limit=90")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setWeights(Array.isArray(d.weights) ? d.weights : []))
      .catch(() => {});
  }, [range]);

  // auto-close floating windows after 5s
  useEffect(() => {
    if (activeKcal === null) return;
    const t = setTimeout(() => { setActiveKcal(null); setActiveKcalPos(null); }, 5000);
    return () => clearTimeout(t);
  }, [activeKcal]);
  useEffect(() => {
    if (activeWeight === null) return;
    const t = setTimeout(() => { setActiveWeight(null); setActiveWeightPos(null); }, 5000);
    return () => clearTimeout(t);
  }, [activeWeight]);
  useEffect(() => {
    if (activeMacro === null) return;
    const t = setTimeout(() => { setActiveMacro(null); setMacroTip(null); }, 5000);
    return () => clearTimeout(t);
  }, [activeMacro]);
  useEffect(() => {
    if (activeSplit === null) return;
    const t = setTimeout(() => { setActiveSplit(null); setSplitPos(null); }, 5000);
    return () => clearTimeout(t);
  }, [activeSplit]);

  const handleMacroClick = (i: number) => (e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    // anchor the tooltip to the OUTER edge of the clicked bar group so it never overlaps it
    const wrap = macroRef.current;
    if (wrap) {
      const w = wrap.getBoundingClientRect();
      const r = e.currentTarget.getBoundingClientRect();
      const cx = r.left + r.width / 2 - w.left;
      const side: "left" | "right" = cx > w.width / 2 ? "left" : "right";
      const x = side === "right" ? r.right - w.left : r.left - w.left;
      setMacroTip({ x, side });
    }
    setActiveMacro((prev) => (prev === i ? null : i));
  };

  const handleSplitClick = (i: number) => (e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    const wrap = splitRef.current;
    if (!wrap) return;
    const r = e.currentTarget.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    setSplitPos({ x: r.left + r.width / 2 - w.left, y: r.top + r.height / 2 - w.top });
    setActiveSplit((prev) => (prev === i ? null : i));
  };

  const macroCellStyle = (i: number) =>
    ({
      cursor: "pointer",
      ...(activeMacro === i ? { filter: "saturate(1.5) brightness(1.15)" } : null),
      ...(activeMacro !== null && activeMacro !== i ? { pointerEvents: "none" } : null),
    }) as any;


  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/meals?limit=200`);
      const j = await res.json();
      const meals: any[] = j.meals || [];
      // group by date
      const map: Record<string, { kcal: number; protein: number; carbs: number; fat: number; count: number }> = {};
      for (const m of meals) {
        if (!map[m.date]) map[m.date] = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
        map[m.date].kcal += m.kcal;
        map[m.date].protein += m.protein;
        map[m.date].carbs += m.carbs;
        map[m.date].fat += m.fat;
        map[m.date].count += 1;
      }
      const sorted = Object.entries(map)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-(range === "7" ? 7 : 30))
        .map(([date, v]) => ({
          date: new Date(date).toLocaleDateString(locale === "sk" ? "sk-SK" : "en-GB", { month: "short", day: "numeric" }),
          rawDate: date,
          kcal: v.kcal,
          protein: v.protein,
          carbs: v.carbs,
          fat: v.fat,
        }));
      setData(sorted);
    } catch {}
    if (!silent) setLoading(false);
  }, [range, locale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // instant refresh when a meal is added/edited/deleted anywhere in the app (no skeleton flash)
  useEffect(() => onBus(BUS.meals, () => loadData(true)), [loadData]);

  const avgKcal = data.length ? Math.round(data.reduce((s, d) => s + d.kcal, 0) / data.length) : 0;
  const totalProtein = data.reduce((s, d) => s + d.protein, 0);
  const totalCarbs = data.reduce((s, d) => s + d.carbs, 0);
  const totalFat = data.reduce((s, d) => s + d.fat, 0);
  const pieData =
    totalProtein + totalCarbs + totalFat > 0
      ? [
          { name: t("trends.protein"), value: totalProtein },
          { name: t("trends.carbs"), value: totalCarbs },
          { name: t("trends.fat"), value: totalFat },
        ]
      : [];

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
        <div className="h-40 sm:h-48 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6 text-center">
        <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg sm:text-xl mb-3">📈</div>
        <p className="font-bold text-sm sm:text-base">{t("trends.title")}</p>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">{t("trends.noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6 space-y-4 sm:space-y-6" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-lg">{t("trends.title")}</h3>
          <p className="text-xs font-semibold text-zinc-500">{t("trends.subtitle")} • {t("trends.avgKcal")}: {avgKcal} {t("trends.kcal")}</p>
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full">
          {(["7", "30"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setRange(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${range === v ? "bg-white shadow text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {v === "7" ? t("trends.last7") : t("trends.last30")}
            </button>
          ))}
        </div>
      </div>

      <div>
          <div className="flex items-center gap-1.5 mb-2">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500">{t("trends.kcalTrend")}</h4>
            <InfoHint text={t("trends.kcalInfo")} label={t("trends.kcalTrend")} />
          </div>
        <div className="h-48 -mx-1 relative" onClick={() => { setActiveKcal(null); setActiveKcalPos(null); }}>
          {activeKcal !== null && data[activeKcal] && activeKcalPos && (
            (() => {
              const nextHigher = activeKcal < data.length - 1 && data[activeKcal + 1].kcal > data[activeKcal].kcal;
              const isLeft = activeKcal < 2;
              const isRight = activeKcal > data.length - 3;
              const tx = isLeft ? "8px" : isRight ? "calc(-100% - 8px)" : "-50%";
              const ty = nextHigher ? "12px" : "calc(-100% - 12px)";
              return (
                <div className="absolute z-10 px-3 py-2 rounded-xl shadow-lg border text-xs font-bold pointer-events-none whitespace-nowrap" style={{ ...tipStyle, padding: "8px 12px", left: activeKcalPos.x, top: activeKcalPos.y, transform: `translate(${tx}, ${ty})`, lineHeight: 1.2, minWidth: 90 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap" }}>{data[activeKcal].date}</div>
                  <div style={{ color: "#00C896", fontWeight: 700, whiteSpace: "nowrap" }}>{data[activeKcal].kcal} kcal</div>
                </div>
              );
            })()
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 600, fill: tickFill }} axisLine={false} tickLine={false} interval={0} tickMargin={6} />
              <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} width={34} tickMargin={4} />
              <Tooltip content={() => null} cursor={{ stroke: "transparent", fill: "transparent" }} />
              <Line
                type="monotone"
                dataKey="kcal"
                stroke="#00C896"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, index } = props;
                  const isActive = index === activeKcal;
                  return (
                    <g key={`dot-${index}`}>
                      <circle cx={cx} cy={cy} r={isActive ? 6.5 : 4} fill="#00C896" stroke={isActive ? "#fff" : "none"} strokeWidth={isActive ? 2 : 0} style={{ pointerEvents: "none", filter: isActive ? "drop-shadow(0 1px 4px rgba(0,0,0,0.2))" : undefined }} />
                      {/* invisible larger hit area for easier clicking */}
                      <circle cx={cx} cy={cy} r={14} fill="transparent" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); if (isActive) { setActiveKcal(null); setActiveKcalPos(null); } else { setActiveKcal(index); setActiveKcalPos({ x: cx, y: cy }); } }} />
                    </g>
                  );
                }}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
          <div className="flex items-center gap-1.5 mb-2">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500">{t("trends.macroTrend")}</h4>
            <InfoHint text={t("trends.macroTrendInfo")} label={t("trends.macroTrend")} />
          </div>
        <div ref={macroRef} className="h-48 -mx-1 relative" onClick={() => { setActiveMacro(null); setMacroTip(null); }}>
          {activeMacro !== null && data[activeMacro] && macroTip && (() => {
            // open the floating window BESIDE the selected day so its bars stay fully visible
            const tx = macroTip.side === "right" ? "10px" : "calc(-100% - 10px)";
            return (
              <div className="absolute z-10 px-3 py-2 rounded-xl shadow-lg border text-xs font-bold pointer-events-none whitespace-nowrap" style={{ ...tipStyle, padding: "8px 12px", left: macroTip.x, top: 8, transform: `translate(${tx}, 0)`, display: "grid", gridTemplateColumns: "auto auto", columnGap: 8, rowGap: 3, alignItems: "center" }}>
                <span style={{ color: "#10B981", fontWeight: 700 }}>● {t("trends.protein")}</span>
                <span>{data[activeMacro].protein} g</span>
                <span style={{ color: "#F59E0B", fontWeight: 700 }}>● {t("trends.carbs")}</span>
                <span>{data[activeMacro].carbs} g</span>
                <span style={{ color: "#FF8A3D", fontWeight: 700 }}>● {t("trends.fat")}</span>
                <span>{data[activeMacro].fat} g</span>
              </div>
            );
          })()}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
              barCategoryGap="20%"
              onClick={(s: any, e: any) => {
                e?.stopPropagation?.();
                const idx = s?.activeTooltipIndex;
                if (typeof idx === "number" && data[idx]) {
                  const wrap = macroRef.current;
                  if (wrap && typeof e?.clientX === "number") {
                    const w = wrap.getBoundingClientRect();
                    const px = Math.min(Math.max(e.clientX - w.left, 20), Math.max(w.width - 20, 20));
                    setMacroTip({ x: px, side: px > w.width / 2 ? "left" : "right" });
                  }
                  setActiveMacro((prev) => (prev !== null ? null : idx));
                } else {
                  setActiveMacro(null);
                  setMacroTip(null);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} interval={0} tickMargin={6} />
              <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} width={34} tickMargin={4} />
              <Tooltip content={() => null} cursor={{ fill: "transparent" }} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11, fontWeight: 600, color: dark ? "#F4F4F5" : undefined }} />
              <Bar dataKey="protein" name={t("trends.protein")} radius={[8, 8, 0, 0]} fill="#0EA371">
                {data.map((_, i) => (
                  <Cell key={`p-${i}`} fill="#10B981" fillOpacity={activeMacro === null || activeMacro === i ? 1 : 0} stroke={activeMacro === i ? "#0B7A56" : "none"} strokeWidth={activeMacro === i ? 1 : 0} onClick={handleMacroClick(i)} style={macroCellStyle(i)} />
                ))}
              </Bar>
              <Bar dataKey="carbs" name={t("trends.carbs")} radius={[8, 8, 0, 0]} fill="#F59E0B">
                {data.map((_, i) => (
                  <Cell key={`c-${i}`} fill="#F59E0B" fillOpacity={activeMacro === null || activeMacro === i ? 1 : 0} stroke={activeMacro === i ? "#B45309" : "none"} strokeWidth={activeMacro === i ? 1 : 0} onClick={handleMacroClick(i)} style={macroCellStyle(i)} />
                ))}
              </Bar>
              <Bar dataKey="fat" name={t("trends.fat")} radius={[8, 8, 0, 0]} fill="#FF6B2D">
                {data.map((_, i) => (
                  <Cell key={`f-${i}`} fill="#FF8A3D" fillOpacity={activeMacro === null || activeMacro === i ? 1 : 0} stroke={activeMacro === i ? "#C2410C" : "none"} strokeWidth={activeMacro === i ? 1 : 0} onClick={handleMacroClick(i)} style={macroCellStyle(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {pieData.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <h4 className="text-xs font-bold tracking-widest text-zinc-500">{t("trends.macroSplit")}</h4>
            <InfoHint text={t("trends.macroSplitInfo")} label={t("trends.macroSplitInfoLabel")} />
          </div>
          <div ref={splitRef} className="h-48 relative" onClick={() => { setActiveSplit(null); setSplitPos(null); }}>
            {activeSplit !== null && pieData[activeSplit] && splitPos && (() => {
              const total = pieData.reduce((s, d) => s + d.value, 0);
              const d = pieData[activeSplit];
              const isRight = splitPos.x >= (splitRef.current?.clientWidth ?? 0) / 2;
              const isBottom = splitPos.y >= (splitRef.current?.clientHeight ?? 0) / 2;
              const tx = isRight ? "10px" : "calc(-100% - 10px)";
              const ty = isBottom ? "10px" : "calc(-100% - 10px)";
              return (
                <div className="absolute z-10 rounded-2xl shadow-lg px-3.5 py-2.5 text-xs font-bold pointer-events-none whitespace-nowrap" style={{ ...tipStyle, borderRadius: 18, left: splitPos.x, top: splitPos.y, transform: `translate(${tx}, ${ty})`, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.name}</div>
                  <div style={{ color: COLORS[activeSplit % COLORS.length] }}>● {Math.round(d.value)} g • {total ? Math.round((d.value / total) * 100) : 0} %</div>
                </div>
              );
            })()}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg sm:text-xl font-black leading-none">{Math.round(totalProtein + totalCarbs + totalFat)} g</span>
              <span className="mt-0.5 text-[10px] font-semibold text-zinc-500">{t("trends.totalMacros")}</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} onClick={handleSplitClick(i)} style={({ cursor: "pointer", ...(activeSplit === i ? { filter: "saturate(1.4) brightness(1.08)", stroke: "#fff", strokeWidth: 2 } : null) }) as any} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Beta: weight trend */}
      {weights.length >= 2 && (
        <div>
          <h4 className="text-xs font-bold tracking-widest text-zinc-500 mb-2">⚖️ {t("weight.trend")}</h4>
          <div className="h-48 -mx-1 relative" onClick={() => { setActiveWeight(null); setActiveWeightPos(null); }}>
            {activeWeight !== null && [...weights].reverse()[activeWeight] && activeWeightPos && (
              (() => {
                const wData = [...weights].reverse();
                const nextHigherW = activeWeight < wData.length - 1 && wData[activeWeight + 1].kg > wData[activeWeight].kg;
                const isLeftW = activeWeight < 2;
                const isRightW = activeWeight > wData.length - 3;
                const txW = isLeftW ? "8px" : isRightW ? "calc(-100% - 8px)" : "-50%";
                const tyW = nextHigherW ? "12px" : "calc(-100% - 12px)";
                return (
                  <div className="absolute z-10 px-3 py-2 rounded-xl shadow-lg border text-xs font-bold pointer-events-none whitespace-nowrap" style={{ ...tipStyle, padding: "8px 12px", left: activeWeightPos.x, top: activeWeightPos.y, transform: `translate(${txW}, ${tyW})`, lineHeight: 1.2, minWidth: 90 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap" }}>{wData[activeWeight].date.slice(5)}</div>
                    <div style={{ color: "#3B82F6", fontWeight: 700, whiteSpace: "nowrap" }}>{wData[activeWeight].kg} kg</div>
                  </div>
                );
              })()
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...weights].reverse().map((w) => ({ date: w.date.slice(5), kg: w.kg }))} margin={{ top: 5, right: 10, bottom: 12, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 600, fill: tickFill }} axisLine={false} tickLine={false} interval={0} tickMargin={6} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} width={34} tickMargin={4} />
                <Tooltip content={() => null} cursor={{ stroke: "transparent", fill: "transparent" }} />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    const isActive = index === activeWeight;
                    return (
                      <g key={`wdot-${index}`}>
                        <circle cx={cx} cy={cy} r={isActive ? 6.5 : 4} fill="#3B82F6" stroke={isActive ? "#fff" : "none"} strokeWidth={isActive ? 2 : 0} style={{ pointerEvents: "none" }} />
                        {/* invisible larger hit area for easier clicking */}
                        <circle cx={cx} cy={cy} r={14} fill="transparent" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); if (isActive) { setActiveWeight(null); setActiveWeightPos(null); } else { setActiveWeight(index); setActiveWeightPos({ x: cx, y: cy }); } }} />
                      </g>
                    );
                  }}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
