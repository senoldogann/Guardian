import { useState, useEffect, useCallback } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";

export type GithubUser = {
  login: string;
  id: number;
  avatar_url?: string;
};

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type AuthSessionResponse = {
  user: GithubUser;
  verified: boolean;
  warning?: string | null;
};

export type AuthLoginResult = {
  user: GithubUser;
  warning?: string | null;
};

export interface UseAuthReturn {
  // Session
  authSession: GithubUser | null;
  authVerified: boolean;
  authWarning: string | null;
  
  // Device flow
  authDevice: DeviceCodeResponse | null;
  authLoading: boolean;
  authError: string | null;
  authCountdown: number | null;
  
  // UI State
  authGateVisible: boolean;
  showAuthGate: boolean;
  requiresVerified: boolean;
  
  // Actions
  refreshAuthSession: () => Promise<AuthSessionResponse | null>;
  startGithubLogin: () => Promise<void>;
  completeGithubLogin: () => Promise<void>;
  logoutGithub: () => Promise<void>;
  setAuthDevice: (device: DeviceCodeResponse | null) => void;
  setAuthError: (error: string | null) => void;
  setAuthGateVisible: (visible: boolean) => void;
}

export function useAuth(): UseAuthReturn {
  const isDesktop = isTauriRuntime();
  
  const [authSession, setAuthSession] = useState<GithubUser | null>(null);
  const [authVerified, setAuthVerified] = useState(false);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [authDevice, setAuthDevice] = useState<DeviceCodeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authGateVisible, setAuthGateVisible] = useState(false);
  const [authCountdown, setAuthCountdown] = useState<number | null>(null);

  const refreshAuthSession = useCallback(async (): Promise<AuthSessionResponse | null> => {
    try {
      const res = await invoke<AuthSessionResponse | null>("refresh_auth_session");
      setAuthSession(res?.user ?? null);
      setAuthVerified(Boolean(res?.verified));
      setAuthWarning(res?.warning ?? null);
      if (res?.verified) {
        setAuthGateVisible(false);
      }
      return res;
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
      setAuthGateVisible(true);
      return null;
    }
  }, []);

  // Load initial session
  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      try {
        const res = await invoke<AuthSessionResponse | null>("get_auth_session", { cachedOnly: true });
        setAuthSession(res?.user ?? null);
        setAuthVerified(Boolean(res?.verified));
        setAuthWarning(res?.warning ?? null);
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : String(e));
      }
    };
    loadSession();
  }, [isDesktop]);

  // Countdown timer for device code
  useEffect(() => {
    if (!authDevice) {
      setAuthCountdown(null);
      return;
    }
    setAuthCountdown(authDevice.expires_in);
    const timer = window.setInterval(() => {
      setAuthCountdown(prev => {
        if (prev === null) return null;
        return Math.max(prev - 1, 0);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authDevice]);

  // Clear device when session is established
  useEffect(() => {
    if (authSession) {
      setAuthDevice(null);
      if (authVerified) {
        setAuthGateVisible(false);
      }
    }
  }, [authSession, authVerified]);

  const startGithubLogin = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthWarning(null);
    try {
      const device = await invoke<DeviceCodeResponse>("start_github_login");
      setAuthDevice(device);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  }, [isDesktop]);

  const completeGithubLogin = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    if (!authDevice) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await invoke<AuthLoginResult>("complete_github_login", {
        deviceCode: authDevice.device_code,
        maxWaitSeconds: 60
      });
      setAuthSession(result.user);
      setAuthWarning(result.warning ?? null);
      setAuthVerified(true);
      setAuthDevice(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }, [isDesktop, authDevice]);

  const logoutGithub = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await invoke("logout_github");
      setAuthSession(null);
      setAuthVerified(false);
      setAuthWarning(null);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  }, [isDesktop]);

  const hasOfflineSession = Boolean(authWarning?.toLowerCase().includes("offline verification"));
  const requiresLogin = isDesktop && !authSession;
  const requiresVerified = isDesktop && Boolean(authSession) && !authVerified && !hasOfflineSession;
  const showAuthGate = requiresLogin && !authDevice;

  return {
    authSession,
    authVerified,
    authWarning,
    authDevice,
    authLoading,
    authError,
    authCountdown,
    authGateVisible,
    showAuthGate,
    requiresVerified,
    refreshAuthSession,
    startGithubLogin,
    completeGithubLogin,
    logoutGithub,
    setAuthDevice,
    setAuthError,
    setAuthGateVisible,
  };
}

export default useAuth;
