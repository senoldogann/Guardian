import { useState, useEffect, useCallback } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";

export type ScanProfile = "source" | "extended" | "full";

export type ScanProfileConfig = {
  profile: ScanProfile;
};

export interface UseScanProfileReturn {
  scanProfile: ScanProfile;
  scanProfileSaving: boolean;
  scanProfileError: string | null;
  setScanProfile: React.Dispatch<React.SetStateAction<ScanProfile>>;
  saveScanProfile: () => Promise<void>;
}

export function useScanProfile(settingsOpen: boolean): UseScanProfileReturn {
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

  const [scanProfile, setScanProfile] = useState<ScanProfile>("source");
  const [scanProfileSaving, setScanProfileSaving] = useState(false);
  const [scanProfileError, setScanProfileError] = useState<string | null>(null);

  // Load scan profile config when settings opens
  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    const loadScanProfile = async (): Promise<void> => {
      try {
        const res = await invoke<ScanProfileConfig>("get_scan_profile_config");
        const raw = (res?.profile ?? "source").toString().toLowerCase();
        const normalized: ScanProfile = raw === "extended" || raw === "full" ? raw : "source";
        setScanProfile(normalized);
        setScanProfileError(null);
      } catch (e: unknown) {
        setScanProfileError(e instanceof Error ? e.message : String(e));
      }
    };
    void loadScanProfile();
  }, [isDesktop, settingsOpen]);

  const saveScanProfile = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setScanProfileSaving(true);
    setScanProfileError(null);
    try {
      const res = await invoke<ScanProfileConfig>("set_scan_profile_config", {
        config: { profile: scanProfile },
      });
      const raw = (res?.profile ?? scanProfile).toString().toLowerCase();
      const normalized: ScanProfile = raw === "extended" || raw === "full" ? raw : "source";
      setScanProfile(normalized);
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (e: unknown) {
      setScanProfileError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanProfileSaving(false);
    }
  }, [isDesktop, scanProfile, t, toast]);

  return {
    scanProfile,
    scanProfileSaving,
    scanProfileError,
    setScanProfile,
    saveScanProfile,
  };
}
