import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useLocalStorage } from "../useLocalStorage";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

describe("useLocalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns initial value when localStorage is empty", async () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    await waitFor(() => {
      expect(result.current[2]).toBe(true); // hydrated
    });
    expect(result.current[0]).toBe("default");
  });

  it("reads existing value from localStorage", async () => {
    localStorage.setItem("test-key", JSON.stringify("stored-value"));
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    await waitFor(() => {
      expect(result.current[0]).toBe("stored-value");
    });
  });

  it("persists value to localStorage on update", async () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

    await waitFor(() => {
      expect(result.current[2]).toBe(true);
    });

    act(() => {
      result.current[1]("updated");
    });

    await waitFor(() => {
      expect(localStorage.getItem("test-key")).toBe(JSON.stringify("updated"));
    });
  });

  it("supports functional updates", async () => {
    const { result } = renderHook(() => useLocalStorage("counter", 0));

    await waitFor(() => {
      expect(result.current[2]).toBe(true);
    });

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it("supports custom serialize/deserialize", async () => {
    const { result } = renderHook(() =>
      useLocalStorage("custom", "dark", {
        deserialize: (raw: string) => {
          const trimmed = raw.trim().toLowerCase();
          return trimmed === "light" ? "light" : "dark";
        },
      }),
    );

    await waitFor(() => {
      expect(result.current[2]).toBe(true);
    });

    expect(result.current[0]).toBe("dark");
  });

  it("handles invalid JSON gracefully", async () => {
    localStorage.setItem("broken", "not-json");
    const { result } = renderHook(() => useLocalStorage("broken", "fallback"));

    await waitFor(() => {
      expect(result.current[2]).toBe(true);
    });

    // Should fall back to initialValue on parse error
    expect(result.current[0]).toBe("fallback");
  });

  it("reports hydrated state correctly", async () => {
    const { result } = renderHook(() => useLocalStorage("hydration-test", 42));

    // After initial render, hydrated should eventually become true
    await waitFor(() => {
      expect(result.current[2]).toBe(true);
    });
  });
});
