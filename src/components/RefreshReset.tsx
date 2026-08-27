"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

export function RefreshReset() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    window.scrollTo(0, 0);
    if (pathname !== "/" && pathname !== "/login" && pathname !== "/register") {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
