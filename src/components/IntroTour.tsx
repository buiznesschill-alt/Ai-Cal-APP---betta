"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

type Step = { id: string; title: string; text: string; anchor: string; tab?: "today" | "history" | "tips" };

const STEPS: Step[] = [
  { id: "header", title: "FitCal — hlavička", text: "Logo a názov. Vpravo vidíš svoj rank a avatar pre nastavenia.", anchor: "header", tab: "today" },
  { id: "rank", title: "Rank a body", text: "Modrá +1 za zelený deň (v cieli), červená −1 za prázdny/biely/červený, modrá 0 freeze počas choroby. Body sa počítajú od prvého jedla.", anchor: "[data-tour='rank']", tab: "today" },
  { id: "goal", title: "Denný cieľ", text: "Krúžok ukazuje koľko kalórií ti zostáva. Dole 9 krúžkov pre všetky živiny.", anchor: "#daily-goal-card", tab: "today" },
  { id: "scan", title: "Naskenovať jedlo", text: "Odfotíš tanier, vyberieš typ jedla (raňajky/obed/večera/snack) a pridáš poznámku. AI vráti 9 živín.", anchor: "[data-tour='scan']", tab: "today" },
  { id: "favorites", title: "Obľúbené a nedávne", text: "Rýchlo pridáš obľúbené alebo nedávne jedlo bez fotenia.", anchor: "[data-tour='favorites']", tab: "today" },
  { id: "meals", title: "Jedlá dnes", text: "Zoznam dnešných jedál — vidíš kategórie, kalórie a makrá. Môžeš upraviť porciu alebo vymazať.", anchor: "[data-tour='meals']", tab: "today" },
  { id: "water", title: "Voda", text: "Sleduj pitný režim. Cieľ 2000 ml, pridávaš po 250 ml.", anchor: "[data-tour='water']", tab: "today" },
  { id: "stats", title: "Štatistiky", text: "Priemer za 7 dní a trend. Pomáha vidieť či držíš cieľ.", anchor: "[data-tour='stats']", tab: "today" },
  { id: "chart", title: "Graf dňa", text: "Stĺpce podľa typu jedla alebo hodín. Vidíš kedy ješ najviac.", anchor: "[data-tour='chart']", tab: "today" },
  { id: "tips", title: "Tipy", text: "Zdravé rady na každý deň. Klikni pre detail.", anchor: "[data-tour='tips']", tab: "today" },
  { id: "history", title: "História — zoznam", text: "Prehľad všetkých jedál po dňoch. Filtrovanie podľa kategórie.", anchor: "[data-tour='history']", tab: "history" },
  { id: "heatmap", title: "Kalendár", text: "Mesačný prehľad: zelená v cieli, biela pod, červená nad, modrá freeze počas choroby, šedá bez dát.", anchor: "#month-calendar", tab: "history" },
  { id: "trend", title: "Grafy a trendy", text: "Týždenné/mesačné trendy kalórií a makier.", anchor: "[data-tour='trend']", tab: "history" },
  { id: "tips-full", title: "Tipy — celá stránka", text: "Všetky tipy a overené rady na jednom mieste.", anchor: "[data-tour='tips-full']", tab: "tips" },
  { id: "settings", title: "Nastavenia", text: "Tu nastavíš výšku, váhu, vek, ciele a zapneš chorobu (freeze). Odtiaľto vieš sprievodcu spustiť znova.", anchor: "a[href='/settings']", tab: "today" },
];

export function IntroTour({ open, onClose, onTabChange }: { open: boolean; onClose: () => void; onTabChange?: (tab: "today"|"history"|"tips") => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const cur = STEPS[step];

  // prepni tab ak krok vyžaduje iný tab (history/tips) — plynule zhora dole
  useEffect(() => {
    if (!open || !onTabChange || !cur.tab) return;
    onTabChange(cur.tab as any);
  }, [open, cur.tab, onTabChange]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const update = () => {
      const el = document.querySelector(cur.anchor) as HTMLElement | null;
      if (!el || cancelled) { if (!el) setPos(null); return; }
      const r = el.getBoundingClientRect();
      // green frame presne okolo elementu + 12px padding, vidno normálne
      setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.min(r.width, window.innerWidth - 24), h: r.height });
      // plynulé scrollovanie s offsetom pre sticky header (72px)
      const top = r.top + window.pageYOffset - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    // malé oneskorenie aby sa stihol prepnúť tab a vyrenderovať
    const t = setTimeout(update, 350);
    const id = setInterval(update, 400);
    window.addEventListener("resize", update);
    return () => { cancelled = true; clearTimeout(t); clearInterval(id); window.removeEventListener("resize", update); };
  }, [open, cur.anchor, step]);

  useEffect(() => { if (open) setStep(0); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* overlay — mimo zeleného rámčeka stmavené, vo vnútri vidno normálne */}
      <div className="absolute inset-0 bg-black/55 pointer-events-auto" onClick={onClose} />
      {/* highlight — plynulý zelený rámček okolo aktuálnej časti */}
      {pos && (
        <motion.div
          className="absolute border-[3px] border-fitcal-mint rounded-2xl pointer-events-none"
          initial={false}
          animate={{ left: pos.x - pos.w / 2 - 10, top: pos.y - pos.h / 2 - 10, width: pos.w + 20, height: pos.h + 20 }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.50), 0 0 24px rgba(0,200,150,0.35)", background: "rgba(0,200,150,0.06)" }}
        />
      )}
      {/* avatar — kráča plynulo zhora dole nad rámčekom */}
      <motion.div
        ref={avatarRef}
        className="absolute h-14 w-14 rounded-full bg-white border-2 border-fitcal-mint shadow-xl flex items-center justify-center font-black text-fitcal-mint text-xl pointer-events-auto"
        animate={pos ? { left: pos.x - 28, top: pos.y - pos.h / 2 - 78 } : { left: 20, top: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        F
      </motion.div>
      {/* bubble */}
      <div className="absolute left-4 right-4 bottom-20 sm:bottom-24 pointer-events-auto">
        <div className="mx-auto max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-black text-sm">{cur.title}</h3>
            <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{step + 1} / {STEPS.length}</span>
          </div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">{cur.text}</p>
          <div className="mt-1 w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-fitcal-mint" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>
      {/* controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="h-11 px-5 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-black text-sm disabled:opacity-40 border border-zinc-200 dark:border-zinc-700">
          ← Späť
        </button>
        <button onClick={onClose} className="h-11 px-5 rounded-full bg-zinc-800 text-white font-bold text-sm">
          Preskočiť
        </button>
        <button
          onClick={() => {
            if (step === STEPS.length - 1) onClose();
            else setStep((s) => s + 1);
          }}
          className="h-11 px-5 rounded-full bg-fitcal-mint text-white font-black text-sm"
        >
          {step === STEPS.length - 1 ? "Hotovo" : "Dopredu →"}
        </button>
      </div>
    </div>
  );
}

export function useIntroAuto() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onStart = () => {
      setOpen(true);
    };
    window.addEventListener("fitcal:startIntro", onStart as any);
    return () => window.removeEventListener("fitcal:startIntro", onStart as any);
  }, []);
  const close = () => {
    setOpen(false);
  };
  return { open, setOpen, close };
}
