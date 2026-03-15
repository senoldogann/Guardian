import type { Critique } from "../types";

export function critiqueStateKey(critique: Critique): string {
  const finding = critique.finding_id?.trim();
  if (finding) return finding;
  return critique.file_path;
}

