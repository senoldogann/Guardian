import { describe, expect, it, vi } from "vitest";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { invoke, isTauriRuntime, openDialog, openExternal } from "../tauri";

const invokeMock = tauriInvoke as unknown as ReturnType<typeof vi.fn>;

describe("tauri helpers", () => {
  it("returns false when no tauri runtime", () => {
    const original = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;
    expect(isTauriRuntime()).toBe(false);
    (window as any).__TAURI_INTERNALS__ = original;
  });

  it("invoke rejects when tauri runtime is missing", async () => {
    const original = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;
    await expect(invoke("ping")).rejects.toThrow("Tauri runtime unavailable");
    (window as any).__TAURI_INTERNALS__ = original;
  });

  it("invoke forwards to tauri invoke when runtime is present", async () => {
    invokeMock.mockResolvedValueOnce("pong");
    const result = await invoke<string>("ping");
    expect(result).toBe("pong");
    expect(invokeMock).toHaveBeenCalledWith("ping", undefined);
  });

  it("openExternal falls back to window.open when runtime is missing", async () => {
    const original = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await openExternal("https://example.com");
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
    (window as any).__TAURI_INTERNALS__ = original;
  });

  it("openDialog returns null when runtime is missing", async () => {
    const original = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;
    await expect(openDialog({ directory: true })).resolves.toBeNull();
    (window as any).__TAURI_INTERNALS__ = original;
  });
});
