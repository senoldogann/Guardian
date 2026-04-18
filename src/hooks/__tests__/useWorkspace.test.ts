import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useWorkspace } from "../useWorkspace";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
  createTranslator: () => (key: string) => key,
}));

import { invoke, openDialog } from "../../lib/tauri";

const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
const mockOpenDialog = openDialog as unknown as ReturnType<typeof vi.fn>;

describe("useWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("initializes with idle state and empty logs", async () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.active).toBe(false);
    expect(result.current.status).toBe("Idle");
    expect(result.current.logs).toEqual({});
    expect(result.current.filter).toBe("");
    expect(result.current.stalled).toBeNull();
  });

  it("setFilter updates the filter value", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setFilter("critical");
    });
    expect(result.current.filter).toBe("critical");
  });

  it("visibleLogs excludes Info-severity entries", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setLogs({
        "a:b": { file_path: "a.ts", severity: "Critical", message: "bad" },
        "c:d": { file_path: "c.ts", severity: "Info", message: "ok" },
        "e:f": { file_path: "e.ts", severity: "Warning", message: "warn" },
      } as any);
    });

    expect(result.current.visibleLogs).toHaveLength(2);
    expect(result.current.visibleLogs.every((l) => l.severity !== "Info")).toBe(true);
  });

  it("stats computes correct severity counts", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setLogs({
        k1: { file_path: "a.ts", severity: "Critical", message: "m" },
        k2: { file_path: "b.ts", severity: "Critical", message: "m" },
        k3: { file_path: "c.ts", severity: "Warning", message: "m" },
      } as any);
    });

    expect(result.current.stats.critical).toBe(2);
    expect(result.current.stats.warning).toBe(1);
    expect(result.current.stats.total).toBe(3);
  });

  it("filteredLogs applies text filter", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setLogs({
        k1: { file_path: "src/auth.ts", severity: "Critical", message: "SQL injection" },
        k2: { file_path: "src/utils.ts", severity: "Warning", message: "unused var" },
      } as any);
    });

    act(() => {
      result.current.setFilter("auth");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].file_path).toBe("src/auth.ts");
  });

  it("scopeLabel extracts directory name from path", async () => {
    localStorage.setItem("guardian_last_path", JSON.stringify("/home/user/my-project"));
    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => {
      expect(result.current.scopeLabel).toBe("my-project");
    });
  });

  it("selectScope resets workspace state", async () => {
    mockOpenDialog.mockResolvedValue("/new/path");

    const { result } = renderHook(() => useWorkspace());

    // Set some state first
    act(() => {
      result.current.setActive(true);
      result.current.setStatus("Scanning");
      result.current.setLogs({
        k1: { file_path: "a.ts", severity: "Critical", message: "m" },
      } as any);
    });

    expect(result.current.active).toBe(true);

    await act(async () => {
      await result.current.selectScope();
    });

    expect(result.current.active).toBe(false);
    expect(result.current.status).toBe("Idle");
    expect(result.current.logs).toEqual({});
    expect(result.current.filter).toBe("");
  });

  it("expandedLogKey is cleared when logs change and key is missing", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setLogs({
        k1: { file_path: "a.ts", severity: "Critical", message: "m" },
      } as any);
    });

    act(() => {
      result.current.setExpandedLogKey("k1");
    });
    expect(result.current.expandedLogKey).toBe("k1");

    // Replace logs without k1
    act(() => {
      result.current.setLogs({
        k2: { file_path: "b.ts", severity: "Warning", message: "m" },
      } as any);
    });

    expect(result.current.expandedLogKey).toBeNull();
  });
});
