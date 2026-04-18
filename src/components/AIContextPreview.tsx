import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, EyeOff, FileText, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import type { AiContextSnapshot } from "../types";
import { basenameOf, copyToClipboard, formatTimestamp } from "../lib/uiFormat";
import { useToast } from "../hooks/useToast";
import { useI18n } from "../i18n";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";

export interface AIContextPreviewProps {
  context: AiContextSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

type ContextFileFilter = "all" | "redacted" | "truncated";

export function AIContextPreview({
  context,
  loading = false,
  error = null,
  onRefresh,
}: AIContextPreviewProps): ReactElement {
  const toast = useToast();
  const { t } = useI18n();
  const files = useMemo(() => context?.files ?? [], [context]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContextFileFilter>("all");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const redactedCount = useMemo(() => files.filter((f) => f.redacted).length, [files]);
  const truncatedCount = useMemo(() => files.filter((f) => f.truncated).length, [files]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => {
        if (filter === "redacted") return f.redacted;
        if (filter === "truncated") return f.truncated;
        return true;
      })
      .filter((f) => {
        if (!q) return true;
        return f.file_path.toLowerCase().includes(q) || basenameOf(f.file_path).toLowerCase().includes(q);
      })
      .sort((a, b) => a.file_path.localeCompare(b.file_path));
  }, [files, query, filter]);

  useEffect(() => {
    if (filteredFiles.length === 0) {
      setSelectedFilePath(null);
      return;
    }
    if (!selectedFilePath) {
      setSelectedFilePath(filteredFiles[0].file_path);
      return;
    }
    const stillExists = filteredFiles.some((f) => f.file_path === selectedFilePath);
    if (!stillExists) {
      setSelectedFilePath(filteredFiles[0].file_path);
    }
  }, [filteredFiles, selectedFilePath]);

  const selectedFile = useMemo(
    () => filteredFiles.find((f) => f.file_path === selectedFilePath) ?? null,
    [filteredFiles, selectedFilePath]
  );

  const fullPayload = useMemo(() => {
    if (!context) return "";
    return JSON.stringify(context, null, 2);
  }, [context]);

  const onCopyFileContext = useCallback(async (): Promise<void> => {
    if (!selectedFile) return;
    try {
      await copyToClipboard(selectedFile.content);
      toast.showSuccess(t("toast.copied"), 2500);
    } catch {
      toast.showError(t("toast.copyFailed"), 3000);
    }
  }, [selectedFile, toast, t]);

  const onCopyFullPayload = useCallback(async (): Promise<void> => {
    if (!fullPayload) return;
    try {
      await copyToClipboard(fullPayload);
      toast.showSuccess(t("toast.copied"), 2500);
    } catch {
      toast.showError(t("toast.copyFailed"), 3000);
    }
  }, [fullPayload, toast, t]);

  const onRefreshClick = useCallback(async (): Promise<void> => {
    if (!onRefresh) return;
    try {
      await Promise.resolve(onRefresh());
      toast.showSuccess(t("toast.refreshed"), 2500);
    } catch {
      toast.showError(t("toast.refreshFailed"), 3000);
    }
  }, [onRefresh, toast, t]);

  if (!context && !loading && !error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4 py-12">
        <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
          <EyeOff className="w-7 h-7 text-text-muted/80" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-text-muted">{t("aiContext.noCapturedTitle")}</h3>
          <p className="text-xs text-text-muted font-mono italic">
            {t("aiContext.noCapturedNote")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-border-main bg-surface/20">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xs font-medium text-text-muted">
            {t("aiContext.title")}
          </h2>
          {context && (
            <div className="text-xs font-mono text-text-muted space-y-0.5">
              <div className="truncate">
                {t("aiContext.provider")}:{" "}
                <span className="text-[var(--text-main)]">{context.provider_id}</span>{" "}
                | {t("aiContext.model")}:{" "}
                <span className="text-[var(--text-main)]">{context.model}</span>
              </div>
              <div className="truncate">
                {t("aiContext.timestamp")}:{" "}
                <span className="text-[var(--text-main)]">{formatTimestamp(context.timestamp)}</span>
              </div>
              <div>
                {t("aiContext.files")}:{" "}
                <span className="text-[var(--text-main)]">{files.length}</span> | {t("aiContext.tokensEst")}:
                {" "}
                <span className="text-[var(--text-main)]">{context.tokens_in}</span>
              </div>
            </div>
          )}
          {error && (
            <div className="text-xs text-rose-400 font-mono">
              {error}
            </div>
          )}
        </div>

        {onRefresh && (
          <Button
            onClick={() => void onRefreshClick()}
            disabled={loading}
            variant="secondary"
            size="md"
            className="bg-background/60"
            title={t("aiContext.refreshTitle")}
            leadingIcon={<RefreshCw className={clsx("w-3 h-3", loading && "animate-spin")} />}
          >
            {t("common.refresh")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col px-6 py-4 gap-3">
          {(redactedCount > 0 || truncatedCount > 0) && (
            <Panel surface="subtle" padding="sm" rounded="xl" className="flex items-start gap-3 text-xs font-mono text-text-muted">
              <div className="shrink-0 mt-0.5">
                <EyeOff className="w-4 h-4 text-[var(--accent-500)]" />
              </div>
              <div className="min-w-0">
                <div className="text-text-main">
                  {t("aiContext.redactionTitle")}{" "}
                  <span className="text-text-muted">
                    {t("aiContext.redactionContext", { redacted: redactedCount, truncated: truncatedCount })}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-relaxed">
                  {t("aiContext.redactionNote")}
                </div>
              </div>
            </Panel>
          )}

          <div className="flex-1 min-h-0 rounded-2xl border border-border-main bg-background/30 overflow-hidden flex">
            <div className="w-[320px] shrink-0 border-r border-border-main bg-background/20 flex flex-col">
              <div className="p-3 border-b border-border-main space-y-2">
                <div className="group relative flex items-center gap-2 rounded-xl border border-border-main bg-background/60 px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-text-muted group-focus-within:text-text-main transition-colors" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("aiContext.searchFilesPlaceholder")}
                    className="guardian-focus-ring w-full bg-transparent text-xs outline-none placeholder:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {(["all", "redacted", "truncated"] as const).map((key) => {
                    const active = filter === key;
                    const label =
                      key === "all"
                        ? t("aiContext.filterAll")
                        : key === "redacted"
                          ? `${t("aiContext.filterRedacted")} ${redactedCount}`
                          : `${t("aiContext.filterTruncated")} ${truncatedCount}`;
                    return (
                      <Button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        variant={active ? "accent" : "secondary"}
                        size="sm"
                        className={active ? "bg-surface/40 text-text-main border-border-main" : "bg-background/60"}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {filteredFiles.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-mono text-text-muted italic">
                    {t("aiContext.noFilesMatch")}
                  </div>
                ) : (
                  filteredFiles.map((file) => {
                    const selected = file.file_path === selectedFilePath;
                    return (
                      <button
                        key={file.file_path}
                        type="button"
                        onClick={() => setSelectedFilePath(file.file_path)}
                        className={clsx(
                          "guardian-focus-ring w-full text-left rounded-xl border px-3 py-2 transition-colors",
                          selected
                            ? "bg-surface/30 border-border-main shadow-sm"
                            : "bg-background/40 border-border-main hover:bg-surface/20"
                        )}
                        aria-selected={selected}
                        title={file.file_path}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{basenameOf(file.file_path)}</div>
                            <div className="text-xs font-mono text-text-muted truncate">
                              {file.file_path}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <div className="text-xs font-mono text-text-muted tabular-nums">
                              {file.token_estimate}
                            </div>
                            <div className="flex items-center gap-1">
                              {file.redacted && (
                                <Badge variant="warning" size="sm">
                                  R
                                </Badge>
                              )}
                              {file.truncated && (
                                <Badge variant="neutral" size="sm">
                                  T
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              {!selectedFile ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm px-6">
                  <div className="w-16 h-16 rounded-2xl border border-border-main bg-background/40 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-text-muted/80" />
                  </div>
                  <div className="text-xs ">{t("aiContext.selectFileTitle")}</div>
                  <div className="text-xs text-text-muted max-w-md text-center">
                    {t("aiContext.selectFileNote")}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                  <div className="max-w-5xl mx-auto space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate" title={selectedFile.file_path}>
                          {selectedFile.file_path}
                        </div>
                        <div className="text-xs font-mono text-text-muted">
                          {t("aiContext.tokensEst")}: {selectedFile.token_estimate}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={onCopyFileContext}
                          variant="secondary"
                          size="md"
                          className="bg-background/60"
                          title={t("aiContext.copyFileContextTitle")}
                          leadingIcon={<Copy className="w-3 h-3" />}
                        >
                          {t("aiContext.copyFileContext")}
                        </Button>
                        <Button
                          type="button"
                          onClick={onCopyFullPayload}
                          variant="secondary"
                          size="md"
                          className="bg-background/60"
                          title={t("aiContext.copyFullPayloadTitle")}
                          leadingIcon={<Copy className="w-3 h-3" />}
                        >
                          {t("aiContext.copyFullPayload")}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedFile.redacted && (
                        <Badge variant="warning" size="md">
                          {t("aiContext.badgeRedacted")}
                        </Badge>
                      )}
                      {selectedFile.truncated && (
                        <Badge variant="neutral" size="md">
                          {t("aiContext.badgeTruncated")}
                        </Badge>
                      )}
                    </div>

                    <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-[var(--text-main)] bg-background/60 border border-border-main rounded-lg p-3 overflow-x-auto custom-scrollbar">
                      {selectedFile.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
