/**
 * Token Audit Logging System
 * 
 * Tracks GitHub token usage for security monitoring and compliance.
 * Logs token operations without exposing sensitive token data.
 */

export type TokenAuditEvent = {
  timestamp: string;
  eventType: "token_usage" | "token_rotation" | "validation_failure" | "rate_limit";
  details: TokenUsageDetails | TokenRotationDetails | ValidationFailureDetails | RateLimitDetails;
};

type TokenUsageDetails = {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  success: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: string;
  durationMs: number;
};

type TokenRotationDetails = {
  reason: "scheduled" | "emergency" | "compromise_suspected" | "team_change";
  oldTokenFingerprint: string;
  newTokenFingerprint: string;
  performedBy: string;
};

type ValidationFailureDetails = {
  failureReason: "invalid_format" | "expired" | "insufficient_permissions" | "revoked";
  attemptedEndpoint: string;
  sourceIp?: string;
};

type RateLimitDetails = {
  limit: number;
  remaining: number;
  resetTime: string;
  endpoint: string;
};

// In-memory audit log (production: use proper logging service)
const auditLog: TokenAuditEvent[] = [];
const MAX_AUDIT_LOG_SIZE = 1000;

/**
 * Generate a fingerprint (hash) of a token for audit purposes
 * Never log the actual token!
 */
export function generateTokenFingerprint(token: string): string {
  if (!token || token.length < 8) return "invalid";
  
  // Show first 4 and last 4 characters only
  const firstFour = token.slice(0, 4);
  const lastFour = token.slice(-4);
  const middleLength = token.length - 8;
  
  return `${firstFour}${"*".repeat(Math.min(middleLength, 8))}${lastFour}`;
}

/**
 * Log token usage event
 */
export function logTokenUsage(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  success: boolean,
  durationMs: number,
  rateLimitInfo?: { remaining: number; reset: string }
): void {
  const event: TokenAuditEvent = {
    timestamp: new Date().toISOString(),
    eventType: "token_usage",
    details: {
      endpoint,
      method,
      success,
      durationMs,
      rateLimitRemaining: rateLimitInfo?.remaining,
      rateLimitReset: rateLimitInfo?.reset,
    },
  };

  addToAuditLog(event);
  
  // Development logging
  if (process.env.NODE_ENV === "development") {
    console.log("[Token Audit] Usage:", {
      endpoint,
      success,
      duration: `${durationMs}ms`,
    });
  }
}

/**
 * Log token rotation event
 */
export function logTokenRotation(
  reason: "scheduled" | "emergency" | "compromise_suspected" | "team_change",
  oldToken: string,
  newToken: string,
  performedBy: string
): void {
  const event: TokenAuditEvent = {
    timestamp: new Date().toISOString(),
    eventType: "token_rotation",
    details: {
      reason,
      oldTokenFingerprint: generateTokenFingerprint(oldToken),
      newTokenFingerprint: generateTokenFingerprint(newToken),
      performedBy,
    },
  };

  addToAuditLog(event);
  
  // Always log rotations (important security event)
  console.log("[Token Audit] Token rotated:", {
    reason,
    performedBy,
    timestamp: event.timestamp,
  });
}

/**
 * Log token validation failure
 */
export function logValidationFailure(
  failureReason: "invalid_format" | "expired" | "insufficient_permissions" | "revoked",
  attemptedEndpoint: string,
  sourceIp?: string
): void {
  const event: TokenAuditEvent = {
    timestamp: new Date().toISOString(),
    eventType: "validation_failure",
    details: {
      failureReason,
      attemptedEndpoint,
      sourceIp,
    },
  };

  addToAuditLog(event);
  
  // Security-critical: always log failures
  console.error("[Token Audit] Validation failed:", {
    failureReason,
    attemptedEndpoint,
    timestamp: event.timestamp,
  });
}

/**
 * Log rate limit event
 */
export function logRateLimit(
  limit: number,
  remaining: number,
  resetTime: string,
  endpoint: string
): void {
  const event: TokenAuditEvent = {
    timestamp: new Date().toISOString(),
    eventType: "rate_limit",
    details: {
      limit,
      remaining,
      resetTime,
      endpoint,
    },
  };

  addToAuditLog(event);
  
  if (remaining < 10) {
    console.warn("[Token Audit] Rate limit critical:", {
      remaining,
      endpoint,
      resetTime,
    });
  }
}

/**
 * Add event to audit log with size limit
 */
function addToAuditLog(event: TokenAuditEvent): void {
  auditLog.push(event);
  
  // Prevent unbounded growth
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }
  
  // Production: Send to external logging service
  if (typeof window !== "undefined" && window.__GUARDIAN_TOKEN_AUDIT_HANDLER__) {
    window.__GUARDIAN_TOKEN_AUDIT_HANDLER__(event);
  }
}

/**
 * Get recent audit events
 */
export function getRecentAuditEvents(
  eventType?: TokenAuditEvent["eventType"],
  limit = 100
): TokenAuditEvent[] {
  let events = [...auditLog];
  
  if (eventType) {
    events = events.filter((e) => e.eventType === eventType);
  }
  
  return events.slice(-limit);
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEvents: number;
  usageCount: number;
  rotationCount: number;
  failureCount: number;
  rateLimitCount: number;
} {
  return {
    totalEvents: auditLog.length,
    usageCount: auditLog.filter((e) => e.eventType === "token_usage").length,
    rotationCount: auditLog.filter((e) => e.eventType === "token_rotation").length,
    failureCount: auditLog.filter((e) => e.eventType === "validation_failure").length,
    rateLimitCount: auditLog.filter((e) => e.eventType === "rate_limit").length,
  };
}

/**
 * Export audit log (for compliance/archiving)
 */
export function exportAuditLog(): string {
  return JSON.stringify(auditLog, null, 2);
}

/**
 * Clear audit log (use with caution)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

// Global handler for external logging integration
declare global {
  interface Window {
    __GUARDIAN_TOKEN_AUDIT_HANDLER__?: (event: TokenAuditEvent) => void;
  }
}

export function setAuditLogHandler(handler: (event: TokenAuditEvent) => void): void {
  if (typeof window !== "undefined") {
    window.__GUARDIAN_TOKEN_AUDIT_HANDLER__ = handler;
  }
}
