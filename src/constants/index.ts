/** Constants for Guardian - Centralized to avoid magic strings/numbers */

// Storage keys
export const STORAGE_KEYS = {
  LAST_PATH: "guardian_last_path",
  THEME: "guardian_theme",
  LANGUAGE: "guardian_language",
  WEB_SEARCH: "guardian_web_search_enabled",
  WEB_SEARCH_DEPTH: "guardian_web_search_depth",
  CHAT_PREFIX: "guardian_chat_",
  ONBOARDING_COMPLETED: "guardian_onboarding_completed",
  AUTO_VERIFY_ENABLED: "guardian_auto_verify_enabled",
  GURU_REPLY_SOUND_ENABLED: "guardian_guru_reply_sound_enabled",
  EMBEDDING_MODE: "guardian_embedding_mode",
  EMBEDDING_OPENAI_BASE_URL: "guardian_embedding_openai_base_url",
  EMBEDDING_OLLAMA_BASE_URL: "guardian_embedding_ollama_base_url",
  EMBEDDING_OPENAI_MODEL: "guardian_embedding_openai_model",
  EMBEDDING_OLLAMA_MODEL: "guardian_embedding_ollama_model",
  USER_PREFERENCES_MIGRATED_V1: "guardian_user_preferences_migrated_v1",
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
  { id: "ollama", label: "Ollama (Local)", baseUrl: "http://localhost:11434" },
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
