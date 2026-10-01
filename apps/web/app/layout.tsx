import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { OfflineNote, ServiceWorker } from "@/components/AppShell";
import { TabBar } from "@/components/TabBar";
import { t } from "@/lib/i18n/en";
import { Providers } from "./providers";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${t.app.name} — ${t.app.tagline}`, template: `%s — ${t.app.name}` },
  description: t.pwa.description,
  applicationName: t.app.name,
  // iOS: open full screen from the home screen
  appleWebApp: { capable: true, title: t.app.name, statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1012",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // the installed app draws under the notch; the header pads with the safe-area inset
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={grotesk.variable}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-button bg-bone px-4 py-2 font-medium text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-40"
        >
          {t.app.skip}
        </a>
        <Providers>
          <ServiceWorker />
          <header className="no-print mx-auto flex max-w-[var(--column)] items-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:pt-6">
            <span className="text-16 font-bold tracking-tight text-bone">{t.app.name}</span>
          </header>
          <TabBar />
          <OfflineNote />
          <main
            id="main"
            className="mx-auto max-w-[var(--column)] px-4 pt-6 pb-[calc(var(--tabbar-height)+var(--space-12))] md:pb-16"
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
