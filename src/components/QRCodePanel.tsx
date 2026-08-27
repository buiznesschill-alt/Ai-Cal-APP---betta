"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export function QRCodePanel() {
  const { t } = useI18n();
  const [url, setUrl] = useState<string>("");
  const [lanUrl, setLanUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    setUrl(origin);
    // Default to origin, but if origin is localhost/127, use LAN IP fallback immediately
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
    const port = window.location.port || "3002";
    const fallbackLan = `http://192.168.1.14:${port}`;
    setLanUrl(isLocalhost ? fallbackLan : origin);
    fetch("/api/info")
      .then((r) => r.json())
      .then((d) => {
        if (d.lanUrl && d.lanUrl.includes("192.168.")) setLanUrl(d.lanUrl);
        else if (d.lanIp) setLanUrl(`http://${d.lanIp}:${port}`);
        else if (isLocalhost) setLanUrl(fallbackLan);
      })
      .catch(() => {
        if (isLocalhost) setLanUrl(fallbackLan);
      });
  }, []);

  const displayUrl = lanUrl || url;
  const qrSrc = displayUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(displayUrl)}&color=1A1C1E&bgcolor=F8F9FA` : "";

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
