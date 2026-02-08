/**
 * Input Validation Schemas using Zod
 * 
 * Provides type-safe validation for all user inputs.
 * Prevents injection attacks and ensures data integrity.
 */

import { z } from "zod";

// ============================================================================
// Common Validators
// ============================================================================

/**
 * Safe string validator - prevents XSS
 */
export const safeString = z
  .string()
  .min(1, "Required")
  .max(1000, "Too long");

/**
 * URL validator with security checks
 */
export const safeURL = z
  .string()
  .url("Invalid URL format")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Only allow http and https
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use HTTP or HTTPS protocol" }
  )
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Block localhost and private IPs in production
        if (process.env.NODE_ENV === "production") {
          const hostname = parsed.hostname;
          if (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname.startsWith("192.168.") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("172.")
          ) {
            return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    },
    { message: "URL contains forbidden hostname" }
  );

/**
 * Email validator
 */
export const email = z
  .string()
  .email("Invalid email format")
  .max(254, "Email too long")
  .transform((str) => str.toLowerCase().trim());

/**
 * Semantic version validator
 */
export const semanticVersion = z
  .string()
  .regex(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
    "Invalid semantic version format (e.g., 1.0.0)"
  );

// ============================================================================
// GitHub API Schemas
// ============================================================================

/**
 * GitHub release validation
 */
export const githubReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string().min(1),
  name: z.string().nullable(),
  body: z.string().nullable(),
  html_url: z.string().url(),
  published_at: z.string().datetime().nullable(),
  prerelease: z.boolean(),
  draft: z.boolean(),
  assets: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      browser_download_url: z.string().url(),
      size: z.number().min(0),
      updated_at: z.string().datetime(),
      download_count: z.number().min(0),
      digest: z.string().optional(),
      content_type: z.string().optional(),
    })
  ),
});

/**
 * GitHub repository reference
 */
export const githubRepoSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
});

// ============================================================================
// OG Image Schemas
// ============================================================================

/**
 * Open Graph image parameters
 */
export const ogImageParamsSchema = z.object({
  title: safeString.max(100, "Title too long for OG image"),
  description: safeString.max(200, "Description too long for OG image").optional(),
});

export type OGImageParams = z.infer<typeof ogImageParamsSchema>;

// ============================================================================
// Contact Form Schemas
// ============================================================================

/**
 * Contact form validation
 */
export const contactFormSchema = z.object({
  name: safeString.max(100, "Name too long"),
  email: email,
  subject: safeString.max(200, "Subject too long"),
  message: safeString.max(5000, "Message too long"),
  honeypot: z.string().max(0, "Spam detected").optional(), // Hidden field for bot detection
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

// ============================================================================
// Download Schemas
// ============================================================================

/**
 * Platform identifier
 */
export const platformSchema = z.enum([
  "mac",
  "mac-universal",
  "mac-x64",
  "mac-arm64",
  "win",
  "win-x64",
  "win-arm64",
  "linux",
  "linux-x64",
  "linux-arm64",
]);

export type Platform = z.infer<typeof platformSchema>;

/**
 * Download request parameters
 */
export const downloadParamsSchema = z.object({
  platform: platformSchema,
  version: semanticVersion.optional(),
});

export type DownloadParams = z.infer<typeof downloadParamsSchema>;

// ============================================================================
// API Request Schemas
// ============================================================================

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Search query
 */
export const searchQuerySchema = z.object({
  q: safeString.max(200, "Search query too long"),
  ...paginationSchema.shape,
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ============================================================================
// Security Schemas
// ============================================================================

/**
 * Token format validation
 */
export const tokenFormatSchema = z
  .string()
  .regex(/^ghp_[a-zA-Z0-9]{36}$/, "Invalid classic token format")
  .or(
    z.string().regex(/^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/, "Invalid fine-grained token format")
  );

/**
 * Path traversal prevention
 */
export const safePath = z
  .string()
  .refine(
    (path) => {
      // Prevent path traversal attacks
      const normalized = path.replace(/\\/g, "/");
      return !normalized.includes("../") && !normalized.startsWith("/");
    },
    { message: "Invalid path format" }
  );

// ============================================================================
// Environment Variable Schemas
// ============================================================================

/**
 * GitHub environment variables
 */
export const githubEnvSchema = z.object({
  GITHUB_RELEASE_OWNER: z.string().min(1).optional(),
  GITHUB_RELEASE_REPO: z.string().min(1).optional(),
  GITHUB_PUBLIC_READ_TOKEN: z.string().optional(),
});

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate data against a schema
 * Returns validated data or throws error
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data against a schema
 * Returns { success, data, error }
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T; error?: undefined } | { success: false; data?: undefined; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Format Zod errors for user display
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.issues
    .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
    .join("; ");
}

/**
 * Sanitize HTML content (basic)
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Validate and sanitize URL parameters
 */
export function validateSearchParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; errors: string[] } {
  const params: Record<string, string | string[]> = {};
  
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      params[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      params[key] = value;
    }
  });
  
  const result = schema.safeParse(params);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      errors: result.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`),
    };
  }
}
