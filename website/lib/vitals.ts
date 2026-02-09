"use client";

import { useEffect, useCallback, useState } from "react";
import type { NextWebVitalsMetric } from "next/app";
import { trackEvent } from "./analytics";

// ============================================================================
// Core Web Vitals Thresholds (Google Recommended)
// ============================================================================

export type WebVitalName = "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";

export type WebVitalRating = "good" | "needs-improvement" | "poor";

export type WebVitalThreshold = {
  name: WebVitalName;
  good: number;
  poor: number;
  unit: string;
};

export const WEB_VITALS_THRESHOLDS: Record<WebVitalName, WebVitalThreshold> = {
  CLS: {
    name: "CLS",
    good: 0.1,
    poor: 0.25,
    unit: "",
  },
  FCP: {
    name: "FCP",
    good: 1800, // 1.8s
    poor: 3000, // 3s
    unit: "ms",
  },
  FID: {
    name: "FID",
    good: 100, // 100ms
    poor: 300, // 300ms
    unit: "ms",
  },
  INP: {
    name: "INP",
    good: 200, // 200ms
    poor: 500, // 500ms
    unit: "ms",
  },
  LCP: {
    name: "LCP",
    good: 2500, // 2.5s
    poor: 4000, // 4s
    unit: "ms",
  },
  TTFB: {
    name: "TTFB",
    good: 800, // 800ms
    poor: 1800, // 1.8s
    unit: "ms",
  },
};

// ============================================================================
// Alert Configuration
// ============================================================================

export type AlertConfig = {
  enabled: boolean;
  threshold: WebVitalRating;
  cooldownMs: number;
  webhookUrl?: string;
};

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  threshold: "poor",
  cooldownMs: 300000, // 5 minutes
};

// Alert tracking
const lastAlertTime: Record<WebVitalName, number> = {
  CLS: 0,
  FCP: 0,
  FID: 0,
  INP: 0,
  LCP: 0,
  TTFB: 0,
};

// ============================================================================
// Web Vitals Monitoring State
// ============================================================================

type WebVitalsState = {
  metrics: Record<WebVitalName, number | null>;
  ratings: Record<WebVitalName, WebVitalRating>;
  alerts: Array<{
    name: WebVitalName;
    value: number;
    rating: WebVitalRating;
    timestamp: string;
  }>;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get rating for a web vital value
 */
export function getWebVitalRating(name: WebVitalName, value: number): WebVitalRating {
  const threshold = WEB_VITALS_THRESHOLDS[name];
  
  if (value <= threshold.good) {
    return "good";
  } else if (value <= threshold.poor) {
    return "needs-improvement";
  } else {
    return "poor";
  }
}

/**
 * Format web vital value for display
 */
export function formatWebVitalValue(name: WebVitalName, value: number): string {
  const threshold = WEB_VITALS_THRESHOLDS[name];
  
  if (threshold.unit === "ms") {
    return `${Math.round(value)}ms`;
  }
  
  return value.toFixed(3);
}

/**
 * Send alert for poor web vital
 */
async function sendWebVitalAlert(
  name: WebVitalName,
  value: number,
  rating: WebVitalRating,
  config: AlertConfig
): Promise<void> {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastAlertTime[name] < config.cooldownMs) {
    return;
  }
  
  lastAlertTime[name] = now;
  
  const alertData = {
    type: "web-vital-alert",
    name,
    value,
    rating,
    threshold: WEB_VITALS_THRESHOLDS[name],
    timestamp: new Date().toISOString(),
    page: typeof window !== "undefined" ? window.location.pathname : "unknown",
  };
  
  // Log alert
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Web Vitals Alert] ${name} is ${rating}: ${formatWebVitalValue(name, value)}`);
  }
  
  // Send to analytics
  trackEvent("web_vital_alert", {
    metric_name: name,
    metric_value: value,
    metric_rating: rating,
    page_path: alertData.page,
  });
  
  // Send to webhook if configured
  if (config.webhookUrl) {
    try {
      await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertData),
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to send web vital alert:", error);
      }
    }
  }
  
  // Send to internal endpoint
  if (typeof window !== "undefined") {
    const body = JSON.stringify(alertData);
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/vitals/alert", body);
    } else {
      fetch("/api/vitals/alert", {
        method: "POST",
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  }
}

// ============================================================================
// Real User Monitoring (RUM)
// ============================================================================

export type RUMSession = {
  sessionId: string;
  startTime: number;
  pageViews: number;
  metrics: WebVitalsState;
};

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize RUM session
 */
function initRUMSession(): RUMSession {
  return {
    sessionId: generateSessionId(),
    startTime: Date.now(),
    pageViews: 1,
    metrics: {
      metrics: {
        CLS: null,
        FCP: null,
        FID: null,
        INP: null,
        LCP: null,
        TTFB: null,
      },
      ratings: {
        CLS: "good",
        FCP: "good",
        FID: "good",
        INP: "good",
        LCP: "good",
        TTFB: "good",
      },
      alerts: [],
    },
  };
}

// ============================================================================
// Enhanced Web Vitals Reporting
// ============================================================================

export function reportWebVitals(
  metric: NextWebVitalsMetric,
  alertConfig: AlertConfig = DEFAULT_ALERT_CONFIG
) {
  const name = metric.name as WebVitalName;
  const value = metric.value;
  const rating = getWebVitalRating(name, value);
  
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    const color = rating === "good" ? "🟢" : rating === "needs-improvement" ? "🟡" : "🔴";
    console.info(`[Web Vitals] ${color} ${name}: ${formatWebVitalValue(name, value)} (${rating})`);
  }
  
  // Send to analytics
  trackEvent("web_vital", {
    metric_name: name,
    metric_value: value,
    metric_rating: rating,
    metric_id: metric.id,
    page_path: typeof window !== "undefined" ? window.location.pathname : "unknown",
  });
  
  // Check if alert needed
  if (alertConfig.enabled) {
    const shouldAlert =
      alertConfig.threshold === "poor"
        ? rating === "poor"
        : alertConfig.threshold === "needs-improvement"
        ? rating === "poor" || rating === "needs-improvement"
        : true;
    
    if (shouldAlert && rating !== "good") {
      sendWebVitalAlert(name, value, rating, alertConfig);
    }
  }
  
  // Send to custom endpoint
  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    const body = JSON.stringify({
      ...metric,
      rating,
      page: window.location.pathname,
      timestamp: Date.now(),
    });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/vitals", body);
      } else {
        fetch("/api/vitals", {
          body,
          method: "POST",
          keepalive: true,
        }).catch(() => undefined);
      }
  }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get current web vitals state
 */
export function useWebVitalsState() {
  const [state, setState] = useState<WebVitalsState>({
    metrics: {
      CLS: null,
      FCP: null,
      FID: null,
      INP: null,
      LCP: null,
      TTFB: null,
    },
    ratings: {
      CLS: "good",
      FCP: "good",
      FID: "good",
      INP: "good",
      LCP: "good",
      TTFB: "good",
    },
    alerts: [],
  });
  
  const updateMetric = useCallback((name: WebVitalName, value: number) => {
    const rating = getWebVitalRating(name, value);
    
    setState((prev) => ({
      ...prev,
      metrics: { ...prev.metrics, [name]: value },
      ratings: { ...prev.ratings, [name]: rating },
      alerts:
        rating !== "good"
          ? [
              ...prev.alerts,
              {
                name,
                value,
                rating,
                timestamp: new Date().toISOString(),
              },
            ]
          : prev.alerts,
    }));
  }, []);
  
  return { state, updateMetric };
}

/**
 * Enhanced Web Vitals Hook with threshold monitoring
 */
export function useWebVitals(alertConfig: AlertConfig = DEFAULT_ALERT_CONFIG) {
  const { state, updateMetric } = useWebVitalsState();
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Initialize RUM session
    const session = initRUMSession();
    
    // Store session in window for debugging
    (window as Window & { __GUARDIAN_RUM_SESSION__?: typeof session }).__GUARDIAN_RUM_SESSION__ = session;
    
    // Load web-vitals library
    Promise.all([
      import("web-vitals").then((mod) => mod.onCLS),
      import("web-vitals").then((mod) => mod.onINP),
      import("web-vitals").then((mod) => mod.onLCP),
      import("web-vitals").then((mod) => mod.onFCP),
      import("web-vitals").then((mod) => mod.onTTFB),
    ])
      .then(([onCLS, onINP, onLCP, onFCP, onTTFB]) => {
        // Track each metric with threshold monitoring
        onCLS((metric) => {
          updateMetric("CLS", metric.value);
          reportWebVitals(metric as unknown as NextWebVitalsMetric, alertConfig);
        });
        
        onINP((metric) => {
          updateMetric("INP", metric.value);
          reportWebVitals(metric as unknown as NextWebVitalsMetric, alertConfig);
        });
        
        onLCP((metric) => {
          updateMetric("LCP", metric.value);
          reportWebVitals(metric as unknown as NextWebVitalsMetric, alertConfig);
        });
        
        onFCP((metric) => {
          updateMetric("FCP", metric.value);
          reportWebVitals(metric as unknown as NextWebVitalsMetric, alertConfig);
        });
        
        onTTFB((metric) => {
          updateMetric("TTFB", metric.value);
          reportWebVitals(metric as unknown as NextWebVitalsMetric, alertConfig);
        });
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load web-vitals:", error);
        }
      });
  }, [alertConfig, updateMetric]);
  
  return state;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Performance Monitor Component
 */
export function PerformanceMonitor({
  alertConfig = DEFAULT_ALERT_CONFIG,
}: {
  alertConfig?: AlertConfig;
}) {
  useWebVitals(alertConfig);
  return null;
}

/**
 * Get Web Vitals report for debugging
 */
export function getWebVitalsReport(state: WebVitalsState): string {
  const lines = ["Web Vitals Report:", ""];
  
  (Object.keys(WEB_VITALS_THRESHOLDS) as WebVitalName[]).forEach((name) => {
    const value = state.metrics[name];
    const rating = state.ratings[name];
    const icon = rating === "good" ? "✓" : rating === "needs-improvement" ? "⚠" : "✗";
    
    lines.push(`${icon} ${name}: ${value !== null ? formatWebVitalValue(name, value) : "-"} (${rating})`);
  });
  
  if (state.alerts.length > 0) {
    lines.push("", `Alerts: ${state.alerts.length}`);
  }
  
  return lines.join("\n");
}

// Export types and utilities
export type { WebVitalsState };
