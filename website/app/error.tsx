"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-boundary";

/**
 * Global Error Boundary for Next.js App Router
 * Catches errors at the route level
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Global application error:", error);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <ErrorFallback 
        error={error} 
        errorInfo={null}
        onReset={reset}
        showDetails={true}
      />
    </div>
  );
}
