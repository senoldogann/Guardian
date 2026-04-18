import * as vscode from "vscode";
import type { Critique } from "./guardianClient";

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
};

export class GuardianDiagnosticProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection =
      vscode.languages.createDiagnosticCollection("guardian");
  }

  /** Update diagnostics for a single file. */
  update(uri: vscode.Uri, critiques: Critique[]): void {
    const diagnostics = critiques.map((c) => this.toDiagnostic(c));
    this.collection.set(uri, diagnostics);
  }

  /** Replace all diagnostics across all files. */
  updateAll(critiques: Critique[]): void {
    this.collection.clear();

    const byFile = new Map<string, Critique[]>();
    for (const c of critiques) {
      const existing = byFile.get(c.file) ?? [];
      existing.push(c);
      byFile.set(c.file, existing);
    }

    for (const [file, fileCritiques] of byFile) {
      const uri = vscode.Uri.file(file);
      const diagnostics = fileCritiques.map((c) => this.toDiagnostic(c));
      this.collection.set(uri, diagnostics);
    }
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }

  private toDiagnostic(critique: Critique): vscode.Diagnostic {
    const startLine = Math.max(0, (critique.line ?? 1) - 1);
    const startCol = Math.max(0, (critique.column ?? 1) - 1);
    const endLine = critique.endLine
      ? Math.max(0, critique.endLine - 1)
      : startLine;
    const endCol = critique.endColumn
      ? Math.max(0, critique.endColumn - 1)
      : startCol + 1;

    const range = new vscode.Range(startLine, startCol, endLine, endCol);

    const severity =
      SEVERITY_MAP[critique.severity] ?? vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(range, critique.message, severity);
    diagnostic.source = "Guardian";
    diagnostic.code = critique.ruleId ?? critique.id;

    return diagnostic;
  }
}
