import React, { type ReactElement, ReactNode, useMemo } from "react";
import clsx from "clsx";
import { Shield, ShieldAlert, AlertCircle, Cpu, Settings } from "lucide-react";
import { useI18n } from "../i18n";

export interface StatMiniProps {
  icon: ReactNode;
  count: number;
  label: string;
  color: string;
}

export function StatMini({ icon, count, label, color }: StatMiniProps): ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 border-r border-white/5 last:border-r-0 hover:bg-white/[0.02] transition-colors rounded-md h-8 group cursor-default">
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <div className="flex flex-col -space-y-1">
        <span className={clsx("text-sm font-black tabular-nums", color)}>{count}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">{label}</span>
      </div>
    </div>
  );
}

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

// Memoized icon components to prevent unnecessary re-renders
const ShieldAlertIcon = React.memo(() => <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />);
const AlertCircleIcon = React.memo(() => <AlertCircle className="w-3.5 h-3.5 text-amber-400" />);
const CpuIcon = React.memo(() => <Cpu className="w-3.5 h-3.5 text-[var(--accent-500)]" />);

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
  // Memoize stat icons to prevent inline object recreation
  const criticalIcon = useMemo(() => <ShieldAlertIcon />, []);
  const warningIcon = useMemo(() => <AlertCircleIcon />, []);
  const cpuIcon = useMemo(() => <CpuIcon />, []);

  return (
    <header className="guardian-topbar justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        <div className={clsx(
          "p-1.5 rounded-lg transition-all duration-500",
          active ? "bg-surface dark:bg-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "bg-surface dark:bg-border-main"
        )}>
          <Shield className={clsx("w-5 h-5", active ? "text-zinc-900" : "opacity-30")} />
        </div>
        <span className="text-base font-bold tracking-tight uppercase opacity-50">GUARDIAN</span>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all cursor-pointer"
          title={t("header.settingsTitle")}
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="flex gap-4 border-r border-border-main pr-6 hide-mobile">
          <StatMini icon={criticalIcon} count={stats.critical} label={t("header.stats.critical")} color="text-rose-400" />
          <StatMini icon={warningIcon} count={stats.warning} label={t("header.stats.warning")} color="text-amber-400" />
          <StatMini icon={cpuIcon} count={usage.calls} label={t("header.stats.aiRequests")} color="text-[var(--accent-500)]" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {authSession && (
            <>
              <div className="flex items-center gap-2 text-[10px] font-mono text-text-main/80">
                {authSession.avatar_url ? (
                  <img src={authSession.avatar_url} alt={authSession.login} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10" />
                )}
                <span>@{authSession.login}</span>
              </div>
              <button
                onClick={onLogout}
                disabled={authLoading || !isDesktop}
                className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--surface)] border border-border-main hover:bg-border-main text-text-main"
              >
                {t("header.logout")}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
