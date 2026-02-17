import type { Critique } from "../components/CritiqueAccordionRow";
import { isTauriRuntime } from "./tauri";

type ExportAuditPdfOptions = {
  logs: Record<string, Critique>;
  path: string;
};

export type ExportAuditPdfResult = {
  mode: "tauri" | "browser";
  savedPath: string | null;
  folderOpened: boolean;
};

export const exportAuditToPdf = async ({
  logs,
  path,
}: ExportAuditPdfOptions): Promise<ExportAuditPdfResult> => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.text("GUARDIAN: Security Audit Report", 20, 20);
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`Scope: ${path}`, 20, 38);
  doc.line(20, 42, 190, 42);

  let y = 55;
  const issueArray = Object.values(logs);

  if (issueArray.length === 0) {
    doc.text("No active security violations detected. System is SECURE.", 20, y);
  } else {
    issueArray.forEach((issue, index) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      if (issue.severity === "Critical") {
        doc.setTextColor(200, 0, 0);
      } else if (issue.severity === "Warning") {
        doc.setTextColor(218, 165, 32);
      } else {
        doc.setTextColor(0, 0, 0);
      }
      doc.text(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.file_path.split("/").pop()}`, 20, y);

      doc.setFontSize(10);
      doc.setTextColor(100);
      y += 7;
      const splitMsg = doc.splitTextToSize(`Message: ${issue.message}`, 170);
      doc.text(splitMsg, 20, y);
      y += (splitMsg.length * 5) + 4;

      if (issue.suggestion) {
        doc.setTextColor(0, 100, 0);
        const splitSugg = doc.splitTextToSize(`Suggestion: ${issue.suggestion}`, 170);
        doc.text(splitSugg, 20, y);
        y += (splitSugg.length * 5) + 10;
      }
    });
  }

  const fileName = `Guardian_Audit_${Date.now()}.pdf`;

  if (isTauriRuntime()) {
    const [{ downloadDir, join, BaseDirectory }, { writeFile }, { revealItemInDir, openPath }] =
      await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/plugin-fs"),
      import("@tauri-apps/plugin-opener"),
    ]);

    const downloadsPath = await downloadDir();
    const filePath = await join(downloadsPath, fileName);
    const pdfData = new Uint8Array(doc.output("arraybuffer"));

    try {
      await writeFile(fileName, pdfData, { baseDir: BaseDirectory.Download });
    } catch {
      // Fallback for environments that still rely on absolute-path writes.
      await writeFile(filePath, pdfData);
    }

    let folderOpened = false;
    try {
      await revealItemInDir(filePath);
      folderOpened = true;
    } catch {
      try {
        await openPath(downloadsPath);
        folderOpened = true;
      } catch {
        folderOpened = false;
      }
    }

    return {
      mode: "tauri",
      savedPath: filePath,
      folderOpened,
    };
  }

  doc.save(fileName);
  return {
    mode: "browser",
    savedPath: null,
    folderOpened: false,
  };
};
