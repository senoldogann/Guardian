import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

type InvokeArgs = Record<string, unknown> | undefined;
type DialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
};

export const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
};

export const invoke = async <T>(cmd: string, args?: InvokeArgs): Promise<T> => {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error("Tauri runtime unavailable"));
  }
  return tauriInvoke<T>(cmd, args);
};

export const listen = async <T>(event: string, handler: (event: { payload: T }) => void): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => { };
  }
  return tauriListen<T>(event, handler);
};

export const openDialog = async (options: DialogOptions): Promise<string | string[] | null> => {
  if (!isTauriRuntime()) {
    return null;
  }
  const mod = await import("@tauri-apps/plugin-dialog");
  return mod.open(options);
};

export const openExternal = async (url: string): Promise<void> => {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const mod = await import("@tauri-apps/plugin-opener");
  return mod.openUrl(url);
};

export type { UnlistenFn };
