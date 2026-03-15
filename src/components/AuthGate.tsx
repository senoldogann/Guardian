import type { ReactElement } from "react";
import { Github } from "lucide-react";
import { openExternal } from "../lib/tauri";
import { useI18n } from "../i18n";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AuthGateProps {
  authDevice: DeviceCodeResponse | null;
  authLoading: boolean;
  authError: string | null;
  authWarning: string | null;
  authCountdown: number | null;
  authSession: {
    login: string;
    id: number;
    avatar_url?: string;
  } | null;
  isDesktop: boolean;
  showAuthGate: boolean;
  onStartLogin: () => void;
  onCompleteLogin: () => void;
  onCancel: () => void;
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "";
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function AuthGate({
  authDevice,
  authLoading,
  authError,
  authWarning,
  authCountdown,
  authSession,
  isDesktop,
  showAuthGate,
  onStartLogin,
  onCompleteLogin,
  onCancel,
}: AuthGateProps): ReactElement {
  const { t } = useI18n();

  return (
    <>
      {authDevice && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-lg w-[92%] bg-surface border border-border-main rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-muted mb-2">
              {t("authGate.deviceLoginTitle")}
            </h3>
            <p className="text-xs text-text-muted mb-4">
              {t("authGate.deviceLoginNote")}
            </p>
            <div className="flex items-center justify-between bg-background border border-border-main rounded-lg px-4 py-3 mb-4">
              <span className="text-lg font-black tracking-widest text-text-main">{authDevice.user_code}</span>
              <button
                onClick={() => openExternal(authDevice.verification_uri)}
                className="px-3 py-1 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] hover:opacity-90 text-background rounded-md transition-colors cursor-pointer"
              >
                {t("authGate.openGithub")}
              </button>
            </div>
            <div className="text-[10px] text-text-muted mb-4">
              {t("authGate.codeExpires", {
                time: formatCountdown(authCountdown ?? authDevice.expires_in),
              })}
            </div>
            <div className="flex gap-3">
              {!authSession && (
                <button
                  onClick={onCompleteLogin}
                  disabled={authLoading}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] hover:opacity-90 text-background rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? t("authGate.checking") : t("authGate.checkNow")}
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[var(--panel-muted)] hover:bg-[var(--panel-bg)] text-text-main rounded-md transition-colors cursor-pointer"
              >
                {t("authGate.cancel")}
              </button>
            </div>
            {authError && (
              <div className="mt-3 text-[10px] text-rose-400">
                {authError}
              </div>
            )}
            {authWarning && (
              <div className="mt-2 text-[10px] text-amber-400">
                {authWarning}
              </div>
            )}
          </div>
        </div>
      )}

      {showAuthGate && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md flex items-center justify-center">
          <div className="max-w-md w-[90%] bg-surface border border-border-main rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Github className="w-5 h-5 text-[var(--accent-500)]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-text-main">
                {t("authGate.signInTitle")}
              </h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              {t("authGate.signInNote")}
            </p>
            <button
              onClick={onStartLogin}
              disabled={authLoading || !isDesktop}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-widest bg-[var(--accent-500)] hover:opacity-90 text-background rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Github className="w-4 h-4" />
                {t("authGate.signInButton")}
              </span>
            </button>
            {authError && (
              <div className="mt-3 text-[10px] text-rose-400">{authError}</div>
            )}
            {!authError && authWarning && (
              <div className="mt-2 text-[10px] text-amber-400">{authWarning}</div>
            )}
            {!isDesktop && (
              <div className="mt-2 text-[10px] text-amber-400">
                {t("authGate.desktopRequired")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AuthGate;
