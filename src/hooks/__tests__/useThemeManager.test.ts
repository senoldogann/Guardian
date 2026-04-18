import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useThemeManager } from "../useThemeManager";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

describe("useThemeManager", () => {
  const mockUpdatePrefs = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to dark theme", async () => {
    const { result } = renderHook(() => useThemeManager(null, mockUpdatePrefs));

    await waitFor(() => {
      expect(result.current.theme).toBe("dark");
    });
  });

  it("toggleTheme switches from dark to light", async () => {
    const { result } = renderHook(() => useThemeManager(null, mockUpdatePrefs));

    await waitFor(() => {
      expect(result.current.theme).toBe("dark");
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ theme_mode: "light" });
  });

  it("toggleTheme switches from light to dark", async () => {
    localStorage.setItem("guardian_theme", JSON.stringify("light"));
    const { result } = renderHook(() => useThemeManager(null, mockUpdatePrefs));

    await waitFor(() => {
      expect(result.current.theme).toBe("light");
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ theme_mode: "dark" });
  });

  it("sets data-theme attribute on document", async () => {
    const { result } = renderHook(() => useThemeManager(null, mockUpdatePrefs));

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  it("applies CSS variables from user preferences", async () => {
    const prefs = {
      theme_mode: "dark" as const,
      font_family: "inter",
      font_size_scale: 110,
      dark_palette: { accent: "#22d3ee", panel: "#0f1520", text: "#f1f5f9" },
    };

    renderHook(() => useThemeManager(prefs, mockUpdatePrefs));

    await waitFor(() => {
      const root = document.documentElement;
      expect(root.style.getPropertyValue("--app-font-family")).toContain("Inter");
      expect(root.style.getPropertyValue("--app-font-scale")).toBe("1.1");
    });
  });

  it("reads theme from localStorage on mount", async () => {
    localStorage.setItem("guardian_theme", JSON.stringify("light"));
    const { result } = renderHook(() => useThemeManager(null, mockUpdatePrefs));

    await waitFor(() => {
      expect(result.current.theme).toBe("light");
    });
  });
});
