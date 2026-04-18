import type { ReactElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../../i18n";
import type { UpdateCheckResult } from "../../types";
import { Button } from "../ui/Button";

function normalizeVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim() ?? "";
  if (!trimmed) return "Unknown";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export interface UpdateBannerProps {
  updateInfo: UpdateCheckResult | null;
  updateDismissed: boolean;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateError: string | null;
  onDismiss: () => void;
  onInstall: () => void;
}

export function UpdateBanner({
  updateInfo,
  updateDismissed,
  updateChecking,
  updateInstalling,
  updateError,
  onDismiss,
  onInstall,
}: UpdateBannerProps): ReactElement {
  const { t } = useI18n();

  return (
    <>
      <AnimatePresence>
        {updateInfo?.status === "available" && !updateDismissed && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-2 pr-2 rounded-full border border-border-main bg-surface/95 backdrop-blur-md shadow-xl shadow-black/10 text-text-main"
          >
            <div className="flex flex-col pl-2">
              <span className="text-xs font-bold text-[var(--accent-500)]">
                {t("app.updateAvailable")}
              </span>
              <span className="text-xs font-medium opacity-80 text-text-main">
                {t("app.updateReady", {
                  version: normalizeVersionLabel(updateInfo.latest_version),
                })}
              </span>
            </div>

            <div className="h-6 w-px bg-border-main mx-1" />

            <div className="flex items-center gap-1">
              <Button
                onClick={onDismiss}
                variant="ghost"
                size="sm"
                className="rounded-full"
              >
                {t("app.later")}
              </Button>
              <Button
                onClick={onInstall}
                disabled={updateInstalling}
                variant="primary"
                size="sm"
                className="rounded-full shadow-lg shadow-black/20"
              >
                {updateInstalling ? t("app.updating") : t("app.updateNow")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {updateChecking && !updateInfo && !updateDismissed && (
        <div className="px-6 py-1 text-xs text-text-muted flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-border-main animate-pulse" />
          {t("app.checkingUpdates")}
        </div>
      )}

      {updateError && !updateDismissed && (
        <div className="px-6 py-1 text-xs text-[color:var(--tone-critical-text)] bg-transparent">
          {updateError}
        </div>
      )}
    </>
  );
}
