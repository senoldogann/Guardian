import { useRef, type ReactElement } from "react";
import { Github } from "lucide-react";
import { openExternal } from "../lib/tauri";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useI18n } from "../i18n";
import { Button } from "./ui/Button";
import { DialogShell } from "./ui/DialogShell";
import { Panel } from "./ui/Panel";

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
  const authDeviceModalRef = useRef<HTMLDivElement | null>(null);
  const authGateModalRef = useRef<HTMLDivElement | null>(null);
  const authDeviceActionRef = useRef<HTMLButtonElement | null>(null);
  const authSignInActionRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: Boolean(authDevice),
    containerRef: authDeviceModalRef,
    onEscape: onCancel,
    initialFocusRef: authSession ? undefined : authDeviceActionRef,
  });

  useFocusTrap({
    active: showAuthGate,
    containerRef: authGateModalRef,
    onEscape: onCancel,
    initialFocusRef: authSignInActionRef,
  });

  return (
    <>
      {authDevice && (
        <DialogShell
          open={Boolean(authDevice)}
          onClose={onCancel}
          title={t("authGate.deviceLoginTitle")}
          description={t("authGate.deviceLoginNote")}
          panelClassName="max-w-lg w-[92%]"
          contentClassName="pt-4"
        >
          <div ref={authDeviceModalRef} className="space-y-4">
            <Panel
              surface="background"
              padding="md"
              rounded="xl"
              className="flex items-center justify-between gap-4"
            >
              <span className="text-lg font-black tracking-widest text-text-main">{authDevice.user_code}</span>
              <Button
                onClick={() => openExternal(authDevice.verification_uri)}
                variant="primary"
                size="sm"
              >
                {t("authGate.openGithub")}
              </Button>
            </Panel>
            <div className="text-xs text-text-muted">
              {t("authGate.codeExpires", {
                time: formatCountdown(authCountdown ?? authDevice.expires_in),
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              {!authSession && (
                <Button
                  onClick={onCompleteLogin}
                  disabled={authLoading}
                  variant="primary"
                  size="md"
                  ref={authDeviceActionRef}
                >
                  {authLoading ? t("authGate.checking") : t("authGate.checkNow")}
                </Button>
              )}
              <Button onClick={onCancel} variant="secondary" size="md">
                {t("authGate.cancel")}
              </Button>
            </div>
            {authError && (
              <div className="text-xs text-rose-400">
                {authError}
              </div>
            )}
            {authWarning && (
              <div className="text-xs text-amber-400">
                {authWarning}
              </div>
            )}
          </div>
        </DialogShell>
      )}

      {showAuthGate && (
        <DialogShell
          open={showAuthGate}
          dismissOnBackdrop={false}
          showCloseButton={false}
          title={t("authGate.signInTitle")}
          description={t("authGate.signInNote")}
          panelClassName="max-w-md w-[90%]"
          contentClassName="pt-4"
        >
          <div ref={authGateModalRef} className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-200)]">
                <Github className="w-5 h-5 text-[var(--accent-500)]" />
              </div>
            </div>
            <Button
              onClick={onStartLogin}
              disabled={authLoading || !isDesktop}
              variant="primary"
              size="md"
              fullWidth
              leadingIcon={<Github className="w-4 h-4" />}
              ref={authSignInActionRef}
            >
              {t("authGate.signInButton")}
            </Button>
            {authError && (
              <div className="text-xs text-rose-400">{authError}</div>
            )}
            {!authError && authWarning && (
              <div className="text-xs text-amber-400">{authWarning}</div>
            )}
            {!isDesktop && (
              <div className="text-xs text-amber-400">
                {t("authGate.desktopRequired")}
              </div>
            )}
          </div>
        </DialogShell>
      )}
    </>
  );
}

export default AuthGate;
