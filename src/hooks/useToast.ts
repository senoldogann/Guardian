/** Toast notification system with global state */

import { useCallback } from "react";
import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message: string, type: ToastType, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const { addToast, removeToast } = useToastStore();
  
  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      addToast(message, type, duration);
    },
    [addToast]
  );
  
  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "success", duration);
    },
    [addToast]
  );
  
  const showError = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "error", duration);
    },
    [addToast]
  );
  
  const showWarning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "warning", duration);
    },
    [addToast]
  );
  
  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    removeToast,
  };
}

export default useToast;
