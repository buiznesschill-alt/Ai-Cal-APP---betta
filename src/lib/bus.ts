"use client";

// Tiny client-side event bus for live UI sync without page refreshes.
// emitBus() dispatches locally AND broadcasts to all other tabs/windows of
// the same browser via BroadcastChannel, where the event is re-dispatched.
export const BUS = {
  meals: "fitcal:meals-changed",
  favorites: "fitcal:favorites-changed",
  water: "fitcal:water-changed",
  weights: "fitcal:weights-changed",
} as const;

const CHANNEL_NAME = "fitcal-sync";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    if (typeof BroadcastChannel === "undefined") return null; // very old browsers
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (ev) => {
        const name = ev?.data?.name;
        if (typeof name === "string" && Object.values(BUS).includes(name as any)) {
          window.dispatchEvent(new CustomEvent(name));
        }
      };
    } catch {
      channel = null;
    }
  }
  return channel;
}

export function emitBus(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
  getChannel()?.postMessage({ name });
}

export function onBus(name: string, fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}
