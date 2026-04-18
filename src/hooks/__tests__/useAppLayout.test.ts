import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAppLayout } from "../useAppLayout";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("useAppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to monitor view", () => {
    const { result } = renderHook(() => useAppLayout(null, false));
    expect(result.current.view).toBe("monitor");
  });

  it("setView changes the current view", () => {
    const { result } = renderHook(() => useAppLayout(null, false));

    act(() => {
      result.current.setView("chat");
    });
    expect(result.current.view).toBe("chat");

    act(() => {
      result.current.setView("diagram");
    });
    expect(result.current.view).toBe("diagram");
  });

  it("openGuruForStall switches to chat with a pending prompt", () => {
    const stalled = { file: "src/index.ts", reason: "unsafe eval" };
    const { result } = renderHook(() => useAppLayout(stalled, false));

    act(() => {
      result.current.openGuruForStall();
    });

    expect(result.current.view).toBe("chat");
    expect(result.current.pendingGuruPrompt).not.toBeNull();
    expect(result.current.pendingGuruPrompt!.prompt).toContain("src/index.ts");
    expect(result.current.pendingGuruPrompt!.prompt).toContain("unsafe eval");
  });

  it("openGuruForStall works when stalled is null", () => {
    const { result } = renderHook(() => useAppLayout(null, false));

    act(() => {
      result.current.openGuruForStall();
    });

    expect(result.current.view).toBe("chat");
    expect(result.current.pendingGuruPrompt).not.toBeNull();
    expect(result.current.pendingGuruPrompt!.prompt).toContain("stalled");
  });

  it("askGuruForLog creates prompt from a critique log", () => {
    const { result } = renderHook(() => useAppLayout(null, false));
    const log = {
      file_path: "lib/utils.ts",
      severity: "critical",
      message: "SQL injection risk",
    };

    act(() => {
      result.current.askGuruForLog(log as any);
    });

    expect(result.current.view).toBe("chat");
    expect(result.current.pendingGuruPrompt!.prompt).toContain("CRITICAL");
    expect(result.current.pendingGuruPrompt!.prompt).toContain("lib/utils.ts");
    expect(result.current.pendingGuruPrompt!.prompt).toContain("SQL injection risk");
  });

  it("consumeAutoPrompt clears the pending prompt", () => {
    const stalled = { file: "a.ts", reason: "r" };
    const { result } = renderHook(() => useAppLayout(stalled, false));

    act(() => {
      result.current.openGuruForStall();
    });
    expect(result.current.pendingGuruPrompt).not.toBeNull();

    act(() => {
      result.current.consumeAutoPrompt();
    });
    expect(result.current.pendingGuruPrompt).toBeNull();
  });

  it("resets guru unread count when switching to chat view", () => {
    const { result } = renderHook(() => useAppLayout(null, false));

    // Trigger handleGuruReply while NOT on chat view (view defaults to "monitor")
    act(() => {
      result.current.handleGuruReply();
    });
    expect(result.current.guruUnreadCount).toBe(1);

    // Switch to chat — count should reset
    act(() => {
      result.current.setView("chat");
    });
    expect(result.current.guruUnreadCount).toBe(0);
  });

  it("guruUnreadCount caps at 99", () => {
    const { result } = renderHook(() => useAppLayout(null, false));

    act(() => {
      for (let i = 0; i < 120; i++) {
        result.current.handleGuruReply();
      }
    });

    expect(result.current.guruUnreadCount).toBeLessThanOrEqual(99);
  });
});
