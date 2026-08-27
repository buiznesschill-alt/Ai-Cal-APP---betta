"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export function QRCodePanel() {
  const { t } = useI18n();
  const [url, setUrl] = useState<string>("");
  const [lanUrl, setLanUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    const origin = window.location.origin;
    setUrl(origin);
    const fallbackLan = "https://192.168.1.14:3443";
    // iba 3443 https (http vypnutý)
    setLanUrl(origin.includes("https") ? origin : fallbackLan);
    const loadInfo = () =>
      fetch("/api/info")
        .then((r) => r.json())
        .then((d) => {
          if (d.publicUrl) setLanUrl(d.publicUrl);
          else if (d.lanUrl && d.lanUrl.includes("192.168.")) setLanUrl(d.lanUrl);
          else if (d.lanIp) setLanUrl(`https://${d.lanIp}:3443`);
          else if (d.lanUrl) setLanUrl(d.lanUrl);
        })
        .catch(() => {});
    loadInfo();
    const iv = setInterval(loadInfo, 30000);
    return () => clearInterval(iv);
  }, []);

  const displayUrl = lanUrl || url;
  useEffect(() => {
    if (!displayUrl) return;
    let cancelled = false;
    async function gen() {
      try {
        const QRCode = await import("qrcode").then((m) => (m as any).default || m).catch(() => null);
        if (QRCode && !cancelled) {
          const dataUrl = await QRCode.toDataURL(displayUrl, { width: 240, margin: 1, color: { dark: "#1A1C1E", light: "#F8F9FA" } });
          if (!cancelled) setQrDataUrl(dataUrl);
          return;
        }
      } catch {}
      if (!cancelled) setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(displayUrl)}&color=1A1C1E&bgcolor=F8F9FA`);
    }
    gen();
    return () => { cancelled = true; };
  }, [displayUrl]);
  const qrSrc = qrDataUrl;

  async function copy() {
    if (!displayUrl) return;
    await navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!displayUrl) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-5 animate-pulse h-64" />
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-4xl shadow-card border border-zinc-100 dark:border-zinc-800 p-4 sm:p-6 flex flex-col items-center text-center sm:sticky sm:top-[72px]" suppressHydrationWarning>
      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white flex items-center justify-center font-black text-sm sm:text-base mb-2 sm:mb-3">QR</div>
      <h3 className="font-extrabold text-sm sm:text-base">{t("qr.title")}</h3>
      <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 mt-1">{t("qr.subtitle")}</p>

      <div className="mt-3 sm:mt-4 bg-[#F8F9FA] dark:bg-zinc-800 rounded-2xl sm:rounded-3xl p-2 sm:p-3 border border-zinc-100 dark:border-zinc-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="QR code" width={160} height={160} className="rounded-xl sm:rounded-2xl w-36 h-36 sm:w-40 sm:h-40 lg:w-[180px] lg:h-[180px]" />
      </div>

      <p className="text-[11px] font-bold tracking-widest text-zinc-400 mt-3">{t("qr.scanMe")}</p>
      <p className="text-xs font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-xl px-3 py-2 mt-2 break-all w-full">{displayUrl}</p>

      <div className="flex gap-2 w-full mt-3">
        <button onClick={copy} className="flex-1 rounded-2xl bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold py-2.5 text-sm hover:bg-black dark:hover:bg-zinc-100 transition">
          {copied ? t("qr.copied") : t("qr.copyLink")}
        </button>
        <a href={displayUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold py-2.5 text-sm text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
          {t("qr.openInMobile")}
        </a>
      </div>

      <p className="text-[11px] font-medium text-zinc-500 mt-3 leading-snug">{t("qr.sameWifi")}</p>

      <div className="mt-3 w-full bg-fitcal-mintLight dark:bg-emerald-500/10 rounded-2xl p-3 text-left">
        <p className="text-xs font-bold text-fitcal-mintDark">💡 Tip</p>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-1">
          {t("qr.sameWifi")} • {displayUrl.includes("localhost") ? "localhost nebude na mobile fungovať, použi 192.168.x.x" : "ak nefunguje kamera, použi https cez ngrok"}
        </p>
      </div>
    </div>
  );
}
