"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useI18n } from "@/lib/i18n";
import { ClientPortal } from "@/components/ClientPortal";
import { NumField } from "@/components/NumField";
import { resolveAutoMeal } from "@/lib/autoMeal";
import type { QuantityProfile } from "@/lib/quantity/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

type BarcodeProduct = {
  code: string;
  dish: string;
  description: string;
  portion_g: number;
  pieceG: number | null;
  packageG: number | null;
  pieces: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
  iron: number;
  potassium: number;
  nutrition?: boolean;
  source?: string;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
  }
}

export function BarcodeScan({ open, onClose, onSaved, autoMeal, onManual }: { open: boolean; onClose: () => void; onSaved: () => void; autoMeal?: any; onManual?: () => void }) {
  const { t, locale } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const zxRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false); // true while a decoder is actively watching
  const [scanEngine, setScanEngine] = useState<"none" | "detector" | "zxing">("none");
  const [mode, setMode] = useState<"camera" | "lookup" | "result" | "notfound" | "error">("camera");
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [productSource, setProductSource] = useState("Open Food Facts");
  const [profile, setProfile] = useState<QuantityProfile | null>(null);
  const [optIdx, setOptIdx] = useState(0);
  const [count, setCount] = useState(1);
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("snack");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  function stopCamera() {
    if (loopRef.current) window.clearInterval(loopRef.current);
    loopRef.current = null;
    try {
      zxRef.current?.stop();
    } catch {}
    zxRef.current = null;
    scanningRef.current = false;
    try {
      const track = streamRef.current?.getVideoTracks()[0] as any;
      if (torchOn && track?.applyConstraints) {
        track.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
      }
    } catch {}
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setStream(null);
    setTorchOn(false);
    setTorchSupported(false);
  }

  // EAN-8 / UPC-A / EAN-13 / GTIN-14 check digit validation
  function isValidGtin(code: string): boolean {
    if (![8, 12, 13, 14].includes(code.length)) return false;
    const digits = code.split("").map(Number);
    const check = digits.pop() as number;
    let sum = 0;
    digits
      .reverse()
      .forEach((d, i) => {
        sum += d * (i % 2 === 0 ? 3 : 1);
      });
    return (10 - (sum % 10)) % 10 === check;
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0] as any;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as any);
      setTorchOn(next);
    } catch {
      try {
        await track.applyConstraints({ torch: next } as any);
        setTorchOn(next);
      } catch {}
    }
  }

  async function lookup(codeRaw: string) {
    let codeSrc = codeRaw;
    // GS1 Digital Link URL – https://id.gs1.org/01/{GTIN}/21/{lot}
    const dl = codeSrc.match(/01\/(\d{13,14})(?:[/?#]|$)/);
    if (dl) codeSrc = dl[1];
    // GS1 AI (01) / FNC1 – vytiahni GTIN zo štruktúrovaného kódu (rule 12)
    const ai = codeSrc.match(/(?:\(01\)|\u001d?01)(\d{14})/);
    if (ai) codeSrc = ai[1];
    const code = codeSrc.replace(/\D/g, "");
    if (code.length < 6) return;
    if (!isValidGtin(code)) {
      setError(t("meal.invalidCode"));
      setMode("error");
      return;
    }
    stopCamera();
    setMode("lookup");
    setError(null);
    try {
      const res = await fetch(`/api/barcode?code=${code}&raw=${encodeURIComponent(codeRaw)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      if (!d.found) {
        setMode("notfound");
        return;
      }
      setProduct(d.product);
      setProductSource(d.source || "Open Food Facts");
      if (d.profile) {
        setProfile(d.profile);
        // user-learning (§17): zapamätaná voľba porcie pre tento barcode > engine default
        let pref: { type: string; count: number } | null = null;
        try {
          const prefs = JSON.parse(localStorage.getItem("fitcal_qty_pref") || "{}");
          pref = prefs[code] ?? null;
        } catch {}
        const prefIdx = pref ? d.profile.options.findIndex((o: { type: string }) => o.type === pref!.type) : -1;
        if (pref && prefIdx >= 0 && pref.count > 0) {
          setOptIdx(prefIdx);
          setCount(pref.count);
        } else {
          setOptIdx(d.profile.defaultIndex);
          setCount(d.profile.options[d.profile.defaultIndex]?.suggestedCount ?? 1);
        }
      } else {
        setProfile(null);
        setCount(1);
      }
      setMode("result");
    } catch (e: any) {
      setError(e.message || "Error");
      setMode("error");
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("meal.camInsecure"));
      setMode("error");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = s;
      try {
        const caps = (s.getVideoTracks()[0] as any)?.getCapabilities?.();
        if (caps && "torch" in caps) setTorchSupported(true);
      } catch {}
      setMode("camera");
      setStream(s);
    } catch (e: any) {
      const name = e?.name || "";
      if (!window.isSecureContext) setError(t("meal.camInsecure"));
      else if (name === "NotAllowedError" || name === "SecurityError") setError(t("meal.camDenied"));
      else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") setError(t("meal.camMissing"));
      else setError("Camera error");
      setMode("error");
    }
  }

  // attach the stream and start decoding only after <video> is actually mounted in the DOM
  useEffect(() => {
    if (!open || !stream) return;
    let cancelled = false;
    const boot = () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v) {
        requestAnimationFrame(boot);
        return;
      }
      v.srcObject = stream;
      v.play().catch(() => {});
      startDecoder(v);
    };
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stream]);

  async function startDecoder(video: HTMLVideoElement) {
    if (scanningRef.current || zxRef.current || loopRef.current) return;

    // 1) natívny BarcodeDetector (Chrome/Edge na Android & desktop) – v try/catch,
    //    lebo na niektorých zariadeniach zlyhá constructor/detect a inak by skenovanie ticho umrelo
    if ("BarcodeDetector" in window && window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf", "qr_code", "data_matrix"] });
        setScanEngine("detector");
        scanningRef.current = true;
        loopRef.current = window.setInterval(async () => {
          if (!scanningRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              scanningRef.current = false;
              navigator.vibrate?.(80);
              await lookup(codes[0].rawValue);
            }
          } catch {}
        }, 300);
        return; // natívny engine beží
      } catch {
        // natívny zlyhal → pokračuj na ZXing fallback
        scanningRef.current = false;
        setScanEngine("none");
        if (loopRef.current) {
          window.clearInterval(loopRef.current);
          loopRef.current = null;
        }
      }
    }

    // 2) univerzálny ZXing fallback – Safari/iOS, Firefox, všetko ostatné
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.ITF,
        BarcodeFormat.RSS_14, // GS1 DataBar – čerstvé/voľné potraviny (rule 14)
        BarcodeFormat.QR_CODE, // GS1 Digital Link (rule 6-8)
        BarcodeFormat.DATA_MATRIX, // GS1 DataMatrix
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250 });
      scanningRef.current = true; // accept decoded results
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (!result || !scanningRef.current) return;
        scanningRef.current = false;
        navigator.vibrate?.(80);
        lookup(result.getText());
      });
      zxRef.current = controls;
      setScanEngine("zxing");
    } catch {
      // žiadny engine nedostupný → ostane len manuálny kód
      scanningRef.current = false;
      setScanEngine("none");
    }
  }

  // open/close lifecycle
  useEffect(() => {
    if (open) {
      setMode("camera");
      setProduct(null);
      setProductSource("Open Food Facts");
      setProfile(null);
      setManualCode("");
      setScanEngine("none");
      // auto-preselect typu jedla podľa času – len keď je zapnutý Auto prepínač v Scan meal
      let autoFlag = false;
      try {
        autoFlag = localStorage.getItem("fitcal_auto_scan") === "1";
      } catch {}
      const mt = autoFlag ? resolveAutoMeal(autoMeal) : null;
      if (mt) setMealType(mt);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // efektívne gramy = počet jednotiek × gramsPerUnit vybranej option (kanonický prepočet §14)
  function effectiveGrams() {
    if (!profile) {
      // fallback bez profilu: count = gramy (nie 0!)
      return Math.max(0, parseFloat(String(count))) || 0;
    }
    const opt = profile.options[optIdx] ?? profile.options[0];
    const c = Math.max(0, parseFloat(String(count))) || 0;
    return c * opt.gramsPerUnit;
  }

  async function addMeal() {
    if (!product) return;
    const grams = effectiveGrams();
    if (grams <= 0) {
      setError(locale === "sk" ? "Zadaj množstvo väčšie ako 0" : "Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    const ratioV = grams / (product.portion_g || 1);
    const scale = (n: number) => Math.round(n * ratioV * 10) / 10;
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: product.dish,
          description: [product.description, `EAN ${product.code}`.slice(0, 40), productSource].filter(Boolean).join(" • "),
          portion_g: Math.round(grams),
          kcal: Math.round(product.kcal * ratioV),
          protein: scale(product.protein),
          carbs: scale(product.carbs),
          fat: scale(product.fat),
          fiber: scale(product.fiber),
          sugar: scale(product.sugar),
          salt: scale(product.salt),
          iron: Math.round(product.iron * ratioV * 10) / 10,
          potassium: Math.round(product.potassium * ratioV),
          mealType,
          source: "barcode",
        }),
      });
      if (res.ok) {
        // user-learning (§17): zapamätaj si zvolenú jednotku a počet pre tento barcode
        try {
          const opt = profile?.options[optIdx];
          if (opt) {
            const prefs = JSON.parse(localStorage.getItem("fitcal_qty_pref") || "{}");
            prefs[product.code] = { type: opt.type, count: Number(count) || 1 };
            localStorage.setItem("fitcal_qty_pref", JSON.stringify(prefs));
          }
        } catch {}
        onSaved();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error");
      }
    } catch {
      setError(locale === "sk" ? "Chyba pri ukladaní – skús znova" : "Save failed – try again");
    }
    setSaving(false);
  }

  const inputCls =
    "w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fitcal-mint/30";

  return (
    <ClientPortal active={open}>
      <AnimatePresence>
      {open && (
        <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { stopCamera(); onClose(); }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-t-4xl p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <h3 className="font-extrabold">🏷️ {t("meal.barcode")}</h3>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center font-bold shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {(mode === "camera" || mode === "lookup") && (
                <>
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    {/* scan frame */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4/5 h-20 border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative overflow-hidden">
                        {/* animovaný laser – prebieha počas skenovania */}
                        {mode === "camera" && scanEngine !== "none" && (
                          <motion.div
                            className="absolute left-2 right-2 h-[3px] rounded-full bg-fitcal-mint"
                            style={{ boxShadow: "0 0 12px 2px rgba(0,200,150,0.65)" }}
                            animate={{ top: ["10%", "82%", "10%"] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                        {mode === "lookup" && <div className="absolute inset-x-2 top-1/2 h-0.5 bg-fitcal-mint animate-pulse" />}
                      </div>
                    </div>
                    {torchSupported && (
                      <button
                        onClick={toggleTorch}
                        title={torchOn ? "Vypnúť blesk" : "Zapnúť blesk"}
                        aria-label={torchOn ? "Vypnúť blesk" : "Zapnúť blesk"}
                        className={`absolute top-2 right-2 h-9 w-9 rounded-full backdrop-blur-sm flex items-center justify-center text-base font-bold transition ${torchOn ? "bg-amber-400 text-zinc-900 shadow" : "bg-black/60 text-white hover:bg-black/80"}`}
                      >
                        {torchOn ? "💡" : "🔦"}
                      </button>
                    )}
                    {mode === "camera" && (
                      <p className="absolute bottom-2 inset-x-2 text-center text-[11px] font-bold text-white/90">{t("meal.scanHint")}</p>
                    )}
                  </div>
                  {scanEngine === "none" && mode === "camera" && (
                    <p className="text-[10px] font-medium text-zinc-400 text-center">{t("meal.noAutoscan")}</p>
                  )}
                </>
              )}

              {mode === "notfound" && (
                <div className="rounded-2xl bg-orange-50 dark:bg-orange-500/10 px-4 py-3 text-xs font-bold text-fitcal-orange text-center">{t("meal.notFound")}</div>
              )}
              {mode === "error" && error && (
                <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400 text-center">{error}</div>
              )}

              {/* Scan again – hneď pri chybe, aby bol na očiach */}
              {(mode === "notfound" || mode === "error") && (
                <button
                  onClick={() => {
                    setError(null);
                    setMode("camera");
                    startCamera();
                  }}
                  className="w-full rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3 text-sm flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.99] transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                  {locale === "sk" ? "Skenovať znova" : "Scan again"}
                </button>
              )}

              {/* Result card */}
              {mode === "result" && product && (
                <div className="space-y-3">
                  {/* produkt bez výživových hodnôt v DB – jasné upozornenie + link na doplnenie */}
                  {product.nutrition === false && (
                    <div className="rounded-2xl bg-orange-50 dark:bg-orange-500/10 px-4 py-3 text-xs font-semibold text-fitcal-orange text-center space-y-2">
                      <div>
                        ⚠️ {locale === "sk"
                          ? "Tento produkt nemá v Open Food Facts výživové hodnoty – kalórie a makrá sa nedajú spočítať."
                          : "This product has no nutrition data in Open Food Facts – calories and macros can't be calculated."}
                      </div>
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <a
                          href={`https://world.openfoodfacts.org/cgi/product.pl?code=${product.code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-white dark:bg-zinc-800 border border-fitcal-orange/30 px-2.5 py-1.5 text-[10px] font-bold text-fitcal-orange hover:bg-fitcal-orangeLight dark:hover:bg-orange-500/20 transition"
                        >
                          {locale === "sk" ? "Doplniť do Open Food Facts →" : "Add to Open Food Facts →"}
                        </a>
                        <button
                          onClick={() => { onClose(); onManual?.(); }}
                          className="rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                        >
                          {locale === "sk" ? "Zadať ručne →" : "Enter manually →"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-3">
                    <p className="font-bold text-sm leading-tight">{product.dish}</p>
                    {product.description && <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{product.description}</p>}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-1.5 py-0.5 rounded-full">{Math.round((product.kcal * effectiveGrams()) / (product.portion_g || 1))} kcal</span>
                      <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">{t("dash.protein")} {Math.round(product.protein * ratio())} g</span>
                      <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">{t("dash.carbs")} {Math.round(product.carbs * ratio())} g</span>
                      <span className="text-[10px] font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">{t("dash.fat")} {Math.round(product.fat * ratio())} g</span>
                      {product.iron > 0 && (
                        <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">{locale === "sk" ? "Železo" : "Iron"} {Math.round(product.iron * ratio() * 10) / 10} mg</span>
                      )}
                      {product.potassium > 0 && (
                        <span className="text-[10px] font-bold bg-lime-50 dark:bg-lime-500/10 text-lime-700 dark:text-lime-300 px-1.5 py-0.5 rounded-full">{locale === "sk" ? "Draslík" : "Potassium"} {Math.round(product.potassium * ratio())} mg</span>
                      )}
                    </div>
                  </div>

                  {/* Množstvo – QuantityProfile (§11): dropdown relevantných jednotiek + počet + quick tlačidlá */}
                  {profile && profile.options.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold tracking-widest text-zinc-500">{t("meal.portion")}</label>
                        <select
                          value={optIdx}
                          onChange={(e) => {
                            const i = Number(e.target.value);
                            setOptIdx(i);
                            setCount(profile.options[i]?.suggestedCount ?? 1);
                          }}
                          className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full px-3 py-1.5 cursor-pointer focus:outline-none"
                        >
                          {profile.options.map((o, i) => (
                            <option key={`${o.type}-${i}`} value={i}>
                              {t(o.labelKey)}
                              {o.gramsPerUnit > 1 ? ` (${Math.round(o.gramsPerUnit)} g)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <NumField key={optIdx} value={count} min={0} onChange={(v) => setCount(Math.max(0, v))} className={`mt-1.5 ${inputCls}`} />

                      {/* quick tlačidlá podľa typu (§13) */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {(() => {
                          const opt = profile.options[optIdx];
                          const btn = "rounded-xl px-2.5 py-1.5 text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition";
                          if (opt.type === "PACKAGE_FRACTION" || opt.type === "WHOLE_PACKAGE") {
                            const frac = profile.options.filter((o) => o.type === "PACKAGE_FRACTION" || o.type === "WHOLE_PACKAGE");
                            return frac.map((o) => (
                              <button key={`${o.type}-${o.gramsPerUnit}`} className={btn} onClick={() => { const i = profile.options.indexOf(o); setOptIdx(i); setCount(1); }}>
                                {t(o.labelKey)}
                              </button>
                            ));
                          }
                          if (opt.type === "PIECE" || opt.type === "SLICE") {
                            return (
                              <>
                                <button className={btn} onClick={() => setCount((c) => Math.max(1, Number(c) - 1))}>−</button>
                                <span className="px-1 py-1.5 text-[11px] font-black">{count}</span>
                                <button className={btn} onClick={() => setCount((c) => Number(c) + 1)}>+</button>
                              </>
                            );
                          }
                          if (opt.type === "GRAM") {
                            return [50, 100, 150].map((g) => (
                              <button key={g} className={btn} onClick={() => setCount(g)}>{g} g</button>
                            ));
                          }
                          if (opt.type === "MILLILITER") {
                            return [100, 250, 330, 500].map((m) => (
                              <button key={m} className={btn} onClick={() => setCount(m)}>{m} ml</button>
                            ));
                          }
                          if (opt.type === "SERVING") {
                            return [1, 2, 3].map((n) => (
                              <button key={n} className={btn} onClick={() => setCount(n)}>{n}×</button>
                            ));
                          }
                          return null;
                        })()}
                      </div>

                      {/* live súčet: fyzické množstvo + kcal (§21) */}
                      <div className="mt-2 rounded-2xl bg-fitcal-mintLight dark:bg-emerald-500/10 px-3 py-2 flex items-center justify-between text-xs font-black">
                        <span>= {Math.round(effectiveGrams())} {profile.isLiquid ? "ml" : "g"}</span>
                        <span className="text-fitcal-mintDark dark:text-emerald-300">{Math.round(product.kcal > 0 && profile.kcalPerGram > 0 ? effectiveGrams() * profile.kcalPerGram : (product.kcal * effectiveGrams()) / (product.portion_g || 1))} kcal</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-bold tracking-widest text-zinc-500">{t("meal.portion")}</label>
                      <NumField value={count} min={1} onChange={(v) => setCount(Math.max(1, v))} className={`mt-1 ${inputCls}`} />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold tracking-widest text-zinc-500">{t("dash.mealType")}</label>
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      {MEAL_TYPES.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMealType(m)}
                          className={`rounded-xl px-2 py-2 text-xs font-bold transition ${mealType === m ? "bg-fitcal-mint text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                        >
                          {t(`meal.${m}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={addMeal} disabled={saving} className="w-full rounded-2xl bg-fitcal-mint text-white font-bold py-3 hover:brightness-95 transition disabled:opacity-60">
                    {saving ? t("dash.saving") : t("meal.add")}
                  </button>
                  {mode === "result" && error && (
                    <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400 text-center">{error}</div>
                  )}
                </div>
              )}

              {/* Manual code entry – always available fallback */}
              <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{t("meal.enterCode")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="1234567890123"
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    onClick={() => lookup(manualCode)}
                    disabled={manualCode.length < 6 || mode === "lookup"}
                    className="rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold px-4 hover:bg-black dark:hover:bg-zinc-100 transition disabled:opacity-40 shrink-0"
                  >
                    🔍
                  </button>
                </div>
              </div>

              {(mode === "result") && (
                <button
                  onClick={() => {
                    setError(null);
                    setMode("camera");
                    startCamera();
                  }}
                  className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold py-2.5 text-sm"
                >
                  📷 {locale === "sk" ? "Skenovať znova" : "Scan again"}
                </button>
              )}
            </div>
          </motion.div>
          </motion.div>
        </>
      )}
        </AnimatePresence>
    </ClientPortal>
  );

  function ratio() {
    return effectiveGrams() / (product?.portion_g || 1);
  }
}
