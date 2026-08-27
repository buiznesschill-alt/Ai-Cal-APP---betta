"use client";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fileToCompressedBase64, fileToThumbnailBase64 } from "@/lib/image";
import { useI18n } from "@/lib/i18n";
import { resolveAutoMeal } from "@/lib/autoMeal";

export function CameraCapture({
  onResult,
  onManual,
  onBarcode,
  autoMeal,
}: {
  onResult: (data: { result: any; thumbnail: string | null; mealType?: string }) => void;
  onManual?: () => void;
  onBarcode?: () => void;
  autoMeal?: any;
}) {
  const { t, locale } = useI18n();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "preview" | "analyzing">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  // Auto prepínač – musí byť zapnutý tu v "Scan meal", až potom sa typ dopĺňa podľa časov
  const [autoOn, setAutoOn] = useState(false);

  useEffect(() => {
    try {
      setAutoOn(localStorage.getItem("fitcal_auto_scan") === "1");
    } catch {}
  }, []);

  // auto-preselect typu jedla podľa času (pri návrate do idle = nové jedlo)
  useEffect(() => {
    if (mode !== "idle" || !autoOn || !autoMeal?.enabled) return;
    const mt = resolveAutoMeal(autoMeal);
    if (mt) setMealType(mt);
  }, [autoMeal, mode, autoOn]);

  function toggleAuto() {
    const next = !autoOn;
    setAutoOn(next);
    try {
      localStorage.setItem("fitcal_auto_scan", next ? "1" : "0");
    } catch {}
    if (next && autoMeal?.enabled) {
      const mt = resolveAutoMeal(autoMeal);
      if (mt) setMealType(mt);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  // poznámka pre analyzátor – upresní jedlo (množstvá, suroviny)
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (!stream) {
      setTorchSupported(false);
      setTorchOn(false);
      return;
    }
    const track = stream.getVideoTracks()[0] as any;
    try {
      const caps = track?.getCapabilities?.();
      if (caps && "torch" in caps) setTorchSupported(true);
      else setTorchSupported(false);
    } catch {
      setTorchSupported(false);
    }
  }, [stream]);

  async function openCamera() {
    // Try live camera first (getUserMedia) for true camera experience
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        setStream(s);
        setMode("camera");
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = s;
        }, 100);
        return;
      } catch {}
    }
    // Fallback to file picker with capture (opens camera directly on mobile)
    cameraFallbackRef.current?.click();
  }

  function openGallery() {
    galleryRef.current?.click();
  }

  function stopCamera() {
    try {
      const track = stream?.getVideoTracks()[0] as any;
      if (torchOn && track?.applyConstraints) {
        track.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
      }
    } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setTorchOn(false);
    setTorchSupported(false);
    setMode("idle");
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0] as any;
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

  function captureFrameBlob(): Promise<File> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!videoRef.current) return reject(new Error("no video"));
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(videoRef.current, 0, 0);
        // jpeg – univerzálne podporované aj na iOS Safari (webp tu zlyháva)
        const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92));
        if (!blob) return reject(new Error("Capture failed"));
        resolve(new File([blob], "capture.jpg", { type: "image/jpeg" }));
      } catch (e) {
        reject(e);
      }
    });
  }

  async function captureFromVideo() {
    if (!videoRef.current) return;
    try {
      const f = await captureFrameBlob();
      // stop the camera FIRST (it resets mode to "idle"), THEN show the preview
      // so the taken photo continues through the same preview → analyze flow as uploads
      stopCamera();
      await handleFile(f);
    } catch (e: any) {
      stopCamera();
      setMode("idle");
      setError(e?.message || "Chyba snímku");
    }
  }

  // LIVE AI analýza – zachytí aktuálny záber z kamery a hneď pošle na AI (bez fotenia/preview)
  async function captureAndAnalyze() {
    if (mode !== "camera") return;
    try {
      setError(null);
      const f = await captureFrameBlob();
      stopCamera();
      setFile(f);
      await analyze(f);
    } catch (e: any) {
      stopCamera();
      setMode("idle");
      setError(e?.message || "Chyba snímku");
    }
  }

  function cancelPreview() {
    setMode("idle");
    setPreview(null);
    setFile(null);
    setError(null);
    setNote("");
    setNoteOpen(false);
  }

  async function handleFile(f: File) {
    try {
      setFile(f);
      setError(null);
      setNote("");
      // po odfotení/nahraní hneď otvor popis – používateľ môže bezproblémovo napísať čo a koľko jedol
      setNoteOpen(true);
      const thumb = await fileToThumbnailBase64(f);
      setPreview(thumb);
      setMode("preview");
    } catch (e: any) {
      setFile(null);
      setPreview(null);
      setMode("idle");
      setError(e?.message || "Chyba spracovania fotky");
    }
  }

  async function analyze(fileOverride?: File) {
    const target = fileOverride || file;
    if (!target) return;
    setMode("analyzing");
    setError(null);
    try {
      const fd = new FormData();
      let thumb = "";
      try {
        // štandardná cesta – canvas kompresia znormalizuje akýkoľvek formát na webp
        const base64 = await fileToCompressedBase64(target, 1536, 0.85);
        const blob = await (await fetch(base64)).blob();
        fd.append("image", blob, "food.webp");
      } catch {
        // exotický formát (napr. HEIC), ktorý canvas nevie dekódovať – pošli originál,
        // server si poradí cez magic-byte sniffing
        fd.append("image", target, target.name || "photo.jpg");
      }
      try {
        thumb = await fileToThumbnailBase64(target);
      } catch {}
      fd.append("mealType", mealType);
      if (thumb) fd.append("thumbnail", thumb);
      fd.append("locale", locale);
      if (note.trim()) fd.append("note", note.trim());

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba analýzy");
      // smart priradenie – server podľa typu jedla (snack/main) a času dňa môže
      // presunúť jedlo do iného slotu; zrkadlíme to aj do výberu v UI
      const finalMealType = ["breakfast", "lunch", "dinner", "snack"].includes(data.mealType) ? data.mealType : mealType;
      if (finalMealType !== mealType) setMealType(finalMealType);
      onResult({ result: data.result, thumbnail: data.thumbnail ?? thumb, mealType: finalMealType });
      setMode("idle");
      setPreview(null);
      setFile(null);
      setNote("");
      setNoteOpen(false);
    } catch (e: any) {
      setError(e.message || "Chyba");
      setMode("preview");
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="font-extrabold text-sm sm:text-base">{t("dash.scan")}</h3>
        <div className="flex items-center gap-1.5">
          {/* Auto prepínač – zapnuté = typ jedla sa dopĺňa podľa časov z Nastavení */}
          <button
            onClick={toggleAuto}
            title={t("settings.autoScan")}
            className={`h-8 px-2.5 rounded-full text-[10px] font-black flex items-center gap-1 transition active:scale-95 ${
              autoOn
                ? "bg-fitcal-mint text-white shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {locale === "sk" ? "Auto" : "Auto"}
          </button>
          {/* pri zapnutom Auto je výber uzamknutý – typ určuje čas */}
          <select
            value={mealType}
            disabled={autoOn}
            onChange={(e) => setMealType(e.target.value as any)}
            className={`text-sm sm:text-base font-bold rounded-full px-4 sm:px-5 py-2 sm:py-2.5 focus:outline-none transition ${
              autoOn
                ? "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer focus:ring-2 focus:ring-fitcal-mint/40"
            }`}
          >
            <option value="breakfast">{t("camera.breakfast")}</option>
            <option value="lunch">{t("camera.lunch")}</option>
            <option value="dinner">{t("camera.dinner")}</option>
            <option value="snack">{t("camera.snack")}</option>
          </select>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === "camera" ? (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3] relative">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <div className="absolute inset-0 border-[3px] border-white/20 rounded-2xl pointer-events-none" />
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
            </div>
            <div className="flex gap-2">
              <button onClick={stopCamera} className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3">{t("camera.cancel")}</button>
              <button onClick={captureFromVideo} className="flex-1 rounded-2xl bg-fitcal-mint text-white font-bold py-3 flex flex-col items-center justify-center leading-tight">
                <span>{t("camera.takePhoto")}</span>
                <span className="text-[11px] font-semibold opacity-80">{t("camera.takePhotoHint")}</span>
              </button>
            </div>
            {/* LIVE AI analýza – zachytí záber a hneď pošle na AI */}
            <button
              onClick={captureAndAnalyze}
              className="w-full rounded-2xl bg-gradient-to-r from-fitcal-mint to-fitcal-mintDark text-white font-bold py-3 hover:brightness-105 active:scale-[0.99] transition"
            >
              {locale === "sk" ? "AI analýza teraz" : "AI analyze now"}
            </button>
          </motion.div>
        ) : mode === "preview" && preview ? (
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-zinc-100 aspect-[4/3]">
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
              {/* X – zruší fotku a vráti späť na sken */}
              <button
                onClick={cancelPreview}
                title={t("common.cancel")}
                aria-label={t("common.cancel")}
                className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/60 text-white backdrop-blur-sm flex items-center justify-center font-black text-base hover:bg-black/80 active:scale-90 transition"
              >
                ✕
              </button>
            </div>
            {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}
            {/* poznámka pre analyzátor – rozbalí sa cez ceruzku */}
            <AnimatePresence>
              {noteOpen && (
                <motion.div
                  key="note"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder={t("camera.notePlaceholder")}
                    className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-fitcal-mint/40 resize-none"
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <p className="text-[11px] font-medium text-zinc-500">{t("camera.noteHint")}</p>
                    <span className="text-[10px] font-bold text-zinc-400 tabular-nums">{note.length}/500</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("idle");
                  setPreview(null);
                  setFile(null);
                  setNote("");
                  setNoteOpen(false);
                }}
                className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-3"
              >
                {t("common.cancel")}
              </button>
              {/* ceruzka – SVG ikona, otvorí/zavrie poznámku pre analyzátor */}
              <button
                onClick={() => setNoteOpen((o) => !o)}
                title={t("camera.note")}
                aria-label={t("camera.note")}
                className={`shrink-0 w-14 rounded-2xl flex items-center justify-center border-2 transition active:scale-95 ${
                  note.trim() || noteOpen
                    ? "bg-fitcal-mintLight dark:bg-emerald-500/10 border-fitcal-mint/50 text-fitcal-mintDark dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="M12 8l4 4" />
                </svg>
              </button>
              <button onClick={() => analyze()} className="flex-1 rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-3">
                {t("camera.analyze")}
              </button>
            </div>
          </motion.div>
        ) : mode === "analyzing" ? (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-4 border-zinc-100 dark:border-zinc-800 border-t-fitcal-mint animate-spin" />
            <p className="font-bold">{t("dash.analyzing")}</p>
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-fitcal-mint"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={openCamera}
              className="rounded-xl sm:rounded-2xl bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 text-white font-bold py-4 sm:py-6 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-black dark:hover:bg-zinc-700 transition text-sm sm:text-base"
            >
              <span className="text-xl sm:text-2xl">📷</span>
              {t("dash.camera")}
            </button>
            <button
              onClick={openGallery}
              className="rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-4 sm:py-6 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-sm sm:text-base"
            >
              <span className="text-xl sm:text-2xl">🖼️</span>
              {t("dash.upload")}
            </button>
            <p className="col-span-2 text-xs text-center text-zinc-500 font-medium">
              {t("camera.support")}
            </p>
            <p className="col-span-2 text-[11px] text-center text-zinc-400 font-medium">
              {t("camera.dragDrop")}
            </p>
            {onBarcode && (
              <button
                onClick={onBarcode}
                className="col-span-2 rounded-xl sm:rounded-2xl bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 text-white font-bold py-2.5 flex items-center justify-center gap-1.5 hover:bg-black dark:hover:bg-zinc-700 active:scale-[0.99] transition text-sm"
              >
                🏷️ {t("meal.barcode")}
              </button>
            )}
            {onManual && (
              <button
                onClick={onManual}
                className="col-span-2 rounded-xl sm:rounded-2xl bg-fitcal-mintLight dark:bg-emerald-500/10 text-fitcal-mintDark dark:text-emerald-300 font-bold py-2.5 flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.99] transition text-sm"
              >
                ✍️ {t("meal.manual")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery picker - opens gallery/file manager, NOT camera */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {/* Camera fallback - opens camera directly on mobile if getUserMedia not available */}
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {/* Drag & drop for desktop */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) handleFile(f);
        }}
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
          if (item) {
            const f = item.getAsFile();
            if (f) handleFile(f);
          }
        }}
        className="hidden"
      />
    </div>
  );
}
