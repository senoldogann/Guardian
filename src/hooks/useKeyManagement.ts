/** Generic key management hook for API keys and Tavily keys */

import { useState, useCallback } from "react";
import { invoke, isTauriRuntime } from "../lib/tauri";
import { MASK } from "../constants";

export interface KeyStatus {
  has_key: boolean;
  source: string;
}

export interface UseKeyManagementReturn<T extends KeyStatus> {
  status: T | null;
  input: string;
  masked: boolean;
  error: string | null;
  saving: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  save: () => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface UseKeyManagementOptions {
  keyType: "api" | "tavily";
  getStatusCommand: string;
  setKeyCommand: string;
  clearKeyCommand: string;
  validateFn?: (key: string) => Promise<boolean>;
  providerId?: string;
}

export function useKeyManagement<T extends KeyStatus>(
  options: UseKeyManagementOptions
): UseKeyManagementReturn<T> {
  const {
    getStatusCommand,
    setKeyCommand,
    clearKeyCommand,
    validateFn,
    providerId,
  } = options;

  const isDesktop = isTauriRuntime();

  const [status, setStatus] = useState<T | null>(null);
  const [input, setInput] = useState("");
  const [masked, setMasked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyStatus = useCallback((newStatus: T): void => {
    setStatus(newStatus);
    if (newStatus.has_key) {
      setMasked(true);
      setInput(MASK);
    } else {
      setMasked(false);
      setInput("");
    }
  }, []);

  const onFocus = useCallback((): void => {
    if (masked) {
      setInput("");
      setMasked(false);
    }
  }, [masked]);

  const onChange = useCallback((value: string): void => {
    setInput(value);
    setError(null);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;

    try {
      const args = providerId ? { providerId } : undefined;
      const res = await invoke<T>(getStatusCommand, args);
      applyStatus(res);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [isDesktop, getStatusCommand, providerId, applyStatus]);

  const save = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;

    const trimmed = input.trim();
    if (!trimmed || (masked && trimmed === MASK)) {
      setError("Key cannot be empty.");
      return;
    }

    if (validateFn) {
      const isValid = await validateFn(trimmed);
      if (!isValid) {
        setError("Invalid key format.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const args = providerId
        ? { apiKey: trimmed, providerId }
        : { key: trimmed };
      await invoke(setKeyCommand, args);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [isDesktop, input, masked, providerId, setKeyCommand, validateFn, refresh]);

  const clear = useCallback(async (): Promise<void> => {
    if (!isDesktop) return;

    setSaving(true);
    setError(null);

    try {
      const args = providerId ? { providerId } : undefined;
      await invoke(clearKeyCommand, args);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [isDesktop, clearKeyCommand, providerId, refresh]);

  return {
    status,
    input,
    masked,
    error,
    saving,
    onFocus,
    onChange,
    save,
    clear,
    refresh,
  };
}

export default useKeyManagement;
