"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useSectionDisplay } from "@/lib/display";
import { ClientPortal } from "@/components/ClientPortal";

const TIP_KEYS = ["tips.tip1", "tips.tip2", "tips.tip3", "tips.tip4", "tips.tip5", "tips.tip6", "tips.tip7", "tips.tip8"] as const;

// Verified tips from WHO, Mayo Clinic, Harvard, Sleep Foundation, Diabetes Care
type DetailedTip = {
  id: string;
  icon: string;
  categorySk: string;
  categoryEn: string;
  titleSk: string;
  titleEn: string;
  summarySk: string;
  summaryEn: string;
  detailSk: string;
  detailEn: string;
  source: string;
  sourceUrl: string;
};

const DETAILED_TIPS: DetailedTip[] = [
  {
    id: "water",
    icon: "💧",
    categorySk: "Hydratácia",
    categoryEn: "Hydration",
    titleSk: "Pite dosť vody",
    titleEn: "Stay hydrated",
    summarySk: "30-35 ml na kg váhy denne",
    summaryEn: "30-35 ml per kg daily",
    detailSk: "WHO odporúča 2-2.5 l denne pre dospelých. Začnite deň pohárom vody, pite pravidelne, nie až keď ste smädní. Dehydratácia znižuje výkon o 20% a zvyšuje únavu. Sledujte farbu moču — svetložltá je ideál. Pri športe pridajte 500 ml na hodinu aktivity.",
    detailEn: "WHO recommends 2-2.5 L daily for adults. Start day with a glass of water, drink regularly, not only when thirsty. Dehydration reduces performance by 20% and increases fatigue. Check urine color — pale yellow is ideal. Add 500 ml per hour of exercise.",
    source: "WHO, Mayo Clinic",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  {
    id: "slow-eating",
    icon: "🍽️",
    categorySk: "Stravovanie",
    categoryEn: "Eating",
    titleSk: "Jedzte pomaly bez displeja",
    titleEn: "Eat slowly, no screens",
    summarySk: "15-20 min na signál sýtosti",
    summaryEn: "15-20 min for satiety",
    detailSk: "Harvard T.H. Chan: mozog potrebuje 20 min na registráciu sýtosti. Jedzte bez telefónu/TV, žujte 20-30x, odkladajte príbor. Ľudia jediaci rýchlo zjedia o 300 kcal viac. Vyskúšajte mindful eating — všímajte si chuť, vôňu, textúru.",
    detailEn: "Harvard T.H. Chan: brain needs 20 min to register satiety. Eat without phone/TV, chew 20-30x, put down utensils. Fast eaters consume 300 kcal more. Try mindful eating — notice taste, smell, texture.",
    source: "Harvard, AJCN",
    sourceUrl: "https://www.hsph.harvard.edu/nutritionsource/mindful-eating/",
  },
  {
    id: "protein-veg",
    icon: "🥗",
    categorySk: "Makrá",
    categoryEn: "Macros",
    titleSk: "Bielkoviny + zelenina ku každému jedlu",
    titleEn: "Protein + veggies every meal",
    summarySk: "Zasýti na dlhšie, stabilný cukor",
    summaryEn: "Keeps full longer, stable sugar",
    detailSk: "Mayo Clinic: 20-30 g bielkovín na jedlo + 200 g zeleniny = sýtost na 4h, menej výkyvov glykémie. Ideálne: kuracie/ryby/strukoviny + šalát/brokolica. Vláknina zo zeleniny (25-30 g denne) znižuje cholesterol a riziko cukrovky o 30%.",
    detailEn: "Mayo Clinic: 20-30 g protein per meal + 200 g veggies = 4h satiety, fewer glucose swings. Ideal: chicken/fish/legumes + salad/broccoli. Veg fiber (25-30 g daily) lowers cholesterol and diabetes risk by 30%.",
    source: "Mayo Clinic, Diabetes Care",
    sourceUrl: "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating",
  },
  {
    id: "sleep",
    icon: "😴",
    categorySk: "Spánok",
    categoryEn: "Sleep",
    titleSk: "Spite 7-9 hodín",
    titleEn: "Sleep 7-9 hours",
    summarySk: "Málo spánku = +30% chuť na sladké",
    summaryEn: "Less sleep = +30% cravings",
    detailSk: "Nedostatok spánku zvyšuje ghrelín (hormón hladu) o 15% a znižuje leptín o 15% — výsledok +300 kcal denne. WHO: 7-9h, konzistentný čas, tma a chlad (18-19°C), bez obrazovky 1h pred spaním. Kvalitný spánok zlepšuje regeneráciu aj imunitu.",
    detailEn: "Lack of sleep raises ghrelin 15% and lowers leptin 15% — result +300 kcal daily. WHO: 7-9h, consistent time, dark & cool (18-19°C), no screens 1h before bed. Quality sleep improves recovery and immunity.",
    source: "WHO, Sleep Foundation",
    sourceUrl: "https://www.sleepfoundation.org/how-sleep-works/why-do-we-need-sleep",
  },
  {
    id: "walk",
    icon: "🚶",
    categorySk: "Pohyb",
    categoryEn: "Movement",
    titleSk: "10 min chôdze po jedle",
    titleEn: "10 min walk after meal",
    summarySk: "Lepšie trávenie aj cukor v krvi",
    summaryEn: "Better digestion & sugar",
    detailSk: "Diabetes Care: 10 min chôdze po jedle zníži glykémiu o 22% a inzulín o 12% vs sedenie. Stačí pomalé tempo, nie beh. Pomáha aj proti nafukovaniu a zlepšuje náladu. Ideálne 3x denne po hlavných jedlách.",
    detailEn: "Diabetes Care: 10 min walk after meal cuts glucose 22% and insulin 12% vs sitting. Slow pace is enough, not running. Helps bloating and mood. Ideal 3x daily after main meals.",
    source: "Diabetes Care, Sports Medicine",
    sourceUrl: "https://diabetesjournals.org/care/article/39/11/2065/37273",
  },
  {
    id: "mealprep",
    icon: "🍱",
    categorySk: "Plánovanie",
    categoryEn: "Planning",
    titleSk: "Priprav si jedlo večer",
    titleEn: "Meal prep in evening",
    summarySk: "Ušetríš čas aj kalórie",
    summaryEn: "Saves time and calories",
    detailSk: "Štúdie: ľudia s meal prep jedia o 25% menej fast foodu a ušetria 5h týždenne. Priprav si krabičky na 2 dni — bielkovina + príloha + zelenina. Použi sklo, chladnička 3-4 dni, mrazák 1 mesiac. Plán = menej impulzívnych rozhodnutí.",
    detailEn: "Studies: meal preppers eat 25% less fast food and save 5h weekly. Prep 2 days — protein + side + veg. Use glass, fridge 3-4 days, freezer 1 month. Plan = fewer impulsive choices.",
    source: "Am. J. Preventive Medicine",
    sourceUrl: "https://www.ajpmonline.org/article/S0749-3797(17)30014-7/fulltext",
  },
  {
    id: "fiber",
    icon: "🌾",
    categorySk: "Vláknina",
    categoryEn: "Fiber",
    titleSk: "Vláknina 25-30 g denne",
    titleEn: "Fiber 25-30 g daily",
    summarySk: "Ovocie, zelenina, celozrnné",
    summaryEn: "Fruits, veggies, whole grains",
    detailSk: "WHO: 400 g ovocia/zeleniny denne + celozrnné znižuje riziko srdcových chorôb o 30%, cukrovky o 20%. Vláknina sýti, kŕmi mikrobióm, spomaľuje cukor. Pridaj chia/ovsené vločky/strukoviny. Zvyšuj postupne + voda.",
    detailEn: "WHO: 400 g fruits/veggies daily + whole grains cuts heart disease 30%, diabetes 20%. Fiber satiates, feeds microbiome, slows sugar. Add chia/oats/legumes. Increase gradually + water.",
    source: "WHO, Lancet",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  {
    id: "fats",
    icon: "🥑",
    categorySk: "Tuky",
    categoryEn: "Fats",
    titleSk: "Neboj sa zdravých tukov",
    titleEn: "Don't fear healthy fats",
    summarySk: "Orechy, olivový olej, ryby",
    summaryEn: "Nuts, olive oil, fish",
    detailSk: "Harvard: nenasýtené tuky (orechy 30 g denne, olivový olej, losos 2x týždenne) znižujú LDL a zápal, chránia mozog. Vyhýbaj sa trans tukom (vyprážané, margarín). Tuk sýti a pomáha vstrebávať vitamíny A/D/E/K.",
    detailEn: "Harvard: unsaturated fats (nuts 30 g daily, olive oil, salmon 2x weekly) lower LDL and inflammation, protect brain. Avoid trans fats (fried, margarine). Fat satiates and helps absorb vitamins A/D/E/K.",
    source: "Harvard, AHA",
    sourceUrl: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats",
  },
  {
    id: "sugar",
    icon: "🍬",
    categorySk: "Cukor",
    categoryEn: "Sugar",
    titleSk: "Cukor pod 10% kalórií",
    titleEn: "Sugar under 10% calories",
    summarySk: "Max 50 g denne, ideál 25 g",
    summaryEn: "Max 50 g daily, ideal 25 g",
    detailSk: "WHO: nad 50 g cukru denne (10% z 2000 kcal) zvyšuje kazivosť, obezitu, cukrovku. Ideál <25 g. Pozor na skrytý cukor v nápojoch (cola 35 g/330 ml), jogurtoch, omáčkach. Nahraď ovocím a vodou.",
    detailEn: "WHO: over 50 g sugar daily (10% of 2000 kcal) raises caries, obesity, diabetes. Ideal <25 g. Watch hidden sugar in drinks (cola 35 g), yogurts, sauces. Replace with fruit and water.",
    source: "WHO Sugars Guideline",
    sourceUrl: "https://www.who.int/publications/i/item/9789241549028",
  },
  {
    id: "strength",
    icon: "💪",
    categorySk: "Sila",
    categoryEn: "Strength",
    titleSk: "Silový tréning 2x týždenne",
    titleEn: "Strength 2x weekly",
    summarySk: "Svaly = vyšší bazál",
    summaryEn: "Muscle = higher BMR",
    detailSk: "Mayo Clinic: 2x týždenne silový tréning (vlastná váha, činky) udrží svaly, zvýši bazálny metabolizmus o 7-8%, spevní kosti, zlepší citlivosť na inzulín. Stačí 20-30 min, full body. Kombinuj s 150 min chôdze týždenne.",
    detailEn: "Mayo Clinic: 2x weekly strength (bodyweight, weights) keeps muscle, raises BMR 7-8%, strengthens bones, improves insulin sensitivity. 20-30 min full body is enough. Combine with 150 min walk weekly.",
    source: "Mayo Clinic, WHO",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
  },
  {
    id: "mindful",
    icon: "🧘",
    categorySk: "Mind",
    categoryEn: "Mind",
    titleSk: "Stres a mindful jedenie",
    titleEn: "Stress & mindful eating",
    summarySk: "Stres = prejedanie",
    summaryEn: "Stress = overeating",
    detailSk: "Stres zvyšuje kortizol a chuť na vysokokalorické jedlá. Skús 5 min dýchania denne, prechádzku v prírode, denník vďačnosti. Mindful jedenie: pred jedlom 3 hlboké nádychy, jedz pomaly, pýtaj sa 'som hladný alebo unavený?'",
    detailEn: "Stress raises cortisol and cravings for high-calorie foods. Try 5 min breathing daily, nature walk, gratitude journal. Mindful eating: 3 deep breaths before meal, eat slowly, ask 'hungry or tired?'",
    source: "Harvard Health",
    sourceUrl: "https://www.health.harvard.edu/staying-healthy/why-stress-causes-people-to-overeat",
  },
  {
    id: "alcohol",
    icon: "🍷",
    categorySk: "Alkohol",
    categoryEn: "Alcohol",
    titleSk: "Alkohol s mierou",
    titleEn: "Alcohol in moderation",
    summarySk: "Prázdne kalórie + chuťovky",
    summaryEn: "Empty calories + snacks",
    detailSk: "1 g alkoholu = 7 kcal, bez živín, spomaľuje spaľovanie tuku o 73%. WHO: max 1-2 jednotky denne, 2 dni bez. Pivo 500 ml = 200 kcal, víno 200 ml = 160 kcal. Alkohol zvyšuje chuť na slané/tučné.",
    detailEn: "1 g alcohol = 7 kcal, no nutrients, slows fat burning 73%. WHO: max 1-2 units daily, 2 days off. Beer 500 ml = 200 kcal, wine 200 ml = 160 kcal. Alcohol raises craving for salty/fatty.",
    source: "WHO, BJN",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/alcohol",
  },
];

export function HealthTips({ onShowAll }: { onShowAll?: () => void } = {}) {
  const { t, locale } = useI18n();
  const [idx, setIdx] = useState(0);
  const [advIdx, setAdvIdx] = useState(0);
  const [selected, setSelected] = useState<DetailedTip | null>(null);

  const prevTip = () => setIdx((i) => (i - 1 + TIP_KEYS.length) % TIP_KEYS.length);
  const nextTip = () => setIdx((i) => (i + 1) % TIP_KEYS.length);
  const prevAdv = () => setAdvIdx((i) => (i - 1 + DETAILED_TIPS.length) % DETAILED_TIPS.length);
  const nextAdv = () => setAdvIdx((i) => (i + 1) % DETAILED_TIPS.length);

  const arrowCls =
    "h-8 w-8 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 active:scale-95 flex items-center justify-center font-black text-zinc-600 dark:text-zinc-300 hover:text-fitcal-mintDark dark:hover:text-emerald-300 transition";

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-5" suppressHydrationWarning>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">💚 {t("tips.title")}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {onShowAll && (
              <button
                onClick={onShowAll}
                className="text-[10px] sm:text-[11px] font-bold bg-fitcal-mint hover:brightness-95 active:scale-95 text-white px-2.5 py-1 rounded-full transition"
              >
                {t("tips.showAll")} →
              </button>
            )}
            <span className="text-[10px] sm:text-[11px] font-bold bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 px-2 py-1 rounded-full">{t("tips.dailyTip")}</span>
          </div>
        </div>

        {/* Tip carousel – manual navigation with arrows */}
        <div className="mt-3 flex items-stretch gap-2">
          <button onClick={prevTip} aria-label={locale === "sk" ? "Predchádzajúci tip" : "Previous tip"} className={`${arrowCls} self-center`}>←</button>
          <div className="flex-1 min-w-0 text-left rounded-2xl bg-fitcal-mintLight dark:bg-emerald-500/10 border border-fitcal-mint/20 dark:border-emerald-500/20 p-3">
            <p className="text-xs sm:text-sm font-medium leading-snug text-zinc-700 dark:text-zinc-200 line-clamp-4">{t(TIP_KEYS[idx])}</p>
            <p className="text-[10px] font-bold text-zinc-400 mt-1.5">{idx + 1} / {TIP_KEYS.length}</p>
          </div>
          <button onClick={nextTip} aria-label={locale === "sk" ? "Ďalší tip" : "Next tip"} className={`${arrowCls} self-center`}>→</button>
        </div>
        <div className="flex justify-center gap-1 mt-2">
          {TIP_KEYS.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`tip ${i + 1}`} className={`h-1.5 rounded-full transition ${i === idx ? "w-5 bg-fitcal-mint" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"}`} />
          ))}
        </div>

        {/* Verified advice – one card at a time, manual navigation */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-bold text-xs sm:text-sm">📚 {locale === "sk" ? "Overené rady" : "Verified advice"}</h4>
            <span className="text-[9px] font-bold bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-1.5 py-0.5 rounded-full">WHO • Mayo • Harvard</span>
          </div>
          <p className="text-[10px] font-medium text-zinc-500 mt-0.5">{locale === "sk" ? "Klikni pre detail" : "Tap for detail"}</p>
          <div className="mt-2 flex items-stretch gap-2">
            <button onClick={prevAdv} aria-label={locale === "sk" ? "Predchádzajúca rada" : "Previous advice"} className={`${arrowCls} self-center`}>←</button>
            {(() => {
              const tip = DETAILED_TIPS[advIdx];
              return (
                <button
                  onClick={() => setSelected(tip)}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-md rounded-2xl p-3 text-left transition group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{tip.icon}</span>
                      <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase truncate">{locale === "sk" ? tip.categorySk : tip.categoryEn}</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 shrink-0">{advIdx + 1} / {DETAILED_TIPS.length}</span>
                  </div>
                  <div className="font-bold text-xs mt-1 line-clamp-2 group-hover:text-fitcal-mintDark">{locale === "sk" ? tip.titleSk : tip.titleEn}</div>
                  <div className="text-[11px] font-medium text-zinc-500 mt-0.5 line-clamp-2">{locale === "sk" ? tip.summarySk : tip.summaryEn}</div>
                  <div className="text-[10px] font-bold text-fitcal-mintDark mt-1.5">→ {locale === "sk" ? "Čítať viac" : "Read more"}</div>
                </button>
              );
            })()}
            <button onClick={nextAdv} aria-label={locale === "sk" ? "Ďalšia rada" : "Next advice"} className={`${arrowCls} self-center`}>→</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <TipDetailModal tip={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function TipDetailModal({ tip, onClose }: { tip: DetailedTip | null; onClose: () => void }) {
  const { locale, t } = useI18n();
  return (
    <ClientPortal active={!!tip}>
      <AnimatePresence>
      {tip && (
        <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-t-4xl p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="text-2xl sm:text-3xl">{tip.icon}</span>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">{locale === "sk" ? tip.categorySk : tip.categoryEn} • {tip.source}</p>
                  <h3 className="font-black text-base sm:text-lg leading-tight">{locale === "sk" ? tip.titleSk : tip.titleEn}</h3>
                  <p className="text-xs sm:text-sm font-medium text-zinc-500">{locale === "sk" ? tip.summarySk : tip.summaryEn}</p>
                </div>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center font-bold shrink-0">✕</button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-sm leading-relaxed font-medium text-zinc-700 dark:text-zinc-200">{locale === "sk" ? tip.detailSk : tip.detailEn}</p>
              <div className="bg-fitcal-mintLight dark:bg-emerald-500/10 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-fitcal-mintDark">✓ {locale === "sk" ? "Overený zdroj" : "Verified source"}</p>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{tip.source}</p>
                </div>
                <a href={tip.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-full px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 shrink-0">
                  {locale === "sk" ? "Zdroj →" : "Source →"}
                </a>
              </div>
              <button onClick={onClose} className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3 hover:bg-black dark:hover:bg-zinc-100">
                {t("common.close")}
              </button>
            </div>
          </motion.div>
        </motion.div>
        </>
      )}
        </AnimatePresence>
    </ClientPortal>
  );
}

type SavedRef = { id: string; kind: "tip" | "advice"; savedAt: number };
const SAVED_KEY = "fitcal_saved_tips"; // legacy local storage – migrated to account on first load
const TIPS_BATCH = 4;
const ADVICE_BATCH = 6;

function rotate<T>(arr: T[], by: number): T[] {
  const n = arr.length;
  if (n === 0) return arr;
  const off = ((by % n) + n) % n;
  return [...arr.slice(off), ...arr.slice(0, off)];
}

export function HealthTipsExpanded() {
  const { t, locale } = useI18n();
  const cols = useSectionDisplay("tips")[0] === "split" ? "lg:grid-cols-2" : "";
  const [selected, setSelected] = useState<DetailedTip | null>(null);
  const [tipOff, setTipOff] = useState(0);
  const [advOff, setAdvOff] = useState(0);
  const [saved, setSaved] = useState<SavedRef[]>([]);
  const [synced, setSynced] = useState(false);

  // Load from account (synced between devices); migrate legacy local data once
  useEffect(() => {
    let local: SavedRef[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      if (Array.isArray(raw)) local = raw.filter((x: any) => x && typeof x.id === "string" && (x.kind === "tip" || x.kind === "advice"));
    } catch {}
    fetch("/api/saved-tips")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const server: SavedRef[] = Array.isArray(d.refs) ? d.refs : [];
        if (server.length === 0 && local.length > 0) {
          setSaved(local);
          try {
            localStorage.removeItem(SAVED_KEY);
          } catch {}
        } else {
          setSaved(server);
        }
        setSynced(true);
      })
      .catch(() => setSynced(true));
  }, []);

  // Write-through to account on every change
  useEffect(() => {
    if (!synced) return;
    fetch("/api/saved-tips", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refs: saved }) }).catch(() => {});
  }, [saved, synced]);

  // Content rotates every day – refresh button reveals another batch
  const dayOffset = Math.floor(Date.now() / 86400000);

  const tipsPool = TIP_KEYS.map((k) => ({ id: k as string, text: t(k) }));
  const tipsShown = rotate(tipsPool, dayOffset + tipOff).slice(0, TIPS_BATCH);

  const adviceShown = rotate(DETAILED_TIPS, dayOffset * 3 + advOff).slice(0, ADVICE_BATCH);

  function toggleSave(id: string, kind: "tip" | "advice") {
    setSaved((s) => (s.some((x) => x.id === id && x.kind === kind) ? s.filter((x) => !(x.id === id && x.kind === kind)) : [{ id, kind, savedAt: Date.now() }, ...s]));
  }
  const isSaved = (id: string, kind: "tip" | "advice") => saved.some((x) => x.id === id && x.kind === kind);
  const savedTips = saved.filter((r) => r.kind === "tip");
  const savedAdvice = saved.filter((r) => r.kind === "advice");

  const saveBtnCls = (active: boolean) =>
    `h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs transition ${
      active ? "bg-fitcal-mint text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-800 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 text-zinc-400 dark:text-zinc-400 hover:text-fitcal-mintDark dark:hover:text-emerald-300"
    }`;

  const refreshBtn =
    "h-8 w-8 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-fitcal-mintLight dark:hover:bg-emerald-500/10 active:scale-90 flex items-center justify-center font-black text-zinc-500 dark:text-zinc-300 hover:text-fitcal-mintDark dark:hover:text-emerald-300 transition";

  const panelHead = (icon: string, title: string, count?: string) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <h3 className="font-extrabold text-sm sm:text-base truncate">{icon} {title}</h3>
        {count && <span className="text-[10px] font-bold bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">{count}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
        <h2 className="font-extrabold text-base sm:text-xl flex items-center gap-2">💚 {t("tips.title")}</h2>
        <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-0.5">{t("tips.subtitle")}</p>
      </div>

      {/* Two parts side by side on desktop */}
      <div className={`grid ${cols} gap-4 sm:gap-6 items-start`}>
        {/* Part 1: tips & tricks – daily rotation + refresh */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            {panelHead("💡", locale === "sk" ? "Tipy a triky" : "Tips & tricks", `${tipsShown.length}/${tipsPool.length}`)}
            <button onClick={() => setTipOff((o) => o + TIPS_BATCH)} aria-label={t("tips.refresh")} title={t("tips.refresh")} className={refreshBtn}>⟳</button>
          </div>
          <div className="mt-3 space-y-2">
            {tipsShown.map(({ id, text }, i) => {
              const num = TIP_KEYS.indexOf(id as any) + 1;
              return (
                <div key={id} className="flex gap-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-3">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-fitcal-mint text-white font-black text-xs flex items-center justify-center">{num}</span>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-200 flex-1 min-w-0">{text}</p>
                  <button
                    onClick={() => toggleSave(id, "tip")}
                    aria-label={isSaved(id, "tip") ? (locale === "sk" ? "Odstrániť z uložených" : "Remove from saved") : locale === "sk" ? "Uložiť" : "Save"}
                    className={saveBtnCls(isSaved(id, "tip"))}
                  >
                    {isSaved(id, "tip") ? "✓" : "+"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Part 2: verified advice – daily rotation + refresh */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            {panelHead("📚", locale === "sk" ? "Overené rady" : "Verified advice", `${adviceShown.length}/${DETAILED_TIPS.length}`)}
            <button onClick={() => setAdvOff((o) => o + ADVICE_BATCH)} aria-label={t("tips.refresh")} title={t("tips.refresh")} className={refreshBtn}>⟳</button>
          </div>
          <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
            {locale === "sk" ? "Klikni pre rozšírené informácie" : "Click for extended info"}
          </p>
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {adviceShown.map((tip) => {
              const active = isSaved(`adv:${tip.id}`, "advice");
              return (
                <div
                  key={tip.id}
                  onClick={() => setSelected(tip)}
                  className="cursor-pointer bg-zinc-50 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-md rounded-2xl p-3 transition group flex flex-col"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-lg">{tip.icon}</span>
                    <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase truncate flex-1">{locale === "sk" ? tip.categorySk : tip.categoryEn}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSave(`adv:${tip.id}`, "advice"); }}
                      aria-label={active ? (locale === "sk" ? "Odstrániť z uložených" : "Remove from saved") : locale === "sk" ? "Uložiť" : "Save"}
                      className={saveBtnCls(active)}
                    >
                      {active ? "✓" : "+"}
                    </button>
                  </div>
                  <div className="font-bold text-xs mt-1 group-hover:text-fitcal-mintDark">{locale === "sk" ? tip.titleSk : tip.titleEn}</div>
                  <div className="text-[11px] font-medium text-zinc-500 mt-0.5 line-clamp-2">{locale === "sk" ? tip.summarySk : tip.summaryEn}</div>
                  <div className="text-[10px] font-bold text-fitcal-mintDark mt-auto pt-1.5">→ {locale === "sk" ? "Čítať viac" : "Read more"}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Saved section – same level as the panels above, split by type */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          {panelHead("🔖", t("tips.saved"), String(saved.length))}
        </div>
        {saved.length === 0 ? (
          <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-3">{t("tips.savedEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-5">
            {/* Saved tips & tricks */}
            <div>
              <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                💡 {locale === "sk" ? "Tipy a triky" : "Tips & tricks"}
                <span className="text-[10px] font-bold bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 px-2 py-0.5 rounded-full">{savedTips.length}</span>
              </h4>
              {savedTips.length === 0 ? (
                <p className="text-[11px] font-medium text-zinc-400 mt-1.5">{locale === "sk" ? "Nič uložené." : "Nothing saved."}</p>
              ) : (
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  {savedTips.map((r) => (
                    <div key={`${r.kind}:${r.id}`} className="flex items-start gap-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-3">
                      <span className="h-7 w-7 shrink-0 rounded-full bg-fitcal-mint text-white font-black text-xs flex items-center justify-center">🔖</span>
                      <p className="text-xs sm:text-sm font-medium leading-snug text-zinc-700 dark:text-zinc-200 flex-1 min-w-0">{t(r.id as any)}</p>
                      <button onClick={() => toggleSave(r.id, "tip")} aria-label={locale === "sk" ? "Odstrániť" : "Remove"} className="self-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 font-bold text-sm px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved verified advice */}
            <div>
              <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                📚 {locale === "sk" ? "Overené rady" : "Verified advice"}
                <span className="text-[10px] font-bold bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 px-2 py-0.5 rounded-full">{savedAdvice.length}</span>
              </h4>
              {savedAdvice.length === 0 ? (
                <p className="text-[11px] font-medium text-zinc-400 mt-1.5">{locale === "sk" ? "Nič uložené." : "Nothing saved."}</p>
              ) : (
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  {savedAdvice.map((r) => {
                    const tip = DETAILED_TIPS.find((d) => d.id === r.id.replace(/^adv:/, ""));
                    if (!tip) return null;
                    return (
                      <div
                        key={`${r.kind}:${r.id}`}
                        onClick={() => setSelected(tip)}
                        className="cursor-pointer rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-md p-3 transition group"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg shrink-0">{tip.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase truncate">{locale === "sk" ? tip.categorySk : tip.categoryEn} • {tip.source}</p>
                            <div className="font-bold text-xs mt-0.5">{locale === "sk" ? tip.titleSk : tip.titleEn}</div>
                            <div className="text-[11px] font-medium text-zinc-500 mt-0.5 line-clamp-2">{locale === "sk" ? tip.summarySk : tip.summaryEn}</div>
                            <a href={tip.sourceUrl} target="_blank" rel="noreferrer" className="inline-block text-[10px] font-bold text-fitcal-mintDark mt-1 hover:underline">🔗 {locale === "sk" ? "Zdroj" : "Source"} →</a>
                          </div>
                          <button
                            onClick={() => toggleSave(r.id, "advice")}
                            aria-label={locale === "sk" ? "Odstrániť" : "Remove"}
                            className="self-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 font-bold text-sm px-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <TipDetailModal tip={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function FoodAdviceCard({ avgKcal, goalKcal }: { avgKcal?: number; goalKcal?: number }) {
  const { t, locale } = useI18n();
  if (avgKcal == null || goalKcal == null) return null;
  const diff = avgKcal - goalKcal;
  let advice = "";
  let color = "bg-zinc-50";
  if (diff > 300) {
    advice = locale === "sk" ? "Priemer je vysoko nad cieľom. Skús menšie porcie večer a viac bielkovín na obed." : "Average is well above goal. Try smaller dinner portions and more protein at lunch.";
    color = "bg-orange-50 border-orange-200";
  } else if (diff < -300) {
    advice = locale === "sk" ? "Priemer je pod cieľom – ak chceš pribrať, pridaj orechy alebo olivový olej." : "Average is below goal — to gain, add nuts or olive oil.";
    color = "bg-blue-50 border-blue-200";
  } else {
    advice = locale === "sk" ? "Skvelé! Držíš sa cieľa. Udržuj rytmus a sleduj vlákninu." : "Great! Staying on goal. Keep rhythm and watch fiber.";
    color = "bg-emerald-50 border-emerald-200";
  }
  return (
    <div className={`rounded-2xl border p-3 ${color}`}>
      <p className="text-xs font-bold tracking-widest text-zinc-500">{t("tips.foodAdvice").toUpperCase()}</p>
      <p className="text-sm font-medium mt-1">{advice}</p>
    </div>
  );
}
