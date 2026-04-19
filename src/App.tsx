import { useState, useEffect, useMemo, useCallback, type ReactElement } from "react";
import { invoke, isTauriRuntime } from "./lib/tauri";
import { exportAuditToPdf } from "./lib/exportAuditPdf";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { StallOverlay } from "./components/StallOverlay";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ToastContainer } from "./components/Toast";
import { SettingsModal } from "./components/SettingsModal";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import { useMonitoringController } from "./hooks/useMonitoringController";
import { useWorkspace } from "./hooks/useWorkspace";
import { useAppLayout } from "./hooks/useAppLayout";
import { useThemeManager } from "./hooks/useThemeManager";
import { ControlSidebar } from "./components/layout/ControlSidebar";
import { MainWorkspace } from "./components/layout/MainWorkspace";
import { UpdateBanner } from "./components/layout/UpdateBanner";
import { useI18n } from "./i18n";
import { safeAsync } from "./lib/safeAsync";

function normalizeVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim() ?? "";
  if (!trimmed) return "Unknown";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function App(): ReactElement {
  const { t } = useI18n();

  // ── Hooks ──────────────────────────────────────────────────
  const auth = useAuth();
  const ws = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettings(exportAuditToPdf, settingsOpen);
  const layout = useAppLayout(ws.stalled, settings.guruReplySoundEnabled);
  const { theme, toggleTheme } = useThemeManager(
    settings.userPreferences,
    settings.updateUserPreferences,
  );

  // ── Window title ───────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    const syncWindowTitle = async (): Promise<void> => {
      if (!isTauriRuntime()) {
        document.title = "Guardian";
        return;
      }
      try {
        const rawVersion = await invoke<string>("get_app_version");
        if (disposed) return;
        const title = `Guardian ${normalizeVersionLabel(rawVersion)}`;
        document.title = title;
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (disposed) return;
        await getCurrentWindow().setTitle(title);
      } catch {
        if (!disposed) document.title = "Guardian";
      }
    };
    safeAsync(syncWindowTitle(), "syncWindowTitle");
    return () => { disposed = true; };
  }, []);

  // ── View-based data refresh ────────────────────────────────
  useEffect(() => {
    if (layout.view !== "ai-context") return;
    void ws.refreshAiContext();
  }, [layout.view, ws.refreshAiContext]);

  useEffect(() => {
    if (layout.view !== "reviews") return;
    void ws.refreshFixProposals();
    void ws.refreshFixHistory();
    void ws.refreshReleaseDecision();
  }, [layout.view, ws.refreshFixProposals, ws.refreshFixHistory, ws.refreshReleaseDecision]);

  // ── Cross-hook: request review navigates to chat ───────────
  const handleRequestReview = useCallback(
    async (proposal: Parameters<typeof ws.requestReviewForProposal>[0]): Promise<void> => {
      await ws.requestReviewForProposal(proposal);
      layout.setView("chat");
    },
    [ws.requestReviewForProposal, layout.setView],
  );

  // ── Derived values ─────────────────────────────────────────
  const engineModel = settings.providerDraft?.model?.trim() || t("app.notSet");
  const isDesktop = isTauriRuntime();
  const showFloatingFilter =
    !isDesktop || ws.active || ws.baselineView === "resolved" || ws.filter.trim().length > 0;

  const embeddingModeLabel = useMemo(() => {
    const mode = settings.embeddingDraft?.mode ?? "auto";
    if (mode === "openai") return "OpenAI";
    if (mode === "ollama") return "Ollama";
    if (mode === "local") return "Local Hash";
    return "Auto";
  }, [settings.embeddingDraft?.mode]);

  const { launchGate, canToggleMonitoring, toggleMonitoring } = useMonitoringController({
    active: ws.active,
    path: ws.path,
    auth,
    settings: settings,
    setLogs: ws.setLogs,
    setActive: ws.setActive,
    setStatus: ws.setStatus,
    setSettingsOpen: setSettingsOpen,
    refreshMonitorCritiques: ws.refreshMonitorCritiques,
  });

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="guardian-shell flex h-screen w-full bg-background text-text-main flex-col font-sans overflow-hidden transition-colors duration-300">
      <ToastContainer />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeToggle={toggleTheme}
        onLocaleChange={settings.onLocalePreferenceChange}
        isDesktop={true}
        providerProps={{
          providerDraft: settings.providerDraft,
          providerError: settings.providerError,
          providerSaving: settings.providerSaving,
          providerModels: settings.providerModels,
          providerModelLoading: settings.providerModelLoading,
          providerModelError: settings.providerModelError,
          providerTestLoading: settings.providerTestLoading,
          providerTestMessage: settings.providerTestMessage,
          providerTestError: settings.providerTestError,
          onProviderChange: settings.onProviderChange,
          onBaseUrlChange: settings.onBaseUrlChange,
          onModelChange: settings.onModelChange,
          onRefreshModels: () => settings.refreshProviderModels(true, false, undefined, true),
          onSaveProvider: settings.saveProviderSettings,
          onTestProviderConnection: settings.testProviderConnection,
          apiKeyStatus: settings.apiKeyStatus,
          apiKeyInput: settings.apiKeyInput,
          apiKeyError: settings.apiKeyError,
          apiKeySaving: settings.apiKeySaving,
          onApiKeyFocus: settings.onApiKeyFocus,
          onApiKeyChange: settings.onApiKeyChange,
          onSaveApiKey: settings.saveApiKey,
          onClearApiKey: settings.clearApiKey,
        }}
        webProps={{
          tavilyKeyStatus: settings.tavilyKeyStatus,
          tavilyKeyInput: settings.tavilyKeyInput,
          tavilyKeyMasked: settings.tavilyKeyMasked,
          tavilyKeyError: settings.tavilyKeyError,
          tavilyKeySaving: settings.tavilyKeySaving,
          webSearchEnabled: settings.webSearchEnabled,
          webSearchDepth: settings.webSearchDepth,
          webSearchReady: settings.webSearchReady,
          onWebSearchToggle: settings.onWebSearchToggle,
          onWebSearchDepthChange: settings.onWebSearchDepthChange,
          autoVerifyEnabled: settings.autoVerifyEnabled,
          onAutoVerifyToggle: settings.onAutoVerifyToggle,
          guruReplySoundEnabled: settings.guruReplySoundEnabled,
          onGuruReplySoundToggle: settings.onGuruReplySoundToggle,
          scanProfile: settings.scanProfile,
          scanProfileSaving: settings.scanProfileSaving,
          scanProfileError: settings.scanProfileError,
          onScanProfileChange: (value) => settings.setScanProfile(value),
          onSaveScanProfile: async () => {
            await settings.saveScanProfile();
            await ws.refreshScanProfile();
          },
          onTavilyKeyFocus: settings.onTavilyKeyFocus,
          onTavilyKeyChange: settings.onTavilyKeyChange,
          onSaveTavilyKey: settings.saveTavilyKey,
          onClearTavilyKey: settings.clearTavilyKey,
        }}
        embeddingProps={{
          embeddingDraft: settings.embeddingDraft,
          embeddingError: settings.embeddingError,
          embeddingSaving: settings.embeddingSaving,
          embeddingOpenAiKeyStatus: settings.embeddingOpenAiKeyStatus,
          embeddingOpenAiKeyInput: settings.embeddingOpenAiKeyInput,
          embeddingOpenAiKeyMasked: settings.embeddingOpenAiKeyMasked,
          embeddingOpenAiKeyError: settings.embeddingOpenAiKeyError,
          embeddingOpenAiKeySaving: settings.embeddingOpenAiKeySaving,
          onEmbeddingModeChange: settings.onEmbeddingModeChange,
          onEmbeddingOpenAiBaseUrlChange: settings.onEmbeddingOpenAiBaseUrlChange,
          onEmbeddingOllamaBaseUrlChange: settings.onEmbeddingOllamaBaseUrlChange,
          onEmbeddingOpenAiModelChange: settings.onEmbeddingOpenAiModelChange,
          onEmbeddingOllamaModelChange: settings.onEmbeddingOllamaModelChange,
          onSaveEmbeddingSettings: settings.saveEmbeddingSettings,
          onRefreshEmbeddingSettings: settings.refreshEmbeddingSettings,
          onEmbeddingOpenAiKeyFocus: settings.onEmbeddingOpenAiKeyFocus,
          onEmbeddingOpenAiKeyChange: settings.onEmbeddingOpenAiKeyChange,
          onSaveEmbeddingOpenAiKey: settings.saveEmbeddingOpenAiKey,
          onClearEmbeddingOpenAiKey: settings.clearEmbeddingOpenAiKey,
        }}
        updateProps={{
          updateInfo: settings.updateInfo,
          updateChecking: settings.updateChecking,
          updateInstalling: settings.updateInstalling,
          updateError: settings.updateError,
          onCheckUpdates: settings.checkForUpdates,
          onInstallUpdate: settings.installUpdate,
        }}
        personalizationProps={{
          userPreferences: settings.userPreferences
            ? {
                theme_mode: settings.userPreferences.theme_mode,
                light_palette: settings.userPreferences.light_palette,
                dark_palette: settings.userPreferences.dark_palette,
                font_size_scale: settings.userPreferences.font_size_scale,
                font_family: settings.userPreferences.font_family,
                model_custom_instructions: settings.userPreferences.model_custom_instructions,
                scan_tuning: settings.userPreferences.scan_tuning,
              }
            : null,
          userPreferencesSaving: settings.userPreferencesSaving,
          userPreferencesError: settings.userPreferencesError,
          onUpdateUserPreferences: settings.updateUserPreferences,
          onRefreshUserPreferences: settings.refreshUserPreferences,
          onResetUserPreferences: settings.resetUserPreferences,
        }}
        onExportPDF={() => settings.onExportPDF(ws.logs, ws.path)}
        exportPdfInProgress={settings.exportPdfInProgress}
        exportPdfMessage={settings.exportPdfMessage}
        exportPdfError={settings.exportPdfError}
        settingsTab={settings.settingsTab}
        onSettingsTabChange={settings.setSettingsTab}
      />

      <StallOverlay
        key={ws.stallSignature}
        stalled={ws.stalled}
        open={ws.stallOverlayOpen}
        onResolve={() => {
          layout.openGuruForStall();
          ws.setStallOverlayOpen(false);
        }}
        onDismiss={() => ws.setStallOverlayOpen(false)}
      />

      {layout.showOnboarding && (
        <OnboardingWizard onComplete={() => layout.setOnboardingCompleted(true)} />
      )}

      <AuthGate
        authDevice={auth.authDevice}
        authLoading={auth.authLoading}
        authError={auth.authError}
        authWarning={auth.authWarning}
        authCountdown={auth.authCountdown}
        authSession={auth.authSession}
        isDesktop={true}
        showAuthGate={auth.showAuthGate}
        onStartLogin={auth.startGithubLogin}
        onCompleteLogin={auth.completeGithubLogin}
        onCancel={auth.cancelGithubLogin}
      />

      <Header
        active={ws.active}
        stats={ws.stats}
        usage={ws.usage}
        authSession={auth.authSession}
        isDesktop={true}
        authLoading={auth.authLoading}
        onLogout={auth.logoutGithub}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <UpdateBanner
        updateInfo={settings.updateInfo}
        updateDismissed={settings.updateDismissed}
        updateChecking={settings.updateChecking}
        updateInstalling={settings.updateInstalling}
        updateError={settings.updateError}
        onDismiss={() => settings.setUpdateDismissed(true)}
        onInstall={settings.installUpdate}
      />

      <div className="flex-1 flex overflow-hidden p-3 gap-3 bg-[color:var(--workspace-chrome)]">
        <div className="min-h-0 flex">
          <ControlSidebar
            view={layout.view}
            onViewChange={layout.setView}
            hasAiContextData={ws.hasAiContextData}
            hasReviewData={ws.hasReviewData}
            pendingFixProposalsCount={ws.pendingFixProposalsCount}
            guruUnreadCount={layout.guruUnreadCount}
            totalFiles={ws.context?.total_files || 0}
            totalIssues={ws.stats.total}
            scopeLabel={ws.scopeLabel}
            onSelectScope={ws.selectScope}
            tokens={ws.usage.tokens}
            calls={ws.usage.calls}
            filesAnalyzed={ws.usage.files}
            queueWaitMs={ws.usage.queueWaitMs}
            scanProfileLabel={ws.scanProfileLabel}
            baselineLoading={ws.baselineLoading}
            baselineStatus={ws.baselineStatus}
            baselineValid={ws.baselineValid}
            baselineMetrics={ws.baselineMetrics}
            baselineError={ws.baselineError}
            baselineView={ws.baselineView}
            onSetBaselineNow={ws.setBaselineNow}
            onClearBaselineNow={ws.clearBaselineNow}
            onBaselineViewChange={ws.setBaselineView}
            path={ws.path}
            engineModel={engineModel}
            embeddingModeLabel={embeddingModeLabel}
            onOpenEmbeddingSettings={() => {
              settings.setSettingsTab("embedding");
              setSettingsOpen(true);
            }}
            authBannerVisible={auth.authGateVisible}
            authShowGate={auth.showAuthGate}
            authRequiresVerified={auth.requiresVerified}
            authLoading={auth.authLoading}
            authError={auth.authError}
            authWarning={auth.authWarning}
            onVerifyAuth={auth.refreshAuthSession}
            settingsRequiresApiKey={settings.requiresApiKey}
            providerLabel={settings.providerLabel}
            onOpenSettings={() => setSettingsOpen(true)}
            active={ws.active}
            canToggleMonitoring={canToggleMonitoring}
            onToggleMonitoring={toggleMonitoring}
            launchBlockingReason={launchGate.blockingReason}
          />
        </div>

        <MainWorkspace
          view={layout.view}
          active={ws.active}
          status={ws.status}
          showFloatingFilter={showFloatingFilter}
          filter={ws.filter}
          onFilterChange={ws.setFilter}
          baselineView={ws.baselineView}
          baselineStatus={ws.baselineStatus}
          baselineValid={ws.baselineValid}
          resolvedFindings={ws.resolvedFindings}
          filteredLogs={ws.filteredLogs}
          baselineIds={ws.baselineIds}
          expandedLogKey={ws.expandedLogKey}
          onToggleLog={(key) => ws.setExpandedLogKey((prev) => (prev === key ? null : key))}
          onAskGuruForLog={layout.askGuruForLog}
          path={ws.path}
          onSelectScope={ws.selectScope}
          chatAutoPrompt={layout.pendingGuruPrompt}
          onAutoPromptConsumed={layout.consumeAutoPrompt}
          onGuruReply={layout.handleGuruReply}
          webSearchEnabled={settings.webSearchEnabled}
          webSearchDepth={settings.webSearchDepth}
          onWebSearchToggle={settings.onWebSearchToggle}
          webSearchReady={settings.webSearchReady}
          fixProposals={ws.fixProposals}
          fixProposalsLoading={ws.fixProposalsLoading}
          fixProposalsError={ws.fixProposalsError}
          onRequestReview={handleRequestReview}
          onSetProposalStatus={ws.setProposalStatus}
          fixHistory={ws.fixHistory}
          fixHistoryLoading={ws.fixHistoryLoading}
          fixHistoryError={ws.fixHistoryError}
          onRefreshFixHistory={ws.refreshFixHistory}
          onUndoFix={ws.undoAppliedFix}
          releaseDecision={ws.releaseDecision}
          releaseDecisionLoading={ws.releaseDecisionLoading}
          releaseDecisionError={ws.releaseDecisionError}
          onRefreshReleaseDecision={ws.refreshReleaseDecision}
          onSetReleaseDecision={ws.setReleaseDecisionFromUi}
          onOverrideReleaseDecision={ws.overrideReleaseDecision}
          aiContext={ws.aiContext}
          aiContextLoading={ws.aiContextLoading}
          aiContextError={ws.aiContextError}
          onRefreshAiContext={ws.refreshAiContext}
          onRefreshContext={ws.refreshContext}
          contextLoading={ws.contextLoading}
          contextError={ws.contextError}
          context={ws.context}
          scopeLabel={ws.scopeLabel}
        />
      </div>
    </div>
  );
}

export default App;
