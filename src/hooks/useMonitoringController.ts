import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { invoke } from "../lib/tauri";
import { handleError } from "../lib/error";
import type { ApiKeyStatus, Critique, ProviderConfig } from "../types";
import { useI18n } from "../i18n";

interface AuthController {
  authSession: unknown;
  authVerified: boolean;
  refreshAuthSession: () => Promise<{ user?: unknown; verified?: boolean } | null>;
  setAuthGateVisible: (next: boolean) => void;
  requiresVerified: boolean;
  authState: "signed_out" | "device_pending" | "verifying" | "authenticated" | string;
}

interface SettingsController {
  providerDraft: ProviderConfig | null;
  apiKeyStatus: ApiKeyStatus | null;
  providerLabel: string;
  autoVerifyEnabled: boolean;
  requiresApiKey: boolean;
}

interface UseMonitoringControllerArgs {
  active: boolean;
  path: string;
  auth: AuthController;
  settings: SettingsController;
  setLogs: Dispatch<SetStateAction<Record<string, Critique>>>;
  setActive: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  refreshMonitorCritiques: () => Promise<void>;
}

export interface LaunchGate {
  canLaunch: boolean;
  blockingReason: string | null;
}

export function useMonitoringController({
  active,
  path,
  auth,
  settings,
  setLogs,
  setActive,
  setStatus,
  setSettingsOpen,
  refreshMonitorCritiques,
}: UseMonitoringControllerArgs): {
  launchGate: LaunchGate;
  canToggleMonitoring: boolean;
  toggleMonitoring: () => Promise<void>;
} {
  const { locale, t } = useI18n();
  const launchGate = useMemo<LaunchGate>(() => {
    if (!path) {
      return { canLaunch: false, blockingReason: t("monitor.gateSelectScope") };
    }
    if (!settings.providerDraft) {
      return { canLaunch: false, blockingReason: t("monitor.gateProviderLoading") };
    }
    if (settings.requiresApiKey) {
      return {
        canLaunch: false,
        blockingReason: t("monitor.gateAddApiKey", { provider: settings.providerLabel }),
      };
    }
    if (auth.requiresVerified) {
      return {
        canLaunch: false,
        blockingReason: t("monitor.gateVerifyGithub"),
      };
    }
    if (auth.authState === "signed_out") {
      return { canLaunch: false, blockingReason: t("monitor.gateSignInGithub") };
    }
    if (auth.authState === "device_pending") {
      return {
        canLaunch: false,
        blockingReason: t("monitor.gateDevicePending"),
      };
    }
    if (auth.authState === "verifying") {
      return { canLaunch: false, blockingReason: t("monitor.gateVerifying") };
    }
    return { canLaunch: true, blockingReason: null };
  }, [
    auth.authState,
    auth.requiresVerified,
    path,
    settings.providerDraft,
    settings.providerLabel,
    settings.requiresApiKey,
    t,
  ]);

  const toggleMonitoring = useCallback(async (): Promise<void> => {
    if (active) {
      try {
        await invoke("stop_monitoring");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLogs((prev) => ({
          ...prev,
          ["System"]: {
            file_path: "System",
            severity: "Warning",
            message: t("monitor.stopFailed", { error: errorMsg }),
          },
        }));
      } finally {
        setActive(false);
        setStatus(t("monitor.statusPaused"));
      }
      return;
    }

    if (!path) return;

    let sessionOk = Boolean(auth.authSession && auth.authVerified);
    if (!sessionOk) {
      const refreshed = await auth.refreshAuthSession();
      sessionOk = Boolean(refreshed?.user && refreshed?.verified);
    }
    if (!sessionOk) {
      auth.setAuthGateVisible(true);
      setLogs((prev) => ({
        ...prev,
        ["System:Auth"]: {
          file_path: "System",
          severity: "Critical",
          message: t("monitor.authRequired"),
        },
      }));
      return;
    }

    const activeProviderId = settings.providerDraft?.provider_id;
    if (!activeProviderId) {
      setLogs((prev) => ({
        ...prev,
        ["System:Provider"]: {
          file_path: "System",
          severity: "Critical",
          message: t("monitor.providerNotReady"),
        },
      }));
      return;
    }

    const providerRequiresApiKey = activeProviderId.trim().toLowerCase() !== "ollama";
    let hasApiKey = providerRequiresApiKey ? settings.apiKeyStatus?.has_key ?? null : true;
    if (providerRequiresApiKey && hasApiKey === null) {
      try {
        const status = await invoke<ApiKeyStatus>("get_api_key_status", {
          providerId: activeProviderId,
        });
        hasApiKey = Boolean(status.has_key);
      } catch (error) {
        handleError(error, "ApiKeyStatusCheck");
        hasApiKey = false;
      }
    }

    if (providerRequiresApiKey && !hasApiKey) {
      setLogs((prev) => ({
        ...prev,
        ["System:APIKey"]: {
          file_path: "System",
          severity: "Critical",
          message: t("monitor.missingApiKey", { provider: settings.providerLabel }),
        },
      }));
      setSettingsOpen(true);
      return;
    }

    try {
      await invoke("start_monitoring", {
        path,
        autoVerifyEnabled: settings.autoVerifyEnabled,
        language: locale,
      });
      await refreshMonitorCritiques();
      setActive(true);
      setStatus(t("monitor.statusActive"));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setLogs((prev) => ({
        ...prev,
        ["System"]: {
          file_path: "System",
          severity: "Critical",
          message: t("monitor.startFailed", { error: errorMsg }),
        },
      }));
    }
  }, [
    active,
    auth,
    locale,
    path,
    refreshMonitorCritiques,
    setActive,
    setLogs,
    setSettingsOpen,
    setStatus,
    settings.apiKeyStatus?.has_key,
    settings.autoVerifyEnabled,
    settings.providerDraft?.provider_id,
    settings.providerLabel,
    t,
  ]);

  return {
    launchGate,
    canToggleMonitoring: active || launchGate.canLaunch,
    toggleMonitoring,
  };
}
