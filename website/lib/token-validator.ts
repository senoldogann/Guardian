/**
 * Token Validation System
 * 
 * Validates GitHub tokens before use to ensure security and compliance.
 * Checks format, permissions, and expiration without exposing token data.
 */

import { logValidationFailure } from "./token-audit";

export type TokenValidationResult = {
  valid: boolean;
  reason?: string;
  expiresAt?: string;
  permissions?: string[];
  fingerprint?: string;
};

export type TokenPermissions = {
  hasPublicRepo: boolean;
  hasRepo: boolean;
  hasWorkflow: boolean;
  hasAdmin: boolean;
  scopes: string[];
};

// Token prefixes
const VALID_TOKEN_PREFIXES = ["ghp_", "github_pat_", "gho_", "ghu_", "ghs_", "ghr_"];

// Forbidden permissions that should never be granted
const FORBIDDEN_PERMISSIONS = [
  "repo", // Full repo access
  "repo:status",
  "repo_deployment",
  "repo:invite",
  "repo:admin",
  "workflow",
  "write:packages",
  "delete:packages",
  "admin:org",
  "admin:public_key",
  "admin:repo_hook",
  "admin:org_hook",
  "admin:ssh_signing_key",
];

// Minimum required permissions
const REQUIRED_PERMISSIONS = ["public_repo"];

/**
 * Validate token format
 */
function validateTokenFormat(token: string): { valid: boolean; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Token is empty or not a string" };
  }

  // Check prefix
  const hasValidPrefix = VALID_TOKEN_PREFIXES.some((prefix) =>
    token.startsWith(prefix)
  );

  if (!hasValidPrefix) {
    return { valid: false, reason: "Invalid token prefix" };
  }

  // Check minimum length
  // Classic tokens: ghp_ + 36 chars = 40 total
  // Fine-grained: github_pat_ + 82 chars = 93 total
  if (token.length < 40) {
    return { valid: false, reason: "Token too short" };
  }

  // Check for valid characters (after prefix)
  const prefix = VALID_TOKEN_PREFIXES.find((p) => token.startsWith(p)) || "";
  const tokenBody = token.slice(prefix.length);
  
  if (!/^[a-zA-Z0-9_-]+$/.test(tokenBody)) {
    return { valid: false, reason: "Invalid characters in token" };
  }

  return { valid: true };
}

/**
 * Generate token fingerprint for logging (first 4 + last 4 chars)
 */
export function generateTokenFingerprint(token: string): string {
  if (!token || token.length < 8) return "invalid";
  
  const firstFour = token.slice(0, 4);
  const lastFour = token.slice(-4);
  
  return `${firstFour}****${lastFour}`;
}

/**
 * Validate GitHub token permissions by making a test API call
 * Note: This makes an actual API call to validate permissions
 */
export async function validateTokenPermissions(
  token: string
): Promise<{ valid: boolean; permissions?: TokenPermissions; reason?: string }> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        logValidationFailure("revoked", "/user");
        return { valid: false, reason: "Token is invalid or revoked" };
      }
      return { valid: false, reason: `API error: ${response.status}` };
    }

    // Get scopes from X-OAuth-Scopes header
    const scopesHeader = response.headers.get("X-OAuth-Scopes") || "";
    const scopes = scopesHeader.split(",").map((s) => s.trim()).filter(Boolean);

    const permissions: TokenPermissions = {
      hasPublicRepo: scopes.includes("public_repo"),
      hasRepo: scopes.includes("repo"),
      hasWorkflow: scopes.includes("workflow"),
      hasAdmin: scopes.some((s) => s.startsWith("admin:")),
      scopes,
    };

    // Check for forbidden permissions
    const hasForbiddenPermissions = FORBIDDEN_PERMISSIONS.some((fp) =>
      scopes.includes(fp)
    );

    if (hasForbiddenPermissions) {
      const forbiddenFound = FORBIDDEN_PERMISSIONS.filter((fp) =>
        scopes.includes(fp)
      );
      logValidationFailure(
        "insufficient_permissions",
        "/user",
        undefined
      );
      return {
        valid: false,
        reason: `Token has forbidden permissions: ${forbiddenFound.join(", ")}`,
        permissions,
      };
    }

    // Check for required permissions
    const hasRequiredPermissions = REQUIRED_PERMISSIONS.every((rp) =>
      scopes.includes(rp)
    );

    if (!hasRequiredPermissions) {
      return {
        valid: false,
        reason: `Token missing required permissions: ${REQUIRED_PERMISSIONS.filter(
          (rp) => !scopes.includes(rp)
        ).join(", ")}`,
        permissions,
      };
    }

    return { valid: true, permissions };
  } catch (error) {
    return {
      valid: false,
      reason: `Validation error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/**
 * Check if token needs rotation (expires within 30 days)
 * Note: GitHub classic tokens don't have expiration, but fine-grained do
 */
export function checkTokenExpiration(token: string): {
  needsRotation: boolean;
  reason?: string;
  expiresAt?: string;
} {
  // Classic tokens (ghp_) don't have built-in expiration
  if (token.startsWith("ghp_")) {
    return {
      needsRotation: false,
      reason: "Classic token - check rotation schedule manually",
    };
  }

  // Fine-grained tokens (github_pat_) have expiration
  if (token.startsWith("github_pat_")) {
    // In a real implementation, you'd decode the token or check with GitHub API
    // For now, we'll assume it needs rotation check
    return {
      needsRotation: true,
      reason: "Fine-grained token - verify expiration with GitHub API",
    };
  }

  return {
    needsRotation: false,
    reason: "Unknown token type",
  };
}

/**
 * Main token validation function
 * Performs all validation checks
 */
export async function validateToken(
  token: string,
  checkPermissions = true
): Promise<TokenValidationResult> {
  // Step 1: Format validation
  const formatCheck = validateTokenFormat(token);
  if (!formatCheck.valid) {
    logValidationFailure("invalid_format", "validation");
    return {
      valid: false,
      reason: formatCheck.reason,
      fingerprint: generateTokenFingerprint(token),
    };
  }

  // Step 2: Expiration check
  const expirationCheck = checkTokenExpiration(token);

  // Step 3: Permission validation (if requested)
  if (checkPermissions) {
    const permCheck = await validateTokenPermissions(token);
    if (!permCheck.valid) {
      return {
        valid: false,
        reason: permCheck.reason,
        fingerprint: generateTokenFingerprint(token),
        permissions: permCheck.permissions?.scopes,
      };
    }

    return {
      valid: true,
      fingerprint: generateTokenFingerprint(token),
      permissions: permCheck.permissions?.scopes,
      expiresAt: expirationCheck.expiresAt,
    };
  }

  return {
    valid: true,
    fingerprint: generateTokenFingerprint(token),
    expiresAt: expirationCheck.expiresAt,
  };
}

/**
 * Quick format validation (synchronous, no API call)
 */
export function quickValidateToken(token: string): boolean {
  const result = validateTokenFormat(token);
  return result.valid;
}

/**
 * Get token metadata without exposing the full token
 */
export function getTokenMetadata(token: string): {
  type: "classic" | "fine_grained" | "unknown";
  fingerprint: string;
  length: number;
} {
  if (token.startsWith("ghp_")) {
    return {
      type: "classic",
      fingerprint: generateTokenFingerprint(token),
      length: token.length,
    };
  }

  if (token.startsWith("github_pat_")) {
    return {
      type: "fine_grained",
      fingerprint: generateTokenFingerprint(token),
      length: token.length,
    };
  }

  return {
    type: "unknown",
    fingerprint: generateTokenFingerprint(token),
    length: token.length,
  };
}
