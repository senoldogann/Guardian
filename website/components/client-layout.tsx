"use client";

import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { CommandHeader } from "./ui/command-header";
import { SiteFooter } from "./site-footer";
import { ThemeProvider } from "./theme-provider";
import { PerformanceMonitor } from "@/lib/vitals";
import { CSPMonitor } from "@/lib/csp-monitor";
import { CookieConsentProvider, useCookieConsent } from "@/lib/cookie-consent";
import { CookieBanner } from "./privacy/CookieBanner";

function AnalyticsBridge() {
  const { preferences } = useCookieConsent();
  const [hasGtag, setHasGtag] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasGtag("gtag" in window);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasGtag) return;

    try {
      // @ts-expect-error - gtag may not have types
      window.gtag("consent", "update", {
        analytics_storage: preferences.analytics ? "granted" : "denied",
        ad_storage: preferences.marketing ? "granted" : "denied",
      });
    } catch {
      // Ignore consent update failures
    }
  }, [preferences.analytics, preferences.marketing, hasGtag]);

  return null;
}

function ConsentAnalytics() {
  const { preferences } = useCookieConsent();

  if (!preferences.analytics) return null;

  return <Analytics />;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* Performance monitoring */}
      <PerformanceMonitor />

      {/* CSP Violation monitoring */}
      <CSPMonitor />

      <CookieConsentProvider>
        <AnalyticsBridge />
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
        {/* Analytics - Automatic page view tracking */}
        <ConsentAnalytics />
      </CookieConsentProvider>
    </ThemeProvider>
  );
}
