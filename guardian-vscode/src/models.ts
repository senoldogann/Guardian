export interface Critique {
  id: string;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  ruleId?: string;
  suggestion?: string;
}

export interface ScanFileMetadata {
  path: string;
  relativePath?: string;
  fileSize?: number;
  lineCount?: number;
  language?: string;
  scanProfile?: string;
  isCandidate?: boolean;
  skipReason?: string;
}

export interface GuardianToolResult {
  status: "ok" | "warning" | "error";
  kind: string;
  message: string;
  critiqueCount: number;
  critiques: Critique[];
  workspacePath?: string;
  snapshotPath?: string;
}

export interface ScanResult extends GuardianToolResult {
  file?: ScanFileMetadata;
}

export interface CritiquesResult extends GuardianToolResult {
  severityFilter?: string;
}

export interface NotificationPlan {
  level: "info" | "warning" | "error";
  message: string;
}