"use client";
import { useEffect, useRef, useState } from "react";

type XPos = "center" | "left" | "right";
type YPos = "below" | "above";

// Malé „i" tlačidlo s rozbaliteľným popisom metriky – rovnaký vzor ako pri Macro split.
// Na mobile sa popover prispôsobí okrajom obrazovky (nevylieza mimo visible range).
export function InfoHint({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: XPos; y: YPos }>({ x: "center", y: "below" });
  const ref = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    // pri scrolle popover zavri – pozícia už nezodpovedá ikonke
    window.addEventListener("scroll", () => setOpen(false), { passive: true, once: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 128; // polovica šírky popoveru + rezerva
      const x: XPos = r.left < margin ? "left" : vw - r.right < margin ? "right" : "center";
      const y: YPos = window.innerHeight - r.bottom < 170 ? "above" : "below";
      setPos({ x, y });
    }
    setOpen((v) => !v);
  }

  const xCls = pos.x === "center" ? "left-1/2 -translate-x-1/2" : pos.x === "left" ? "left-0" : "right-0";
  const yCls = pos.y === "below" ? "top-full mt-1.5" : "bottom-full mb-1.5";

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onTouchEnd={(e) => e.stopPropagation()}
        aria-label={label || text}
        title={label || text}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 text-[10px] font-bold leading-none transition shrink-0"
      >
        i
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${yCls} ${xCls} z-50 w-56 max-w-[calc(100vw-12px)] rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-lg px-3 py-2 text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-300 leading-snug font-medium`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
