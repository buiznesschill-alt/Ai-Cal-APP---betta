import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { RefreshReset } from "@/components/RefreshReset";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "FitCal Beta – AI Calorie Tracker",
  description: "YAZIO-like AI calorie tracker – odfot jedlo, spočítam kalórie",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "FitCal", statusBarStyle: "default" },
  icons: {
    // favicon podľa systému, ?v=3 = bypass starej cache (predtým biele pozadie)
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon-light.png?v=3", sizes: "64x64", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png?v=3", sizes: "64x64", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#00C896",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Sets dark class before first paint (no flash)
const noFlashScript = `(function(){try{var m=localStorage.getItem('fitcal_theme_mode')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (cookies().get("fitcal_locale")?.value as "sk" | "en") || "sk";
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-[#F8F9FA] antialiased" suppressHydrationWarning>
        <I18nProvider initialLocale={locale}>
          <ThemeProvider>
            <RefreshReset />
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
