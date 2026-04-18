import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

import { invoke } from "../../lib/tauri";

const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("starts in signed_out state", async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.authState).toBe("signed_out");
    });

    expect(result.current.authSession).toBeNull();
    expect(result.current.authVerified).toBe(false);
    expect(result.current.authDevice).toBeNull();
  });

  it("startGithubLogin sets device code", async () => {
    const mockDevice = {
      device_code: "abc123",
      user_code: "USER-CODE",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    };

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "start_github_login") return mockDevice;
      if (cmd === "get_auth_session") return null;
      return null;
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startGithubLogin();
    });

    expect(result.current.authDevice).toEqual(mockDevice);
    expect(result.current.authState).toBe("device_pending");
  });

  it("cancelGithubLogin resets auth flow state", async () => {
    const mockDevice = {
      device_code: "abc123",
      user_code: "USER-CODE",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    };

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "start_github_login") return mockDevice;
      if (cmd === "get_auth_session") return null;
      return null;
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startGithubLogin();
    });
    expect(result.current.authDevice).not.toBeNull();

    act(() => {
      result.current.cancelGithubLogin();
    });

    expect(result.current.authDevice).toBeNull();
    expect(result.current.authLoading).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it("showAuthGate is true when no session and no device", async () => {
    mockInvoke.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.showAuthGate).toBe(true);
    });
  });

  it("sets authError on login failure", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "start_github_login") throw new Error("Network error");
      if (cmd === "get_auth_session") return null;
      return null;
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startGithubLogin();
    });

    expect(result.current.authError).toBe("Network error");
  });

  it("logoutGithub clears session state", async () => {
    // Start with a session
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_auth_session")
        return {
          user: { login: "testuser", avatar_url: "" },
          verified: true,
          warning: null,
        };
      if (cmd === "logout_github") return null;
      if (cmd === "refresh_auth_session") return null;
      return null;
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.authSession).not.toBeNull();
    });

    await act(async () => {
      await result.current.logoutGithub();
    });

    expect(result.current.authSession).toBeNull();
    expect(result.current.authVerified).toBe(false);
    expect(result.current.authGateVisible).toBe(true);
  });
});
