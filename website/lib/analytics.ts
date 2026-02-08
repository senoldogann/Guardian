/**
 * Analytics & Event Tracking Utilities
 * 
 * Provides a unified interface for tracking user interactions,
 * custom events, and integrating with analytics providers.
 */

export type AnalyticsEvent =
  | "download_click"
  | "download_complete"
  | "video_play"
  | "video_pause"
  | "theme_toggle"
  | "docs_search"
  | "external_link_click"
  | "error_boundary_triggered"
  | "changelog_view"
  | "release_view"
  | "web_vital"
  | "web_vital_alert";

export type AnalyticsProperties = {
  // Download events
  platform?: string;
  version?: string;
  asset_name?: string;
  download_url?: string;
  
  // Video events
  video_id?: string;
  video_duration?: number;
  video_timestamp?: number;
  
  // Theme events
  theme?: "light" | "dark";
  
  // Navigation events
  page_path?: string;
  external_url?: string;
  
  // Error events
  error_message?: string;
  error_component?: string;
  
  // Generic
  [key: string]: string | number | boolean | undefined;
};

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== "undefined";
const CONSENT_STORAGE_KEY = "guardian_cookie_consent";

/**
 * Check if analytics should be enabled (production + consent)
 */
function hasAnalyticsConsent(): boolean {
  if (!isBrowser) return false;

  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as { analytics?: boolean };
    return Boolean(parsed?.analytics);
  } catch {
    return false;
  }
}

function isAnalyticsEnabled(): boolean {
  if (!isBrowser) return false;

  // Only enable in production or if explicitly enabled in dev
  const isDev = process.env.NODE_ENV === "development";
  const devAnalytics = process.env.NEXT_PUBLIC_DEV_ANALYTICS === "true";
  if (isDev && !devAnalytics) return false;

  return hasAnalyticsConsent();
}

/**
 * Track a custom event
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties
): void {
  if (!isAnalyticsEnabled()) {
    return;
  }
  
  // Vercel Analytics (if available)
  if (typeof window !== "undefined" && "va" in window) {
    try {
      // @ts-expect-error - Vercel Analytics may not have types
      window.va("event", event, properties);
    } catch {
      // Ignore analytics provider errors
    }
  }
  
  // Google Analytics (if available)
  if (typeof window !== "undefined" && "gtag" in window) {
    try {
      // @ts-expect-error - gtag may not have types
      window.gtag("event", event, properties);
    } catch {
      // Ignore analytics provider errors
    }
  }
}

/**
 * Track a page view
 */
export function trackPageView(url: string): void {
  if (!isAnalyticsEnabled()) return;
  
  trackEvent("changelog_view", { page_path: url });
}

/**
 * Track a download event
 */
export function trackDownload(properties: {
  platform: string;
  version: string;
  assetName: string;
  downloadUrl: string;
}): void {
  trackEvent("download_click", {
    platform: properties.platform,
    version: properties.version,
    asset_name: properties.assetName,
    download_url: properties.downloadUrl,
  });
}

/**
 * Track a video interaction
 */
export function trackVideo(
  action: "play" | "pause",
  videoId: string,
  currentTime?: number,
  duration?: number
): void {
  const event = action === "play" ? "video_play" : "video_pause";
  
  trackEvent(event, {
    video_id: videoId,
    video_timestamp: currentTime,
    video_duration: duration,
  });
}

/**
 * Track theme toggle
 */
export function trackThemeToggle(newTheme: "light" | "dark"): void {
  trackEvent("theme_toggle", { theme: newTheme });
}

/**
 * Track external link clicks
 */
export function trackExternalLink(url: string): void {
  trackEvent("external_link_click", { external_url: url });
}

/**
 * Track error boundary triggers
 */
export function trackError(error: Error, componentStack?: string): void {
  trackEvent("error_boundary_triggered", {
    error_message: error.message,
    error_component: componentStack || "unknown",
  });
}

/**
 * Track docs search
 */
export function trackDocsSearch(query: string): void {
  trackEvent("docs_search", { page_path: query });
}

/**
 * Identify a user (if using user-based analytics)
 */
export function identifyUser(_userId: string, _traits?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;

  // Placeholder for future analytics identity integration.
}

/**
 * Reset analytics (on logout, etc.)
 */
export function resetAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
}
