/** Tests for useAuth hook */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth } from "../useAuth";

// Mock Tauri
vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
}));

import { invoke } from "../../lib/tauri";

const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load session on mount", async () => {
    const mockSession = {
      user: { login: "testuser", id: 123, avatar_url: "https://example.com/avatar.png" },
      verified: true,
    };

    mockInvoke.mockResolvedValueOnce(mockSession);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.authSession).toEqual(mockSession.user);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_auth_session", { cachedOnly: true });
  });

  it("should handle GitHub login flow", async () => {
    const mockDeviceCode = {
      device_code: "abc123",
      user_code: "ABC-123",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    };

    mockInvoke
      .mockResolvedValueOnce(null) // Initial session check
      .mockResolvedValueOnce(mockDeviceCode); // Start login

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startGithubLogin();
    });

    expect(result.current.authDevice).toEqual(mockDeviceCode);
    expect(mockInvoke).toHaveBeenCalledWith("start_github_login");
  });

  it("should complete GitHub login", async () => {
    const mockDeviceCode = {
      device_code: "abc123",
      user_code: "ABC-123",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    };

    const mockLoginResult = {
      user: { login: "testuser", id: 123 },
      warning: null,
    };

    mockInvoke
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockDeviceCode)
      .mockResolvedValueOnce(mockLoginResult);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startGithubLogin();
    });

    await act(async () => {
      await result.current.completeGithubLogin();
    });

    expect(result.current.authSession).toEqual(mockLoginResult.user);
    expect(result.current.authVerified).toBe(true);
  });

  it("should handle logout", async () => {
    const mockSession = {
      user: { login: "testuser", id: 123 },
      verified: true,
    };

    mockInvoke
      .mockResolvedValueOnce(mockSession)
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.authSession).toBeTruthy();
    });

    await act(async () => {
      await result.current.logoutGithub();
    });

    expect(result.current.authSession).toBeNull();
    expect(result.current.authVerified).toBe(false);
  });

  it("should handle session expiration", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        user: { login: "testuser", id: 123 },
        verified: false,
        warning: "offline verification",
      });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.authWarning).toBe("offline verification");
    });
  });
});
