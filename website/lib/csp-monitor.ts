"use client";

import { useEffect } from "react";

/**
 * CSP Violation Report Interface
 */
interface CSPViolationReport {
  "csp-report": {
    "document-uri": string;
    "referrer": string;
    "violated-directive": string;
    "effective-directive": string;
    "original-policy": string;
    "disposition": string;
    "blocked-uri": string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    "script-sample"?: string;
    "status-code"?: number;
  };
}

/**
 * Log CSP violation to console with structured formatting
 */
function logCSPViolation(report: CSPViolationReport): void {
  const violation = report["csp-report"];
  
   if (process.env.NODE_ENV !== "development") {
     return;
   }
   console.group("🚨 CSP Violation Detected");
   console.error(`Directive: ${violation["violated-directive"]}`);
   console.error(`Blocked URI: ${violation["blocked-uri"]}`);
   console.error(`Document: ${violation["document-uri"]}`);
  
  if (violation["line-number"]) {
    console.error(`Line: ${violation["line-number"]}:${violation["column-number"] || "?"}`);
  }
  
  if (violation["source-file"]) {
    console.error(`Source: ${violation["source-file"]}`);
  }
  
  console.groupEnd();
}

/**
 * Send CSP violation to reporting endpoint
 */
async function sendCSPReport(report: CSPViolationReport): Promise<void> {
  try {
    const response = await fetch("/api/csp-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/csp-report",
      },
      body: JSON.stringify(report),
    });

   if (!response.ok) {
     console.error("[CSP] Failed to send violation report:", response.statusText);
   }
   } catch (error) {
     console.error("[CSP] Error sending violation report:", error);
   }
}

/**
 * CSP Violation Event Handler
 */
function handleSecurityPolicyViolation(event: SecurityPolicyViolationEvent): void {
  // Create report object matching the CSP report format
  const report: CSPViolationReport = {
    "csp-report": {
      "document-uri": event.documentURI,
      "referrer": event.referrer,
      "violated-directive": event.violatedDirective,
      "effective-directive": event.effectiveDirective,
      "original-policy": event.originalPolicy,
      "disposition": event.disposition,
      "blocked-uri": event.blockedURI,
      "line-number": event.lineNumber,
      "column-number": event.columnNumber,
      "source-file": event.sourceFile,
      "script-sample": event.sample,
      "status-code": event.statusCode,
    },
  };

  // Log to console
  logCSPViolation(report);

  // Send to reporting endpoint
  sendCSPReport(report);
}

/**
 * CSP Monitor Component
 * Listens for CSP violations and reports them
 */
export function CSPMonitor(): null {
  useEffect(() => {
    // Check if CSP is in Report-Only mode
    const isReportOnly = document.querySelector('meta[http-equiv="Content-Security-Policy-Report-Only"]') !== null;
    
    if (process.env.NODE_ENV === "development") {
      console.info("[CSP Monitor] Initialized", isReportOnly ? "(Report-Only mode)" : "");
    }

    // Add violation listener
    document.addEventListener("securitypolicyviolation", handleSecurityPolicyViolation);

    // Cleanup
    return () => {
      document.removeEventListener("securitypolicyviolation", handleSecurityPolicyViolation);
    };
  }, []);

  // This component doesn't render anything
  return null;
}

/**
 * Hook for manual CSP violation reporting
 */
export function useCSPMonitor(): {
  reportViolation: (details: Partial<CSPViolationReport["csp-report"]>) => void;
} {
  const reportViolation = (details: Partial<CSPViolationReport["csp-report"]>) => {
    const report: CSPViolationReport = {
      "csp-report": {
        "document-uri": details["document-uri"] || window.location.href,
        "referrer": details["referrer"] || document.referrer,
        "violated-directive": details["violated-directive"] || "manual-report",
        "effective-directive": details["effective-directive"] || "manual-report",
        "original-policy": details["original-policy"] || "",
        "disposition": details["disposition"] || "report",
        "blocked-uri": details["blocked-uri"] || "",
        "line-number": details["line-number"],
        "column-number": details["column-number"],
        "source-file": details["source-file"],
        "script-sample": details["script-sample"],
        "status-code": details["status-code"],
      },
    };

    logCSPViolation(report);
    sendCSPReport(report);
  };

  return { reportViolation };
}

export type { CSPViolationReport };
