import type { ReactElement, ReactNode } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertCircle,
  Cpu,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "../i18n";

export interface HeaderProps {
  active: boolean;
  stats: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  usage: {
    tokens: number;
    calls: number;
  };
  authSession: {
    login: string;
    id: number;
    avatar_url?: string;
  } | null;
  isDesktop: boolean;
  authLoading: boolean;
  onLogout: () => void;
  onSettingsClick: () => void;
}

function StatPill({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone: "critical" | "warning" | "ai";
}): ReactElement {
  const toneStyles = {
    critical: "text-[color:var(--tone-critical-text)]",
    warning: "text-[color:var(--tone-warning-text)]",
    ai: "text-[color:var(--tone-ai-text)]",
  };

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
        toneStyles[tone],
      )}
    >
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[11px] opacity-60">{label}</span>
    </div>
  );
}

export function Header({
  active,
  stats,
  usage,
  authSession,
  isDesktop,
  authLoading,
  onLogout,
  onSettingsClick,
}: HeaderProps): ReactElement {
  const { t } = useI18n();
  return (
    <header className="guardian-topbar z-20 justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[var(--accent-500)] flex items-center justify-center">
          <ShieldCheck className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-text-main tracking-tight">
            Guardian
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              className={clsx(
                "inline-block h-1.5 w-1.5 rounded-full",
                active
                  ? "bg-[color:var(--tone-success-text)] shadow-[0_0_6px_var(--tone-success-text)]"
                  : "bg-text-muted opacity-50",
              )}
            />
            <span>{active ? t("header.monitoringOn") : t("header.monitoringOff")}</span>
          </div>
        </div>
      </div>

      {/* Stats + Controls */}
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-2">
          <StatPill
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            value={stats.critical}
            label={t("header.stats.critical")}
            tone="critical"
          />
          <StatPill
            icon={<Activity className="h-3.5 w-3.5" />}
            value={stats.warning}
            label={t("header.stats.warning")}
            tone="warning"
          />
          <StatPill
            icon={<Cpu className="h-3.5 w-3.5" />}
            value={usage.calls}
            label={t("header.stats.aiRequests")}
            tone="ai"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={onSettingsClick}
            className="guardian-focus-ring rounded-lg p-2 text-text-muted hover:text-text-main hover:bg-[var(--panel-muted)] transition-all cursor-pointer"
            title={t("header.settingsTitle")}
            aria-label={t("header.settingsTitle")}
          >
            <Settings className="h-4 w-4" />
          </button>

          {authSession && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-[var(--panel-muted)] border border-[color:var(--border-main)]/40">
              {authSession.avatar_url ? (
                <img
                  src={authSession.avatar_url}
                  alt={authSession.login}
                  className="h-6 w-6 rounded-full ring-1 ring-border-main"
                />
              ) : (
                <div className="h-6 w-6 rounded-full ring-1 ring-border-main bg-[var(--accent-200)]" />
              )}
              <span className="hidden md:block max-w-[120px] truncate text-xs font-medium text-text-main">
                @{authSession.login}
              </span>
              <button
                onClick={onLogout}
                disabled={authLoading || !isDesktop}
                className={clsx(
                  "guardian-focus-ring rounded-md p-1.5 text-text-muted hover:text-text-main transition-colors",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
                aria-label={t("header.logout")}
                title={t("header.logout")}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
