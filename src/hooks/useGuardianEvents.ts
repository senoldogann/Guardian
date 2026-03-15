import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useMemo } from "react";
import { invoke, listen, type UnlistenFn } from "../lib/tauri";
import { handleError } from "../lib/error";
import { critiqueStateKey } from "../lib/critiqueStateKey";
import type { AiContextSnapshot, Critique, FixProposalsSnapshot } from "../types";
import { createTranslator, useI18n } from "../i18n";

interface UseGuardianEventsArgs {
  setLogs: Dispatch<SetStateAction<Record<string, Critique>>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setStalled: Dispatch<SetStateAction<{ file: string; reason: string } | null>>;
  setStallOverlayOpen: Dispatch<SetStateAction<boolean>>;
  stallSignatureRef: MutableRefObject<string | null>;
  setUsage: Dispatch<SetStateAction<{ tokens: number; calls: number; files: number; queueWaitMs: number }>>;
  setAiContext: Dispatch<SetStateAction<AiContextSnapshot | null>>;
  setAiContextError: Dispatch<SetStateAction<string | null>>;
  setFixProposals: Dispatch<SetStateAction<FixProposalsSnapshot | null>>;
  setFixProposalsError: Dispatch<SetStateAction<string | null>>;
}

function normalizeSystemMessage(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function toFriendlySystemMessage(
  raw: string,
  kind: "warning" | "error" | "verification" | "backend",
  t: (key: string) => string,
): string {
  const normalized = normalizeSystemMessage(raw);
  const lower = normalized.toLowerCase();

  if (
    lower.includes("json schema validation failed")
    || lower.includes("invalid json syntax")
    || lower.includes("raw content preview")
    || lower.includes("oneof")
    || lower.includes("is not valid under any of the schemas")
  ) {
    return t("systemUi.aiResponseInvalidFormat");
  }

  if (
    lower.includes("batch prompt is heavy")
    || lower.includes("estimated tokens")
    || lower.includes("max_batch_prompt_tokens")
    || lower.includes("falling back to per-file audit")
  ) {
    return t("systemUi.batchPromptHeavy");
  }

  if (
    lower.includes("timed out")
    || lower.includes("timeout")
    || lower.includes("failed to send openai request")
    || lower.includes("error sending request for url")
  ) {
    return t("systemUi.providerTimeout");
  }

  if (kind === "backend") {
    return t("systemUi.backendUnavailable");
  }

  if (normalized.length > 220) {
    return kind === "error" ? t("systemUi.internalError") : t("systemUi.internalWarning");
  }

  return normalized;
}

export function useGuardianEvents({
  setLogs,
  setStatus,
  setStalled,
  setStallOverlayOpen,
  stallSignatureRef,
  setUsage,
  setAiContext,
  setAiContextError,
  setFixProposals,
  setFixProposalsError,
}: UseGuardianEventsArgs): void {
  const { locale } = useI18n();
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const register = async <T,>(
      event: string,
      handler: (payload: { payload: T }) => void,
    ): Promise<void> => {
      try {
        const unlisten = await listen<T>(event, handler);
        if (disposed) {
          await unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      } catch (error) {
        handleError(error, `EventListener:${event}`);
      }
    };

    void register<Critique>("guardian:critique", (event) => {
      const stateKey = critiqueStateKey(event.payload);
      setLogs((prev) => ({
        ...prev,
        [stateKey]: event.payload,
      }));
      setStatus("Monitoring Active");
    });

    void register<string>("guardian:clear", (event) => {
      setLogs((prev) => {
        const next: Record<string, Critique> = {};
        for (const [key, critique] of Object.entries(prev)) {
          const shouldDrop = key === event.payload || critique.file_path === event.payload;
          if (!shouldDrop) {
            next[key] = critique;
          }
        }
        return next;
      });
    });

    void register<string>("guardian:analyzing", (event) => {
      const fileName = event.payload.split("/").pop() || "File";
      setStatus(`Analyzing: ${fileName}`);
    });

    void register<string>("guardian:error", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System"]: {
          file_path: "System Error",
          severity: "Critical",
          message: toFriendlySystemMessage(event.payload, "error", t),
        },
      }));
    });

    void register<string>("guardian:verification", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System:Verification"]: {
          file_path: "Verification",
          severity: "Warning",
          message: toFriendlySystemMessage(event.payload, "verification", t),
        },
      }));
    });

    void register<string>("guardian:warning", (event) => {
      setLogs((prev) => ({
        ...prev,
        ["System:Warning"]: {
          file_path: "System Warning",
          severity: "Warning",
          message: toFriendlySystemMessage(event.payload, "warning", t),
        },
      }));
    });

    void register<{ file_path: string; reason: string }>("guardian:stall-requested", (event) => {
      const signature = `${event.payload.file_path}::${event.payload.reason}`;
      setStalled({ file: event.payload.file_path, reason: event.payload.reason });
      if (stallSignatureRef.current !== signature) {
        setStallOverlayOpen(true);
        stallSignatureRef.current = signature;
      }
    });

    void register<string>("guardian:stall-released", () => {
      setStalled(null);
      setStallOverlayOpen(false);
      stallSignatureRef.current = null;
    });

    void register<{ tokens: number; calls: number; files?: number; queue_wait_ms?: number }>("guardian:usage", (event) => {
      setUsage((prev) => ({
        tokens: prev.tokens + event.payload.tokens,
        calls: prev.calls + event.payload.calls,
        files: prev.files + (event.payload.files ?? 0),
        queueWaitMs: event.payload.queue_wait_ms ?? prev.queueWaitMs,
      }));
    });

    void register<AiContextSnapshot>("guardian:ai-context", (event) => {
      setAiContext(event.payload);
      setAiContextError(null);
    });

    void register<FixProposalsSnapshot>("guardian:fix-proposals", (event) => {
      setFixProposals(event.payload);
      setFixProposalsError(null);
    });

    invoke("ping").catch((error) => {
      setLogs((prev) => ({
        ...prev,
        ["System:Backend"]: {
          file_path: "System",
          severity: "Warning",
          message: toFriendlySystemMessage(
            error instanceof Error ? error.message : String(error),
            "backend",
            t,
          ),
        },
      }));
    });

    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [
    setAiContext,
    setAiContextError,
    setFixProposals,
    setFixProposalsError,
    setLogs,
    setStalled,
    setStallOverlayOpen,
    setStatus,
    setUsage,
    stallSignatureRef,
    t,
  ]);
}
