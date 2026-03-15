/**
 * Health Check System
 * 
 * Provides comprehensive health monitoring for Guardian application
 * with automatic rollback triggers on failure.
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheckResult = {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, ComponentHealth>;
  overall: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
};

type ComponentHealth = {
  status: HealthStatus;
  responseTime: number;
  message?: string;
  lastChecked: string;
};

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit?: number;
};

// Health check configuration
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const DEGRADED_THRESHOLD = 3000; // 3 seconds response time

/**
 * Check GitHub API connectivity
 */
async function checkGitHubAPI(): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    
    const response = await fetch("https://api.github.com/status", {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        status: "degraded",
        responseTime,
        message: `GitHub API returned ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
    
    return {
      status: responseTime > DEGRADED_THRESHOLD ? "degraded" : "healthy",
      responseTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Unknown error",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check application memory usage
 */
function checkMemory(): ComponentHealth {
  const startTime = Date.now();
  
  try {
    // For Node.js environment
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      let status: HealthStatus = "healthy";
      let message: string | undefined;
      
      if (usagePercent > 90) {
        status = "unhealthy";
        message = `Memory usage critical: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent > 70) {
        status = "degraded";
        message = `Memory usage high: ${usagePercent.toFixed(1)}%`;
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        message,
        lastChecked: new Date().toISOString(),
      };
    }
    
    // For browser environment
    if (typeof performance !== "undefined" && "memory" in performance) {
      const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
      if (!memory) {
        return {
          status: "healthy",
          responseTime: Date.now() - startTime,
          message: "Memory check not available in this environment",
          lastChecked: new Date().toISOString(),
        };
      }
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      
      return {
        status: "healthy",
        responseTime: Date.now() - startTime,
        message: `Browser memory: ${usedMB}MB / ${totalMB}MB`,
        lastChecked: new Date().toISOString(),
      };
    }
    
    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      message: "Memory check not available in this environment",
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      status: "degraded",
      responseTime: Date.now() - startTime,
      message: "Could not check memory",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check disk space (Node.js only)
 */
async function checkDiskSpace(): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you'd use a library like check-disk-space
    // For now, we'll return a mock response
    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      message: "Disk space check placeholder - implement with check-disk-space package",
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      status: "degraded",
      responseTime: Date.now() - startTime,
      message: "Could not check disk space",
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Tauri runtime (if applicable)
 */
function checkTauriRuntime(): ComponentHealth {
  const startTime = Date.now();
  
  try {
    // Check if running in Tauri
    const isTauri =
      typeof window !== "undefined" &&
      !!(window as Window & { __TAURI__?: unknown }).__TAURI__;
    
    if (isTauri) {
      return {
        status: "healthy",
        responseTime: Date.now() - startTime,
        message: "Tauri runtime detected",
        lastChecked: new Date().toISOString(),
      };
    }
    
    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      message: "Running in browser mode (not Tauri)",
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      status: "degraded",
      responseTime: Date.now() - startTime,
      message: "Could not determine runtime",
      lastChecked: new Date().toISOString(),
    };
  }
}

// Track application start time
const startTime = Date.now();

/**
 * Get application uptime in seconds
 */
function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [githubHealth, memoryHealth, diskHealth, runtimeHealth] = await Promise.all([
    checkGitHubAPI(),
    checkMemory(),
    checkDiskSpace(),
    Promise.resolve(checkTauriRuntime()),
  ]);
  
  const checks = {
    github_api: githubHealth,
    memory: memoryHealth,
    disk: diskHealth,
    runtime: runtimeHealth,
  };
  
  // Calculate overall health
  const values = Object.values(checks);
  const healthy = values.filter((v) => v.status === "healthy").length;
  const degraded = values.filter((v) => v.status === "degraded").length;
  const unhealthy = values.filter((v) => v.status === "unhealthy").length;
  
  // Determine overall status
  let status: HealthStatus = "healthy";
  if (unhealthy > 0) {
    status = "unhealthy";
  } else if (degraded > 0) {
    status = "degraded";
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: getUptime(),
    checks,
    overall: {
      healthy,
      degraded,
      unhealthy,
      total: values.length,
    },
  };
}

/**
 * Quick health check for load balancers
 */
export async function quickHealthCheck(): Promise<{ healthy: boolean }> {
  const result = await performHealthCheck();
  return { healthy: result.status === "healthy" };
}

/**
 * Check if deployment should be rolled back
 */
export function shouldRollback(healthResult: HealthCheckResult): {
  rollback: boolean;
  reason?: string;
} {
  // Rollback if any critical component is unhealthy
  if (healthResult.checks.github_api?.status === "unhealthy") {
    return {
      rollback: true,
      reason: "GitHub API connectivity lost",
    };
  }
  
  if (healthResult.checks.memory?.status === "unhealthy") {
    return {
      rollback: true,
      reason: "Critical memory usage",
    };
  }
  
  // Rollback if more than 50% of checks are unhealthy
  const unhealthyPercent = (healthResult.overall.unhealthy / healthResult.overall.total) * 100;
  if (unhealthyPercent > 50) {
    return {
      rollback: true,
      reason: `More than 50% of health checks failing (${unhealthyPercent.toFixed(0)}%)`,
    };
  }
  
  return { rollback: false };
}

/**
 * Format health check for human reading
 */
export function formatHealthCheck(result: HealthCheckResult): string {
  const lines = [
    `Health Status: ${result.status.toUpperCase()}`,
    `Timestamp: ${result.timestamp}`,
    `Version: ${result.version}`,
    `Uptime: ${Math.floor(result.uptime / 60)}m ${result.uptime % 60}s`,
    "",
    "Component Checks:",
  ];
  
  for (const [name, check] of Object.entries(result.checks)) {
    const icon = check.status === "healthy" ? "✓" : check.status === "degraded" ? "⚠" : "✗";
    lines.push(`  ${icon} ${name}: ${check.status} (${check.responseTime}ms)`);
    if (check.message) {
      lines.push(`    ${check.message}`);
    }
  }
  
  lines.push("");
  lines.push(`Overall: ${result.overall.healthy} healthy, ${result.overall.degraded} degraded, ${result.overall.unhealthy} unhealthy`);
  
  return lines.join("\n");
}
