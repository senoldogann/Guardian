"use client";

import { Analytics } from "@vercel/analytics/react";
import { CommandHeader } from "./ui/command-header";
import { SiteFooter } from "./site-footer";
import { ThemeProvider } from "./theme-provider";
import { PerformanceMonitor } from "@/lib/vitals";
import { CookieConsentProvider } from "@/lib/cookie-consent";
import { CookieBanner } from "./privacy/CookieBanner";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* Performance monitoring */}
      <PerformanceMonitor />

      <CookieConsentProvider>
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-lg focus:font-medium"
        >
          Skip to main content
        </a>
        <div className="site-shell bg-white dark:bg-black min-h-screen transition-colors duration-300">
          <CommandHeader />
          <main id="main-content" className="page" role="main">
            {children}
          </main>
          <SiteFooter />
          <CookieBanner />
        </div>
      </CookieConsentProvider>
      {/* Analytics - Automatic page view tracking */}
      <Analytics />
    </ThemeProvider>
  );
}
