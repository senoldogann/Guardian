import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "../lib/tauri";
import type { Baseline, BaselineFinding, BaselineStatusView, Critique } from "../types";

export interface BaselineControllerState {
  baseline: Baseline | null;
  baselineStatus: BaselineStatusView | null;
  baselineLoading: boolean;
  baselineError: string | null;
  baselineView: "all" | "new" | "resolved";
  setBaselineView: (next: "all" | "new" | "resolved") => void;
  refreshBaseline: () => Promise<void>;
  setBaselineNow: () => Promise<void>;
  clearBaselineNow: () => Promise<void>;
  baselineValid: boolean;
  baselineIds: Set<string>;
  currentFindingIds: Set<string>;
  baselineMetrics: { active: number; new: number; resolved: number } | null;
  resolvedFindings: BaselineFinding[];
}

export function useBaselineController(
  path: string,
  visibleLogs: Critique[],
  filter: string,
): BaselineControllerState {
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [baselineStatus, setBaselineStatus] = useState<BaselineStatusView | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [baselineView, setBaselineView] = useState<"all" | "new" | "resolved">("all");

  const refreshBaseline = useCallback(async (): Promise<void> => {
    if (!path) {
      setBaseline(null);
      setBaselineStatus(null);
      setBaselineError(null);
      setBaselineView("all");
      return;
    }

    setBaselineLoading(true);
    setBaselineError(null);
    try {
      const baselineValue = await invoke<Baseline | null>("get_baseline", { root: path });
      setBaseline(baselineValue ?? null);

      const statusValue = await invoke<BaselineStatusView | null>("get_baseline_status", {
        root: path,
      });
      setBaselineStatus(statusValue ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseline(null);
      setBaselineStatus(null);
      setBaselineError(message);
      setBaselineView("all");
    } finally {
      setBaselineLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void refreshBaseline();
  }, [refreshBaseline]);

  const setBaselineNow = useCallback(async (): Promise<void> => {
    if (!path) return;
    setBaselineLoading(true);
    setBaselineError(null);
    try {
      await invoke<BaselineStatusView>("create_baseline", { root: path });
      await refreshBaseline();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaselineError(message);
    } finally {
      setBaselineLoading(false);
    }
  }, [path, refreshBaseline]);

  const clearBaselineNow = useCallback(async (): Promise<void> => {
    if (!path) return;
    setBaselineLoading(true);
    setBaselineError(null);
    try {
      await invoke("clear_baseline", { root: path });
      await refreshBaseline();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaselineError(message);
    } finally {
      setBaselineLoading(false);
    }
  }, [path, refreshBaseline]);

  const baselineValid = Boolean(baselineStatus?.valid);
  const baselineIds = useMemo(() => new Set(baseline?.finding_ids ?? []), [baseline]);
  const currentFindingIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of visibleLogs) {
      if (entry.finding_id) set.add(entry.finding_id);
    }
    return set;
  }, [visibleLogs]);

  const baselineMetrics = useMemo(() => {
    if (!baseline || !baselineValid) return null;
    let activeCount = 0;
    let newCount = 0;
    for (const id of currentFindingIds) {
      if (baselineIds.has(id)) activeCount += 1;
      else newCount += 1;
    }
    let resolvedCount = 0;
    for (const id of baselineIds) {
      if (!currentFindingIds.has(id)) resolvedCount += 1;
    }
    return { active: activeCount, new: newCount, resolved: resolvedCount };
  }, [baseline, baselineValid, baselineIds, currentFindingIds]);

  const resolvedFindings = useMemo((): BaselineFinding[] => {
    if (!baseline || !baselineValid) return [];
    const findings = baseline.findings ?? [];
    const entries = findings.filter((finding) => !currentFindingIds.has(finding.finding_id));
    if (!filter) {
      return entries.sort((a, b) => a.file_path.localeCompare(b.file_path));
    }
    const q = filter.toLowerCase();
    return entries
      .filter(
        (finding) =>
          finding.file_path.toLowerCase().includes(q) ||
          (finding.message ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.file_path.localeCompare(b.file_path));
  }, [baseline, baselineValid, currentFindingIds, filter]);

  return {
    baseline,
    baselineStatus,
    baselineLoading,
    baselineError,
    baselineView,
    setBaselineView,
    refreshBaseline,
    setBaselineNow,
    clearBaselineNow,
    baselineValid,
    baselineIds,
    currentFindingIds,
    baselineMetrics,
    resolvedFindings,
  };
}
