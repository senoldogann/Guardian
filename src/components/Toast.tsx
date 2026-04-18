/** Toast notification component */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToastStore, type ToastAction, type ToastType } from "../hooks/useToast";
import { Button } from "./ui/Button";

const icons: Record<ToastType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const unifiedStyle =
  "bg-[var(--accent-200)] text-[var(--accent-500)] border-[var(--accent-400)]";
const styles: Record<ToastType, string> = {
  info: unifiedStyle,
  success: unifiedStyle,
  warning: unifiedStyle,
  error: unifiedStyle,
};

function ToastItem({
  id,
  message,
  type,
  duration,
  action,
}: {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}): React.ReactElement {
  const { removeToast } = useToastStore();
  const Icon = icons[type];

  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, removeToast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${styles[type]}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <Button
          onClick={() => {
            try {
              action.onClick();
            } finally {
              removeToast(id);
            }
          }}
          variant="accent"
          size="sm"
          className="ml-1 bg-background/30 hover:bg-background/55 text-[var(--accent-500)] border-[var(--accent-400)]"
          title={action.label}
        >
          {action.label}
        </Button>
      )}
      <Button
        onClick={() => removeToast(id)}
        variant="ghost"
        size="icon"
        className="ml-2 h-8 w-8"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

export function ToastContainer(): React.ReactElement {
  const { toasts } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
