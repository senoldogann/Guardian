"use client";

import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Global Error Boundary Wrapper
 * Wraps the entire application to catch any uncaught errors
 */
export function GlobalErrorProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("Global error boundary caught:", error, errorInfo);
        // Here you would send to your error tracking service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
