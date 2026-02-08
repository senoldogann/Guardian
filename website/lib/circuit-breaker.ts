/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by temporarily rejecting requests
 * when a service is experiencing high failure rates.
 */

export type CircuitBreakerState = "closed" | "open" | "half_open";

export type CircuitBreakerConfig = {
  failureThreshold: number;      // Number of failures before opening circuit
  resetTimeout: number;          // Time (ms) before attempting to close circuit
  halfOpenMaxCalls: number;      // Max calls allowed in half-open state
  successThreshold: number;      // Successes needed to close circuit from half-open
};

export type CircuitBreakerStats = {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
};

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3,
  successThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private halfOpenCalls = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const waitTime = this.getRemainingWaitTime();
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN. Try again in ${waitTime}ms`,
          this.name,
          waitTime
        );
      }
    }

    // Check half-open call limit
    if (this.state === "half_open" && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.name}' is HALF_OPEN and at capacity. Try again later.`,
        this.name,
        this.config.resetTimeout
      );
    }

    // Track half-open calls
    if (this.state === "half_open") {
      this.halfOpenCalls++;
    }

    this.totalCalls++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful call
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === "half_open") {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else {
      // In closed state, reset failures on success
      this.failures = 0;
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(): void {
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half_open") {
      // Any failure in half-open state goes back to open
      this.transitionToOpen();
    } else if (this.failures >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      this.transitionToOpen();
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = "open";
    this.successes = 0;
    this.halfOpenCalls = 0;
    
    if (process.env.NODE_ENV === "development") {
      console.warn(`[CircuitBreaker] '${this.name}' transitioned to OPEN`);
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = "half_open";
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;
    
    if (process.env.NODE_ENV === "development") {
      console.info(`[CircuitBreaker] '${this.name}' transitioned to HALF_OPEN`);
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = null;
    
    if (process.env.NODE_ENV === "development") {
      console.info(`[CircuitBreaker] '${this.name}' transitioned to CLOSED`);
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (this.state !== "open" || !this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  /**
   * Get remaining wait time before next attempt
   */
  private getRemainingWaitTime(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.resetTimeout - elapsed);
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.state === "open" && this.lastFailureTime
        ? this.lastFailureTime + this.config.resetTimeout
        : null,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Force circuit to closed state (manual recovery)
   */
  forceClose(): void {
    this.transitionToClosed();
  }

  /**
   * Force circuit to open state (manual intervention)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  reset(name: string): void {
    this.breakers.delete(name);
  }

  resetAll(): void {
    this.breakers.clear();
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
