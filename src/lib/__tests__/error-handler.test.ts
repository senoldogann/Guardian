/** Tests for centralized error handling */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, handleError, reportError, createErrorReporter } from "../error/index";

describe("AppError", () => {
  it("should create error with default severity", () => {
    const error = new AppError("Test error", "TEST_CODE");
    
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.severity).toBe("medium");
    expect(error.name).toBe("AppError");
  });

  it("should create error with custom severity", () => {
    const error = new AppError("Critical error", "CRITICAL_CODE", "critical");
    
    expect(error.message).toBe("Critical error");
    expect(error.code).toBe("CRITICAL_CODE");
    expect(error.severity).toBe("critical");
  });

  it("should support all severity levels", () => {
    const severities: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];
    
    severities.forEach((severity) => {
      const error = new AppError("Test", "CODE", severity);
      expect(error.severity).toBe(severity);
    });
  });
});

describe("handleError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should handle AppError instances", () => {
    const appError = new AppError("Known error", "KNOWN_ERROR", "high");
    const result = handleError(appError, "TestContext");
    
    expect(result).toBe(appError);
    expect(result.code).toBe("KNOWN_ERROR");
    expect(result.severity).toBe("high");
  });

  it("should handle standard Error instances", () => {
    const stdError = new Error("Standard error");
    const result = handleError(stdError, "TestContext");
    
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("Standard error");
    expect(result.code).toBe("UNKNOWN");
    expect(result.severity).toBe("medium");
  });

  it("should handle string errors", () => {
    const result = handleError("String error message", "TestContext");
    
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("String error message");
    expect(result.code).toBe("UNKNOWN");
  });

  it("should handle null/undefined errors", () => {
    const result1 = handleError(null, "TestContext");
    expect(result1.message).toBe("null");
    
    const result2 = handleError(undefined, "TestContext");
    expect(result2.message).toBe("undefined");
  });

  it("should handle objects as errors", () => {
    const objError = { message: "Object error" };
    const result = handleError(objError, "TestContext");
    
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("[object Object]");
  });

  it("should use default context when not provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    
    handleError(new Error("Test"));
    
    expect(console.error).toHaveBeenCalledWith(
      "[App]",
      expect.any(AppError)
    );
  });

  it("should use provided context", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    
    handleError(new Error("Test"), "AuthService");
    
    expect(console.error).toHaveBeenCalledWith(
      "[AuthService]",
      expect.any(AppError)
    );
  });

  it("should report error to global handler", () => {
    const mockHandler = vi.fn();
    
    // Create error reporter
    createErrorReporter(mockHandler);
    
    // Handle error
    handleError(new Error("Test error"));
    
    // Verify handler was called
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UNKNOWN",
        error: "Test error",
        timestamp: expect.any(String),
      })
    );
  });
});

describe("reportError", () => {
  beforeEach(() => {
    // Clean up any existing handler
    if (typeof window !== "undefined") {
      window.__GUARDIAN_ERROR_HANDLER__ = undefined;
    }
  });

  it("should not throw if no handler is set", () => {
    expect(() => {
      reportError({
        type: "TEST",
        error: "Test error",
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it("should call handler when set", () => {
    const mockHandler = vi.fn();
    createErrorReporter(mockHandler);
    
    const errorDetails = {
      type: "TEST_ERROR",
      error: "Something went wrong",
      timestamp: new Date().toISOString(),
      additionalInfo: "Extra context",
    };
    
    reportError(errorDetails);
    
    expect(mockHandler).toHaveBeenCalledWith(errorDetails);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("should handle multiple error reports", () => {
    const mockHandler = vi.fn();
    createErrorReporter(mockHandler);
    
    reportError({ type: "ERROR_1", error: "First", timestamp: "2024-01-01" });
    reportError({ type: "ERROR_2", error: "Second", timestamp: "2024-01-02" });
    reportError({ type: "ERROR_3", error: "Third", timestamp: "2024-01-03" });
    
    expect(mockHandler).toHaveBeenCalledTimes(3);
  });
});

describe("createErrorReporter", () => {
  it("should set global error handler", () => {
    const mockHandler = vi.fn();
    
    createErrorReporter(mockHandler);
    
    expect(window.__GUARDIAN_ERROR_HANDLER__).toBe(mockHandler);
  });

  it("should allow replacing existing handler", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    
    createErrorReporter(firstHandler);
    createErrorReporter(secondHandler);
    
    reportError({ type: "TEST", error: "Test", timestamp: "2024-01-01" });
    
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it("should work in browser environment", () => {
    const mockHandler = vi.fn();
    
    // Simulate browser environment
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
    });
    
    createErrorReporter(mockHandler);
    
    expect(window.__GUARDIAN_ERROR_HANDLER__).toBe(mockHandler);
  });
});

describe("Error severity handling", () => {
  it("should classify low severity errors", () => {
    const error = new AppError("Minor issue", "MINOR", "low");
    expect(error.severity).toBe("low");
  });

  it("should classify medium severity errors", () => {
    const error = new AppError("Standard issue", "STANDARD", "medium");
    expect(error.severity).toBe("medium");
  });

  it("should classify high severity errors", () => {
    const error = new AppError("Serious issue", "SERIOUS", "high");
    expect(error.severity).toBe("high");
  });

  it("should classify critical severity errors", () => {
    const error = new AppError("Critical failure", "CRITICAL", "critical");
    expect(error.severity).toBe("critical");
  });
});

describe("Error context preservation", () => {
  it("should create AppError with stack trace", () => {
    const originalError = new Error("Original");
    
    const handledError = handleError(originalError);
    
    expect(handledError.stack).toBeDefined();
    expect(handledError.stack).toContain("AppError");
    expect(handledError.message).toBe(originalError.message);
  });

  it("should create new stack for non-Error inputs", () => {
    const handledError = handleError("String error");
    
    expect(handledError.stack).toBeDefined();
    expect(handledError.stack).toContain("AppError");
  });
});
