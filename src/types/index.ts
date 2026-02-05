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

export type SettingsTab = "provider" | "web" | "updates" | "export";

export interface UpdateCheckResult {
  status: string;
  current_version: string;
  latest_version?: string | null;
  notes?: string | null;
  error?: string | null;
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
