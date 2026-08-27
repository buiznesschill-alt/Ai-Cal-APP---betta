import { NextRequest } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { subscribeUserEvents, type ServerEventType } from "@/lib/serverEvents";

// Server-Sent Events stream – pushes instant change notifications to all
// devices/tabs logged in with the same account.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return new Response("Unauthorized", { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {}
      };
      // instruct EventSource to reconnect automatically after drops
      send("retry: 3000\n\n");
      unsubscribe = subscribeUserEvents(payload.userId, (type: ServerEventType) => {
        send(`event: ${type}\ndata: changed\n\n`);
      });
      // keep the connection alive through proxies
      heartbeat = setInterval(() => send(": ping\n\n"), 25000);
      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
