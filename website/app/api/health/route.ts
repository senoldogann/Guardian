/**
 * Health Check API Endpoint
 * 
 * Provides health status for monitoring and load balancers.
 * Supports both comprehensive and quick health checks.
 */

import { NextResponse } from "next/server";
import { performHealthCheck, quickHealthCheck, shouldRollback } from "@/lib/health-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * 
 * Query parameters:
 * - quick: "true" for quick check (returns 200/503 only)
 * - format: "json" (default) or "text" for human-readable
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isQuick = searchParams.get("quick") === "true";
    const format = searchParams.get("format") || "json";
    
    // Quick check for load balancers
    if (isQuick) {
      const { healthy } = await quickHealthCheck();
      
      if (healthy) {
        return new NextResponse("OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      } else {
        return new NextResponse("UNHEALTHY", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
    
    // Comprehensive health check
    const healthResult = await performHealthCheck();
    
    // Check if rollback is needed
    const rollbackDecision = shouldRollback(healthResult);
    
    // Determine HTTP status
    let statusCode = 200;
    if (healthResult.status === "unhealthy") {
      statusCode = 503;
    } else if (healthResult.status === "degraded") {
      statusCode = 200; // Still serving traffic, but with issues
    }
    
    // Add rollback info if applicable
    const response = {
      ...healthResult,
      rollback: rollbackDecision.rollback ? {
        needed: true,
        reason: rollbackDecision.reason,
      } : {
        needed: false,
      },
    };
    
    if (format === "text") {
      // Import format function dynamically to avoid server/client mismatch
      const { formatHealthCheck } = await import("@/lib/health-check");
      return new NextResponse(formatHealthCheck(healthResult), {
        status: statusCode,
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("Health check failed:", error);
    
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

/**
 * HEAD /api/health
 * 
 * Minimal check for load balancers (returns 200/503 only)
 */
export async function HEAD() {
  try {
    const { healthy } = await quickHealthCheck();
    
    return new NextResponse(null, {
      status: healthy ? 200 : 503,
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
