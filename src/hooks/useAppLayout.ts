import { useState, useEffect, useCallback, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useToast } from "./useToast";
import { useI18n } from "../i18n";
import { STORAGE_KEYS } from "../constants";
import type { Critique } from "../types";
import type { AutoPrompt } from "../components/ChatView";

// ── Helpers ────────────────────────────────────────────────────

function parseBooleanStorage(raw: string): boolean {
  const lowered = raw.trim().toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : false;
  } catch {
    return false;
  }
}

type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext };

// ── Types ──────────────────────────────────────────────────────

export interface UseAppLayoutReturn {
  view: "monitor" | "chat" | "diagram" | "ai-context" | "reviews";
  setView: (v: "monitor" | "chat" | "diagram" | "ai-context" | "reviews") => void;
  showOnboarding: boolean;
  setOnboardingCompleted: (val: boolean) => void;
  pendingGuruPrompt: AutoPrompt | null;
  setPendingGuruPrompt: (prompt: AutoPrompt | null) => void;
  guruUnreadCount: number;
  openGuruForStall: () => void;
  askGuruForLog: (log: Critique, useWebSearch?: boolean) => void;
  handleGuruReply: () => void;
  consumeAutoPrompt: () => void;
}

// ── Hook ───────────────────────────────────────────────────────

export function useAppLayout(
  stalled: { file: string; reason: string } | null,
  guruReplySoundEnabled: boolean,
): UseAppLayoutReturn {
  const { t } = useI18n();
  const toast = useToast();

  // Onboarding
  const [onboardingCompleted, setOnboardingCompleted, onboardingHydrated] =
    useLocalStorage<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED, false, {
      deserialize: parseBooleanStorage,
    });
  const showOnboarding = onboardingHydrated && !onboardingCompleted;

  // View navigation
  const [view, setView] = useState<
    "monitor" | "chat" | "diagram" | "ai-context" | "reviews"
  >("monitor");
  const viewRef = useRef(view);

  // Guru
  const [pendingGuruPrompt, setPendingGuruPrompt] = useState<AutoPrompt | null>(null);
  const [guruUnreadCount, setGuruUnreadCount] = useState(0);
  const guruReplyAudioRef = useRef<AudioContext | null>(null);

  // Keep viewRef in sync
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Reset guru unread when switching to chat
  useEffect(() => {
    if (view === "chat") {
      setGuruUnreadCount(0);
    }
  }, [view]);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      const ctx = guruReplyAudioRef.current;
      if (!ctx) return;
      void ctx.close().catch(() => {});
      guruReplyAudioRef.current = null;
    };
  }, []);

  const playGuruReplyChime = useCallback((): void => {
    if (typeof window === "undefined") return;
    try {
      const audioCtor =
        window.AudioContext || (window as WindowWithLegacyAudio).webkitAudioContext;
      if (!audioCtor) return;
      const context = guruReplyAudioRef.current ?? new audioCtor();
      guruReplyAudioRef.current = context;

      const schedule = (): void => {
        const start = context.currentTime;

        const masterGain = context.createGain();
        masterGain.gain.setValueAtTime(0.0001, start);
        masterGain.gain.exponentialRampToValueAtTime(0.13, start + 0.02);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        masterGain.connect(context.destination);

        const playTone = (frequency: number, offset: number, duration: number): void => {
          const toneStart = start + offset;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, toneStart);
          gain.gain.setValueAtTime(0.0001, toneStart);
          gain.gain.exponentialRampToValueAtTime(0.15, toneStart + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
          oscillator.connect(gain);
          gain.connect(masterGain);
          oscillator.start(toneStart);
          oscillator.stop(toneStart + duration + 0.02);
        };

        playTone(900, 0, 0.18);
        playTone(1320, 0.12, 0.2);
      };

      if (context.state === "suspended") {
        void context
          .resume()
          .then(schedule)
          .catch((e) => console.warn("Audio context:", e));
        return;
      }
      schedule();
    } catch {
      // Ignore audio availability/runtime issues.
    }
  }, []);

  const openGuruForStall = useCallback((): void => {
    const prompt = stalled
      ? `Critical violation detected in ${stalled.file}.\nReason: ${stalled.reason}.\n\nPlease propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).`
      : "We are stalled by a critical violation. Please propose a safe fix with the FULL updated file content only (no diff markers, no markdown).";
    setPendingGuruPrompt({ id: `${Date.now()}-${Math.random()}`, prompt, useWebSearch: false });
    setView("chat");
  }, [stalled]);

  const askGuruForLog = useCallback((log: Critique, useWebSearch = false): void => {
    const severity = log.severity.toUpperCase();
    const prompt = `Investigate this ${severity} issue and propose a safe fix with a clear explanation and the FULL updated file content only (no diff markers, no markdown).\n\nFile: ${log.file_path}\nReason: ${log.message}`;
    setPendingGuruPrompt({ id: `${Date.now()}-${Math.random()}`, prompt, useWebSearch });
    setView("chat");
  }, []);

  const handleGuruReply = useCallback((): void => {
    if (viewRef.current === "chat") return;
    setGuruUnreadCount((prev) => Math.min(prev + 1, 99));
    toast.showToast(t("app.guruReplyReady"), "info", 3500);
    if (guruReplySoundEnabled) {
      playGuruReplyChime();
    }
  }, [playGuruReplyChime, guruReplySoundEnabled, t, toast]);

  const consumeAutoPrompt = useCallback((): void => {
    setPendingGuruPrompt(null);
  }, []);

  return {
    view,
    setView,
    showOnboarding,
    setOnboardingCompleted,
    pendingGuruPrompt,
    setPendingGuruPrompt,
    guruUnreadCount,
    openGuruForStall,
    askGuruForLog,
    handleGuruReply,
    consumeAutoPrompt,
  };
}
