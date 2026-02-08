/** Constants for Guardian - Centralized to avoid magic strings/numbers */

// Storage keys
export const STORAGE_KEYS = {
  LAST_PATH: "guardian_last_path",
  THEME: "guardian_theme",
  WEB_SEARCH: "guardian_web_search_enabled",
  CHAT_PREFIX: "guardian_chat_",
  ONBOARDING_COMPLETED: "guardian_onboarding_completed",
  AUTO_VERIFY_ENABLED: "guardian_auto_verify_enabled",
} as const;

// Limits
export const LIMITS = {
  MAX_USER_GURU: 120,
  MAX_SYSTEM: 20,
  MAX_FILES: 300,
  MAX_DEPTH: 5,
  MAX_CONTENT: 4000,
  MAX_DIFF: 1500,
} as const;

// API Key masking
export const MASK = "••••••";

// Provider options
export const PROVIDER_OPTIONS = [
  { id: "ollama", label: "Ollama (Local)", baseUrl: "http://127.0.0.1:11434" },
  { id: "ollama-cloud", label: "Ollama (Cloud)", baseUrl: "https://ollama.com" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "github-models", label: "GitHub Models", baseUrl: "https://models.github.ai" },
] as const;

export type ProviderId = typeof PROVIDER_OPTIONS[number]["id"];

export const getProviderDefaults = (providerId: string) => {
  const match = PROVIDER_OPTIONS.find((p) => p.id === providerId);
  return match ?? PROVIDER_OPTIONS[0];
};

// Time intervals (ms)
export const INTERVALS = {
  UPDATE_CHECK: 15 * 60 * 1000, // 15 minutes
  SCROLL_BOTTOM: 120, // pixels from bottom
  TOAST_DURATION: 3000,
} as const;

// Diagram limits
export const DIAGRAM_LIMITS = {
  MAX_FILES: 300,
  MAX_DEPTH: 4,
  AUTO_EXPAND_THRESHOLD: 120,
} as const;

// Error codes
export const ERROR_CODES = {
  OPERATION_FAILED: "OPERATION_FAILED",
  AUTH_FAILED: "AUTH_FAILED",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  API_KEY_MISSING: "API_KEY_MISSING",
  UPDATE_ERROR: "UPDATE_ERROR",
  BACKEND_ERROR: "BACKEND_ERROR",
} as const;
