"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, Bug } from "lucide-react";
import { trackError } from "@/lib/analytics";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Track error in analytics
    trackError(error, errorInfo.componentStack || undefined);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // In production, you might want to send to an error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      this.reportError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Placeholder for error reporting service
    // You can integrate Sentry, LogRocket, or other services here
    const errorReport = {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof window !== "undefined" ? navigator.userAgent : "",
      timestamp: new Date().toISOString(),
    };
    
    // Send to your error tracking endpoint
    // fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorReport) });
    console.log("Error report prepared:", errorReport);
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error fallback UI
      return (
        <div className={cn("min-h-[400px] flex items-center justify-center p-6", this.props.className)}>
          <ErrorFallback 
            error={this.state.error} 
            errorInfo={this.state.errorInfo}
            onReset={this.reset}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback UI Component
 * Displays user-friendly error information and recovery options
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset?: () => void;
  showDetails?: boolean;
}

export function ErrorFallback({ 
  error, 
  errorInfo, 
  onReset,
  showDetails = process.env.NODE_ENV === "development" 
}: ErrorFallbackProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="max-w-lg w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-black dark:text-white">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              We apologize for the inconvenience
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <p className="text-neutral-600 dark:text-neutral-400">
          An unexpected error occurred while loading this content. Our team has been notified and we&apos;re working to fix it.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {onReset && (
            <Button 
              onClick={onReset}
              variant="default"
              className="gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
          
          <Button 
            onClick={handleReload}
            variant="outline"
            className="gap-2 border-neutral-300 dark:border-neutral-700"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </Button>
          
          <Button 
            asChild
            variant="ghost"
            className="gap-2"
          >
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
        </div>

        {/* Technical Details Toggle */}
        {showDetails && (error || errorInfo) && (
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <Bug className="w-4 h-4" />
              {showTechnicalDetails ? "Hide" : "Show"} technical details
            </button>
            
            {showTechnicalDetails && (
              <div className="mt-3 p-4 bg-neutral-100 dark:bg-neutral-900 rounded-lg overflow-auto max-h-60">
                {error && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Error</p>
                    <p className="text-sm font-mono text-red-600 dark:text-red-400">{error.message}</p>
                  </div>
                )}
                
                {error?.stack && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Stack Trace</p>
                    <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}
                
                {errorInfo?.componentStack && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Component Stack</p>
                    <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Digest (for Next.js errors) */}
        {(error as Error & { digest?: string })?.digest && (
          <p className="text-xs text-neutral-400 dark:text-neutral-600 pt-2">
            Error ID: {(error as Error & { digest?: string }).digest}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Async Error Boundary
 * Specialized boundary for handling async component errors
 */
export function AsyncErrorBoundary({ 
  children, 
  className 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <ErrorBoundary 
      className={className}
      onError={(error, errorInfo) => {
        console.error("Async component error:", error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Section Error Boundary
 * Smaller boundary for isolating errors to specific page sections
 */
export function SectionErrorBoundary({ 
  children, 
  sectionName,
  className 
}: { 
  children: ReactNode; 
  sectionName: string;
  className?: string;
}) {
  return (
    <ErrorBoundary 
      className={className}
      onError={(error, errorInfo) => {
        console.error(`Error in section "${sectionName}":`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
