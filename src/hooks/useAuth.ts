import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import type { GithubUser, DeviceCodeResponse, AuthSessionResponse, AuthLoginResult } from "../types";

const isPendingAuthorization = (message: string): boolean =>
  message.toLowerCase().includes("authorization pending");

export interface UseAuthReturn {
  authSession: GithubUser | null;
  authVerified: boolean;
  authWarning: string | null;
  authDevice: DeviceCodeResponse | null;
  authLoading: boolean;
  authError: string | null;
  authCountdown: number | null;
  authGateVisible: boolean;
  showAuthGate: boolean;
  requiresVerified: boolean;
  refreshAuthSession: () => Promise<AuthSessionResponse | null>;
  startGithubLogin: () => Promise<void>;
  completeGithubLogin: () => Promise<void>;
  cancelGithubLogin: () => void;
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
  
  // Refs for cleanup and race condition prevention
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<number | null>(null);
  const authFlowIdRef = useRef(0);

  const refreshAuthSession = useCallback(async (): Promise<AuthSessionResponse | null> => {
    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await invoke<AuthSessionResponse | null>("refresh_auth_session");
      
      // Prevent state updates if unmounted
      if (!mountedRef.current) return null;
      
      setAuthSession(res?.user ?? null);
      setAuthVerified(Boolean(res?.verified));
      setAuthWarning(res?.warning ?? null);
      if (res?.verified) {
        setAuthGateVisible(false);
      }
      return res;
    } catch (e: unknown) {
      if (!mountedRef.current) return null;
      setAuthError(e instanceof Error ? e.message : String(e));
      setAuthGateVisible(true);
      return null;
    }
  }, []);

  // Load initial session
  useEffect(() => {
    mountedRef.current = true;
    
    const loadSession = async (): Promise<void> => {
      try {
        const res = await invoke<AuthSessionResponse | null>("get_auth_session", { cachedOnly: true });
        if (!mountedRef.current) return;
        setAuthSession(res?.user ?? null);
        setAuthVerified(Boolean(res?.verified));
        setAuthWarning(res?.warning ?? null);
      } catch (e) {
        if (!mountedRef.current) return;
        setAuthError(e instanceof Error ? e.message : String(e));
      }
    };
    
    loadSession();
    
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [isDesktop]);

  // Countdown timer for device code - fixed cleanup
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!authDevice) {
      setAuthCountdown(null);
      return;
    }
    
    setAuthCountdown(authDevice.expires_in);
    
    intervalRef.current = window.setInterval(() => {
      setAuthCountdown(prev => {
        if (prev === null || prev <= 0) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return null;
        }
        return Math.max(prev - 1, 0);
      });
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
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
    authFlowIdRef.current += 1;
    const flowId = authFlowIdRef.current;
    setAuthLoading(true);
    setAuthError(null);
    setAuthWarning(null);
    try {
      const device = await invoke<DeviceCodeResponse>("start_github_login");
      if (!mountedRef.current || authFlowIdRef.current !== flowId) return;
      setAuthDevice(device);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) {
        setAuthLoading(false);
      }
    }
  }, [isDesktop]);

  const completeGithubLogin = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    if (!authDevice) return;
    
    // Cancel any pending login
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await invoke<AuthLoginResult>("complete_github_login", {
        deviceCode: authDevice.device_code,
        maxWaitSeconds: 60
      });
      if (!mountedRef.current) return;
      setAuthSession(result.user);
      setAuthWarning(result.warning ?? null);
      setAuthVerified(true);
      setAuthDevice(null);
      setAuthGateVisible(false);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (isPendingAuthorization(msg)) {
        setAuthError(null);
      } else {
        setAuthError(msg);
      }
    } finally {
      if (mountedRef.current) {
        setAuthLoading(false);
      }
    }
  }, [isDesktop, authDevice]);

  // Auto-check device authorization and close modal when GitHub confirms login
  useEffect(() => {
    if (!isDesktop || !authDevice || authSession) return;

    const flowId = authFlowIdRef.current;
    let active = true;
    const pollDelayMs = Math.min(Math.max(authDevice.interval, 2), 10) * 1000;
    const maxWaitSeconds = Math.max(8, Math.min(25, Math.floor(pollDelayMs / 1000) + 2));

    const run = async (): Promise<void> => {
      while (active && mountedRef.current && authFlowIdRef.current === flowId) {
        setAuthLoading(true);
        try {
          const result = await invoke<AuthLoginResult>("complete_github_login", {
            deviceCode: authDevice.device_code,
            maxWaitSeconds,
          });

          if (!active || !mountedRef.current || authFlowIdRef.current !== flowId) return;

          setAuthSession(result.user);
          setAuthWarning(result.warning ?? null);
          setAuthVerified(true);
          setAuthDevice(null);
          setAuthGateVisible(false);
          setAuthError(null);
          return;
        } catch (e: unknown) {
          if (!active || !mountedRef.current || authFlowIdRef.current !== flowId) return;
          const msg = e instanceof Error ? e.message : String(e);
          if (!isPendingAuthorization(msg)) {
            setAuthError(msg);
          }
        } finally {
          if (active && mountedRef.current && authFlowIdRef.current === flowId) {
            setAuthLoading(false);
          }
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), pollDelayMs);
        });
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [isDesktop, authDevice, authSession]);

  const cancelGithubLogin = useCallback((): void => {
    authFlowIdRef.current += 1;
    setAuthDevice(null);
    setAuthLoading(false);
    setAuthError(null);
  }, []);

  const logoutGithub = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await invoke("logout_github");
      if (!mountedRef.current) return;
      setAuthSession(null);
      setAuthVerified(false);
      setAuthWarning(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) {
        setAuthLoading(false);
      }
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
    cancelGithubLogin,
    logoutGithub,
    setAuthDevice,
    setAuthError,
    setAuthGateVisible,
  };
}

export default useAuth;
