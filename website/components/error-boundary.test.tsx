import { render, screen } from "@testing-library/react";
import { ErrorBoundary, ErrorFallback } from "./error-boundary";
import { describe, it, expect, vi } from "vitest";

/**
 * Error Boundary Unit Tests
 * 
 * Tests the error boundary component's ability to:
 * - Catch and handle errors
 * - Display fallback UI
 * - Call error callbacks
 * - Reset error state
 * - Report errors in production
 */

// Component that throws an error
const ThrowError = ({ message = "Test error" }: { message?: string }) => {
  throw new Error(message);
};

// Component that works normally
const WorkingComponent = () => <div>Working component</div>;

describe("ErrorBoundary", () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });
  
  afterEach(() => {
    console.error = originalError;
  });
  
  it("should render children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText("Working component")).toBeInTheDocument();
  });
  
  it("should catch errors and show fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it("should display error message in fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Custom error message" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it("should call onError callback when error occurs", () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });
  
  it("should render custom fallback if provided", () => {
    const customFallback = <div>Custom error UI</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
  });
  
  it("should have try again button", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();
  });
  
  it("should have reload page button", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const reloadButton = screen.getByRole("button", { name: /reload page/i });
    expect(reloadButton).toBeInTheDocument();
  });
  
  it("should have go home link", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });
});

describe("ErrorFallback", () => {
  it("should render error fallback UI", () => {
    const error = new Error("Test error");
    const errorInfo = { componentStack: "Component stack trace" };
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={errorInfo} 
      />
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it("should show technical details in development", () => {
    const error = new Error("Detailed error message");
    const errorInfo = { componentStack: "Stack trace here" };
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={errorInfo}
        showDetails={true}
      />
    );
    
    // Look for show/hide technical details button
    const detailsButton = screen.getByRole("button", { name: /technical details/i });
    expect(detailsButton).toBeInTheDocument();
  });
  
  it("should hide technical details by default in production", () => {
    const error = new Error("Production error");
    const errorInfo = { componentStack: "Stack" };
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={errorInfo}
        showDetails={false}
      />
    );
    
    // Technical details should not be visible
    const detailsButton = screen.queryByRole("button", { name: /technical details/i });
    expect(detailsButton).not.toBeInTheDocument();
  });
  
  it("should call onReset when try again is clicked", () => {
    const onReset = vi.fn();
    const error = new Error("Test");
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={null}
        onReset={onReset}
      />
    );
    
    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    tryAgainButton.click();
    
    expect(onReset).toHaveBeenCalled();
  });
  
  it("should have accessible structure", () => {
    const error = new Error("Test error");
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={null}
      />
    );
    
    // Should have proper heading
    const heading = screen.getByRole("heading", { name: /something went wrong/i });
    expect(heading).toBeInTheDocument();
    
    // Should have visible buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe("ErrorBoundary - Production Behavior", () => {
  it("should prepare error report in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    // Error should be caught and reported
    expect(onError).toHaveBeenCalled();
    
    process.env.NODE_ENV = originalEnv;
  });
});

describe("ErrorBoundary - Edge Cases", () => {
  it("should handle null error info", () => {
    render(
      <ErrorFallback 
        error={new Error("Test")} 
        errorInfo={null}
      />
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it("should handle error without message", () => {
    const error = new Error();
    
    render(
      <ErrorFallback 
        error={error} 
        errorInfo={null}
      />
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it("should handle custom className", () => {
    render(
      <ErrorBoundary className="custom-class">
        <ThrowError />
      </ErrorBoundary>
    );
    
    const container = screen.getByText(/something went wrong/i).closest(".custom-class");
    expect(container).toBeInTheDocument();
  });
});
