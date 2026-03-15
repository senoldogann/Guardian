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
    header: {
      settingsTitle: "Setup & Settings",
      stats: {
        critical: "Critical",
        warning: "Warning",
        aiRequests: "AI Requests",
      },
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
      selectWorkspace: "Workspace Seç",
      noWorkspaceSelected: "Workspace seçilmedi.",
      cancel: "İptal",
      delete: "Sil",
      loading: "Yükleniyor",
      enabled: "Açık",
      disabled: "Kapalı",
      on: "Aç",
      off: "Kapat",
      unknown: "Bilinmiyor",
    },
    language: {
      label: "Dil",
      english: "English",
      turkish: "Türkçe",
    },
    settings: {
      title: "Kurulum ve Ayarlar",
      subtitle:
        "Provider, API key ve güncellemeleri yapılandırın. Değişiklikler bir sonraki oturumda veya monitoring restart sonrası uygulanır.",
      desktopRequired: "Ayarları değiştirmek için desktop uygulama gerekir.",
      toggleTheme: "Tema Değiştir",
      tabs: {
        general: "Genel",
        provider: "Provider",
        embedding: "Embedding",
        web: "Web Search",
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
      },
      provider: {
        title: "AI Provider",
        popoverTitle: "Provider Setup",
        popoverNote:
          "Önce provider ve modeli kaydedin, gerekiyorsa API key ekleyin. Yerel kullanım için Ollama, cloud için OpenAI/Anthropic/Gemini kullanın.",
        currentProvider: "Mevcut provider: {provider}.",
        providerLabel: "Provider",
        baseUrlLabel: "Base URL",
        modelLabel: "Model",
        modelPlaceholder: "Model ID'yi manuel girin",
        modelsLoading: "Yükleniyor...",
        refreshModels: "Yenile",
        saveProvider: "Provider'ı Kaydet",
        testConnection: "Bağlantıyı Test Et",
        testing: "Test ediliyor...",
        requiresKeyLoadModels: "Model listesini yüklemek için {provider} API key ekleyin.",
        apiKeyTitle: "API Key",
        apiKeyPopoverTitle: "API Key",
        apiKeyPopoverNote:
          "API key gereksinimi seçili provider'a bağlıdır. Key'i yapıştırıp Kaydet'e basın; sadece local keychain'de saklanır.",
        keyStored: "{provider} için key kayıtlı ({source}).",
        noKeyStored: "{provider} için API key yok. Ortam değişkenleri (env) yok sayılır.",
        setupRequired: "Kurulum gerekli: {provider} API key ekleyin (model listeleme ve monitoring için).",
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
    header: {
      settingsTitle: "Kurulum ve Ayarlar",
      stats: {
        critical: "Kritik",
        warning: "Uyarı",
        aiRequests: "AI Çağrıları",
      },
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
      statusActive: "Monitoring Aktif",
      tableIndex: "#",
      tableFilePath: "Dosya Yolu",
      tableMessage: "Çekirdek İhlal Mesajı",
      tableActions: "Aksiyon / Seviye",
      searchPlaceholder: "Hataları ara (dosya, mesaj, seviye)...",
      gateSelectScope: "Önce bir workspace scope seçin.",
      gateProviderLoading: "Provider yapılandırması hâlâ yükleniyor.",
      gateAddApiKey: "Settings içinde {provider} API key'inizi ekleyin.",
      gateVerifyGithub: "Monitoring öncesi GitHub oturumunuzu online doğrulayın.",
      gateSignInGithub: "Monitoring başlatmak için GitHub ile giriş yapın.",
      gateDevicePending: "GitHub device authorization ekranını tamamlayın.",
      gateVerifying: "GitHub doğrulaması devam ediyor.",
      stopFailed: "Monitoring durdurulamadı: {error}",
      authRequired:
        "GitHub girişi gerekli. Monitoring başlamadan önce GitHub doğrulamasını tamamlayın.",
      providerNotReady: "Provider hazır değil. Biraz sonra tekrar deneyin.",
      missingApiKey:
        "{provider} için API key eksik. Settings'i açıp key ekleyerek tekrar deneyin.",
      startFailed: "Başlatılamadı: {error}",
      guardianOnline: "Guardian Çalışıyor",
      systemSecure: "Sistem Güvenli",
      offline: "Guardian çevrimdışı.",
      resolvedBadge: "ÇÖZÜLDÜ",
      resolved: {
        noBaselineTitle: "Baseline yok",
        noBaselineNote: "Resolved takibini açmak için \"Set Baseline\" tıklayın.",
        invalidTitle: "Baseline geçersiz",
        invalidNote: "Baseline sonrası kurallar değişmiş. Devam etmek için baseline'ı sıfırlayın.",
        emptyTitle: "Çözülen bulgu yok",
        emptyNote: "Mevcut baseline'dan beri çözülen bir bulgu yok.",
        defaultMessage: "Baseline sonrası çözüldü",
      },
    },
    reviews: {
      appliedFixesTitle: "Uygulanan Fix'ler (Geri Alınabilir)",
      appliedFixesNote: "Geri alma, dosya başına tek fix olarak tutulur (son uygulanan).",
      fixHistoryLoading: "Yükleniyor...",
      noAppliedFixes: "Henüz uygulanmış fix yok. Monitor veya Guru üzerinden bir fix uygularsanız burada görürsünüz.",
      appliedLabel: "Uygulandı",
      undoTitle: "Bu dosya için son uygulanan fix'i geri al",
      selectWorkspaceHint:
        "Bir workspace seçin, sonra önerileri .guardian-proposals/fix_proposals.jsonl dosyasına yazın.",
      proposalsHint:
        "Fix Proposals opsiyoneldir. Bir fix uyguladığınızda Applied Fixes burada görünür (Geri Al).",
    },
    fixProposals: {
      emptyTitle: "Reviews: Fix Proposal gelen kutusu",
      emptyNote:
        "Guardian, Monitor ve Guru üzerinden fix'leri anında uygulayabilir. Fix Proposals opsiyoneldir: inceleme kuyruğu veya CI odaklı akışlar için kullanın.",
      emptyAdvanced:
        "Gelişmiş akış: JSONL önerileri .guardian-proposals/fix_proposals.jsonl dosyasına ekleyin.",
      title: "Fix Proposals",
      source: "Kaynak",
      updated: "Güncellendi",
      pending: "Bekleyen",
      done: "Tamamlanan",
      total: "Toplam",
      searchPlaceholder: "Öneri ara...",
      filterPending: "Bekleyen",
      filterReviewRequested: "Review İstendi",
      filterDone: "Tamamlandı",
      filterAll: "Tümü",
      noMatch: "Mevcut filtreyle eşleşen öneri yok.",
      selectTitle: "Bir öneri seçin.",
      selectNote: "İncelemek istediğiniz öneriyi arama ve durum filtreleriyle bulun.",
      unknownFile: "<bilinmeyen dosya>",
      copyProposedContent: "Önerilen İçeriği Kopyala",
      copyProposalJson: "Öneri JSON Kopyala",
      copyProposedContentTitle: "Önerilen içeriği kopyala",
      copyProposalJsonTitle: "Öneriyi JSON olarak kopyala",
      missingProposedContent:
        "Öneride proposed_content yok. İnceleme veya uygulama yapılamaz.",
      requestReview: "Review İste",
      requestReviewTitle:
        "Bu öneriyi Guardian review (AI) sürecine gönderin. Uygulama için yine de onay gerekir.",
      reject: "Reddet",
      rejectTitle: "Reddedildi olarak işaretle (JSONL'a status ekler)",
      markApplied: "Uygulandı",
      markAppliedTitle: "Uygulandı olarak işaretle (JSONL'a status ekler)",
    },
    aiContext: {
      titleEmpty: "Workspace seçilmedi.",
      noteEmpty: "Bir workspace seçin, monitoring'i başlatın ve bir dosyayı değiştirerek outbound AI payload'unu yakalayın.",
      noCapturedTitle: "Yakalanan Context Yok",
      noCapturedNote: "Monitoring'i başlatın ve outbound AI payload'u yakalamak için bir dosyayı değiştirin.",
      title: "AI Outbound Context",
      provider: "Provider",
      model: "Model",
      timestamp: "Zaman",
      files: "Dosya",
      tokensEst: "Token (tahmini)",
      refreshTitle: "Backend'den yenile",
      redactionTitle: "Hassas içerik maskelendi.",
      redactionContext: "Durum: {redacted} maskeli, {truncated} kısaltıldı.",
      redactionNote:
        "Önizleme, provider'a gerçekten gönderilen içeriği gösterir. Etkilenen dosyaları görmek için filtreleri kullanın.",
      searchFilesPlaceholder: "Dosya ara...",
      filterAll: "Tümü",
      filterRedacted: "Maskeli",
      filterTruncated: "Kısaltılmış",
      noFilesMatch: "Mevcut filtreyle eşleşen dosya yok.",
      selectFileTitle: "Önizleme için bir dosya seçin.",
      selectFileNote: "İncelemek istediğiniz dosyayı arama ve filtrelerle bulun.",
      copyFileContext: "Dosya Context'ini Kopyala",
      copyFullPayload: "Tüm Payload'u Kopyala",
      copyFileContextTitle: "Seçili dosya context'ini kopyala",
      copyFullPayloadTitle: "Tüm payload'u JSON olarak kopyala",
      badgeRedacted: "MASKELİ",
      badgeTruncated: "KISALTILDI",
    },
    diagram: {
      title: "Project Map",
      emptyTitle: "Project map boş.",
      emptyNote: "Bir workspace seçin, map'i oluşturun, sonra doğru dizini doğrulamak için yeniden tarayın.",
      projectRoot: "Proje Kökü",
      scanning: "Taranıyor...",
    },
    critique: {
      system: "Sistem",
      askGuru: "Guru'dan çözüm iste",
      quickFixTitle: "Hızlı Fix: Bu patch'i hemen uygula",
      fix: "FIX",
      undo: "GERİ AL",
      applyThisFix: "FIX'İ UYGULA",
      autopilotProposedFix: "Autopilot: Önerilen Fix",
      filePath: "Dosya Yolu",
      violationDetails: "Sistem İhlal Detayları",
      verdictSuggestion: "Mimarın Kararı ve Önerisi",
      cannotApplyMissingWorkspace: "Fix uygulanamadı: workspace path eksik.",
      cannotUndoMissingWorkspace: "Geri alınamadı: workspace path eksik.",
      appliedFixToast: "{file} için fix uygulandı.",
      undoCompleteToast: "{file} için geri alma tamamlandı.",
      applyFailedToast: "Fix uygulanamadı: {error}",
      undoFailedToast: "Geri alma başarısız: {error}",
      findingNewSinceBaseline: "Baseline sonrası yeni",
      findingPresentInBaseline: "Baseline içinde mevcut",
      badgeNew: "YENİ",
      badgeActive: "AKTİF",
      badgeResolved: "ÇÖZÜLDÜ",
    },
    chat: {
      title: "Guru",
      openGuide: "Rehberi Aç",
      clearHistory: "Geçmişi Temizle",
      clearConfirmTitle: "Emin misiniz?",
      clearConfirmDescription: "Bu işlem bu workspace için mevcut chat geçmişini kalıcı olarak silecektir.",
      emptyTitle: "Guru Engine",
      emptyDescription: "Ben Guardian Guru. Proje bağlamına RAG-Lite ile erişiyorum.\nKod tabanınızla ilgili her şeyi sorabilirsiniz.",
      inputPlaceholder: "Mantık akışı, mimari veya STALL çözümü hakkında Guru'ya sor...",
      send: "Gönder",
      cancel: "İptal",
      actionsTitle: "Aksiyon ekle",
      webSearch: "Web Search",
      webSearchSetupHint: "Web search için Settings'e Tavily key ekleyin.",
      systemSelectWorkspace: "Guru'ya sormak için bir workspace seçin.",
      errorWebSearchOptional:
        "Guru Hatası: {error}. Web search opsiyoneldir; tekrar deneyin veya Settings'ten kapatın.",
      errorLocalServer: "Guru Hatası: {error}. Local AI sunucusunun çalıştığından emin olun.",
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
        step1: "Guardian, workspace içinde kritik bir ihlal algıladığında sistemi kilitler.",
        step2: "Sorunu çözmek için Guru Architect'ten analiz ve patch (fix) isteyin.",
        step3: "Onayınızla Antigravity, proje mimarisine uyarak fix'i uygular.",
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
    },
    sidebar: {
      controlHub: "Control Hub",
      expand: "Sidebar'ı aç",
      collapse: "Sidebar'ı kapat",
      nav: {
        monitor: "Monitor",
        guru: "Guru",
        projectMap: "Project Map",
        aiContext: "AI Context",
        reviews: "Reviews",
      },
      selectWorkspace: "Workspace seç",
      showDetails: "Detayları göster",
      hideDetails: "Detayları gizle",
      details: "Detaylar",
      ready: "HAZIR",
      empty: "BOŞ",
      log: "LOG",
      files: "Dosya",
      issues: "Bulgu",
      scope: "Scope",
      setupRequired: "Kurulum gerekli: {provider} API key ekleyin.",
      openSettings: "Settings'i Aç",
      verifyNow: "Şimdi Doğrula",
      authLoginRequired: "Monitoring başlamadan önce GitHub girişi gerekli.",
      authVerifyRequired: "Önbellek oturumu bulundu. GitHub erişimini yenilemek için online doğrulayın.",
      launchGuardian: "Guardian'ı Başlat",
      killGuardian: "Guardian'ı Durdur",
      launchBlocked: "Başlatma engellendi: {reason}",
      baseline: {
        title: "Baseline",
        statusLoading: "YÜKLENİYOR",
        statusValid: "GEÇERLİ",
        statusInvalid: "GEÇERSİZ",
        statusNone: "YOK",
        labelLoading: "Baseline: yükleniyor",
        labelNone: "Baseline: yok",
        labelValid: "Baseline: geçerli",
        labelInvalid: "Baseline: geçersiz",
        age: "Yaş",
        loaded: "Baseline yüklendi",
        noneSet: "Bu workspace için baseline ayarlanmadı.",
        invalidNote: "Baseline geçersiz (rules değişti). Filtrelemeyi açmak için baseline'ı sıfırlayın.",
        setNow: "Set Baseline",
        reset: "Reset",
        viewAll: "All",
        viewNew: "New",
        viewResolved: "Resolved",
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
