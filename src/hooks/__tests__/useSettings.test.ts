/** Tests for useSettings hook */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSettings } from "../useSettings";

// Mock Tauri
vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
}));

import { invoke } from "../../lib/tauri";

const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe("useSettings", () => {
  const mockExportPdfFn = vi.fn();
  const defaultUpdateResult = {
    status: "up_to_date",
    current_version: "0.2.4",
    latest_version: null,
    notes: null,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load providers on mount", async () => {
    const mockProvider = {
      provider_id: "openai",
      base_url: "https://api.openai.com/v1",
      model: "gpt-4",
    };

    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "get_provider_config") return mockProvider;
      if (command === "get_api_key_status") return { has_key: false, source: "missing" };
      if (command === "get_tavily_key_status") return { has_key: false, source: "none" };
      if (command === "check_app_update") return defaultUpdateResult;
      return null;
    });

    const { result } = renderHook(() => useSettings(mockExportPdfFn, true));

    await waitFor(() => {
      expect(result.current.providerDraft).toEqual(mockProvider);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_provider_config");
  });

  it("should validate API key", async () => {
    const mockProvider = {
      provider_id: "openai",
      base_url: "https://api.openai.com/v1",
      model: "gpt-4",
    };

    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "get_provider_config") return mockProvider;
      if (command === "get_api_key_status") return { has_key: true, source: "user" };
      if (command === "get_tavily_key_status") return { has_key: false, source: "none" };
      if (command === "check_app_update") return defaultUpdateResult;
      return null;
    });

    const { result } = renderHook(() => useSettings(mockExportPdfFn, true));

    await waitFor(() => {
      expect(result.current.providerDraft).toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.apiKeyStatus).toEqual({
        has_key: true,
        source: "user",
      });
    });
  });

  it("should handle update check", async () => {
    const mockUpdateResult = {
      status: "available",
      current_version: "1.0.0",
      latest_version: "1.1.0",
      notes: "New features",
    };

    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "get_provider_config") return { provider_id: "openai", base_url: "", model: "" };
      if (command === "get_api_key_status") return { has_key: false, source: "missing" };
      if (command === "get_tavily_key_status") return { has_key: false, source: "none" };
      if (command === "check_app_update") return mockUpdateResult;
      return null;
    });

    const { result } = renderHook(() => useSettings(mockExportPdfFn, true));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockInvoke).toHaveBeenCalledWith("check_app_update");
  });

  it("should handle provider change", async () => {
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "get_provider_config") {
        return {
          provider_id: "openai",
          base_url: "",
          model: "",
        };
      }
      if (command === "get_api_key_status") return { has_key: false, source: "missing" };
      if (command === "get_tavily_key_status") return { has_key: false, source: "none" };
      if (command === "check_app_update") return defaultUpdateResult;
      return null;
    });

    const { result } = renderHook(() => useSettings(mockExportPdfFn, true));

    await waitFor(() => {
      expect(result.current.providerDraft).toBeTruthy();
    });

    act(() => {
      result.current.onProviderChange("anthropic");
    });

    expect(result.current.providerDraft?.provider_id).toBe("anthropic");
  });
});
