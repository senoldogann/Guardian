import { createContext, useContext, useMemo, type ReactNode } from "react";
import { STORAGE_KEYS } from "../constants";
import { useLocalStorage } from "../hooks/useLocalStorage";

export type AppLocale = "en" | "tr";

const SUPPORTED_LOCALES: readonly AppLocale[] = ["en", "tr"] as const;
const DEFAULT_LOCALE: AppLocale = "en";

type Params = Record<string, string | number | boolean | null | undefined>;

type Messages = Record<string, unknown>;

const MESSAGES: Record<AppLocale, Messages> = {
  en: {
    common: {
      close: "Close",
      save: "Save",
      saving: "Saving...",
      clear: "Clear",
      refresh: "Refresh",
      rescan: "Rescan",
      undo: "Undo",
      apply: "Apply",
      selectWorkspace: "Select Workspace",
      noWorkspaceSelected: "No workspace selected.",
      cancel: "Cancel",
      delete: "Delete",
      loading: "Loading",
      enabled: "Enabled",
      disabled: "Disabled",
      on: "On",
      off: "Off",
      unknown: "Unknown",
      yes: "Yes",
      no: "No",
    },
    language: {
      label: "Language",
      english: "English",
      turkish: "Turkish",
    },
    settings: {
      title: "Setup & Settings",
      subtitle:
        "Configure provider, API key, and updates. Changes apply on next session or monitoring restart.",
      desktopRequired: "Desktop app required to update settings.",
      toggleTheme: "Toggle Theme",
      tabs: {
        general: "General",
        provider: "Provider",
        embedding: "Embedding",
        web: "Web Search",
        updates: "Updates",
        export: "Export",
      },
      general: {
        safety: "Safety",
        autoVerifyTitle: "Automatic Verification",
        autoVerifyNote:
          "When enabled, Guardian can run project commands (npm/cargo, etc.). Keep it on only for trusted repositories.",
        autoVerifyDescription:
          "Automatic Verification can run project commands (npm/cargo/etc) in your monitored workspace. Keep it off unless you fully trust the repo.",
        autoVerifyStatus: "Automatic Verification: {status}",
        scanScopeTitle: "Scan Scope",
        scanScopeNote:
          "Source is fast and focused. Extended adds infra/security surfaces (Docker/CI/locks/scripts). Full scans most text files (higher cost). Changes apply on next monitoring start.",
        scanScopeCurrent:
          "Current scope: {profile}. Restart monitoring to apply changes.",
        scanScopeSource: "Source (Fast, code-focused)",
        scanScopeExtended: "Extended (Infra + security files)",
        scanScopeFull: "Full (Most text files)",
        saveScanScope: "Save Scan Scope",
        languageTitle: "Language",
        languageNote:
          "Controls UI language and AI output language (Guru + Monitor findings).",
        personalizationTitle: "Personalization",
        personalizationNote:
          "Customize theme mode, typography, model behavior hints, and scan tuning with safe limits.",
        personalizationDescription:
          "These settings are local-first and bounded by Guardian safety limits.",
        appearanceTitle: "Appearance (light/dark palettes)",
        appearancePreviewLabel: "Live preview ({mode})",
        appearancePreviewDescription:
          "Preview uses active theme mode. Accent and panel colors stay within guarded theme tokens.",
        lightPaletteTitle: "Light palette",
        darkPaletteTitle: "Dark palette",
        palettePresetsLabel: "Quick palettes",
        paletteCloud: "Cloud",
        paletteStone: "Stone",
        paletteMint: "Mint",
        paletteSand: "Sand",
        paletteMidnight: "Midnight",
        paletteGraphite: "Graphite",
        paletteAurora: "Aurora",
        paletteEmber: "Ember",
        accentColorLabel: "Accent color",
        panelColorLabel: "Panel color",
        textColorLabel: "Text color",
        restoreLightPalette: "Restore Light Palette",
        restoreDarkPalette: "Restore Dark Palette",
        themeModeLabel: "Theme mode",
        themeModeDark: "Dark",
        themeModeLight: "Light",
        themeModeSystem: "System",
        fontFamilyLabel: "Font family",
        fontFamilySpaceGrotesk: "Space Grotesk",
        fontFamilyInter: "Inter",
        fontFamilySystem: "System UI",
        fontFamilySourceSans: "Source Sans 3",
        fontFamilyIbmPlex: "IBM Plex Sans",
        fontSizeScaleLabel: "Font size ({scale}%)",
        modelInstructionLabel: "Model custom instructions",
        modelInstructionPlaceholder:
          "Optional: add project-specific style instructions without bypassing policy.",
        modelInstructionHint:
          "Applied to Guru/analysis requests within Guardian governance limits.",
        modelInstructionPresetExplainFirstLabel: "Preset: Explain First",
        modelInstructionPresetTerseLabel: "Preset: Terse",
        modelInstructionPresetExplainFirst:
          "Explain risk and release impact first, then provide the safest minimal fix.",
        modelInstructionPresetTerse:
          "Keep output concise and action-first, but preserve release risk clarity.",
        maxFilesPerScanLabel: "Max files per scan",
        maxBatchSizeHintLabel: "Batch size hint",
        tokenBudgetHintLabel: "Token budget hint",
        maxFilesPerScanNote:
          "Upper bound for initial scan file count. Higher values increase startup latency and cost.",
        maxBatchSizeHintNote:
          "How many files are grouped in one AI request. Higher values increase context width and timeout risk.",
        tokenBudgetHintNote:
          "Target prompt budget per batch. Runtime policy may cap this to protect stability.",
        scanTuningHint:
          "Higher values may increase latency and cost; lower values may miss cross-file signals.",
        scanTuningPolicyCaps: "Scope caps: files <= {filesCap}, batch <= {batchCap}.",
        scanTuningPolicyOverride:
          "Policy applied: effective files {files} / requested {requestedFiles}, effective batch {batch} / requested {requestedBatch}. Token budget may still be capped by runtime policy.",
        scanTuningPolicyNoOverride:
          "No scope cap is currently applied for these values. Runtime token policy can still apply.",
        refreshPreferences: "Reload Preferences",
        savingPreferences: "Saving...",
        resetPreferences: "Reset to Defaults",
        guruReplySoundTitle: "Guru Reply Sound",
        guruReplySoundNote:
          "Plays a subtle chime when Guru responds while you are outside the Guru screen.",
        guruReplySoundDescription:
          "Useful when you switch to another view and wait for Guru to finish.",
        guruReplySoundStatus: "Guru reply sound: {status}",
      },
      provider: {
        title: "AI Provider",
        popoverTitle: "Provider Setup",
        popoverNote:
          "Save provider and model first, then add the API key if required. Use Ollama for local runs and OpenAI/Anthropic/Gemini for cloud.",
        currentProvider: "Current provider: {provider}.",
        providerLabel: "Provider",
        baseUrlLabel: "Base URL",
        modelLabel: "Model",
        modelPlaceholder: "Enter model ID manually",
        modelsLoading: "Loading...",
        refreshModels: "Refresh",
        saveProvider: "Save Provider",
        testConnection: "Test Connection",
        testing: "Testing...",
        requiresKeyLoadModels: "Enter your {provider} API key to load models.",
        apiKeyTitle: "API Key",
        apiKeyPopoverTitle: "API Key",
        apiKeyPopoverNote:
          "API key requirement depends on your selected provider. Paste the key and click Save Key; it is stored only in local keychain.",
        keyStored: "Key stored for {provider} ({source}).",
        noKeyStored: "No API key stored for {provider}. Environment keys are ignored.",
        setupRequired: "Setup required: add your {provider} API key to list models and start monitoring.",
        apiKeyPlaceholder: "Enter your API key",
        saveKey: "Save Key",
      },
      embedding: {
        title: "Semantic Embeddings",
        popoverTitle: "Embedding Mode",
        popoverNote:
          "In auto mode, Guardian tries OpenAI only when an OpenAI key exists; otherwise it goes directly to Ollama, then local hash fallback.",
        note:
          "Embedding settings are optional. With no OpenAI key, auto mode skips OpenAI and uses Ollama/local fallback.",
        refresh: "Refresh",
        modeLabel: "Embedding Mode",
        modeAuto: "Auto (recommended)",
        modeOpenAi: "OpenAI Embeddings",
        modeOllama: "Ollama Local Embeddings",
        modeLocal: "Local Hash (Offline fallback)",
        openAiBaseUrl: "OpenAI Base URL",
        openAiModel: "OpenAI Model",
        ollamaBaseUrl: "Ollama Base URL",
        ollamaModel: "Ollama Model",
        saveEmbeddingSettings: "Save Embedding Settings",
        openAiKeyTitle: "OpenAI Embedding Key (Optional)",
        openAiKeyPopoverTitle: "Optional Key",
        openAiKeyPopoverNote:
          "This key is used only when embedding calls go to OpenAI. Ollama and Local modes work without this key.",
        openAiKeyNote: "Used only when embedding mode can call OpenAI. Not required for Ollama/local modes.",
        openAiKeyStored: "OpenAI key stored ({source}).",
        openAiKeyMissing: "No OpenAI embedding key stored.",
        openAiKeyPlaceholder: "Enter your OpenAI API key (optional)",
        saveOpenAiKey: "Save Key",
        clearOpenAiKey: "Clear",
        localSetupNote: "Local setup: install Ollama and run {command}.",
      },
      web: {
        title: "Web Search (Tavily)",
        popoverTitle: "Web Search",
        popoverNote:
          "Optional internet context via Tavily. Basic depth is recommended for cost control. If your prompt includes a URL, Guru will extract that page directly for higher accuracy.",
        note:
          "Allow Guru to use Tavily web results when needed. Web search is optional and only used when your prompt suggests external context.",
        status: "Web Search: {status}",
        searchDepth: "Search depth",
        tavilyKeyHint: "Add your Tavily API key to enable web search.",
        tavilyKeyTitle: "Tavily API Key",
        tavilyKeyPlaceholder: "Enter your Tavily API key",
        saveKey: "Save Key",
        keyStored:
          "Tavily key stored ({source}). If macOS prompts every session, choose \"Always Allow\" for Keychain access.",
        keyMissing: "No Tavily key stored. Add your own to enable web search.",
        keyRequired: "Tavily key is required to save.",
        depthAria: "Web Search Depth",
      },
      updates: {
        title: "Updates",
        note: "Updates are delivered from GitHub Releases and installed in-app.",
        current: "Current",
        latest: "Latest",
        lastCheck: "Last check",
        notCheckedYet: "Not checked yet",
        unavailable: "Unavailable",
        viewChangelog: "View changelog on website",
        checkNow: "Check Now",
        checking: "Checking...",
        installUpdate: "Install Update",
        updating: "Updating...",
        status: {
          idle: "Idle",
          checking: "Checking",
          upToDate: "Up to date",
          available: "Update available",
          error: "Error",
        },
        aboutTitle: "About",
        builtBy: "Built by {name}.",
        website: "Website",
        feedback: "Feedback / Suggestions / Bug Reports",
      },
      export: {
        title: "Export",
        note:
          "Export creates a PDF snapshot of the current workspace status, issues, and monitoring summary for sharing or archiving.",
        exportPdf: "Export PDF",
        exporting: "Exporting...",
        preparing: "Preparing report blocks...",
        rendering: "Rendering PDF pages...",
        finalizing: "Finalizing and saving file...",
        openingFolder: "Opening export location...",
      },
      errors: {
        apiKeyStatusLoadFailed: "API key status could not be loaded.",
        tavilyKeyStatusLoadFailed: "Tavily key status could not be loaded.",
        embeddingOpenAiKeyStatusLoadFailed:
          "OpenAI embedding key status could not be loaded.",
        openAiEmbeddingUrlInvalid:
          "OpenAI embedding base URL must be a valid http/https URL.",
        ollamaEmbeddingUrlInvalid:
          "Ollama embedding base URL must be a valid http/https URL.",
        embeddingOpenAiKeyEmpty: "Embedding OpenAI key cannot be empty.",
        providerBaseUrlModelRequired: "Provider base URL and model are required.",
        providerBaseUrlInvalid: "Provider base URL must be a valid http/https URL.",
        providerConfigLoading:
          "Provider configuration is still loading. Try again in a moment.",
        apiKeyEmpty: "API key cannot be empty.",
        tavilyKeyEmpty: "Tavily key cannot be empty.",
        autoVerifyConfirm:
          "Automatic Verification runs project commands (npm/cargo/etc) inside your monitored workspace. Enable only for trusted repos.",
        preferencesLoadFailed: "Preferences could not be loaded: {error}",
        preferencesSaveFailed: "Preferences could not be saved: {error}",
        preferencesResetFailed: "Preferences could not be reset: {error}",
        updateUnavailable: "Update service unavailable.",
        updateUnavailableHint: "Update service unavailable. Check network and try again.",
      },
    },
    toast: {
      providerSaved: "Provider settings saved.",
      connectionOk: "Connection OK.",
      folderOpened: "Folder opened automatically.",
      exportSaved: "Saved to {path}. {opened}",
      saved: "Saved.",
      copied: "Copied.",
      copyFailed: "Copy failed.",
      refreshed: "Refreshed.",
      refreshFailed: "Refresh failed.",
    },
    app: {
      notSet: "Not set",
      selectWorkspaceFirst: "Select a workspace scope first.",
      guruReplyReady: "Guru reply is ready.",
      proposalMissingContent: "Proposal is missing proposed content.",
      reviewRequested: "Review requested. Check Guru for the approval result.",
      requestReviewFailed: "Failed to request review: {error}",
      proposalMarked: "Proposal marked: {status}",
      updateProposalFailed: "Failed to update proposal: {error}",
      undoComplete: "Undo complete.",
      undoFailed: "Failed to undo fix: {error}",
      releaseDecisionUpdated: "Release decision updated.",
      releaseDecisionUpdateFailed: "Failed to set release decision: {error}",
      releaseBlockOverridden: "Release block overridden with reason.",
      releaseOverrideFailed: "Failed to override release block: {error}",
      updateAvailable: "Update available",
      updateReady: "v{version} is ready",
      updateNow: "Update now",
      updating: "Updating...",
      later: "Later",
      checkingUpdates: "Checking for updates...",
    },
    systemUi: {
      aiResponseInvalidFormat:
        "AI response format was invalid for this batch. Guardian skipped unsafe output and continued safely.",
      batchPromptHeavy:
        "Batch request was too large for current AI context limits. Guardian switched to a safer fallback mode.",
      providerTimeout:
        "AI provider timed out during batch audit. Guardian will continue with retry/fallback logic.",
      backendUnavailable:
        "Backend connection is temporarily unavailable. Monitoring remains in safe mode.",
      internalWarning:
        "A non-critical system warning occurred. Guardian continued in safe mode.",
      internalError:
        "A system error occurred. Guardian protected the workflow and continued safely.",
    },
    header: {
      settingsTitle: "Setup & Settings",
      stats: {
        critical: "Critical",
        warning: "Warning",
        aiRequests: "AI Requests",
      },
      session: "Session",
      monitoringOn: "Monitoring active",
      monitoringOff: "Monitoring paused",
      logout: "Logout",
    },
    authGate: {
      deviceLoginTitle: "GitHub Login",
      deviceLoginNote: "Open the verification page and enter this code:",
      openGithub: "Open GitHub",
      codeExpires:
        "Code expires in {time}. Guardian checks automatically and closes this screen when authorization is complete.",
      checking: "Checking...",
      checkNow: "Check Now",
      cancel: "Cancel",
      signInTitle: "GitHub Sign In",
      signInNote:
        "Sign in with GitHub to unlock monitoring, model access, and release approval workflows.",
      signInButton: "Sign In With GitHub",
      desktopRequired: "Desktop app required to authenticate.",
    },
    onboarding: {
      skip: "Skip Tour",
      continue: "Continue",
      getStarted: "Get Started",
      slides: {
        welcome: {
          title: "Welcome to Guardian",
          description:
            "Guardian is a local-first governance layer for small engineering teams. It reviews AI-generated and risky code changes before release against your team policies.",
          highlight: "Protect your code. Elevate your standards.",
        },
        neural: {
          title: "Neural Governance",
          description:
            "Choose your AI engine. Use cloud providers like OpenAI, Anthropic, or Gemini for maximum power or run completely locally with Ollama for full privacy.",
          highlight: "Your data, your choice.",
        },
        realtime: {
          title: "Real-time Monitoring",
          description:
            "Guardian watches your files as you code. Each save can trigger policy checks, and critical findings can block release until a human approves.",
          highlight: "No issue goes unnoticed.",
        },
        ready: {
          title: "Ready to Begin",
          description:
            "Sign in with GitHub to unlock Guardian's full potential. Your free tier includes generous usage, no credit card required.",
          highlight: "Let's secure your codebase.",
        },
      },
    },
    stall: {
      title: "Critical Stall",
      notePrefix: "Critical violation detected in",
      noteSuffix:
        "Real-time monitoring is paused for safety. Resolve the issue in Guru to continue.",
      resolve: "Resolve In Guru",
      dismiss: "Dismiss",
    },
    errorBoundary: {
      title: "Something went wrong",
      fallback: "An unexpected error occurred",
      tryAgain: "Try Again",
    },
    monitor: {
      statusIdle: "Idle",
      statusPaused: "Paused",
      statusActive: "Monitoring Active",
      tableIndex: "#",
      tableFilePath: "File Path",
      tableMessage: "Core Violation Message",
      tableActions: "Actions / Sev",
      searchPlaceholder: "Search issues (file, message, severity)...",
      gateSelectScope: "Select a workspace scope first.",
      gateProviderLoading: "Provider configuration is still loading.",
      gateAddApiKey: "Add your {provider} API key in Settings.",
      gateVerifyGithub: "Verify your GitHub session online before monitoring.",
      gateSignInGithub: "Sign in with GitHub to launch monitoring.",
      gateDevicePending: "Complete the GitHub device authorization screen.",
      gateVerifying: "GitHub verification is in progress.",
      stopFailed: "Failed to stop monitoring: {error}",
      authRequired:
        "GitHub login is required. Complete GitHub authentication before starting monitoring.",
      providerNotReady: "Provider config not ready. Try again in a moment.",
      missingApiKey:
        "Missing API key for {provider}. Open Settings and add your key before starting.",
      startFailed: "Failed to start: {error}",
      guardianOnline: "Guardian Online",
      systemSecure: "System Secure",
      offline: "Guardian is offline.",
      resolvedBadge: "RESOLVED",
      resolved: {
        noBaselineTitle: "No Baseline",
        noBaselineNote: "Click \"Set Baseline\" to enable resolved tracking.",
        invalidTitle: "Baseline Invalid",
        invalidNote: "Rules changed since baseline. Reset baseline to continue.",
        emptyTitle: "No Resolved Findings",
        emptyNote: "Nothing has been resolved since the current baseline.",
        defaultMessage: "Resolved since baseline",
      },
    },
    reviews: {
      appliedFixesTitle: "Applied Fixes (Undo Available)",
      appliedFixesNote: "Undo is stored per file (last applied fix only).",
      fixHistoryLoading: "Loading...",
      noAppliedFixes: "No applied fixes yet. Apply a fix from Monitor or Guru to see Undo here.",
      appliedLabel: "Applied",
      undoTitle: "Undo last applied fix for this file",
      selectWorkspaceHint:
        "Select a workspace, then write proposals to .guardian-proposals/fix_proposals.jsonl.",
      proposalsHint:
        "Fix Proposals are optional. Applied Fixes appear here after you apply a fix (Undo available).",
    },
    releaseDecision: {
      title: "Release Decision",
      metrics: "Critical: {critical} • Warning: {warning} • AI-heavy: {aiHeavy}",
      auditPath: "Audit trail file",
      approver: "Approver",
      reason: "Reason",
      approverPlaceholder: "release-manager",
      reasonPlaceholder: "Approved after architectural review",
      saveDecision: "Save Decision",
      overrideTitle: "Block Override",
      overridePlaceholder: "Override reason (required)",
      overrideButton: "Override Block",
      labels: {
        PASS: "Pass",
        PASS_WITH_WARNING: "Pass With Warning",
        BLOCK_UNTIL_APPROVED: "Block Until Approved",
        OVERRIDDEN: "Overridden",
      },
    },
    fixProposals: {
      emptyTitle: "Reviews is your Fix Proposal inbox",
      emptyNote:
        "Guardian can apply fixes instantly from Monitor and Guru. Fix Proposals are optional: use them when you want a review queue or CI-driven workflows.",
      emptyAdvanced:
        "Advanced workflow: append JSONL proposals to .guardian-proposals/fix_proposals.jsonl.",
      title: "Fix Proposals",
      source: "Source",
      updated: "Updated",
      pending: "Pending",
      done: "Done",
      total: "Total",
      searchPlaceholder: "Search proposals...",
      filterPending: "Pending",
      filterReviewRequested: "Review Requested",
      filterDone: "Done",
      filterAll: "All",
      noMatch: "No proposals match the current filter.",
      selectTitle: "Select a proposal.",
      selectNote: "Use search and status filters to locate the proposal you want to inspect.",
      unknownFile: "<unknown file>",
      copyProposedContent: "Copy Proposed Content",
      copyProposalJson: "Copy Proposal JSON",
      copyProposedContentTitle: "Copy proposed content",
      copyProposalJsonTitle: "Copy proposal as JSON",
      missingProposedContent:
        "Proposal is missing proposed_content. Nothing can be reviewed or applied.",
      requestReview: "Request Review",
      requestReviewTitle:
        "Send this proposal to Guardian review (AI). You will still need to confirm apply.",
      reject: "Reject",
      rejectTitle: "Mark as rejected (append status to JSONL)",
      markApplied: "Mark Applied",
      markAppliedTitle: "Mark as applied (append status to JSONL)",
    },
    aiContext: {
      titleEmpty: "No workspace selected.",
      noteEmpty: "Select a workspace, start monitoring, and modify a file to capture the outbound AI payload.",
      noCapturedTitle: "No Captured Context",
      noCapturedNote: "Start monitoring and modify a file to capture the outbound AI payload.",
      title: "AI Outbound Context",
      provider: "Provider",
      model: "Model",
      timestamp: "Timestamp",
      files: "Files",
      tokensEst: "Tokens (est)",
      refreshTitle: "Refresh from backend",
      redactionTitle: "Sensitive content was redacted.",
      redactionContext: "Context: {redacted} redacted, {truncated} truncated.",
      redactionNote:
        "Preview reflects what was actually sent to the provider. Use filters to quickly inspect affected files.",
      searchFilesPlaceholder: "Search files...",
      filterAll: "All",
      filterRedacted: "Redacted",
      filterTruncated: "Truncated",
      noFilesMatch: "No files match the current filter.",
      selectFileTitle: "Select a file to preview.",
      selectFileNote: "Use search and filters to locate the file you want to inspect.",
      copyFileContext: "Copy File Context",
      copyFullPayload: "Copy Full Payload",
      copyFileContextTitle: "Copy selected file context",
      copyFullPayloadTitle: "Copy full payload as JSON",
      badgeRedacted: "REDACTED",
      badgeTruncated: "TRUNCATED",
    },
    diagram: {
      title: "Project Map",
      emptyTitle: "Project map is empty.",
      emptyNote: "Select a workspace to build the map, then rescan to verify the correct directory.",
      projectRoot: "Project Root",
      scanning: "Scanning...",
    },
    critique: {
      system: "System",
      askGuru: "Ask Guru to resolve",
      quickFixTitle: "Quick Fix: Apply this patch immediately",
      fix: "FIX",
      undo: "UNDO",
      applyThisFix: "APPLY THIS FIX",
      autopilotProposedFix: "Autopilot: Proposed Fix",
      severityInfo: "INFO",
      severityWarning: "WARNING",
      severityCritical: "CRITICAL",
      filePath: "File Path",
      violationDetails: "System Violation Details",
      verdictSuggestion: "Architect's Verdict & Suggestion",
      cannotApplyMissingWorkspace: "Cannot apply fix: workspace path is missing.",
      cannotUndoMissingWorkspace: "Cannot undo: workspace path is missing.",
      appliedFixToast: "Applied fix to {file}.",
      undoCompleteToast: "Undo complete for {file}.",
      applyFailedToast: "Failed to apply fix: {error}",
      undoFailedToast: "Undo failed: {error}",
      findingNewSinceBaseline: "New since baseline",
      findingPresentInBaseline: "Present in baseline",
      badgeNew: "NEW",
      badgeActive: "ACTIVE",
      badgeResolved: "RESOLVED",
    },
    chat: {
      title: "Guru Architect",
      openGuide: "Open Guide",
      clearHistory: "Clear History",
      clearConfirmTitle: "Are you sure?",
      clearConfirmDescription: "This will permanently delete the current chat history for this workspace.",
      emptyTitle: "Guru Architect Engine",
      emptyDescription: "I am the Guardian Guru. Accessing project context via RAG-Lite.\nAsk me anything about your codebase.",
      inputPlaceholder: "Ask the Guru about logical flows, architecture, or resolving STALLs...",
      send: "Send",
      cancel: "Cancel",
      actionsTitle: "Add actions",
      webSearch: "Web Search",
      webSearchSetupHint: "Add your Tavily key in Settings to enable web search.",
      systemSelectWorkspace: "Select a workspace path to ask the Guru.",
      errorWebSearchOptional:
        "Guru Error: {error}. Web search is optional; try again or disable web search in Settings.",
      errorLocalServer: "Guru Error: {error}. Ensure local AI server is running.",
      errorGeneric: "Guru Error: {error}.",
      decisionReceived: "Decision received for {file}: **{decision}**",
      guide: {
        title: "Guardian Guru",
        subtitle: "Hybrid Autonomous Engineering Protocol",
        options: {
          sentryTitle: "Guardian Sentry",
          sentryDesc: "Monitors your code in real-time. Instantly locks the system on critical violations.",
          architectTitle: "Guru Architect",
          architectDesc: "Architectural intelligence. Autonomously cleans technical debt found by Guardian.",
          hardLockTitle: "Hard Lock",
          hardLockDesc: "Development is blocked until critical issues are resolved, enforcing a safe cycle.",
          planDrivenTitle: "Plan-Driven",
          planDrivenDesc: "Ingests PLAN-*.md files to ensure code aligns with your original design intent.",
        },
        stepsTitle: "Operational Steps",
        step1: "Guardian locks the system when a critical violation is detected in the workspace.",
        step2: "Request analysis and a patch (fix) from the Guru Architect to resolve the issue.",
        step3: "On your confirmation, Antigravity applies the fix while respecting project architecture.",
        start: "START PROTOCOL",
      },
      thinking: {
        analyzing: "Analyzing project context",
        crossChecking: "Cross-checking architecture patterns",
        comparing: "Comparing with active monitor findings",
        building: "Building an actionable answer",
      },
      copy: "Copy",
      copied: "Copied",
      copyCode: "Copy code",
      verifiedSafe: "Verified Safe",
      guardianAutoCorrected: "Guardian Auto-Corrected",
      successfullyApplied: "Successfully Applied",
      fix: {
        cannotApplyMissingWorkspace: "Cannot apply fix: workspace path is missing.",
        appliedFixToast: "Applied fix to {file}.",
        undoCompleteToast: "Undo complete for {file}.",
        undoFailedToast: "Undo failed: {error}",
        appliedFixConfirmation: "Applied fix to {file} successfully.",
        applyFailedToast: "Failed to apply fix: {error}",
        rejectedFixToast: "Rejected proposed fix for {file}.",
        rejected: "Rejected",
        confirmAndApply: "Confirm & Apply",
        reject: "Reject",
      },
    },
    sidebar: {
      controlHub: "Control Hub",
      expand: "Expand sidebar",
      collapse: "Collapse sidebar",
      nav: {
        monitor: "Monitor",
        guru: "Guru",
        projectMap: "Project Map",
        aiContext: "AI Context",
        reviews: "Reviews",
      },
      selectWorkspace: "Select workspace",
      showDetails: "Show details",
      hideDetails: "Hide details",
      details: "Details",
      ready: "READY",
      empty: "EMPTY",
      log: "LOG",
      files: "Files",
      issues: "Issues",
      scope: "Scope",
      setupRequired: "Setup required: add your {provider} API key.",
      openSettings: "Open Settings",
      verifyNow: "Verify Now",
      authLoginRequired: "GitHub login is required before starting monitoring.",
      authVerifyRequired: "Cached session detected. Verify online to refresh GitHub access.",
      launchGuardian: "Launch Guardian",
      killGuardian: "Kill Guardian",
      launchBlocked: "Launch blocked: {reason}",
      baseline: {
        title: "Baseline",
        statusLoading: "LOADING",
        statusValid: "VALID",
        statusInvalid: "INVALID",
        statusNone: "NONE",
        labelLoading: "Baseline: loading",
        labelNone: "Baseline: none",
        labelValid: "Baseline: valid",
        labelInvalid: "Baseline: invalid",
        age: "Age",
        loaded: "Baseline loaded",
        noneSet: "No baseline set for this workspace.",
        invalidNote: "Baseline invalid (rules changed). Reset baseline to re-enable filtering.",
        setNow: "Set Baseline",
        reset: "Reset",
        viewAll: "All",
        viewNew: "New",
        viewResolved: "Resolved",
        metricsActive: "active",
        metricsNew: "new",
        metricsResolved: "resolved",
      },
      cost: {
        title: "Cost Metric",
        est: "est",
        units: "units",
        tokens: "Tokens",
        apiCalls: "API calls",
        files: "Files",
        queueWait: "Queue wait",
        scope: "Scope",
      },
      engine: {
        title: "Engine Status",
        model: "Model",
        embedding: "Embedding",
        setup: "Setup",
      },
    },
  },
  tr: {
    common: {
      close: "Kapat",
      save: "Kaydet",
      saving: "Kaydediliyor...",
      clear: "Temizle",
      refresh: "Yenile",
      rescan: "Yeniden Tara",
      undo: "Geri Al",
      apply: "Uygula",
      selectWorkspace: "Çalışma Alanı Seç",
      noWorkspaceSelected: "Çalışma alanı seçilmedi.",
      cancel: "İptal",
      delete: "Sil",
      loading: "Yükleniyor",
      enabled: "Açık",
      disabled: "Kapalı",
      on: "Aç",
      off: "Kapat",
      unknown: "Bilinmiyor",
      yes: "Evet",
      no: "Hayır",
    },
    language: {
      label: "Dil",
      english: "English",
      turkish: "Türkçe",
    },
    settings: {
      title: "Kurulum ve Ayarlar",
      subtitle:
        "Sağlayıcı, API anahtarı ve güncellemeleri yapılandırın. Değişiklikler bir sonraki oturumda veya izleme yeniden başlatıldığında uygulanır.",
      desktopRequired: "Ayarları değiştirmek için desktop uygulama gerekir.",
      toggleTheme: "Tema Değiştir",
      tabs: {
        general: "Genel",
        provider: "Sağlayıcı",
        embedding: "Gömme",
        web: "Web Arama",
        updates: "Güncellemeler",
        export: "Dışa Aktar",
      },
      general: {
        safety: "Güvenlik",
        autoVerifyTitle: "Otomatik Doğrulama",
        autoVerifyNote:
          "Açıkken Guardian, izlenen workspace içinde proje komutlarını (npm/cargo vb.) çalıştırabilir. Sadece güvendiğiniz repo'larda açık tutun.",
        autoVerifyDescription:
          "Otomatik Doğrulama, izlenen workspace içinde proje komutlarını (npm/cargo vb.) çalıştırabilir. Repo'ya tam güvenmiyorsanız kapalı tutun.",
        autoVerifyStatus: "Otomatik Doğrulama: {status}",
        scanScopeTitle: "Tarama Kapsamı",
        scanScopeNote:
          "Source hızlı ve odaklıdır. Extended infra/security yüzeylerini (Docker/CI/locks/scripts) ekler. Full çoğu text dosyasını tarar (daha yüksek maliyet). Değişiklikler monitoring bir sonraki başlangıcında uygulanır.",
        scanScopeCurrent:
          "Mevcut kapsam: {profile}. Uygulamak için monitoring'i yeniden başlatın.",
        scanScopeSource: "Source (Hızlı, kod odaklı)",
        scanScopeExtended: "Extended (Infra + security dosyaları)",
        scanScopeFull: "Full (Çoğu text dosyası)",
        saveScanScope: "Tarama Kapsamını Kaydet",
        languageTitle: "Dil",
        languageNote:
          "Arayüz dilini ve AI çıktılarının dilini belirler (Guru + Monitor bulguları).",
        personalizationTitle: "Kişiselleştirme",
        personalizationNote:
          "Tema modu, tipografi, model davranış notları ve tarama ayarlarını güvenli sınırlar içinde özelleştirin.",
        personalizationDescription:
          "Bu ayarlar local-first çalışır ve Guardian güvenlik sınırlarıyla korunur.",
        appearanceTitle: "Görünüm (açık/koyu paletler)",
        appearancePreviewLabel: "Canlı önizleme ({mode})",
        appearancePreviewDescription:
          "Önizleme aktif tema modunu kullanır. Vurgu ve panel renkleri güvenli tema token sınırlarında kalır.",
        lightPaletteTitle: "Açık palet",
        darkPaletteTitle: "Koyu palet",
        palettePresetsLabel: "Hızlı paletler",
        paletteCloud: "Bulut",
        paletteStone: "Taş",
        paletteMint: "Nane",
        paletteSand: "Kum",
        paletteMidnight: "Gece",
        paletteGraphite: "Grafit",
        paletteAurora: "Kutup",
        paletteEmber: "Köz",
        accentColorLabel: "Vurgu rengi",
        panelColorLabel: "Panel rengi",
        textColorLabel: "Metin rengi",
        restoreLightPalette: "Açık Paleti Sıfırla",
        restoreDarkPalette: "Koyu Paleti Sıfırla",
        themeModeLabel: "Tema modu",
        themeModeDark: "Koyu",
        themeModeLight: "Açık",
        themeModeSystem: "Sistem",
        fontFamilyLabel: "Yazı tipi ailesi",
        fontFamilySpaceGrotesk: "Space Grotesk",
        fontFamilyInter: "Inter",
        fontFamilySystem: "System UI",
        fontFamilySourceSans: "Source Sans 3",
        fontFamilyIbmPlex: "IBM Plex Sans",
        fontSizeScaleLabel: "Yazı boyutu ({scale}%)",
        modelInstructionLabel: "Model özel talimatları",
        modelInstructionPlaceholder:
          "Opsiyonel: politikayı aşmadan proje bağlamına uygun stil talimatı ekleyin.",
        modelInstructionHint:
          "Guardian yönetişim sınırları içinde Guru/analiz isteklerine uygulanır.",
        modelInstructionPresetExplainFirstLabel: "Preset: Önce Açıkla",
        modelInstructionPresetTerseLabel: "Preset: Kısa",
        modelInstructionPresetExplainFirst:
          "Önce riski ve release etkisini açıkla, sonra en güvenli minimal düzeltmeyi ver.",
        modelInstructionPresetTerse:
          "Çıktıyı kısa ve aksiyon odaklı tut, ancak release risk netliğini koru.",
        maxFilesPerScanLabel: "Tarama başına maksimum dosya",
        maxBatchSizeHintLabel: "Batch boyutu ipucu",
        tokenBudgetHintLabel: "Token bütçesi ipucu",
        maxFilesPerScanNote:
          "İlk taramadaki dosya üst sınırı. Yüksek değerler başlangıç gecikmesini ve maliyeti artırır.",
        maxBatchSizeHintNote:
          "Tek AI isteğinde gruplanan dosya sayısı. Yüksek değerler bağlamı büyütür ve timeout riskini artırır.",
        tokenBudgetHintNote:
          "Batch başına hedef prompt bütçesi. Stabilite için çalışma zamanı politikası bu değeri sınırlandırabilir.",
        scanTuningHint:
          "Yüksek değerler gecikme ve maliyeti artırabilir; düşük değerler dosyalar arası sinyalleri kaçırabilir.",
        scanTuningPolicyCaps: "Kapsam sınırları: dosya <= {filesCap}, batch <= {batchCap}.",
        scanTuningPolicyOverride:
          "Politika uygulandı: etkili dosya {files} / istenen {requestedFiles}, etkili batch {batch} / istenen {requestedBatch}. Token bütçesi ayrıca çalışma zamanı politikasıyla sınırlandırılabilir.",
        scanTuningPolicyNoOverride:
          "Bu değerler için şu an kapsam kaynaklı bir sınır uygulanmıyor. Çalışma zamanı token politikası yine de geçerli olabilir.",
        refreshPreferences: "Tercihleri Yenile",
        savingPreferences: "Kaydediliyor...",
        resetPreferences: "Varsayılanlara Dön",
        guruReplySoundTitle: "Guru Yanıt Sesi",
        guruReplySoundNote:
          "Guru ekranı dışında olduğunuzda yanıt gelirse hafif bir zil sesi çalar.",
        guruReplySoundDescription:
          "Guru yanıtını beklerken başka bir görünüme geçtiğinizde faydalıdır.",
        guruReplySoundStatus: "Guru yanıt sesi: {status}",
      },
      provider: {
        title: "Yapay Zeka Sağlayıcı",
        popoverTitle: "Sağlayıcı Kurulumu",
        popoverNote:
          "Önce sağlayıcı ve modeli kaydedin, gerekiyorsa API anahtarını ekleyin. Yerel kullanım için Ollama, bulut için OpenAI/Anthropic/Gemini kullanın.",
        currentProvider: "Mevcut sağlayıcı: {provider}.",
        providerLabel: "Sağlayıcı",
        baseUrlLabel: "Base URL",
        modelLabel: "Model",
        modelPlaceholder: "Model ID'yi manuel girin",
        modelsLoading: "Yükleniyor...",
        refreshModels: "Yenile",
        saveProvider: "Sağlayıcıyı Kaydet",
        testConnection: "Bağlantıyı Test Et",
        testing: "Test ediliyor...",
        requiresKeyLoadModels: "Model listesini yüklemek için {provider} API key ekleyin.",
        apiKeyTitle: "API Key",
        apiKeyPopoverTitle: "API Key",
        apiKeyPopoverNote:
          "API key gereksinimi seçili provider'a bağlıdır. Key'i yapıştırıp Kaydet'e basın; sadece local keychain'de saklanır.",
        keyStored: "{provider} için key kayıtlı ({source}).",
        noKeyStored: "{provider} için API key yok. Ortam değişkenleri (env) yok sayılır.",
        setupRequired: "Kurulum gerekli: {provider} API anahtarı ekleyin (model listeleme ve izleme için).",
        apiKeyPlaceholder: "API key'inizi girin",
        saveKey: "Key'i Kaydet",
      },
      embedding: {
        title: "Semantic Embeddings",
        popoverTitle: "Embedding Mode",
        popoverNote:
          "Auto modda Guardian, sadece OpenAI key varsa OpenAI dener; yoksa doğrudan Ollama, sonra local hash fallback kullanır.",
        note:
          "Embedding ayarları opsiyoneldir. OpenAI key yoksa auto mod OpenAI'yi atlar ve Ollama/local fallback kullanır.",
        refresh: "Yenile",
        modeLabel: "Embedding Modu",
        modeAuto: "Auto (önerilen)",
        modeOpenAi: "OpenAI Embedding",
        modeOllama: "Ollama Local Embedding",
        modeLocal: "Local Hash (offline fallback)",
        openAiBaseUrl: "OpenAI Base URL",
        openAiModel: "OpenAI Model",
        ollamaBaseUrl: "Ollama Base URL",
        ollamaModel: "Ollama Model",
        saveEmbeddingSettings: "Embedding Ayarlarını Kaydet",
        openAiKeyTitle: "OpenAI Embedding Key (Opsiyonel)",
        openAiKeyPopoverTitle: "Opsiyonel Key",
        openAiKeyPopoverNote:
          "Bu key sadece embedding çağrıları OpenAI'ye gittiğinde kullanılır. Ollama ve Local modlar bu key olmadan çalışır.",
        openAiKeyNote: "Sadece embedding modu OpenAI çağırabildiğinde kullanılır. Ollama/local modlar için gerekmez.",
        openAiKeyStored: "OpenAI key kayıtlı ({source}).",
        openAiKeyMissing: "OpenAI embedding key kayıtlı değil.",
        openAiKeyPlaceholder: "OpenAI API key (opsiyonel)",
        saveOpenAiKey: "Key'i Kaydet",
        clearOpenAiKey: "Temizle",
        localSetupNote: "Local kurulum: Ollama'yı kurun ve {command} çalıştırın.",
      },
      web: {
        title: "Web Search (Tavily)",
        popoverTitle: "Web Search",
        popoverNote:
          "Tavily ile opsiyonel internet bağlamı. Maliyet için Basic önerilir. Prompt bir URL içeriyorsa, Guru daha yüksek doğruluk için o sayfayı Extract ile çeker.",
        note:
          "Gerektiğinde Guru'nun Tavily web sonuçlarını kullanmasına izin verin. Web search opsiyoneldir ve sadece dış bağlam gerektiğinde kullanılır.",
        status: "Web Search: {status}",
        searchDepth: "Arama derinliği",
        tavilyKeyHint: "Web search için Tavily API key ekleyin.",
        tavilyKeyTitle: "Tavily API Key",
        tavilyKeyPlaceholder: "Tavily API key",
        saveKey: "Key'i Kaydet",
        keyStored:
          "Tavily key kayıtlı ({source}). macOS her oturumda sorarsa Keychain için \"Always Allow\" seçin.",
        keyMissing: "Tavily key yok. Web search için kendi key'inizi ekleyin.",
        keyRequired: "Kaydetmek için Tavily key gerekli.",
        depthAria: "Web Search Depth",
      },
      updates: {
        title: "Güncellemeler",
        note: "Güncellemeler GitHub Releases üzerinden gelir ve uygulama içinden kurulur.",
        current: "Mevcut",
        latest: "En Son",
        lastCheck: "Son kontrol",
        notCheckedYet: "Henüz kontrol edilmedi",
        unavailable: "Kullanılamıyor",
        viewChangelog: "Changelog'u web sitesinde görüntüle",
        checkNow: "Şimdi Kontrol Et",
        checking: "Kontrol ediliyor...",
        installUpdate: "Güncellemeyi Kur",
        updating: "Güncelleniyor...",
        status: {
          idle: "Boşta",
          checking: "Kontrol ediliyor",
          upToDate: "Güncel",
          available: "Güncelleme var",
          error: "Hata",
        },
        aboutTitle: "Hakkında",
        builtBy: "{name} tarafından geliştirildi.",
        website: "Web sitesi",
        feedback: "Geri Bildirim / Öneri / Hata Bildirimi",
      },
      export: {
        title: "Dışa Aktar",
        note:
          "Export, mevcut workspace durumu, bulgular ve monitoring özetinin PDF snapshot'unu paylaşım veya arşiv için üretir.",
        exportPdf: "PDF Dışa Aktar",
        exporting: "Dışa aktarılıyor...",
        preparing: "Rapor blokları hazırlanıyor...",
        rendering: "PDF sayfaları işleniyor...",
        finalizing: "Dosya kaydediliyor...",
        openingFolder: "Klasör açılıyor...",
      },
      errors: {
        apiKeyStatusLoadFailed: "API key durumu yüklenemedi.",
        tavilyKeyStatusLoadFailed: "Tavily key durumu yüklenemedi.",
        embeddingOpenAiKeyStatusLoadFailed:
          "OpenAI embedding key durumu yüklenemedi.",
        openAiEmbeddingUrlInvalid:
          "OpenAI embedding base URL geçerli bir http/https URL olmalı.",
        ollamaEmbeddingUrlInvalid:
          "Ollama embedding base URL geçerli bir http/https URL olmalı.",
        embeddingOpenAiKeyEmpty: "Embedding OpenAI key boş olamaz.",
        providerBaseUrlModelRequired: "Provider base URL ve model zorunlu.",
        providerBaseUrlInvalid:
          "Provider base URL geçerli bir http/https URL olmalı.",
        providerConfigLoading:
          "Provider yapılandırması hâlâ yükleniyor. Biraz sonra tekrar deneyin.",
        apiKeyEmpty: "API key boş olamaz.",
        tavilyKeyEmpty: "Tavily key boş olamaz.",
        autoVerifyConfirm:
          "Automatic Verification, izlenen workspace içinde proje komutlarını (npm/cargo vb.) çalıştırır. Sadece güvendiğiniz repolarda açın.",
        preferencesLoadFailed: "Tercihler yüklenemedi: {error}",
        preferencesSaveFailed: "Tercihler kaydedilemedi: {error}",
        preferencesResetFailed: "Tercihler sıfırlanamadı: {error}",
        updateUnavailable: "Güncelleme servisi kullanılamıyor.",
        updateUnavailableHint:
          "Güncelleme servisi kullanılamıyor. Ağı kontrol edip tekrar deneyin.",
      },
    },
    toast: {
      providerSaved: "Provider ayarları kaydedildi.",
      connectionOk: "Bağlantı başarılı.",
      folderOpened: "Klasör otomatik olarak açıldı.",
      exportSaved: "{path} konumuna kaydedildi. {opened}",
      saved: "Kaydedildi.",
      copied: "Kopyalandı.",
      copyFailed: "Kopyalama başarısız.",
      refreshed: "Yenilendi.",
      refreshFailed: "Yenileme başarısız.",
    },
    app: {
      notSet: "Ayarlanmadı",
      selectWorkspaceFirst: "Önce bir çalışma alanı kapsamı seçin.",
      guruReplyReady: "Guru yanıtı hazır.",
      proposalMissingContent: "Öneride uygulanacak içerik yok.",
      reviewRequested: "İnceleme istendi. Onay sonucunu Guru ekranından kontrol edin.",
      requestReviewFailed: "İnceleme isteği başarısız: {error}",
      proposalMarked: "Öneri işaretlendi: {status}",
      updateProposalFailed: "Öneri güncellenemedi: {error}",
      undoComplete: "Geri alma tamamlandı.",
      undoFailed: "Düzeltme geri alınamadı: {error}",
      releaseDecisionUpdated: "Sürüm kararı güncellendi.",
      releaseDecisionUpdateFailed: "Sürüm kararı ayarlanamadı: {error}",
      releaseBlockOverridden: "Sürüm blokajı gerekçeyle override edildi.",
      releaseOverrideFailed: "Blokaj override edilemedi: {error}",
      updateAvailable: "Güncelleme hazır",
      updateReady: "v{version} sürümü hazır",
      updateNow: "Şimdi güncelle",
      updating: "Güncelleniyor...",
      later: "Daha sonra",
      checkingUpdates: "Güncellemeler kontrol ediliyor...",
    },
    systemUi: {
      aiResponseInvalidFormat:
        "Bu batch için AI yanıt formatı geçersizdi. Guardian güvensiz çıktıyı atladı ve güvenli şekilde devam etti.",
      batchPromptHeavy:
        "Batch isteği mevcut AI bağlam limitleri için çok büyüktü. Guardian daha güvenli fallback moduna geçti.",
      providerTimeout:
        "Batch denetiminde AI sağlayıcısı zaman aşımına uğradı. Guardian retry/fallback mantığıyla devam edecek.",
      backendUnavailable:
        "Backend bağlantısı geçici olarak kullanılamıyor. İzleme güvenli modda devam ediyor.",
      internalWarning:
        "Kritik olmayan bir sistem uyarısı oluştu. Guardian güvenli modda devam etti.",
      internalError:
        "Bir sistem hatası oluştu. Guardian iş akışını koruyarak güvenli şekilde devam etti.",
    },
    header: {
      settingsTitle: "Kurulum ve Ayarlar",
      stats: {
        critical: "Kritik",
        warning: "Uyarı",
        aiRequests: "AI Çağrıları",
      },
      session: "Oturum",
      monitoringOn: "İzleme aktif",
      monitoringOff: "İzleme duraklatıldı",
      logout: "Çıkış",
    },
    authGate: {
      deviceLoginTitle: "GitHub Login",
      deviceLoginNote: "Doğrulama sayfasını açın ve bu kodu girin:",
      openGithub: "GitHub'ı Aç",
      codeExpires:
        "Kodun süresi {time} içinde dolacak. Guardian otomatik kontrol eder ve yetkilendirme tamamlanınca bu ekranı kapatır.",
      checking: "Kontrol ediliyor...",
      checkNow: "Şimdi Kontrol Et",
      cancel: "İptal",
      signInTitle: "GitHub ile Giriş",
      signInNote:
        "Monitoring, model erişimi ve release onay akışlarını açmak için GitHub ile giriş yapın.",
      signInButton: "GitHub ile Giriş Yap",
      desktopRequired: "Kimlik doğrulama için desktop uygulama gerekli.",
    },
    onboarding: {
      skip: "Turu Geç",
      continue: "Devam",
      getStarted: "Başla",
      slides: {
        welcome: {
          title: "Guardian'a Hoş Geldiniz",
          description:
            "Guardian, küçük mühendislik ekipleri için local-first bir yönetişim katmanıdır. AI ile üretilen ve riskli kod değişikliklerini release öncesinde takım politikalarına göre denetler.",
          highlight: "Kodunuzu koruyun. Standartlarınızı yükseltin.",
        },
        neural: {
          title: "AI Motoru",
          description:
            "AI engine'inizi seçin. Maksimum güç için OpenAI, Anthropic veya Gemini gibi cloud provider'ları kullanın ya da tam gizlilik için Ollama ile tamamen local çalışın.",
          highlight: "Veriniz, seçiminiz.",
        },
        realtime: {
          title: "Gerçek Zamanlı İzleme",
          description:
            "Guardian kod yazarken dosyalarınızı izler. Her kaydetme politika kontrolü tetikleyebilir; kritik bulgular, insan onayı gelene kadar release'i durdurabilir.",
          highlight: "Hiçbir bulgu gözden kaçmaz.",
        },
        ready: {
          title: "Başlamaya Hazır",
          description:
            "Guardian'ın tüm gücünü açmak için GitHub ile giriş yapın. Ücretsiz plan cömert kullanım sunar, kredi kartı gerekmez.",
          highlight: "Kod tabanınızı güvene alalım.",
        },
      },
    },
    stall: {
      title: "Kritik Duruş",
      notePrefix: "Kritik ihlal tespit edildi:",
      noteSuffix:
        "Güvenlik için gerçek zamanlı izleme duraklatıldı. Devam etmek için Guru'da çözün.",
      resolve: "Guru'da Çöz",
      dismiss: "Kapat",
    },
    errorBoundary: {
      title: "Bir şeyler ters gitti",
      fallback: "Beklenmeyen bir hata oluştu",
      tryAgain: "Tekrar Dene",
    },
    monitor: {
      statusIdle: "Boşta",
      statusPaused: "Duraklatıldı",
      statusActive: "İzleme Aktif",
      tableIndex: "#",
      tableFilePath: "Dosya Yolu",
      tableMessage: "Çekirdek İhlal Mesajı",
      tableActions: "Aksiyon / Seviye",
      searchPlaceholder: "Hataları ara (dosya, mesaj, seviye)...",
      gateSelectScope: "Önce bir çalışma alanı kapsamı seçin.",
      gateProviderLoading: "Sağlayıcı yapılandırması hâlâ yükleniyor.",
      gateAddApiKey: "Ayarlar içinde {provider} API anahtarınızı ekleyin.",
      gateVerifyGithub: "İzleme öncesi GitHub oturumunuzu çevrimiçi doğrulayın.",
      gateSignInGithub: "İzlemeyi başlatmak için GitHub ile giriş yapın.",
      gateDevicePending: "GitHub device authorization ekranını tamamlayın.",
      gateVerifying: "GitHub doğrulaması devam ediyor.",
      stopFailed: "İzleme durdurulamadı: {error}",
      authRequired:
        "GitHub girişi gerekli. İzleme başlamadan önce GitHub doğrulamasını tamamlayın.",
      providerNotReady: "Sağlayıcı hazır değil. Biraz sonra tekrar deneyin.",
      missingApiKey:
        "{provider} için API anahtarı eksik. Ayarları açıp anahtar ekleyerek tekrar deneyin.",
      startFailed: "Başlatılamadı: {error}",
      guardianOnline: "Guardian Çalışıyor",
      systemSecure: "Sistem Güvenli",
      offline: "Guardian çevrimdışı.",
      resolvedBadge: "ÇÖZÜLDÜ",
      resolved: {
        noBaselineTitle: "Temel çizgi yok",
        noBaselineNote: "Çözülen takibini açmak için \"Temel Çizgi Oluştur\" düğmesine tıklayın.",
        invalidTitle: "Temel çizgi geçersiz",
        invalidNote: "Temel çizgiden sonra kurallar değişmiş. Devam etmek için temel çizgiyi sıfırlayın.",
        emptyTitle: "Çözülen bulgu yok",
        emptyNote: "Mevcut temel çizgiden beri çözülen bir bulgu yok.",
        defaultMessage: "Temel çizgiden sonra çözüldü",
      },
    },
    reviews: {
      appliedFixesTitle: "Uygulanan Düzeltmeler (Geri Alınabilir)",
      appliedFixesNote: "Geri alma, dosya başına tek düzeltme olarak tutulur (son uygulanan).",
      fixHistoryLoading: "Yükleniyor...",
      noAppliedFixes: "Henüz uygulanmış düzeltme yok. İzleme veya Guru üzerinden bir düzeltme uygularsanız burada görünür.",
      appliedLabel: "Uygulandı",
      undoTitle: "Bu dosya için son uygulanan düzeltmeyi geri al",
      selectWorkspaceHint:
        "Bir çalışma alanı seçin, sonra önerileri .guardian-proposals/fix_proposals.jsonl dosyasına yazın.",
      proposalsHint:
        "Düzeltme önerileri opsiyoneldir. Bir düzeltme uyguladığınızda uygulanan düzeltmeler burada görünür (Geri Al).",
    },
    releaseDecision: {
      title: "Sürüm Kararı",
      metrics: "Kritik: {critical} • Uyarı: {warning} • AI-ağır: {aiHeavy}",
      auditPath: "Denetim izi dosyası",
      approver: "Onaylayan",
      reason: "Gerekçe",
      approverPlaceholder: "release-manager",
      reasonPlaceholder: "Mimari inceleme sonrası onaylandı",
      saveDecision: "Kararı Kaydet",
      overrideTitle: "Blokaj Override",
      overridePlaceholder: "Override gerekçesi (zorunlu)",
      overrideButton: "Blokajı Override Et",
      labels: {
        PASS: "Geç",
        PASS_WITH_WARNING: "Uyarıyla Geç",
        BLOCK_UNTIL_APPROVED: "Onaylanana Kadar Blokla",
        OVERRIDDEN: "Override Edildi",
      },
    },
    fixProposals: {
      emptyTitle: "İncelemeler: Düzeltme Önerisi Gelen Kutusu",
      emptyNote:
        "Guardian, İzleme ve Guru üzerinden düzeltmeleri anında uygulayabilir. Düzeltme önerileri opsiyoneldir: inceleme kuyruğu veya CI odaklı akışlar için kullanın.",
      emptyAdvanced:
        "Gelişmiş akış: JSONL önerileri .guardian-proposals/fix_proposals.jsonl dosyasına ekleyin.",
      title: "Düzeltme Önerileri",
      source: "Kaynak",
      updated: "Güncellendi",
      pending: "Bekleyen",
      done: "Tamamlanan",
      total: "Toplam",
      searchPlaceholder: "Öneri ara...",
      filterPending: "Bekleyen",
      filterReviewRequested: "İnceleme İstendi",
      filterDone: "Tamamlandı",
      filterAll: "Tümü",
      noMatch: "Mevcut filtreyle eşleşen öneri yok.",
      selectTitle: "Bir öneri seçin.",
      selectNote: "İncelemek istediğiniz öneriyi arama ve durum filtreleriyle bulun.",
      unknownFile: "<bilinmeyen dosya>",
      copyProposedContent: "Önerilen İçeriği Kopyala",
      copyProposalJson: "Öneri JSON'unu Kopyala",
      copyProposedContentTitle: "Önerilen içeriği kopyala",
      copyProposalJsonTitle: "Öneriyi JSON olarak kopyala",
      missingProposedContent:
        "Öneride proposed_content yok. İnceleme veya uygulama yapılamaz.",
      requestReview: "İnceleme İste",
      requestReviewTitle:
        "Bu öneriyi Guardian inceleme (YZ) sürecine gönderin. Uygulama için yine de onay gerekir.",
      reject: "Reddet",
      rejectTitle: "Reddedildi olarak işaretle (JSONL'a status ekler)",
      markApplied: "Uygulandı",
      markAppliedTitle: "Uygulandı olarak işaretle (JSONL'a status ekler)",
    },
    aiContext: {
      titleEmpty: "Çalışma alanı seçilmedi.",
      noteEmpty: "Bir çalışma alanı seçin, izlemeyi başlatın ve YZ çıkış yükünü yakalamak için bir dosyayı değiştirin.",
      noCapturedTitle: "Yakalanan Bağlam Yok",
      noCapturedNote: "İzlemeyi başlatın ve YZ çıkış yükünü yakalamak için bir dosyayı değiştirin.",
      title: "YZ Çıkış Bağlamı",
      provider: "Sağlayıcı",
      model: "Model",
      timestamp: "Zaman Damgası",
      files: "Dosya",
      tokensEst: "Token (tahmini)",
      refreshTitle: "Arka uçtan yenile",
      redactionTitle: "Hassas içerik maskelendi.",
      redactionContext: "Durum: {redacted} maskeli, {truncated} kısaltıldı.",
      redactionNote:
        "Önizleme, sağlayıcıya gerçekten gönderilen içeriği gösterir. Etkilenen dosyaları görmek için filtreleri kullanın.",
      searchFilesPlaceholder: "Dosya ara...",
      filterAll: "Tümü",
      filterRedacted: "Maskeli",
      filterTruncated: "Kısaltılmış",
      noFilesMatch: "Mevcut filtreyle eşleşen dosya yok.",
      selectFileTitle: "Önizleme için bir dosya seçin.",
      selectFileNote: "İncelemek istediğiniz dosyayı arama ve filtrelerle bulun.",
      copyFileContext: "Dosya Bağlamını Kopyala",
      copyFullPayload: "Tüm Yükü Kopyala",
      copyFileContextTitle: "Seçili dosya bağlamını kopyala",
      copyFullPayloadTitle: "Tüm yükü JSON olarak kopyala",
      badgeRedacted: "MASKELİ",
      badgeTruncated: "KISALTILDI",
    },
    diagram: {
      title: "Proje Haritası",
      emptyTitle: "Proje haritası boş.",
      emptyNote: "Bir çalışma alanı seçin, haritayı oluşturun, ardından doğru dizini doğrulamak için yeniden tarayın.",
      projectRoot: "Proje Kökü",
      scanning: "Taranıyor...",
    },
    critique: {
      system: "Sistem",
      askGuru: "Guru'dan çözüm iste",
      quickFixTitle: "Hızlı Düzeltme: Bu yamayı hemen uygula",
      fix: "DÜZELT",
      undo: "GERİ AL",
      applyThisFix: "BU DÜZELTMEYİ UYGULA",
      autopilotProposedFix: "Autopilot: Önerilen Düzeltme",
      severityInfo: "BİLGİ",
      severityWarning: "UYARI",
      severityCritical: "KRİTİK",
      filePath: "Dosya Yolu",
      violationDetails: "Sistem İhlal Detayları",
      verdictSuggestion: "Mimarın Kararı ve Önerisi",
      cannotApplyMissingWorkspace: "Düzeltme uygulanamadı: çalışma alanı yolu eksik.",
      cannotUndoMissingWorkspace: "Geri alınamadı: çalışma alanı yolu eksik.",
      appliedFixToast: "{file} için düzeltme uygulandı.",
      undoCompleteToast: "{file} için geri alma tamamlandı.",
      applyFailedToast: "Düzeltme uygulanamadı: {error}",
      undoFailedToast: "Geri alma başarısız: {error}",
      findingNewSinceBaseline: "Temel çizgiden sonra yeni",
      findingPresentInBaseline: "Temel çizgide mevcut",
      badgeNew: "YENİ",
      badgeActive: "AKTİF",
      badgeResolved: "ÇÖZÜLDÜ",
    },
    chat: {
      title: "Guru",
      openGuide: "Rehberi Aç",
      clearHistory: "Geçmişi Temizle",
      clearConfirmTitle: "Emin misiniz?",
      clearConfirmDescription: "Bu işlem bu çalışma alanı için mevcut sohbet geçmişini kalıcı olarak silecektir.",
      emptyTitle: "Guru Motoru",
      emptyDescription: "Ben Guardian Guru. Proje bağlamına RAG-Lite ile erişiyorum.\nKod tabanınızla ilgili her şeyi sorabilirsiniz.",
      inputPlaceholder: "Mantık akışı, mimari veya STALL çözümü hakkında Guru'ya sor...",
      send: "Gönder",
      cancel: "İptal",
      actionsTitle: "Aksiyon ekle",
      webSearch: "Web Arama",
      webSearchSetupHint: "Web arama için Ayarlar'a Tavily anahtarı ekleyin.",
      systemSelectWorkspace: "Guru'ya sormak için bir çalışma alanı seçin.",
      errorWebSearchOptional:
        "Guru Hatası: {error}. Web arama opsiyoneldir; tekrar deneyin veya Ayarlar'dan kapatın.",
      errorLocalServer: "Guru Hatası: {error}. Yerel YZ sunucusunun çalıştığından emin olun.",
      errorGeneric: "Guru Hatası: {error}.",
      decisionReceived: "{file} için karar alındı: **{decision}**",
      guide: {
        title: "Guardian Guru",
        subtitle: "Hibrit Otonom Mühendislik Protokolü",
        options: {
          sentryTitle: "Guardian Sentry",
          sentryDesc: "Kodunuzu gerçek zamanlı izler. Kritik ihlallerde sistemi anında kilitler.",
          architectTitle: "Guru Architect",
          architectDesc: "Mimari zekâ. Guardian'ın bulduğu teknik borçları otonom şekilde temizlemeye yardımcı olur.",
          hardLockTitle: "Hard Lock",
          hardLockDesc: "Kritik sorunlar çözülene kadar geliştirmeyi durdurur, güvenli bir döngü uygular.",
          planDrivenTitle: "Plan-Driven",
          planDrivenDesc: "PLAN-*.md dosyalarını okuyarak kodun tasarım niyetiyle uyumunu artırır.",
        },
        stepsTitle: "Operasyon Adımları",
        step1: "Guardian, çalışma alanında kritik bir ihlal algıladığında sistemi kilitler.",
        step2: "Sorunu çözmek için Guru Architect'ten analiz ve yama isteyin.",
        step3: "Onayınızla Antigravity, proje mimarisine uyarak düzeltmeyi uygular.",
        start: "PROTOKOLÜ BAŞLAT",
      },
      thinking: {
        analyzing: "Proje bağlamı analiz ediliyor",
        crossChecking: "Mimari desenler kontrol ediliyor",
        comparing: "Aktif monitor bulgularıyla karşılaştırılıyor",
        building: "Uygulanabilir cevap hazırlanıyor",
      },
      copy: "Kopyala",
      copied: "Kopyalandı",
      copyCode: "Kodu kopyala",
      verifiedSafe: "Güvenli Doğrulandı",
      guardianAutoCorrected: "Guardian Otomatik Düzeltti",
      successfullyApplied: "Başarıyla Uygulandı",
      fix: {
        cannotApplyMissingWorkspace: "Düzeltme uygulanamadı: çalışma alanı yolu eksik.",
        appliedFixToast: "{file} dosyasına düzeltme uygulandı.",
        undoCompleteToast: "{file} için geri alma tamamlandı.",
        undoFailedToast: "Geri alma başarısız: {error}",
        appliedFixConfirmation: "{file} dosyasına düzeltme başarıyla uygulandı.",
        applyFailedToast: "Düzeltme uygulanamadı: {error}",
        rejectedFixToast: "{file} için önerilen düzeltme reddedildi.",
        rejected: "Reddedildi",
        confirmAndApply: "Onayla ve Uygula",
        reject: "Reddet",
      },
    },
    sidebar: {
      controlHub: "Kontrol Merkezi",
      expand: "Sidebar'ı aç",
      collapse: "Sidebar'ı kapat",
      nav: {
        monitor: "İzleme",
        guru: "Guru",
        projectMap: "Proje Haritası",
        aiContext: "Yapay Zeka Bağlamı",
        reviews: "İncelemeler",
      },
      selectWorkspace: "Çalışma alanı seç",
      showDetails: "Detayları göster",
      hideDetails: "Detayları gizle",
      details: "Detaylar",
      ready: "HAZIR",
      empty: "BOŞ",
      log: "KAYIT",
      files: "Dosya",
      issues: "Bulgu",
      scope: "Kapsam",
      setupRequired: "Kurulum gerekli: {provider} API anahtarı ekleyin.",
      openSettings: "Ayarları Aç",
      verifyNow: "Şimdi Doğrula",
      authLoginRequired: "İzleme başlamadan önce GitHub girişi gerekli.",
      authVerifyRequired: "Önbellek oturumu bulundu. GitHub erişimini yenilemek için çevrimiçi doğrulayın.",
      launchGuardian: "Guardian'ı Başlat",
      killGuardian: "Guardian'ı Durdur",
      launchBlocked: "Başlatma engellendi: {reason}",
      baseline: {
        title: "Temel Çizgi",
        statusLoading: "YÜKLENİYOR",
        statusValid: "GEÇERLİ",
        statusInvalid: "GEÇERSİZ",
        statusNone: "YOK",
        labelLoading: "Temel çizgi: yükleniyor",
        labelNone: "Temel çizgi: yok",
        labelValid: "Temel çizgi: geçerli",
        labelInvalid: "Temel çizgi: geçersiz",
        age: "Yaş",
        loaded: "Temel çizgi yüklendi",
        noneSet: "Bu çalışma alanı için temel çizgi ayarlanmadı.",
        invalidNote: "Temel çizgi geçersiz (kurallar değişti). Filtrelemeyi açmak için temel çizgiyi sıfırlayın.",
        setNow: "Baseline Oluştur",
        reset: "Sıfırla",
        viewAll: "Tümü",
        viewNew: "Yeni",
        viewResolved: "Çözülen",
        metricsActive: "aktif",
        metricsNew: "yeni",
        metricsResolved: "çözüldü",
      },
      cost: {
        title: "Maliyet",
        est: "tahmini",
        units: "birim",
        tokens: "Token",
        apiCalls: "API çağrısı",
        files: "Dosya",
        queueWait: "Kuyruk",
        scope: "Kapsam",
      },
      engine: {
        title: "Engine Status",
        model: "Model",
        embedding: "Embedding",
        setup: "Kur",
      },
    },
  },
};

function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const serializeLocale = (value: AppLocale): string => JSON.stringify(value);

function deserializeLocale(raw: string): AppLocale {
  try {
    const parsed = JSON.parse(raw);
    if (isLocale(parsed)) return parsed;
  } catch {
    // Ignore and fall through.
  }
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  return isLocale(trimmed) ? trimmed : DEFAULT_LOCALE;
}

function getPathValue(messages: Messages, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatTemplate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    void match;
    const value = params[name];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export function createTranslator(locale: AppLocale) {
  const messages = MESSAGES[locale] ?? MESSAGES.en;
  return (key: string, params?: Params): string => {
    const raw = getPathValue(messages, key);
    if (typeof raw === "string") return formatTemplate(raw, params);
    return key;
  };
}

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: Params) => string;
  hydrated: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw, hydrated] = useLocalStorage<AppLocale>(
    STORAGE_KEYS.LANGUAGE,
    DEFAULT_LOCALE,
    {
      deserialize: deserializeLocale,
      serialize: serializeLocale,
    }
  );

  const t = useMemo(() => createTranslator(locale), [locale]);
  const setLocale = (next: AppLocale) => setLocaleRaw(next);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, hydrated }),
    [hydrated, locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    const t = createTranslator(DEFAULT_LOCALE);
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t, hydrated: false };
  }
  return ctx;
}
