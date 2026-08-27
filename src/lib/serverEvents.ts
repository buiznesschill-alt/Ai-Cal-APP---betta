import { EventEmitter } from "events";

export type ServerEventType = "meals" | "favorites" | "water" | "weights" | "sickness" | "supplements";

// survive Next.js dev hot reloads via globalThis singleton
const g = globalThis as typeof globalThis & { __fitcalServerEvents?: EventEmitter };
export const serverEvents: EventEmitter = g.__fitcalServerEvents ?? new EventEmitter();
g.__fitcalServerEvents = serverEvents;
serverEvents.setMaxListeners(100);

export function emitUserEvent(userId: string, type: ServerEventType): void {
  if (!userId) return;
  serverEvents.emit(`user:${userId}`, type);
}

export function subscribeUserEvents(userId: string, cb: (type: ServerEventType) => void): () => void {
  const ch = `user:${userId}`;
  const handler = (t: ServerEventType) => cb(t);
  serverEvents.on(ch, handler);
  return () => {
    serverEvents.off(ch, handler);
  };
}
