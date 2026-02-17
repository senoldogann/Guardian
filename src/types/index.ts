/** Centralized type definitions for Guardian */

// Auth types
export interface GithubUser {
  login: string;
  id: number;
  avatar_url?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AuthSessionResponse {
  user: GithubUser;
  verified: boolean;
  warning?: string | null;
}

export interface AuthLoginResult {
  user: GithubUser;
  warning?: string | null;
}

export type AuthState =
  | "signed_out"
  | "device_pending"
  | "verifying"
  | "signed_in_verified"
  | "signed_in_offline";

// Settings types
export interface ProviderConfig {
  provider_id: string;
  base_url: string;
  model: string;
}

export interface ApiKeyStatus {
  has_key: boolean;
  source: string;
  warning?: string | null;
}

export interface TavilyKeyStatus {
  has_key: boolean;
  source: string;
}

export type SettingsTab = "provider" | "embedding" | "web" | "updates" | "export";

export type EmbeddingMode = "auto" | "openai" | "ollama" | "local";

export interface EmbeddingRuntimeConfig {
  mode: EmbeddingMode;
  openai_base_url?: string | null;
  ollama_base_url?: string | null;
  openai_model?: string | null;
  ollama_model?: string | null;
}

export interface UpdateCheckResult {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
  last_checked_at?: string | null;
}

// Project types
export interface ProjectContext {
  file_structure: string[];
  dependencies: string[];
  total_files: number;
  intent_summary: string;
}

export type GuardianEvent =
  | { type: "FileModified"; path: string }
  | { type: "RequestScan"; root: string }
  | { type: "AnalysisComplete"; file_path: string; result?: string | null }
  | { type: "RequestFix"; file_path: string; diff: string }
  | { type: "RequestReview"; file_path: string; diff: string }
  | { type: "ChatQuery"; context: string; query: string }
  | { type: "StallRequested"; file_path: string; reason: string }
  | { type: "StallReleased"; file_path: string }
  | { type: "Startup" }
  | { type: "Shutdown" };

// Chat types
export interface ChatMessage {
  role: "user" | "guru" | "guardian";
  content: string;
  timestamp?: string;
  action?: {
    status: "APPROVED" | "MODIFIED";
    file_path: string;
    diff: string;
  };
}

export interface ReviewDecisionPayload {
  file_path: string;
  status?: "APPROVED" | "MODIFIED";
  diff?: string;
  message?: string;
  decision?: "Approve" | "Reject";
}

// Critique types
export interface Critique {
  file_path: string;
  severity: "Info" | "Warning" | "Critical";
  message: string;
  suggestion?: string;
  suggested_diff?: string;
  finding_id?: string;
}

export interface BaselineFinding {
  finding_id: string;
  file_path: string;
  severity: string;
  message?: string | null;
}

export interface Baseline {
  schema_version: number;
  created_at: string;
  workspace_id: string;
  rules_hash: string;
  finding_ids: string[];
  findings?: BaselineFinding[];
}

export interface BaselineStatusView {
  valid: boolean;
  baseline_age_days: number;
  active: number;
  new_since_baseline: number;
  resolved_since_baseline: number;
  rules_hash_current: string;
  rules_hash_baseline: string;
  created_at: string;
}

export interface AiContextFile {
  file_path: string;
  token_estimate: number;
  redacted: boolean;
  truncated: boolean;
  content: string;
}

export interface AiContextSnapshot {
  timestamp: string;
  root: string;
  provider_id: string;
  model: string;
  tokens_in: number;
  files: AiContextFile[];
}

export interface FixProposal {
  proposal_id: string;
  timestamp: string;
  status: string;
  file_path: string;
  finding_id?: string | null;
  proposed_by?: string | null;
  original_content_hash?: string | null;
  suggestion?: string | null;
  proposed_content?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
}

export interface FixProposalsSnapshot {
  timestamp: string;
  root: string;
  source_path: string;
  proposals: FixProposal[];
}

export interface FixHistoryEntry {
  file_path: string;
  applied_at: string;
}

// Provider options
export interface ProviderOption {
  id: string;
  label: string;
  baseUrl: string;
}

// Stats
export interface Stats {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export interface UsageStats {
  tokens: number;
  calls: number;
  files?: number;
  queue_wait_ms?: number;
}

// Tauri abstraction
export interface ITauriAPI {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
}

// Error types
export interface AppErrorDetails {
  type: string;
  error: string;
  timestamp: string;
}
