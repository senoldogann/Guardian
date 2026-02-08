import { NextRequest, NextResponse } from "next/server";

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
 * Log CSP violation with structured formatting
 */
function logViolation(report: CSPViolationReport): void {
  const violation = report["csp-report"];
  
  console.error("[CSP Violation]", {
    timestamp: new Date().toISOString(),
    directive: violation["violated-directive"],
    blockedUri: violation["blocked-uri"],
    documentUri: violation["document-uri"],
    lineNumber: violation["line-number"],
    columnNumber: violation["column-number"],
    sourceFile: violation["source-file"],
    disposition: violation["disposition"],
  });
}

/**
 * POST handler for CSP violation reports
 * Receives reports from browser's CSP violation events
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the CSP report
    const report: CSPViolationReport = await request.json();
    
    // Log the violation
    logViolation(report);

    // In production, you might want to:
    // 1. Store violations in a database
    // 2. Send alerts for critical violations
    // 3. Aggregate reports for analysis
    // 4. Send to external monitoring service (Sentry, etc.)

    if (process.env.NODE_ENV === "production") {
      // Example: Send to external service
      // await sendToMonitoringService(report);
      
      // Example: Store in database
      // await storeViolation(report);
    }

    // Return 204 No Content (standard for CSP reports)
    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error("[CSP Report] Error processing violation report:", error);
    
    // Return 400 for malformed reports
    return NextResponse.json(
      { error: "Invalid CSP report format" },
      { status: 400 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * GET handler for health check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "CSP Reporting Endpoint Active",
    mode: "Report-Only",
    timestamp: new Date().toISOString(),
  });
}
