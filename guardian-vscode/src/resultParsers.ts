import type {
  Critique,
  CritiquesResult,
  ScanFileMetadata,
  ScanResult,
} from "./models";

type JsonRecord = Record<string, unknown>;

export class GuardianTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardianTransportError";
  }
}

export class GuardianParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardianParseError";
  }
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const expectRecord = (value: unknown, context: string): JsonRecord => {
  if (!isRecord(value)) {
    throw new GuardianParseError(`${context} must be an object.`);
  }
  return value;
};

const expectString = (
  record: JsonRecord,
  field: string,
  context: string
): string => {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GuardianParseError(`${context}.${field} must be a non-empty string.`);
  }
  return value;
};

const optionalString = (record: JsonRecord, field: string): string | undefined => {
  const value = record[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const optionalNumber = (record: JsonRecord, field: string): number | undefined => {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const optionalBoolean = (record: JsonRecord, field: string): boolean | undefined => {
  const value = record[field];
  return typeof value === "boolean" ? value : undefined;
};

const normalizeSeverity = (value: string): Critique["severity"] => {
  switch (value.trim().toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "warning":
    case "medium":
      return "medium";
    case "info":
    case "low":
    case "lgtm":
      return "low";
    default:
      throw new GuardianParseError(`Unsupported critique severity: ${value}`);
  }
};

const toPositiveInteger = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
};

const deriveCritiqueId = (record: JsonRecord, file: string, line: number, message: string): string => {
  const findingId = optionalString(record, "finding_id");
  if (findingId) {
    return findingId;
  }
  return `${file}:${line}:${message}`;
};

const parseCritique = (value: unknown): Critique => {
  const record = expectRecord(value, "critique");
  const file = expectString(record, "file_path", "critique");
  const message = expectString(record, "message", "critique");
  const severity = normalizeSeverity(expectString(record, "severity", "critique"));
  const line = toPositiveInteger(optionalNumber(record, "line_start"), 1);
  const endLine = toPositiveInteger(optionalNumber(record, "line_end"), line);
  const column = toPositiveInteger(optionalNumber(record, "column"), 1);
  const endColumn = toPositiveInteger(optionalNumber(record, "end_column"), column + 1);

  return {
    id: deriveCritiqueId(record, file, line, message),
    file,
    line,
    column,
    endLine,
    endColumn,
    severity,
    message,
    ruleId: optionalString(record, "category") ?? optionalString(record, "finding_id"),
    suggestion: optionalString(record, "suggestion"),
  };
};

const parseEnvelopePayload = (raw: unknown): JsonRecord => {
  if (isRecord(raw) && Array.isArray(raw.content)) {
    const entry = raw.content.find(
      (candidate) =>
        isRecord(candidate) &&
        candidate.type === "text" &&
        typeof candidate.text === "string"
    );

    if (!entry || typeof entry.text !== "string") {
      throw new GuardianParseError("MCP response did not include a text content payload.");
    }

    try {
      return expectRecord(JSON.parse(entry.text), "guardian tool payload");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GuardianParseError(`Failed to parse guardian tool payload JSON: ${message}`);
    }
  }

  return expectRecord(raw, "guardian tool payload");
};

const parseCritiques = (record: JsonRecord): Critique[] => {
  const rawCritiques = record.critiques;
  if (!Array.isArray(rawCritiques)) {
    throw new GuardianParseError("guardian tool payload.critiques must be an array.");
  }
  return rawCritiques.map((value) => parseCritique(value));
};

const parseBaseResult = (raw: unknown) => {
  const record = parseEnvelopePayload(raw);
  const rawStatus = expectString(record, "status", "guardian tool payload");
  let status: "ok" | "warning" | "error";
  if (rawStatus === "ok" || rawStatus === "warning" || rawStatus === "error") {
    status = rawStatus;
  } else {
    throw new GuardianParseError(`Unsupported guardian tool status: ${rawStatus}`);
  }

  const critiques = parseCritiques(record);
  return {
    record,
    status,
    kind: expectString(record, "kind", "guardian tool payload"),
    message: expectString(record, "message", "guardian tool payload"),
    critiques,
    critiqueCount:
      optionalNumber(record, "critique_count") ?? critiques.length,
    workspacePath: optionalString(record, "workspace_path"),
    snapshotPath: optionalString(record, "snapshot_path"),
  };
};

const parseFileMetadata = (value: unknown): ScanFileMetadata | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "guardian tool payload.file");
  return {
    path: expectString(record, "path", "guardian tool payload.file"),
    relativePath: optionalString(record, "relative_path"),
    fileSize: optionalNumber(record, "file_size"),
    lineCount: optionalNumber(record, "line_count"),
    language: optionalString(record, "language"),
    scanProfile: optionalString(record, "scan_profile"),
    isCandidate: optionalBoolean(record, "is_candidate"),
    skipReason: optionalString(record, "skip_reason"),
  };
};

export const parseScanToolResult = (raw: unknown): ScanResult => {
  const base = parseBaseResult(raw);
  return {
    status: base.status,
    kind: base.kind,
    message: base.message,
    critiques: base.critiques,
    critiqueCount: base.critiqueCount,
    workspacePath: base.workspacePath,
    snapshotPath: base.snapshotPath,
    file: parseFileMetadata(base.record.file),
  };
};

export const parseCritiquesToolResult = (raw: unknown): CritiquesResult => {
  const base = parseBaseResult(raw);
  return {
    status: base.status,
    kind: base.kind,
    message: base.message,
    critiques: base.critiques,
    critiqueCount: base.critiqueCount,
    workspacePath: base.workspacePath,
    snapshotPath: base.snapshotPath,
    severityFilter: optionalString(base.record, "severity_filter"),
  };
};