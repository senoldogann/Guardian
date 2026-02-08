"use client";

import { useEffect } from "react";
import type { NextWebVitalsMetric } from "next/app";
import { trackEvent } from "./analytics";

/**
 * Web Vitals Metric Type
 * Reserved for future custom vitals tracking
 */
// type WebVitalMetric = {
//   id: string;
//   name: string;
//   startTime: number;
//   value: number;
//   label: "web-vital" | "custom";
// };

/**
 * Report Web Vitals Metrics
 * 
 * This function reports Core Web Vitals metrics to the console in development
 * and sends them to analytics services in production.
 * 
 * Metrics tracked:
 * - CLS (Cumulative Layout Shift)
 * - FID (First Input Delay)
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - TTFB (Time to First Byte)
 * - INP (Interaction to Next Paint)
 */
export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Web Vitals]", metric);
  }

  // Send to Vercel Analytics via custom event
  trackEvent("changelog_view", {
    page_path: `web_vital_${metric.name.toLowerCase()}`,
    [`${metric.name}_value`]: metric.value,
    [`${metric.name}_id`]: metric.id,
  });

  // Also send to custom endpoint for logging
  if (process.env.NODE_ENV === "production") {
    const body = JSON.stringify({
      ...metric,
      page: window.location.pathname,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/vitals", body);
    } else {
      fetch("/api/vitals", {
        body,
        method: "POST",
        keepalive: true,
      }).catch(console.error);
    }
  }
}

/**
 * Web Vitals Hook
 * 
 * Use this hook in your layout to automatically track Web Vitals
 */
export function useWebVitals() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    // Import web-vitals library dynamically (v5 API)
    Promise.all([
      import("web-vitals").then((mod) => mod.onCLS),
      import("web-vitals").then((mod) => mod.onINP),
      import("web-vitals").then((mod) => mod.onLCP),
      import("web-vitals").then((mod) => mod.onFCP),
      import("web-vitals").then((mod) => mod.onTTFB),
    ]).then(([onCLS, onINP, onLCP, onFCP, onTTFB]) => {
      // Core Web Vitals
      onCLS(console.log);
      onINP(console.log);
      onLCP(console.log);
      onFCP(console.log);
      onTTFB(console.log);
    }).catch((error) => {
      console.error("Failed to load web-vitals:", error);
    });
  }, []);
}

/**
 * Performance Monitoring Component
 * 
 * Add this to your root layout to enable performance monitoring
 */
export function PerformanceMonitor() {
  useWebVitals();
  return null;
}
