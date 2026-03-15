import type { ReactElement, ReactNode } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertCircle,
  Cpu,
  LogOut,
  Settings,
  ShieldAlert,
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
  const toneClass =
    tone === "critical"
      ? "text-[color:var(--tone-critical-text)]"
      : tone === "warning"
        ? "text-[color:var(--tone-warning-text)]"
        : "text-[color:var(--tone-ai-text)]";

  return (
    <div className={clsx("min-w-[104px] flex items-center gap-2.5 transition-colors", toneClass)}>
      <div className="shrink-0 opacity-90">{icon}</div>
      <div className="leading-none min-w-0">
        <div className="text-sm font-black tabular-nums">{value}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] opacity-85">{label}</div>
      </div>
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
      <div className="flex min-w-0 items-center gap-3">
        <div className="guardian-elevated-card h-10 w-10 rounded-xl flex items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-[var(--accent-500)]" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-text-main">
            Guardian
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <Activity
              className={clsx(
                "h-3 w-3",
                active ? "text-[color:var(--tone-success-text)]" : "text-text-muted",
              )}
            />
            <span>
              {active ? t("header.monitoringOn") : t("header.monitoringOff")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden xl:flex items-center gap-4 pr-1">
          <StatPill
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            value={stats.critical}
            label={t("header.stats.critical")}
            tone="critical"
          />
          <StatPill
            icon={<AlertCircle className="h-3.5 w-3.5" />}
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
        <button
          onClick={onSettingsClick}
          className="guardian-elevated-card guardian-focus-ring rounded-xl p-2 text-text-muted hover:text-text-main transition-colors cursor-pointer"
          title={t("header.settingsTitle")}
          aria-label={t("header.settingsTitle")}
        >
          <Settings className="h-4 w-4" />
        </button>

        {authSession && (
          <div className="guardian-elevated-card flex items-center gap-2 rounded-xl px-2.5 py-1.5">
            {authSession.avatar_url ? (
              <img
                src={authSession.avatar_url}
                alt={authSession.login}
                className="h-7 w-7 rounded-full border border-border-main"
              />
            ) : (
              <div className="h-7 w-7 rounded-full border border-border-main bg-background/40" />
            )}
            <div className="hidden md:block leading-tight">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                {t("header.session")}
              </div>
              <div className="max-w-[140px] truncate text-xs font-bold text-text-main">
                @{authSession.login}
              </div>
            </div>
            <button
              onClick={onLogout}
              disabled={authLoading || !isDesktop}
              className={clsx(
                "guardian-focus-ring rounded-lg border px-2 py-1 text-[9px]",
                "font-bold uppercase tracking-[0.18em] transition-colors",
                "border-border-main bg-background/60 text-text-main hover:bg-background/80",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label={t("header.logout")}
            >
              <span className="hidden sm:inline">{t("header.logout")}</span>
              <LogOut className="h-3.5 w-3.5 sm:hidden" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
