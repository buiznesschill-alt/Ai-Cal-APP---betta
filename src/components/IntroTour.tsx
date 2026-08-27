"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

type Step = { id: string; title: string; text: string; anchor: string };

const STEPS: Step[] = [
  { id: "header", title: "FitCal", text: "Toto je tvoj denný prehľad. Tu vidíš avatar a nastavenia.", anchor: "header" },
  { id: "goal", title: "Denný cieľ", text: "Tu sleduješ kalórie a makrá. Krúžky ukazujú koľko ti zostáva.", anchor: "#daily-goal-card" },
  { id: "scan", title: "Naskenovať jedlo", text: "Odfotíš jedlo, AI spočíta kalórie. Môžeš vybrať typ jedla a pridať poznámku.", anchor: "[data-tour='scan']" },
  { id: "meals", title: "Jedlá dnes", text: "Tu vidíš všetky dnešné jedlá s kategóriami a možnosťou úpravy porcie.", anchor: "[data-tour='meals']" },
  { id: "chart", title: "Graf dňa", text: "Graf podľa typu jedla alebo hodín — sleduj kedy ješ najviac.", anchor: "[data-tour='chart']" },
  { id: "tips", title: "Tipy", text: "Zdravé rady — každý deň nový tip.", anchor: "[data-tour='tips']" },
  { id: "history", title: "História", text: "Prehľad minulých dní a všetkych jedál.", anchor: "a[href='/history']" },
  { id: "heatmap", title: "Kalendár", text: "Mesiacny prehľad — zelená v cieli, biela pod, červená nad, modrá freeze.", anchor: "#month-calendar" },
  { id: "water", title: "Voda", text: "Sleduj pitný režim — cieľ 2000 ml.", anchor: "[data-tour='water']" },
  { id: "favorites", title: "Obľúbené", text: "Rýchlo pridáš obľúbené jedlá.", anchor: "[data-tour='favorites']" },
  { id: "rank", title: "Rank a body", text: "Zelený deň +1, prázdny/biely/červený -1, freeze 0 modrá. Body od prvého jedla.", anchor: "[data-tour='rank']" },
  { id: "settings", title: "Nastavenia", text: "Tu nastavíš výšku, váhu, ciele a zapneš chorobu freeze.", anchor: "a[href='/settings']" },
];

export function IntroTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const cur = STEPS[step];

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = document.querySelector(cur.anchor) as HTMLElement | null;
      if (!el) { setPos(null); return; }
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    update();
    const id = setInterval(update, 300);
    window.addEventListener("resize", update);
    return () => { clearInterval(id); window.removeEventListener("resize", update); };
  }, [open, cur.anchor, step]);

  useEffect(() => { if (open) setStep(0); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onClose} />
      {/* highlight */}
      {pos && (
        <div
          className="absolute border-2 border-fitcal-mint bg-fitcal-mint/10 rounded-2xl pointer-events-none"
          style={{ left: pos.x - pos.w / 2 - 8, top: pos.y - pos.h / 2 - 8, width: pos.w + 16, height: pos.h + 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
        />
      )}
      {/* avatar */}
      <motion.div
        ref={avatarRef}
        className="absolute h-14 w-14 rounded-full bg-white border-2 border-fitcal-mint shadow-xl flex items-center justify-center font-black text-fitcal-mint text-xl pointer-events-auto"
        animate={pos ? { left: pos.x - 28, top: pos.y - 70 } : { left: 20, top: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
