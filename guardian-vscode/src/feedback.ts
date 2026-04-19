import type {
    CritiquesResult,
    NotificationPlan,
    ScanResult,
} from "./models";
import { GuardianParseError, GuardianTransportError } from "./resultParsers";

export const buildScanNotification = (
    relativePath: string,
    result: ScanResult
): NotificationPlan => {
    if (result.status === "ok") {
        if (result.critiqueCount === 0) {
            return {
                level: "info",
                message: `Guardian: ${relativePath} scanned successfully — no active critiques.`,
            };
        }

        return {
            level: "info",
            message: `Guardian: ${relativePath} scanned successfully — ${result.critiqueCount} active critique(s).`,
        };
    }

    return {
        level: result.status === "warning" ? "warning" : "error",
        message: `Guardian: ${result.message}`,
    };
};

export const buildCritiquesNotification = (
    result: CritiquesResult
): NotificationPlan => {
    if (result.status === "ok") {
        if (result.critiqueCount === 0) {
            const suffix = result.severityFilter
                ? ` for filter '${result.severityFilter}'`
                : "";
            return {
                level: "info",
                message: `Guardian: no active critiques found${suffix}.`,
            };
        }

        return {
            level: "info",
            message: `Guardian: loaded ${result.critiqueCount} active critique(s).`,
        };
    }

    return {
        level: result.status === "warning" ? "warning" : "error",
        message: `Guardian: ${result.message}`,
    };
};

export const describeClientError = (error: unknown): NotificationPlan => {
    if (error instanceof GuardianTransportError) {
        return {
            level: "error",
            message: `Guardian: could not communicate with guardian-mcp. ${error.message}`,
        };
    }

    if (error instanceof GuardianParseError) {
        return {
            level: "error",
            message: `Guardian: received an invalid response from guardian-mcp. ${error.message}`,
        };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
        level: "error",
        message: `Guardian: unexpected failure. ${message}`,
    };
};