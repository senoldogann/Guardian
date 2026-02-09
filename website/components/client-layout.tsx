"use client";

import { CommandHeader } from "./ui/command-header";
import { SiteFooter } from "./site-footer";
import { ThemeProvider } from "./theme-provider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
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
      </div>
    </ThemeProvider>
  );
}
