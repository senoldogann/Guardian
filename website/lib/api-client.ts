/**
 * HTTP API Client with Retry Logic
 * 
 * Provides a robust HTTP client with:
 * - Exponential backoff retry
 * - Circuit breaker integration
 * - Request/response interceptors
 * - Timeout handling
 * - Comprehensive error handling
 */

import { CircuitBreaker, circuitBreakerRegistry, CircuitBreakerOpenError } from "./circuit-breaker";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export type RetryConfig = {
  maxRetries: number;           // Maximum number of retry attempts
  baseDelay: number;            // Initial delay in milliseconds
  maxDelay: number;             // Maximum delay in milliseconds
  backoffMultiplier: number;    // Exponential backoff multiplier
  retryableStatuses: number[];  // HTTP status codes that trigger retry
};

export type ApiClientConfig = {
  baseURL?: string;
  timeout?: number;
  retry?: Partial<RetryConfig>;
  circuitBreaker?: {
    enabled: boolean;
    name?: string;
    failureThreshold?: number;
    resetTimeout?: number;
  };
  headers?: Record<string, string>;
};

export type ApiRequestConfig = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retry?: Partial<RetryConfig>;
  skipCircuitBreaker?: boolean;
  cache?: RequestCache;
  next?: {
    revalidate?: number;
  };
};

export type ApiResponse<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  duration: number;
  retries: number;
};

export type ApiError = {
  message: string;
  status?: number;
  statusText?: string;
  data?: unknown;
  code: string;
  isRetryable: boolean;
  retriesAttempted: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Calculate delay for retry with exponential backoff and jitter
 */
function calculateRetryDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

  // Apply max delay cap
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  // Network errors (no status)
  if (error instanceof TypeError || error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("abort")
    ) {
      return true;
    }
  }

  // HTTP status codes
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    return config.retryableStatuses.includes(status);
  }

  return false;
}

/**
 * Sleep helper for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API Client class with retry and circuit breaker support
 */
export class ApiClient {
  private config: Required<ApiClientConfig>;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || "",
      timeout: config.timeout || DEFAULT_TIMEOUT,
      retry: { ...DEFAULT_RETRY_CONFIG, ...config.retry },
      circuitBreaker: {
        enabled: config.circuitBreaker?.enabled ?? true,
        name: config.circuitBreaker?.name || "default",
        failureThreshold: config.circuitBreaker?.failureThreshold || 5,
        resetTimeout: config.circuitBreaker?.resetTimeout || 30000,
      },
      headers: config.headers || {},
    };

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreaker.enabled && this.config.circuitBreaker.name) {
      this.circuitBreaker = circuitBreakerRegistry.get(
        this.config.circuitBreaker.name,
        {
          failureThreshold: this.config.circuitBreaker.failureThreshold,
          resetTimeout: this.config.circuitBreaker.resetTimeout,
        }
      );
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async request<T>(
    url: string,
    requestConfig: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const method = requestConfig.method || "GET";
    const fullURL = this.config.baseURL + url;

    // Merge configs with defaults
    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...this.config.retry,
      ...(requestConfig.retry || {}),
    };
    const timeout = requestConfig.timeout || this.config.timeout;

    // Execute with circuit breaker if enabled
    if (this.circuitBreaker && !requestConfig.skipCircuitBreaker) {
      return this.circuitBreaker.execute(() =>
        this.executeRequest<T>(fullURL, method, requestConfig, retryConfig, timeout, startTime)
      );
    }

    return this.executeRequest<T>(fullURL, method, requestConfig, retryConfig, timeout, startTime);
  }

  /**
   * Execute the actual HTTP request with retry logic
   */
  private async executeRequest<T>(
    url: string,
    method: HttpMethod,
    requestConfig: ApiRequestConfig,
    retryConfig: RetryConfig,
    timeout: number,
    startTime: number,
    attempt = 0
  ): Promise<ApiResponse<T>> {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Prepare headers
      const headers: Record<string, string> = {
        ...this.config.headers,
        ...requestConfig.headers,
      };

      if (requestConfig.body && typeof requestConfig.body === "object") {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }

      // Make request
      const fetchOptions: RequestInit & { next?: { revalidate?: number } } = {
        method,
        headers,
        body: requestConfig.body ? JSON.stringify(requestConfig.body) : undefined,
        signal: controller.signal,
      };

      if (requestConfig.cache) {
        fetchOptions.cache = requestConfig.cache;
      }

      if (requestConfig.next) {
        fetchOptions.next = requestConfig.next;
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        const error: ApiError = {
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          data: errorData.data,
          code: `HTTP_${response.status}`,
          isRetryable: retryConfig.retryableStatuses.includes(response.status),
          retriesAttempted: attempt,
        };

        // Retry if applicable
        if (attempt < retryConfig.maxRetries && error.isRetryable) {
          const delay = calculateRetryDelay(attempt, retryConfig);

          if (process.env.NODE_ENV === "development") {
            console.info(`[ApiClient] Retrying ${method} ${url} after ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
          }

          await sleep(delay);
          return this.executeRequest(url, method, requestConfig, retryConfig, timeout, startTime, attempt + 1);
        }

        throw new ApiClientError(error.message, error);
      }

      // Parse successful response
      const data = await this.parseResponse<T>(response);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        duration,
        retries: attempt,
      };
    } catch (error) {
      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        const apiError: ApiError = {
          message: `Request timeout after ${timeout}ms`,
          code: "TIMEOUT",
          isRetryable: true,
          retriesAttempted: attempt,
        };

        // Retry on timeout
        if (attempt < retryConfig.maxRetries) {
          const delay = calculateRetryDelay(attempt, retryConfig);
          await sleep(delay);
          return this.executeRequest(url, method, requestConfig, retryConfig, timeout, startTime, attempt + 1);
        }

        throw new ApiClientError(apiError.message, apiError);
      }

      // Handle circuit breaker errors
      if (error instanceof CircuitBreakerOpenError) {
        const apiError: ApiError = {
          message: error.message,
          code: "CIRCUIT_BREAKER_OPEN",
          isRetryable: false,
          retriesAttempted: attempt,
        };
        throw new ApiClientError(apiError.message, apiError);
      }

      // Handle API client errors (already wrapped)
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Handle network errors
      if (isRetryableError(error, retryConfig)) {
        if (attempt < retryConfig.maxRetries) {
          const delay = calculateRetryDelay(attempt, retryConfig);

          if (process.env.NODE_ENV === "development") {
            console.info(`[ApiClient] Retrying ${method} ${url} after network error (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
          }

          await sleep(delay);
          return this.executeRequest(url, method, requestConfig, retryConfig, timeout, startTime, attempt + 1);
        }
      }

      // Unknown error
      const apiError: ApiError = {
        message: error instanceof Error ? error.message : "Unknown error",
        code: "UNKNOWN",
        isRetryable: false,
        retriesAttempted: attempt,
      };

      throw new ApiClientError(apiError.message, apiError);
    }
  }

  /**
   * Parse successful response
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
  }

  /**
   * Parse error response
   */
  private async parseErrorResponse(response: Response): Promise<{ message?: string; data?: unknown }> {
    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        return {
          message: data.message || data.error || JSON.stringify(data),
          data,
        };
      }

      const text = await response.text();
      return { message: text };
    } catch {
      return { message: response.statusText };
    }
  }

  /**
   * Convenience methods
   */
  async get<T>(url: string, config?: Omit<ApiRequestConfig, "method" | "body">): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: "GET" });
  }

  async post<T>(url: string, body?: unknown, config?: Omit<ApiRequestConfig, "method" | "body">): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: "POST", body });
  }

  async put<T>(url: string, body?: unknown, config?: Omit<ApiRequestConfig, "method" | "body">): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: "PUT", body });
  }

  async delete<T>(url: string, config?: Omit<ApiRequestConfig, "method">): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: "DELETE" });
  }

  async patch<T>(url: string, body?: unknown, config?: Omit<ApiRequestConfig, "method" | "body">): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: "PATCH", body });
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }
}

/**
 * Custom API client error
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly error: ApiError
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// Export singleton instance for common use cases
export const apiClient = new ApiClient({
  circuitBreaker: {
    enabled: true,
    name: "github-api",
  },
});
