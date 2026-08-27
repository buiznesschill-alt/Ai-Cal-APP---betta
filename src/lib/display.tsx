"use client";
import { useCallback, useEffect, useState } from "react";

export type DisplayMode = "split" | "stacked";
const PREFIX = "fitcal_display_";

// Module-level shared store – every subscriber of the same section updates live
const cache = new Map<string, DisplayMode>();
const listeners = new Map<string, Set<() => void>>();

function load(section: string): DisplayMode {
  if (cache.has(section)) return cache.get(section)!;
  let mode: DisplayMode = "split";
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(PREFIX + section) : null;
    if (stored === "split" || stored === "stacked") mode = stored;
  } catch {}
  cache.set(section, mode);
  return mode;
}

function notify(section: string) {
  listeners.get(section)?.forEach((fn) => fn());
}

export function setDisplayMode(section: string, m: DisplayMode) {
  cache.set(section, m);
  try {
    localStorage.setItem(PREFIX + section, m);
  } catch {}
  notify(section);
}

/** Per-section panel arrangement – each section remembers its own setting, updates live everywhere */
export function useSectionDisplay(section: string): [DisplayMode, (m: DisplayMode) => void] {
  const [display, setState] = useState<DisplayMode>(() => cache.get(section) ?? "split");

  useEffect(() => {
    const update = () => setState(load(section));
    update();
    if (!listeners.has(section)) listeners.set(section, new Set());
    const subs = listeners.get(section)!;
    subs.add(update);
    return () => {
      subs.delete(update);
    };
  }, [section]);

  const setDisplay = useCallback((m: DisplayMode) => setDisplayMode(section, m), [section]);

  return [display, setDisplay];
}
