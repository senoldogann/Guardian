/** Centralized error handling for Guardian */

import type { AppErrorDetails } from "../../types";

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: "low" | "medium" | "high" | "critical" = "medium"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleError(error: unknown, context?: string): AppError {
  const appError = error instanceof AppError 
    ? error 
    : new AppError(
        error instanceof Error ? error.message : String(error),
        "UNKNOWN"
      );
  
  console.error(`[${context || "App"}]`, appError);
  
  reportError({
    type: appError.code,
    error: appError.message,
    timestamp: new Date().toISOString(),
  });
  
  return appError;
}

export function reportError(details: AppErrorDetails): void {
  // In production, send to error tracking service
  if (typeof window !== "undefined" && window.__GUARDIAN_ERROR_HANDLER__) {
    window.__GUARDIAN_ERROR_HANDLER__(details);
  }
}

declare global {
  interface Window {
    __GUARDIAN_ERROR_HANDLER__?: (details: AppErrorDetails) => void;
  }
}

export function createErrorReporter(handler: (details: AppErrorDetails) => void): void {
  if (typeof window !== "undefined") {
    window.__GUARDIAN_ERROR_HANDLER__ = handler;
  }
}
