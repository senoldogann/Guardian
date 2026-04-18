import { describe, expect, it, vi, beforeEach } from "vitest";
import { exportAuditToPdf } from "../exportAuditPdf";
import type { Critique } from "../../types";

let lastDoc: any;

vi.mock("../tauri", () => ({
  isTauriRuntime: () => false,
}));

vi.mock("jspdf", () => {
  class JsPdfMock {
    text = vi.fn();
    setFontSize = vi.fn();
    line = vi.fn();
    addPage = vi.fn();
    save = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    setTextColor = vi.fn();

    constructor() {
      lastDoc = this;
    }
  }

  return { jsPDF: JsPdfMock };
});

describe("exportAuditToPdf", () => {
  beforeEach(() => {
    lastDoc = undefined;
    vi.clearAllMocks();
  });

  it("exports a PDF when there are no issues", async () => {
    const result = await exportAuditToPdf({ logs: {}, path: "/tmp" });

    expect(lastDoc).toBeDefined();
    expect(lastDoc.save).toHaveBeenCalledTimes(1);
    expect(lastDoc.text).toHaveBeenCalledWith(
      "No active security violations detected. System is SECURE.",
      20,
      expect.any(Number)
    );
    expect(result).toEqual({
      mode: "browser",
      savedPath: null,
      folderOpened: false,
    });
  });

  it("exports issue details with suggestions", async () => {
    const logs: Record<string, Critique> = {
      "/tmp/foo.ts": {
        file_path: "/tmp/foo.ts",
        severity: "Warning",
        message: "Missing validation",
        suggestion: "Add input checks",
      },
    };

    await exportAuditToPdf({ logs, path: "/tmp" });

    expect(lastDoc.text).toHaveBeenCalledWith(
      "1. [WARNING] foo.ts",
      20,
      expect.any(Number)
    );
    expect(lastDoc.splitTextToSize).toHaveBeenCalledWith(
      "Message: Missing validation",
      170
    );
    expect(lastDoc.splitTextToSize).toHaveBeenCalledWith(
      "Suggestion: Add input checks",
      170
    );
  });
});
