"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let openModals = 0;
function syncModalClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("modal-open", openModals > 0);
}

/**
 * Renders children into document.body and flags <html> with .modal-open
 * ONLY while `active` (i.e. the window is actually open).
 * Stays attached ~280ms after deactivation so the exit animation can play.
 */
export function ClientPortal({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const [host] = useState(() => (typeof document !== "undefined" ? document.createElement("div") : null));
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(active);

  // keep the portal attached briefly after closing (exit animation)
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (!host || !mounted) return;
    host.className = "modal-host";
    document.body.appendChild(host);
    openModals++;
    syncModalClass();
    setReady(true);
    return () => {
      host.remove();
      openModals = Math.max(0, openModals - 1);
      syncModalClass();
    };
  }, [host, mounted]);

  if (!ready || !host || !mounted) return null;
  return createPortal(children, host);
}
