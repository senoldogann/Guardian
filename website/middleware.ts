import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CSP Directive Configuration
 * Report-Only mode for monitoring without blocking
 */
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-eval'", // Required for Next.js
    "'unsafe-inline'", // Required for Next.js
    "https://va.vercel-scripts.com", // Vercel Analytics
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'", // Required for styled-components/emotion
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https:",
  ],
  "font-src": [
    "'self'",
    "data:",
  ],
  "connect-src": [
    "'self'",
    "https://vitals.vercel-insights.com", // Vercel Vitals
    "https://va.vercel-scripts.com", // Vercel Analytics
  ],
  "media-src": ["'self'"],
  "object-src": ["'none'"],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  // Report-Only mode - violations logged but not blocked
  "report-uri": ["/api/csp-report"],
};

/**
 * Build CSP header value from directives
 */
function buildCSPHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Security Headers Configuration
 */
const SECURITY_HEADERS = {
  // CSP in Report-Only mode for monitoring
  "Content-Security-Policy-Report-Only": buildCSPHeader(CSP_DIRECTIVES),
  // Additional security headers
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/**
 * Next.js Middleware
 * Applies security headers to all responses
 */
export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Log CSP monitoring status in development
  if (process.env.NODE_ENV === "development") {
    console.info("[CSP] Report-Only mode active - violations will be logged to /api/csp-report");
  }

  return response;
}

/**
 * Matcher configuration
 * Apply middleware to all routes except static files and API routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
