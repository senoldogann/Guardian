import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { STORAGE_KEYS } from "../constants";
import type { ExportAuditPdfResult } from "../lib/exportAuditPdf";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import type { Critique, SettingsTab } from "../types";
import { normalizeThemeMode, normalizeHex, normalizeFontFamily } from "./useTheme";
import type { ThemeMode, ThemePalette } from "./useTheme";

export type WebSearchDepth = "basic" | "advanced" | "fast" | "ultra-fast" | "auto";

export type ScanTuning = {
  max_files_per_scan: number;
  max_batch_size_hint: number;
  token_budget_hint: number;
};

export type UserPreferencesV1 = {
  schema_version: number;
  theme_mode: ThemeMode;
  language: "en" | "tr";
  light_palette: ThemePalette;
  dark_palette: ThemePalette;
  font_size_scale: number;
  font_family: string;
  model_custom_instructions: string | null;
  scan_tuning: ScanTuning;
  web_search_enabled: boolean;
  web_search_depth: WebSearchDepth;
  auto_verify_enabled: boolean;
  guru_reply_sound_enabled: boolean;
};

export type UserPreferencesPatch = {
  theme_mode?: ThemeMode;
  language?: "en" | "tr";
  light_palette?: Partial<ThemePalette>;
  dark_palette?: Partial<ThemePalette>;
  font_size_scale?: number;
  font_family?: string;
  model_custom_instructions?: string | null;
  scan_tuning?: Partial<ScanTuning>;
  web_search_enabled?: boolean;
  web_search_depth?: WebSearchDepth;
  auto_verify_enabled?: boolean;
  guru_reply_sound_enabled?: boolean;
};

export type UpdateCheckResult = {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
  last_checked_at?: string | null;
};

export const USER_PREFERENCES_SCHEMA_VERSION = 1;

const DEFAULT_MODEL_CUSTOM_INSTRUCTION =
  "Keep release-governance clarity first: explain risk and release impact before fix details, and prefer minimal, policy-compliant, production-safe changes.";

export const DEFAULT_USER_PREFERENCES: UserPreferencesV1 = {
  schema_version: USER_PREFERENCES_SCHEMA_VERSION,
  theme_mode: "dark",
  language: "en",
  light_palette: {
    accent: "#0284c7",
    panel: "#ffffff",
    text: "#0f172a",
  },
  dark_palette: {
    accent: "#38bdf8",
    panel: "#111827",
    text: "#edf2f7",
  },
  font_size_scale: 100,
  font_family: "space-grotesk",
  model_custom_instructions: DEFAULT_MODEL_CUSTOM_INSTRUCTION,
  scan_tuning: {
    max_files_per_scan: 300,
    max_batch_size_hint: 3,
    token_budget_hint: 5000,
  },
  web_search_enabled: false,
  web_search_depth: "basic",
  auto_verify_enabled: false,
  guru_reply_sound_enabled: true,
};

const buildFallbackUpdateInfo = (
  version: string,
  status: string = "up_to_date",
  error: string | null = null
): UpdateCheckResult => ({
  status,
  current_version: version,
  latest_version: version,
  notes: null,
  error,
  last_checked_at: new Date().toISOString(),
});

export interface UseUserPreferencesReturn {
  userPreferences: UserPreferencesV1 | null;
  userPreferencesSaving: boolean;
  userPreferencesError: string | null;
  webSearchEnabled: boolean;
  webSearchDepth: WebSearchDepth;
  autoVerifyEnabled: boolean;
  guruReplySoundEnabled: boolean;
  settingsTab: SettingsTab;
  updateInfo: UpdateCheckResult | null;
  updateDismissed: boolean;
  updateInstalling: boolean;
  updateError: string | null;
  updateChecking: boolean;
  exportPdfInProgress: boolean;
  exportPdfMessage: string | null;
  exportPdfError: string | null;
  setSettingsTab: (tab: SettingsTab) => void;
  setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onWebSearchToggle: () => void;
  setWebSearchDepth: React.Dispatch<React.SetStateAction<WebSearchDepth>>;
  onWebSearchDepthChange: (value: WebSearchDepth) => void;
  setAutoVerifyEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onAutoVerifyToggle: () => void;
  setGuruReplySoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onGuruReplySoundToggle: () => void;
  onLocalePreferenceChange: (locale: "en" | "tr") => void;
  updateUserPreferences: (patch: UserPreferencesPatch) => void;
  refreshUserPreferences: () => Promise<void>;
  resetUserPreferences: () => Promise<void>;
  onExportPDF: (logs: Record<string, Critique>, path: string) => void;
  setUpdateDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export function useUserPreferences(opts: {
  settingsOpen: boolean;
  exportPdfFn: (args: { logs: Record<string, Critique>; path: string }) => Promise<ExportAuditPdfResult>;
}): UseUserPreferencesReturn {
  const { settingsOpen, exportPdfFn } = opts;
  const isDesktop = isTauriRuntime();
  const toast = useToast();
  const { t } = useI18n();

  // ── Normalizers ──────────────────────────────────────────────

  const normalizeWebSearchDepth = useCallback((value: string | null): WebSearchDepth => {
    const raw = (value ?? "").trim().toLowerCase();
    if (raw === "advanced" || raw === "fast" || raw === "ultra-fast" || raw === "auto") {
      return raw as WebSearchDepth;
    }
    return "basic";
  }, []);

  const normalizeLocale = useCallback((value: unknown): "en" | "tr" => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "tr" ? "tr" : "en";
  }, []);

  const normalizeUserPreferences = useCallback(
    (input?: Partial<UserPreferencesV1> | null): UserPreferencesV1 => {
      const next = input ?? {};
      const mergedScanTuning = {
        ...DEFAULT_USER_PREFERENCES.scan_tuning,
        ...(next.scan_tuning ?? {}),
      };
      const modelInstructionRaw =
        typeof next.model_custom_instructions === "string"
          ? next.model_custom_instructions
          : (DEFAULT_USER_PREFERENCES.model_custom_instructions ?? "");
      return {
        schema_version: USER_PREFERENCES_SCHEMA_VERSION,
        theme_mode: normalizeThemeMode(next.theme_mode),
        language: normalizeLocale(next.language),
        light_palette: {
          accent: normalizeHex(
            next.light_palette?.accent,
            DEFAULT_USER_PREFERENCES.light_palette.accent,
          ),
          panel: normalizeHex(
            next.light_palette?.panel,
            DEFAULT_USER_PREFERENCES.light_palette.panel,
          ),
          text: normalizeHex(
            next.light_palette?.text,
            DEFAULT_USER_PREFERENCES.light_palette.text,
          ),
        },
        dark_palette: {
          accent: normalizeHex(
            next.dark_palette?.accent,
            DEFAULT_USER_PREFERENCES.dark_palette.accent,
          ),
          panel: normalizeHex(
            next.dark_palette?.panel,
            DEFAULT_USER_PREFERENCES.dark_palette.panel,
          ),
          text: normalizeHex(
            next.dark_palette?.text,
            DEFAULT_USER_PREFERENCES.dark_palette.text,
          ),
        },
        font_size_scale: Math.min(
          130,
          Math.max(85, Number(next.font_size_scale ?? DEFAULT_USER_PREFERENCES.font_size_scale)),
        ),
        font_family: normalizeFontFamily(next.font_family),
        model_custom_instructions: modelInstructionRaw.trim() || null,
        scan_tuning: {
          max_files_per_scan: Math.min(
            400,
            Math.max(
              50,
              Number(
                mergedScanTuning.max_files_per_scan
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.max_files_per_scan,
              ),
            ),
          ),
          max_batch_size_hint: Math.min(
            10,
            Math.max(
              1,
              Number(
                mergedScanTuning.max_batch_size_hint
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.max_batch_size_hint,
              ),
            ),
          ),
          token_budget_hint: Math.min(
            12000,
            Math.max(
              1500,
              Number(
                mergedScanTuning.token_budget_hint
                  ?? DEFAULT_USER_PREFERENCES.scan_tuning.token_budget_hint,
              ),
            ),
          ),
        },
        web_search_enabled:
          typeof next.web_search_enabled === "boolean"
            ? next.web_search_enabled
            : DEFAULT_USER_PREFERENCES.web_search_enabled,
        web_search_depth: normalizeWebSearchDepth(next.web_search_depth ?? "basic"),
        auto_verify_enabled:
          typeof next.auto_verify_enabled === "boolean"
            ? next.auto_verify_enabled
            : DEFAULT_USER_PREFERENCES.auto_verify_enabled,
        guru_reply_sound_enabled:
          typeof next.guru_reply_sound_enabled === "boolean"
            ? next.guru_reply_sound_enabled
            : DEFAULT_USER_PREFERENCES.guru_reply_sound_enabled,
      };
    },
    [normalizeLocale, normalizeWebSearchDepth],
  );

  // ── Web search state ─────────────────────────────────────────

  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.WEB_SEARCH) === "true";
    }
    return false;
  });

  const [webSearchDepth, setWebSearchDepth] = useState<WebSearchDepth>(() => {
    if (typeof window !== "undefined") {
      return normalizeWebSearchDepth(localStorage.getItem(STORAGE_KEYS.WEB_SEARCH_DEPTH));
    }
    return "basic";
  });

  // ── Safety state ─────────────────────────────────────────────

  const [autoVerifyEnabled, setAutoVerifyEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED) === "true";
    }
    return false;
  });

  const [guruReplySoundEnabled, setGuruReplySoundEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED);
      if (stored === null) return true;
      return stored === "true";
    }
    return true;
  });

  // ── User preferences state ──────────────────────────────────

  const [userPreferences, setUserPreferences] = useState<UserPreferencesV1 | null>(null);
  const [userPreferencesSaving, setUserPreferencesSaving] = useState(false);
  const [userPreferencesError, setUserPreferencesError] = useState<string | null>(null);
  const userPreferencesRef = useRef<UserPreferencesV1 | null>(null);
  const userPreferencesGenerationRef = useRef(0);
  const pendingUserPreferencesSaveRef = useRef<{ prefs: UserPreferencesV1; generation: number } | null>(null);
  const userPreferencesSaveLoopRunningRef = useRef(false);
  const userPreferencesSaveTimerRef = useRef<number | null>(null);

  // ── Update state ─────────────────────────────────────────────

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  // ── Export PDF state ─────────────────────────────────────────

  const [exportPdfInProgress, setExportPdfInProgress] = useState(false);
  const [exportPdfMessage, setExportPdfMessage] = useState<string | null>(null);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);
  const exportStatusTimerRef = useRef<number | null>(null);

  // ── Cleanup ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (exportStatusTimerRef.current) {
        window.clearTimeout(exportStatusTimerRef.current);
      }
      if (userPreferencesSaveTimerRef.current) {
        window.clearTimeout(userPreferencesSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    userPreferencesRef.current = userPreferences;
  }, [userPreferences]);

  // ── Tab state ────────────────────────────────────────────────

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsTab("general");
  }, [settingsOpen]);

  // ── Persist local storage ────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.WEB_SEARCH, String(webSearchEnabled));
  }, [webSearchEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_DEPTH, webSearchDepth);
  }, [webSearchDepth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED, String(autoVerifyEnabled));
  }, [autoVerifyEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED, String(guruReplySoundEnabled));
  }, [guruReplySoundEnabled]);

  // ── Internal helpers ─────────────────────────────────────────

  const mergeLegacyPreferences = useCallback(
    (base: UserPreferencesV1): UserPreferencesV1 => {
      if (typeof window === "undefined") return base;
      const asBool = (raw: string | null): boolean | null => {
        if (raw === "true") return true;
        if (raw === "false") return false;
        return null;
      };

      const next: UserPreferencesV1 = {
        ...base,
        scan_tuning: { ...base.scan_tuning },
      };

      const themeLegacy = localStorage.getItem(STORAGE_KEYS.THEME);
      if (themeLegacy === "dark" || themeLegacy === "light") {
        next.theme_mode = themeLegacy;
      }

      const localeLegacy = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (localeLegacy === "en" || localeLegacy === "tr") {
        next.language = localeLegacy;
      }

      const webSearchLegacy = asBool(localStorage.getItem(STORAGE_KEYS.WEB_SEARCH));
      if (webSearchLegacy !== null) {
        next.web_search_enabled = webSearchLegacy;
      }

      const webDepthLegacy = localStorage.getItem(STORAGE_KEYS.WEB_SEARCH_DEPTH);
      if (webDepthLegacy) {
        next.web_search_depth = normalizeWebSearchDepth(webDepthLegacy);
      }

      const autoVerifyLegacy = asBool(localStorage.getItem(STORAGE_KEYS.AUTO_VERIFY_ENABLED));
      if (autoVerifyLegacy !== null) {
        next.auto_verify_enabled = autoVerifyLegacy;
      }

      const guruSoundLegacy = asBool(localStorage.getItem(STORAGE_KEYS.GURU_REPLY_SOUND_ENABLED));
      if (guruSoundLegacy !== null) {
        next.guru_reply_sound_enabled = guruSoundLegacy;
      }

      return normalizeUserPreferences(next);
    },
    [normalizeUserPreferences, normalizeWebSearchDepth],
  );

  const applyPreferencesToRuntime = useCallback((prefs: UserPreferencesV1): void => {
    setWebSearchEnabled(prefs.web_search_enabled);
    setWebSearchDepth(normalizeWebSearchDepth(prefs.web_search_depth));
    setAutoVerifyEnabled(prefs.auto_verify_enabled);
    setGuruReplySoundEnabled(prefs.guru_reply_sound_enabled);
  }, [normalizeWebSearchDepth]);

  const commitUserPreferencesState = useCallback((prefs: UserPreferencesV1): number => {
    const nextGeneration = userPreferencesGenerationRef.current + 1;
    userPreferencesGenerationRef.current = nextGeneration;
    userPreferencesRef.current = prefs;
    startTransition(() => {
      setUserPreferences(prefs);
    });
    return nextGeneration;
  }, []);

  const clearQueuedUserPreferencesSave = useCallback((): void => {
    pendingUserPreferencesSaveRef.current = null;
    if (userPreferencesSaveTimerRef.current) {
      window.clearTimeout(userPreferencesSaveTimerRef.current);
      userPreferencesSaveTimerRef.current = null;
    }
  }, []);

  const saveUserPreferencesInternal = useCallback(
    async (prefs: UserPreferencesV1): Promise<UserPreferencesV1> => {
      const normalized = normalizeUserPreferences(prefs);
      const saved = await invoke<UserPreferencesV1>("set_user_preferences", {
        preferences: normalized,
      });
      return normalizeUserPreferences(saved);
    },
    [normalizeUserPreferences],
  );

  const flushUserPreferencesSaveQueue = useCallback(async (): Promise<void> => {
    if (!isDesktop || userPreferencesSaveLoopRunningRef.current) return;
    userPreferencesSaveLoopRunningRef.current = true;
    try {
      while (pendingUserPreferencesSaveRef.current) {
        const queued = pendingUserPreferencesSaveRef.current;
        pendingUserPreferencesSaveRef.current = null;
        setUserPreferencesSaving(true);
        setUserPreferencesError(null);
        try {
          const saved = await saveUserPreferencesInternal(queued.prefs);
          const hasNewerPatch = pendingUserPreferencesSaveRef.current !== null;
          const isCurrentGeneration = queued.generation === userPreferencesGenerationRef.current;
          if (!hasNewerPatch && isCurrentGeneration) {
            userPreferencesRef.current = saved;
            startTransition(() => {
              setUserPreferences(saved);
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setUserPreferencesError(t("settings.errors.preferencesSaveFailed", { error: message }));
          break;
        }
      }
    } finally {
      userPreferencesSaveLoopRunningRef.current = false;
      setUserPreferencesSaving(false);
    }
  }, [isDesktop, saveUserPreferencesInternal, t]);

  const queueUserPreferencesSave = useCallback(
    (prefs: UserPreferencesV1, generation: number, delayMs = 220): void => {
      pendingUserPreferencesSaveRef.current = { prefs, generation };
      setUserPreferencesSaving(true);
      setUserPreferencesError(null);
      if (userPreferencesSaveTimerRef.current) {
        window.clearTimeout(userPreferencesSaveTimerRef.current);
      }
      userPreferencesSaveTimerRef.current = window.setTimeout(() => {
        userPreferencesSaveTimerRef.current = null;
        void flushUserPreferencesSaveQueue();
      }, delayMs);
    },
    [flushUserPreferencesSaveQueue],
  );

  // ── Public callbacks ─────────────────────────────────────────

  const refreshUserPreferences = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUserPreferencesSaving(true);
    setUserPreferencesError(null);
    try {
      clearQueuedUserPreferencesSave();
      const raw = await invoke<UserPreferencesV1>("get_user_preferences");
      const normalized = normalizeUserPreferences(raw);
      commitUserPreferencesState(normalized);
      applyPreferencesToRuntime(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUserPreferencesError(t("settings.errors.preferencesLoadFailed", { error: message }));
    } finally {
      setUserPreferencesSaving(false);
    }
  }, [
    isDesktop,
    clearQueuedUserPreferencesSave,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    t,
  ]);

  const resetUserPreferences = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUserPreferencesSaving(true);
    setUserPreferencesError(null);
    try {
      clearQueuedUserPreferencesSave();
      const raw = await invoke<UserPreferencesV1>("reset_user_preferences");
      const normalized = normalizeUserPreferences(raw);
      commitUserPreferencesState(normalized);
      applyPreferencesToRuntime(normalized);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1, "true");
      }
      toast.showSuccess(t("toast.saved"), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUserPreferencesError(t("settings.errors.preferencesResetFailed", { error: message }));
    } finally {
      setUserPreferencesSaving(false);
    }
  }, [
    isDesktop,
    clearQueuedUserPreferencesSave,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    t,
    toast,
  ]);

  // ── Load + migrate legacy preferences ────────────────────────

  useEffect(() => {
    if (!isDesktop || !settingsOpen) return;
    let canceled = false;

    const loadAndMigrate = async (): Promise<void> => {
      setUserPreferencesSaving(true);
      setUserPreferencesError(null);
      try {
        clearQueuedUserPreferencesSave();
        const fetched = await invoke<UserPreferencesV1>("get_user_preferences");
        if (canceled) return;
        let normalized = normalizeUserPreferences(fetched);

        const migrationDone =
          typeof window !== "undefined" &&
          localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1) === "true";

        if (!migrationDone) {
          const mergedFromLegacy = mergeLegacyPreferences(normalized);
          const before = JSON.stringify(normalized);
          const after = JSON.stringify(mergedFromLegacy);
          if (before !== after) {
            setUserPreferencesSaving(true);
            normalized = await saveUserPreferencesInternal(mergedFromLegacy);
          }
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES_MIGRATED_V1, "true");
          }
        }

        if (canceled) return;
        commitUserPreferencesState(normalized);
        applyPreferencesToRuntime(normalized);
      } catch (error) {
        if (canceled) return;
        const message = error instanceof Error ? error.message : String(error);
        setUserPreferencesError(t("settings.errors.preferencesLoadFailed", { error: message }));
      } finally {
        if (!canceled) {
          setUserPreferencesSaving(false);
        }
      }
    };

    void loadAndMigrate();
    return () => {
      canceled = true;
    };
  }, [
    applyPreferencesToRuntime,
    clearQueuedUserPreferencesSave,
    commitUserPreferencesState,
    isDesktop,
    mergeLegacyPreferences,
    normalizeUserPreferences,
    saveUserPreferencesInternal,
    settingsOpen,
    t,
  ]);

  // ── Patch user preferences ───────────────────────────────────

  const patchUserPreferences = useCallback((patch: UserPreferencesPatch): void => {
    if (!isDesktop) return;
    void (async () => {
      let base = userPreferencesRef.current;
      if (!base) {
        try {
          const fetched = await invoke<UserPreferencesV1>("get_user_preferences");
          base = normalizeUserPreferences(fetched);
        } catch {
          base = normalizeUserPreferences(null);
        }
      }

      const merged = normalizeUserPreferences({
        ...base,
        ...patch,
        light_palette: {
          ...base.light_palette,
          ...(patch.light_palette ?? {}),
        },
        dark_palette: {
          ...base.dark_palette,
          ...(patch.dark_palette ?? {}),
        },
        scan_tuning: {
          ...base.scan_tuning,
          ...(patch.scan_tuning ?? {}),
        },
      });
      const generation = commitUserPreferencesState(merged);
      applyPreferencesToRuntime(merged);
      queueUserPreferencesSave(merged, generation);
    })();
  }, [
    isDesktop,
    normalizeUserPreferences,
    commitUserPreferencesState,
    applyPreferencesToRuntime,
    queueUserPreferencesSave,
  ]);

  const onWebSearchDepthChange = useCallback((value: WebSearchDepth): void => {
    const normalized = normalizeWebSearchDepth(value);
    setWebSearchDepth(normalized);
    patchUserPreferences({ web_search_depth: normalized });
  }, [normalizeWebSearchDepth, patchUserPreferences]);

  const onWebSearchToggle = useCallback((): void => {
    setWebSearchEnabled(prev => {
      const next = !prev;
      patchUserPreferences({ web_search_enabled: next });
      return next;
    });
  }, [patchUserPreferences]);

  const onAutoVerifyToggle = useCallback((): void => {
    if (!autoVerifyEnabled) {
      const ok = window.confirm(
        t("settings.errors.autoVerifyConfirm")
      );
      if (!ok) return;
    }
    setAutoVerifyEnabled(prev => {
      const next = !prev;
      patchUserPreferences({ auto_verify_enabled: next });
      return next;
    });
  }, [autoVerifyEnabled, patchUserPreferences, t]);

  const onGuruReplySoundToggle = useCallback((): void => {
    setGuruReplySoundEnabled((prev) => {
      const next = !prev;
      patchUserPreferences({ guru_reply_sound_enabled: next });
      return next;
    });
  }, [patchUserPreferences]);

  const onLocalePreferenceChange = useCallback((locale: "en" | "tr"): void => {
    patchUserPreferences({ language: locale });
  }, [patchUserPreferences]);

  // ── Export PDF ───────────────────────────────────────────────

  const onExportPDF = useCallback((logs: Record<string, Critique>, path: string): void => {
    if (exportPdfInProgress) return;

    if (exportStatusTimerRef.current) {
      window.clearTimeout(exportStatusTimerRef.current);
      exportStatusTimerRef.current = null;
    }

    void (async () => {
      setExportPdfInProgress(true);
      setExportPdfError(null);
      setExportPdfMessage(null);
      try {
        const result = await exportPdfFn({ logs, path });
        if (result.mode === "tauri") {
          const savedPath = result.savedPath || "your Downloads folder";
          const openedText = result.folderOpened ? t("toast.folderOpened") : "";
          toast.showSuccess(
            t("toast.exportSaved", { path: savedPath, opened: openedText }).trim(),
            3000
          );
        } else {
          toast.showSuccess(t("toast.saved"), 2500);
        }
      } catch (e: unknown) {
        setExportPdfError(e instanceof Error ? e.message : String(e));

        exportStatusTimerRef.current = window.setTimeout(() => {
          setExportPdfError(null);
          exportStatusTimerRef.current = null;
        }, 5000);
      } finally {
        setExportPdfInProgress(false);
      }
    })();
  }, [exportPdfFn, exportPdfInProgress, toast]);

  // ── App version + update checks ─────────────────────────────

  useEffect(() => {
    if (!isDesktop) return;
    const loadVersion = async (): Promise<void> => {
      try {
        const version = await invoke<string>("get_app_version");
        setAppVersion(version);
        setUpdateInfo(prev => prev ?? buildFallbackUpdateInfo(version));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAppVersion("Unknown");
        setUpdateInfo(prev => prev ?? buildFallbackUpdateInfo("Unknown", "unavailable", message));
      }
    };
    void loadVersion();
  }, [isDesktop]);

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;
    setUpdateChecking(true);
    setUpdateError(null);
    const checkedAt = new Date().toISOString();
    try {
      const res = await invoke<UpdateCheckResult | null>("check_app_update");
      if (res && typeof res.status === "string") {
        const currentVersion = res.current_version || appVersion || "Unknown";
        const latestVersion =
          res.latest_version ??
          (res.status === "up_to_date" ? currentVersion : appVersion ?? currentVersion);
        setUpdateInfo({
          ...res,
          current_version: currentVersion,
          latest_version: latestVersion,
          last_checked_at: res.last_checked_at ?? checkedAt,
        });
        setUpdateError(res.error ?? null);
      } else {
        const msg = t("settings.errors.updateUnavailable");
        setUpdateInfo(buildFallbackUpdateInfo(appVersion ?? "Unknown", "unavailable", msg));
        setUpdateError(msg);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const displayMessage = t("settings.errors.updateUnavailableHint");
      setUpdateError(displayMessage);
      setUpdateInfo(buildFallbackUpdateInfo(appVersion ?? "Unknown", "unavailable", displayMessage));
      console.warn("[Guardian] Update check failed:", message);
    } finally {
      setUpdateChecking(false);
    }
  }, [isDesktop, appVersion]);

  useEffect(() => {
    if (!isDesktop) return;
    void checkForUpdates();
  }, [isDesktop]);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!isDesktop || updateInfo?.status !== "available") return;
    setUpdateInstalling(true);
    setUpdateError(null);
    try {
      await invoke("install_app_update");
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateInstalling(false);
    }
  }, [isDesktop, updateInfo?.status]);

  // Update polling
  useEffect(() => {
    if (!isDesktop) return;

    const onForeground = (): void => {
      if (document.visibilityState === "visible") {
        void checkForUpdates();
      }
    };

    const interval = window.setInterval(() => {
      void checkForUpdates();
    }, 15 * 60 * 1000);

    window.addEventListener("focus", onForeground);
    document.addEventListener("visibilitychange", onForeground);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onForeground);
      document.removeEventListener("visibilitychange", onForeground);
    };
  }, [isDesktop, checkForUpdates]);

  return {
    userPreferences,
    userPreferencesSaving,
    userPreferencesError,
    webSearchEnabled,
    webSearchDepth,
    autoVerifyEnabled,
    guruReplySoundEnabled,
    settingsTab,
    updateInfo,
    updateDismissed,
    updateInstalling,
    updateError,
    updateChecking,
    exportPdfInProgress,
    exportPdfMessage,
    exportPdfError,
    setSettingsTab,
    setWebSearchEnabled,
    onWebSearchToggle,
    setWebSearchDepth,
    onWebSearchDepthChange,
    setAutoVerifyEnabled,
    onAutoVerifyToggle,
    setGuruReplySoundEnabled,
    onGuruReplySoundToggle,
    onLocalePreferenceChange,
    updateUserPreferences: patchUserPreferences,
    refreshUserPreferences,
    resetUserPreferences,
    onExportPDF,
    setUpdateDismissed,
    checkForUpdates,
    installUpdate,
  };
}
