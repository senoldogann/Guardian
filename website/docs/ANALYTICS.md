# Analytics & Performance Monitoring

This document explains how analytics and performance monitoring are implemented in the Guardian website.

## Overview

The website includes comprehensive analytics tracking for:
- **User Interactions**: Downloads, theme toggles, video plays
- **Performance Metrics**: Core Web Vitals (LCP, FID, CLS, TTFB, INP)
- **Error Tracking**: Error boundary triggers with stack traces
- **Page Views**: Automatic page view tracking

## Architecture

### Analytics Stack

1. **Vercel Analytics** (`@vercel/analytics`)
   - Automatic page view tracking
   - Custom event tracking
   - Privacy-focused, GDPR compliant
   - No cookies required

2. **Vercel Speed Insights** (`@vercel/speed-insights`)
   - Real User Monitoring (RUM)
   - Core Web Vitals tracking
   - Performance scoring

3. **Custom Analytics Library** (`lib/analytics.ts`)
   - Unified event tracking interface
   - Type-safe event definitions
   - Multi-provider support (Vercel, GA ready)
   - Development mode logging

## Tracked Events

### Download Events

```typescript
trackDownload({
  platform: "darwin",    // OS platform
  version: "1.0.0",      // Release version
  assetName: "guardian-1.0.0-darwin.dmg",
  downloadUrl: "https://..."
});
```

**Triggered when:**
- User clicks "Download" button
- Direct download is initiated

**Location:** `components/ui/direct-download-button.tsx`

### Theme Toggle Events

```typescript
trackThemeToggle("dark");  // or "light"
```

**Triggered when:**
- User switches between light/dark theme
- Does not track "system" theme selection

**Location:** `components/theme-toggle.tsx`

### Error Events

```typescript
trackError(error, componentStack);
```

**Triggered when:**
- Error Boundary catches a React error
- Includes error message and component stack

**Location:** `components/error-boundary.tsx`

### Video Events

```typescript
trackVideo("play", "hero-video", currentTime, duration);
trackVideo("pause", "hero-video", currentTime, duration);
```

**Implementation needed in:** `components/home-page.tsx` (video components)

## Web Vitals Integration

Core Web Vitals are automatically tracked and sent to analytics:

```typescript
// Automatically tracked metrics:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)  
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
- INP (Interaction to Next Paint)
- FCP (First Contentful Paint)
```

**Location:** `lib/vitals.ts`, `app/api/vitals/route.ts`

## Development Mode

Analytics are disabled by default in development. To enable analytics in development:

```bash
NEXT_PUBLIC_DEV_ANALYTICS=true npm run dev
```

## Production Setup

### 1. Deploy to Vercel

Analytics are automatically enabled when deployed to Vercel. No configuration needed.

### 2. Manual Deployment (Other Hosts)

Set these environment variables:

```bash
# Optional: Enable specific Vercel features
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS_ID=your_insights_id
```

### 3. Google Analytics (Optional)

To add Google Analytics, update `lib/analytics.ts`:

```typescript
// Already prepared - just add your GA4 ID
if (typeof window !== "undefined" && "gtag" in window) {
  window.gtag("event", event, properties);
}
```

Add to `app/layout.tsx`:

```tsx
<Script
  src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
  strategy="afterInteractive"
/>
```

## Privacy & Compliance

### GDPR Compliance

- ✅ No cookies used by default
- ✅ No personal data collected
- ✅ IP addresses anonymized
- ✅ Data processed in EU (Vercel)

### User Consent

Analytics are gated by the cookie consent preferences stored in `guardian_cookie_consent`.
When `analytics` is false, no analytics events are sent and the analytics script is not rendered.

## Viewing Analytics Data

### Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Analytics** tab
4. View:
   - Page views
   - Custom events
   - Performance metrics
   - Error rates

### Custom Endpoint

Web Vitals are also sent to `/api/vitals` for custom logging:

```typescript
// app/api/vitals/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  
  // Log to your preferred service:
  // - Database
  // - Logging service (Datadog, LogRocket)
  // - Analytics platform
  
  return new Response("OK", { status: 200 });
}
```

## Adding New Events

### 1. Define Event Type

Update `lib/analytics.ts`:

```typescript
export type AnalyticsEvent =
  | "download_click"
  | "your_new_event"  // Add here
  | ...;
```

### 2. Create Helper Function (Optional)

```typescript
export function trackYourEvent(data: YourData): void {
  trackEvent("your_new_event", {
    custom_property: data.value,
  });
}
```

### 3. Track in Component

```typescript
import { trackYourEvent } from "@/lib/analytics";

function YourComponent() {
  const handleAction = () => {
    trackYourEvent({ value: 123 });
  };
}
```

## Testing

### Unit Tests

Analytics functions are tested in `lib/analytics.test.ts` (to be created):

```typescript
describe("analytics", () => {
  it("should track download events", () => {
    const spy = vi.spyOn(window, "va");
    trackDownload({
      platform: "darwin",
      version: "1.0.0",
      assetName: "test.dmg",
      downloadUrl: "https://test.com"
    });
    expect(spy).toHaveBeenCalledWith("event", "download_click", ...);
  });
});
```

### E2E Tests

Analytics tracking is tested in Playwright:

```typescript
test("should track download click", async ({ page }) => {
  await page.route("**/api/vitals", route => {
    // Intercept analytics calls
    route.fulfill({ status: 200 });
  });
  
  await page.click("[data-testid='download-button']");
  // Assert analytics was called
});
```

## Troubleshooting

### Events Not Showing Up

1. **Check environment:**
   ```bash
   process.env.NODE_ENV;  // Should be "production"
   ```

2. **Check Vercel deployment:**
   - Analytics only work in production builds
   - Test with `npm run build && npm start`

3. **Check browser console:**
   - Should see no errors
   - In dev: Should see `📊 Analytics Event` logs

### Performance Impact

Analytics have minimal performance impact:
- **Bundle size:** ~3 KB gzipped (Vercel Analytics)
- **Runtime overhead:** <1ms per event
- **Network:** Events batched and sent async

### Data Delays

- **Real-time events:** 30-60 seconds delay
- **Aggregated data:** 5-10 minutes delay
- **Historical reports:** Updated hourly

## Best Practices

1. **Event Naming:** Use snake_case for consistency
2. **Property Names:** Keep them short and descriptive
3. **PII:** Never track personal information
4. **Testing:** Always test in development mode first
5. **Documentation:** Update this file when adding new events

## Resources

- [Vercel Analytics Docs](https://vercel.com/docs/analytics)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [GDPR Compliance](https://gdpr.eu/)
- [Privacy-First Analytics](https://plausible.io/data-policy)
