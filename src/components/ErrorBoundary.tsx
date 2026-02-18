/** Error Boundary component for catching React errors */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { reportError } from "../lib/error";
import { STORAGE_KEYS } from "../constants";
import { createTranslator, type AppLocale } from "../i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem(STORAGE_KEYS.LANGUAGE);
  if (!raw) return "en";
  try {
    const parsed = JSON.parse(raw);
    if (parsed === "en" || parsed === "tr") return parsed;
  } catch {
    // Ignore and fall through.
  }
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  return trimmed === "tr" ? "tr" : "en";
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError({
      type: "REACT_ERROR",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = createTranslator(readLocale());
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-surface border border-border-main rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-rose-500/10 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-text-main">{t("errorBoundary.title")}</h2>
              <p className="text-sm text-text-muted">
                {this.state.error?.message || t("errorBoundary.fallback")}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-500)] text-background rounded-lg font-bold text-sm hover:opacity-90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t("errorBoundary.tryAgain")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
