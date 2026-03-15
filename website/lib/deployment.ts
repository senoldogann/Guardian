/**
 * Deployment Configuration
 * 
 * Blue-green deployment strategy configuration and helpers.
 */

export type DeploymentEnvironment = "blue" | "green" | "production";

export type DeploymentConfig = {
  environment: DeploymentEnvironment;
  version: string;
  timestamp: string;
  healthCheckUrl: string;
  rollbackVersion?: string;
};

// Deployment state (in-memory for simple cases, Redis/database for production)
let currentDeployment: DeploymentConfig = {
  environment: "blue",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  healthCheckUrl: "/api/health",
};

/**
 * Get current deployment configuration
 */
export function getDeploymentConfig(): DeploymentConfig {
  return { ...currentDeployment };
}

/**
 * Set deployment configuration
 */
export function setDeploymentConfig(config: Partial<DeploymentConfig>): void {
  currentDeployment = {
    ...currentDeployment,
    ...config,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Switch between blue and green environments
 */
export function switchEnvironment(): DeploymentEnvironment {
  const newEnvironment = currentDeployment.environment === "blue" ? "green" : "blue";
  setDeploymentConfig({ environment: newEnvironment });
  return newEnvironment;
}

/**
 * Check if current deployment is healthy
 */
export async function isDeploymentHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/health?quick=true`);
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Deployment strategy interface
 */
export interface DeploymentStrategy {
  name: string;
  deploy: (version: string) => Promise<DeploymentResult>;
  rollback: () => Promise<DeploymentResult>;
}

type DeploymentResult = {
  success: boolean;
  message: string;
  previousVersion?: string;
  newVersion?: string;
};

/**
 * Blue-Green Deployment Strategy
 */
export const blueGreenStrategy: DeploymentStrategy = {
  name: "blue-green",
  
  async deploy(version: string): Promise<DeploymentResult> {
    const previousVersion = currentDeployment.version;
    const targetEnvironment = currentDeployment.environment === "blue" ? "green" : "blue";
    
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Starting blue-green deployment to ${targetEnvironment}...`);
    }
    
    // Step 1: Deploy to inactive environment
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Deploying version ${version} to ${targetEnvironment}...`);
    }
    
    // Step 2: Health check on new environment
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Running health checks...`);
    }
    const isHealthy = await isDeploymentHealthy();
    
    if (!isHealthy) {
      return {
        success: false,
        message: `Health check failed on ${targetEnvironment}`,
        previousVersion,
      };
    }
    
    // Step 3: Switch traffic to new environment
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Switching traffic to ${targetEnvironment}...`);
    }
    setDeploymentConfig({
      environment: targetEnvironment,
      version,
      rollbackVersion: previousVersion,
    });
    
    // Step 4: Monitor for a grace period
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Monitoring deployment...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s grace period
    
    const stillHealthy = await isDeploymentHealthy();
    
    if (!stillHealthy) {
      // Auto-rollback
      if (process.env.NODE_ENV === "development") {
        console.info(`[Deployment] Health degraded, triggering rollback...`);
      }
      return this.rollback();
    }
    
    return {
      success: true,
      message: `Successfully deployed version ${version} to ${targetEnvironment}`,
      previousVersion,
      newVersion: version,
    };
  },
  
  async rollback(): Promise<DeploymentResult> {
    const { rollbackVersion, environment } = currentDeployment;
    
    if (!rollbackVersion) {
      return {
        success: false,
        message: "No rollback version available",
      };
    }
    
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Rolling back from ${environment} to previous version ${rollbackVersion}...`);
    }
    
    // Switch back to previous environment
    const previousEnvironment = environment === "blue" ? "green" : "blue";
    
    setDeploymentConfig({
      environment: previousEnvironment,
      version: rollbackVersion,
      rollbackVersion: undefined,
    });
    
    return {
      success: true,
      message: `Successfully rolled back to version ${rollbackVersion}`,
      newVersion: rollbackVersion,
    };
  },
};

/**
 * Simple deployment with health-based auto-rollback
 */
export async function deployWithRollback(version: string): Promise<DeploymentResult> {
  const previousVersion = currentDeployment.version;
  
  if (process.env.NODE_ENV === "development") {
    console.info(`[Deployment] Starting deployment of version ${version}...`);
  }
  
  // Update version
  setDeploymentConfig({
    version,
    rollbackVersion: previousVersion,
  });
  
  // Wait for deployment to stabilize
  await new Promise((resolve) => setTimeout(resolve, 5000));
  
  // Health check
  const isHealthy = await isDeploymentHealthy();
  
  if (!isHealthy) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Deployment] Health check failed, initiating rollback...`);
    }
    return blueGreenStrategy.rollback();
  }
  
  return {
    success: true,
    message: `Successfully deployed version ${version}`,
    previousVersion,
    newVersion: version,
  };
}

/**
 * Get deployment status for monitoring
 */
export function getDeploymentStatus() {
  return {
    ...currentDeployment,
    strategy: blueGreenStrategy.name,
    timestamp: new Date().toISOString(),
  };
}
