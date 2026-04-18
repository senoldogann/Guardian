/** Toast notification system with global state */

import { useCallback } from "react";
import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number, action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message: string, type: ToastType, duration = 3000, action?: ToastAction) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration, action }],
    }));
  },
  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const { addToast, removeToast } = useToastStore();
  
  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration?: number, action?: ToastAction) => {
      addToast(message, type, duration, action);
    },
    [addToast]
  );
  
  const showSuccess = useCallback(
    (message: string, duration?: number, action?: ToastAction) => {
      addToast(message, "success", duration, action);
    },
    [addToast]
  );
  
  const showError = useCallback(
    (message: string, duration?: number, action?: ToastAction) => {
      addToast(message, "error", duration, action);
    },
    [addToast]
  );
  
  const showWarning = useCallback(
    (message: string, duration?: number, action?: ToastAction) => {
      addToast(message, "warning", duration, action);
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
