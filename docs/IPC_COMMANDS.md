# Guardian — Tauri IPC Command Reference

> Auto-generated documentation of every `#[tauri::command]` exposed from the Rust backend (`src-tauri/src/lib.rs`).
>
> Tauri converts Rust `snake_case` function names to `snake_case` IPC command names (no conversion).
> The frontend calls these via `invoke("command_name", { ...args })`.

---

## Table of Contents

- [Health](#health)
- [Authentication](#authentication)
- [Monitoring](#monitoring)
- [Baseline](#baseline)
- [Critiques & Findings](#critiques--findings)
- [Fix Management](#fix-management)
- [Release Decision](#release-decision)
- [AI / Chat](#ai--chat)
- [Provider Configuration](#provider-configuration)
- [Embedding Configuration](#embedding-configuration)
- [API Key Management](#api-key-management)
- [Web Search (Tavily)](#web-search-tavily)
- [User Preferences](#user-preferences)
- [Scan Profile](#scan-profile)
- [App Updates](#app-updates)
- [Storage / Chat History](#storage--chat-history)
- [Project Context](#project-context)
- [Guardian Lock](#guardian-lock)

---

## Health

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `ping` | — | `Result<String, String>` | Returns `"pong"`. Used as a liveness check to verify the Tauri backend is reachable. | `useGuardianEvents.ts`, `tauri.test.ts` |

---

## Authentication

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `start_github_login` | — | `Result<DeviceCodeResponse, String>` | Initiates the GitHub OAuth device-code flow. Returns a device code and verification URI for the user to authorize in-browser. | — |
| `complete_github_login` | `device_code: String`, `max_wait_seconds: Option<u64>` | `Result<AuthLoginResult, String>` | Polls GitHub until the device-code flow completes. Stores the access token in the OS keychain and caches the user profile on disk. Returns the authenticated user and optional warnings. | — |
| `logout_github` | — | `Result<(), String>` | Clears the in-memory auth state, removes the cached user profile, and deletes the access token from the OS keychain. | `useAuth.ts` |
| `get_auth_session` | `cached_only: Option<bool>` | `Result<Option<AuthSessionView>, String>` | Returns the current authenticated session. Checks in-memory state first, then falls back to on-disk cache (with token-age validation), and finally attempts online verification via the stored access token. If `cached_only` is `true`, skips online verification. | — |
| `refresh_auth_session` | — | `Result<Option<AuthSessionView>, String>` | Forces an online re-verification of the stored access token against GitHub and updates the cached session. | — |

---

## Monitoring

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `start_monitoring` | `path: String`, `auto_verify_enabled: Option<bool>`, `language: Option<String>` | `Result<(), String>` | Starts the file-system watcher on the given workspace path. Resolves the AI provider, API key, scan profile, and user preferences, then launches the watcher supervisor. Requires an active GitHub session. | `useMonitoringController.ts` |
| `stop_monitoring` | — | `Result<(), String>` | Stops the currently active file-system watcher. | `useMonitoringController.ts`, `useWorkspace.ts` |

---

## Baseline

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_baseline` | `root: String` | `Result<Option<Baseline>, String>` | Loads the saved baseline snapshot for the given workspace root. Returns `None` if no baseline exists. | — |
| `create_baseline` | `root: String` | `Result<BaselineStatusView, String>` | Creates a new baseline from the current active critiques, persists it, and logs a `baseline_created` history event. | — |
| `clear_baseline` | `root: String` | `Result<(), String>` | Deletes the baseline file for the given workspace root. | `useBaselineController.ts` |
| `get_baseline_status` | `root: String` | `Result<Option<BaselineStatusView>, String>` | Loads the existing baseline, compares it against current critiques, and returns a status view showing drift. Returns `None` if no baseline exists. | — |

---

## Critiques & Findings

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_monitor_critiques` | `root: String` | `Result<Vec<Critique>, String>` | Returns the active AI critiques for the workspace. Falls back to the last persisted snapshot if no live critiques are present. | — |
| `get_last_ai_context` | `root: String` | `Result<Option<AiContextSnapshot>, String>` | Returns the last AI context snapshot (files scanned, tokens used, model info) for debugging and transparency. | — |
| `get_fix_proposals` | `root: String` | `Result<FixProposalsSnapshot, String>` | Returns the current set of AI-generated fix proposals for the workspace, refreshing from the proposals log. | — |
| `set_fix_proposal_status` | `root: String`, `proposal_id: String`, `status: String`, `note: Option<String>` | `Result<FixProposalsSnapshot, String>` | Updates the status of a specific fix proposal (e.g., accepted, rejected, deferred) and appends the decision to the proposals log. | — |

---

## Fix Management

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `apply_fix` | `file_path: String`, `new_content: String` | `Result<String, String>` | Publishes a `RequestReview` event to the governance Kernel event bus, initiating a review pipeline before applying the fix. Returns a status message. | `useWorkspace.ts` |
| `apply_fix_now` | `file_path: String`, `new_content: String`, `root: String` | `Result<ApplyFixNowResult, String>` | Immediately applies a fix to the file (bypassing governance review), creates an undo snapshot, and logs a `fix_applied` history event. | `CritiqueAccordionRow.tsx`, `ChatView.tsx` |
| `undo_fix` | `file_path: String`, `root: String` | `Result<String, String>` | Reverts the last fix applied to the given file using the undo snapshot. Logs a `fix_undone` history event. | `useWorkspace.ts`, `CritiqueAccordionRow.tsx`, `ChatView.tsx` |
| `get_fix_history` | `root: String` | `Result<Vec<FixHistoryEntry>, String>` | Returns the list of fix history entries (applied and undone) for the workspace. | — |
| `confirm_fix` | `file_path: String`, `new_content: String`, `root: String` | `Result<String, String>` | Applies a patch to a file (used after governance approval) and logs a `fix_applied` history event. | — |

---

## Release Decision

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_release_decision` | `root: String` | `Result<ReleaseDecisionView, String>` | Returns the current release decision state (go / no-go / blocked) for the workspace. | — |
| `set_release_decision` | `root: String`, `decision: String`, `approver: String`, `reason: Option<String>` | `Result<ReleaseDecisionView, String>` | Records a release decision with an approver name and optional reason. | — |
| `override_release_block` | `root: String`, `approver: String`, `reason: String` | `Result<ReleaseDecisionView, String>` | Overrides a release block with an explicit approver and mandatory reason, allowing the release to proceed. | — |

---

## AI / Chat

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `ask_guru` | `path: String`, `query: String`, `web_search: Option<bool>`, `web_search_depth: Option<String>`, `language: Option<String>` | `Result<String, String>` | The main AI assistant endpoint. Builds a rich context from RAG-lite search, semantic index, active issues, and optional Tavily web search, then sends the query to the configured AI provider. Emits a `guardian:usage` event with estimated token counts. | — |
| `search_web` | `query: String` | `Result<String, String>` | Performs a standalone web search using the Tavily API and returns formatted results. | — |

---

## Provider Configuration

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_provider_config` | — | `Result<ProviderConfig, String>` | Loads the persisted AI provider configuration (provider ID, base URL, model). | — |
| `set_provider_config` | `config: ProviderConfig` | `Result<ProviderConfig, String>` | Saves the AI provider configuration to disk and returns the persisted value. | — |
| `test_provider_connection` | `config: Option<ProviderConfig>` | `Result<ProviderConnectionTestResult, String>` | Tests connectivity to the AI provider by listing available models and checking that the selected model is present in the catalog. | — |
| `list_provider_models` | `provider_id: Option<String>`, `base_url: Option<String>` | `Result<Vec<String>, String>` | Lists all models available from the configured (or overridden) AI provider. | — |

---

## Embedding Configuration

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_embedding_runtime_config` | — | `Result<EmbeddingRuntimeConfig, String>` | Returns the current embedding runtime configuration (mode, provider URLs, model IDs). Reads from the in-process config store with env-var fallback. | — |
| `set_embedding_runtime_config` | `config: EmbeddingRuntimeConfig` | `Result<EmbeddingRuntimeConfig, String>` | Validates and applies embedding runtime configuration. Normalizes mode (`auto\|openai\|ollama\|local`), validates URLs, and updates the thread-safe in-process store. | — |

---

## API Key Management

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_api_key_status` | `provider_id: Option<String>` | `Result<ApiKeyStatus, String>` | Checks whether an API key is stored in the OS keychain for the given (or current) provider. Returns the source (`keychain`, `missing`, `env_ignored`, `error`) and optional warnings. | — |
| `set_user_api_key` | `provider_id: Option<String>`, `api_key: String` | `Result<(), String>` | Stores an API key in the OS keychain for the specified provider. Falls back to the currently configured provider if `provider_id` is omitted. | `useEmbeddingConfig.ts`, `useApiKeyManagement.ts` |
| `clear_user_api_key` | `provider_id: Option<String>` | `Result<(), String>` | Removes the stored API key from the OS keychain for the specified provider. | `useEmbeddingConfig.ts`, `useApiKeyManagement.ts` |

---

## Web Search (Tavily)

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_tavily_key_status` | — | `Result<TavilyKeyStatus, String>` | Checks whether a Tavily API key is configured. Returns `has_key` and source (`user` or `none`). | — |
| `set_tavily_key` | `key: String` | `Result<(), String>` | Stores the Tavily web-search API key in the OS keychain. | `useApiKeyManagement.ts` |
| `clear_tavily_key` | — | `Result<(), String>` | Removes the Tavily API key from the OS keychain. | `useApiKeyManagement.ts` |

---

## User Preferences

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_user_preferences` | — | `Result<UserPreferencesV1, String>` | Loads user preferences from disk (language, auto-verify, scan tuning, custom model instructions, etc.). | — |
| `set_user_preferences` | `preferences: UserPreferencesV1` | `Result<UserPreferencesV1, String>` | Saves user preferences to disk and returns the persisted value. | — |
| `reset_user_preferences` | — | `Result<UserPreferencesV1, String>` | Resets user preferences to defaults, persists, and returns the default values. | — |

---

## Scan Profile

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_scan_profile_config` | — | `Result<ScanProfileConfig, String>` | Loads the scan profile configuration (e.g., `source`, `full`, `security`) from disk. | — |
| `set_scan_profile_config` | `config: ScanProfileConfig` | `Result<ScanProfileConfig, String>` | Saves the scan profile configuration to disk and returns the persisted value. | — |

---

## App Updates

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `check_app_update` | — | `Result<UpdateCheckResult, String>` | Checks whether a newer version of the Guardian app is available. | — |
| `install_app_update` | — | `Result<(), String>` | Downloads and installs the latest app update. | `useUserPreferences.ts` |
| `get_app_version` | — | `String` | Returns the current app version from `CARGO_PKG_VERSION`. This is the only synchronous (non-async) command. | — |

---

## Storage / Chat History

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_chat_history` | `path: String`, `limit: Option<u32>`, `offset: Option<u32>` | `Result<Vec<ChatMessage>, String>` | Loads chat messages for the given workspace path from the SQLite storage. Defaults to 500 messages at offset 0. | — |
| `append_chat_message` | `path: String`, `message: ChatMessage` | `Result<(), String>` | Appends a single chat message to the SQLite storage for the given workspace path. | `ChatView.tsx` |
| `clear_chat_history` | `path: String` | `Result<(), String>` | Deletes all chat messages for the given workspace path from storage. | `ChatView.tsx` |

---

## Project Context

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_project_context` | `path: String` | `Result<ProjectContext, String>` | Indexes the workspace at the given path using the current scan profile and returns structured project context (file tree, dependencies, tech stack). | — |

---

## Guardian Lock

| Command | Parameters | Returns | Description | Frontend Usage |
|---------|-----------|---------|-------------|----------------|
| `get_guardian_lock_status` | `root: String` | `Result<GuardianLockStatus, String>` | Returns the status of the `guardian.lock` file for the workspace (present, hash, staleness). | — |
| `ensure_guardian_lock` | `root: String` | `Result<GuardianLockStatus, String>` | Creates or re-syncs the `guardian.lock` file for the workspace, ensuring it reflects the current state. | — |

---

## Notes

- **Parameter injection**: Parameters like `AppHandle`, `tauri::State<'_, ...>` are injected by Tauri at runtime and are _not_ passed from the frontend. Only plain-data parameters appear in `invoke()` calls.
- **Command naming**: Tauri uses the Rust function name as-is for the IPC command name (snake_case). For example, `start_monitoring` in Rust → `invoke("start_monitoring", ...)` in TypeScript.
- **Error handling**: All commands return `Result<T, String>`. Errors are surfaced to the frontend as rejected promises.
- **Total commands**: **52** IPC commands registered in the `invoke_handler`.
