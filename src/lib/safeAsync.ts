/**
 * Utility for safely executing async functions without swallowing errors.
 *
 * Instead of `void someAsyncFn()` which silently drops rejections,
 * use `safeAsync(someAsyncFn())` to log errors and optionally show
 * a toast notification.
 */

import { useToastStore } from "../hooks/useToast";

/**
 * Execute an async operation with error logging.
 * Use this instead of `void asyncFn()` in useEffect or event handlers.
 *
 * @param promise  The promise to execute
 * @param label    Optional label for console error messages
 * @param silent   If true, only logs to console (no toast). Default: true
 */
export function safeAsync(
  promise: Promise<unknown>,
  label?: string,
  silent = true,
): void {
  promise.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const prefix = label ? `[${label}]` : "[safeAsync]";
    console.error(`${prefix} Unhandled async error:`, msg);

    if (!silent) {
      const { addToast } = useToastStore.getState();
      addToast(msg, "error", 4000);
    }
  });
}

/**
 * Wraps an async callback for use in onClick/onChange handlers.
 * Catches errors and shows a toast notification.
 *
 * Usage: `onClick={handleAsync(() => deleteItem(id), "Delete failed")}`
 */
export function handleAsync(
  fn: () => Promise<unknown>,
  errorMessage?: string,
): () => void {
  return () => {
    fn().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[handleAsync]", msg);
      const { addToast } = useToastStore.getState();
      addToast(errorMessage ?? msg, "error", 4000);
    });
  };
}
