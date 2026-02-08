import { NextRequest, NextResponse } from "next/server";

/**
 * Web Vitals Logging Endpoint
 * 
 * Receives Web Vitals metrics from the client and logs them.
 * In production, this could send to:
 * - Vercel Analytics
 * - Google Analytics 4
 * - Datadog
 * - Sentry
 * - Custom logging service
 */
export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();
    
    // Log to server console
    console.log("[Web Vitals]", {
      ...metric,
      receivedAt: new Date().toISOString(),
    });
    
    // In production, you might want to:
    // 1. Send to external analytics service
    // 2. Store in database for analysis
    // 3. Trigger alerts for poor performance
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to process web vital:", error);
    return NextResponse.json(
      { error: "Failed to process metric" },
      { status: 400 }
    );
  }
}
