export interface ProjectContext {
  file_structure: string[];
  dependencies: string[];
  total_files: number;
  intent_summary: string;
}

export type GuardianEvent =
  | { type: "FileModified"; path: string }
  | { type: "RequestScan"; root: string }
  | { type: "AnalysisComplete"; file_path: string; result?: string | null }
  | { type: "RequestFix"; file_path: string; diff: string }
  | { type: "RequestReview"; file_path: string; diff: string }
  | { type: "ChatQuery"; context: string; query: string }
  | { type: "StallRequested"; file_path: string; reason: string }
  | { type: "StallReleased"; file_path: string }
  | { type: "Startup" }
  | { type: "Shutdown" };
