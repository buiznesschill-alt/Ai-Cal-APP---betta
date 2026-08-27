"use client";
import { mealTypeIcon } from "@/lib/mealIcons";

export function MealTypeIcon({ type, className = "" }: { type: string | null | undefined; className?: string }) {
  const src = mealTypeIcon(type);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} className={`select-none ${className}`} />;
}
