"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
const KEY = "fitcal_theme_mode";

function applyMode(mode: ThemeMode): "light" | "dark" {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

const ThemeCtx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void; resolved: "light" | "dark" }>({
  mode: "system",
  setMode: () => {},
  resolved: "light",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: ThemeMode = "system";
    try {
      stored = (localStorage.getItem(KEY) as ThemeMode) || "system";
    } catch {}
    setModeState(stored);
    setResolved(applyMode(stored));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let m: ThemeMode = "system";
      try {
        m = (localStorage.getItem(KEY) as ThemeMode) || "system";
      } catch {}
      setResolved(applyMode(m));
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    setResolved(applyMode(m));
    try {
      localStorage.setItem(KEY, m);
    } catch {}
  }

  return <ThemeCtx.Provider value={{ mode, setMode, resolved }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
