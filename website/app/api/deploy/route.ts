/**
 * Deployment API Endpoint
 * 
 * Provides deployment and rollback functionality.
 * Protected by API key for security.
 */

import { NextResponse } from "next/server";
import {
  deployWithRollback,
  blueGreenStrategy,
  getDeploymentStatus,
  getDeploymentConfig,
} from "@/lib/deployment";

// Simple API key authentication
const API_KEY = process.env.DEPLOY_API_KEY;

function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === API_KEY;
}

/**
 * GET /api/deploy
 * 
 * Get current deployment status
 */
export async function GET(request: Request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  try {
    const status = getDeploymentStatus();
    const config = getDeploymentConfig();
    
    return NextResponse.json({
      status,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get deployment status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deploy
 * 
 * Deploy a new version with automatic rollback on failure
 * 
 * Body: { version: string, strategy?: "blue-green" | "simple" }
 */
export async function POST(request: Request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    const { version, strategy = "simple" } = body;
    
    if (!version) {
      return NextResponse.json(
        { error: "Version is required" },
        { status: 400 }
      );
    }
    
    if (process.env.NODE_ENV === "development") {
        console.info(`[API] Deployment requested for version ${version} using ${strategy} strategy`);
    }
    
    let result;
    if (strategy === "blue-green") {
      result = await blueGreenStrategy.deploy(version);
    } else {
      result = await deployWithRollback(version);
    }
    
    const statusCode = result.success ? 200 : 500;
    
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("[API] Deployment failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deploy
 * 
 * Rollback to previous version
 */
export async function DELETE(request: Request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  try {
    if (process.env.NODE_ENV === "development") {
        console.info("[API] Rollback requested");
    }
    
    const result = await blueGreenStrategy.rollback();
    
    const statusCode = result.success ? 200 : 500;
    
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("[API] Rollback failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
