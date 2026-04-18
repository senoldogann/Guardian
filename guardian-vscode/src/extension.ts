import * as vscode from "vscode";
import { GuardianClient } from "./guardianClient";
import { GuardianDiagnosticProvider } from "./diagnostics";

let client: GuardianClient | undefined;
let diagnosticProvider: GuardianDiagnosticProvider | undefined;
let monitoring = false;
let onSaveDisposable: vscode.Disposable | undefined;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Guardian");
  outputChannel.appendLine("Guardian extension activating…");

  const config = vscode.workspace.getConfiguration("guardian");
  const serverPath = config.get<string>("serverPath", "guardian-mcp");

  client = new GuardianClient(serverPath, outputChannel);
  diagnosticProvider = new GuardianDiagnosticProvider();

  // ── Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("guardian.scanCurrentFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active file to scan.");
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const profile = config.get<string>("scanProfile", "source");

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Guardian: Scanning ${vscode.workspace.asRelativePath(filePath)}…`,
          cancellable: false,
        },
        async () => {
          try {
            const result = await client!.scanFile(filePath, profile);
            diagnosticProvider!.update(editor.document.uri, result.critiques);
            vscode.window.showInformationMessage(
              `Guardian: scan complete — ${result.critiques.length} finding(s).`
            );
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Guardian scan failed: ${message}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand("guardian.showCritiques", async () => {
      try {
        const severity = config.get<string>("severityFilter", "low");
        const result = await client!.listCritiques(severity);
        diagnosticProvider!.updateAll(result.critiques);
        vscode.commands.executeCommand("workbench.action.problems.focus");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Guardian: failed to fetch critiques: ${message}`
        );
      }
    }),

    vscode.commands.registerCommand("guardian.startMonitoring", () => {
      if (monitoring) {
        vscode.window.showInformationMessage(
          "Guardian: monitoring is already active."
        );
        return;
      }

      consecutiveFailures = 0;
      monitoring = true;

      onSaveDisposable = vscode.workspace.onDidSaveTextDocument(
        async (document) => {
          if (!isSupportedLanguage(document.languageId)) {
            return;
          }
          try {
            const profile = config.get<string>("scanProfile", "source");
            const result = await client!.scanFile(
              document.uri.fsPath,
              profile
            );
            diagnosticProvider!.update(document.uri, result.critiques);
            consecutiveFailures = 0;
          } catch (err: unknown) {
            consecutiveFailures++;
            const message = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(
              `Guardian: monitoring scan failed for ${document.uri.fsPath}: ${message}`
            );
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              vscode.window.showWarningMessage(
                `Guardian: monitoring disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Last error: ${message}`
              );
              monitoring = false;
              onSaveDisposable?.dispose();
              onSaveDisposable = undefined;
            }
          }
        }
      );

      context.subscriptions.push(onSaveDisposable);
      vscode.window.showInformationMessage(
        "Guardian: monitoring started — files will be scanned on save."
      );
    }),

    outputChannel,
    diagnosticProvider
  );

  // Auto-scan on save (if configured independently of monitoring)
  if (config.get<boolean>("autoScanOnSave", false)) {
    vscode.commands.executeCommand("guardian.startMonitoring");
  }

  try {
    await client.initialize();
    outputChannel.appendLine("Guardian MCP client initialized.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`Guardian MCP client failed to start: ${message}`);
    vscode.window.showWarningMessage(
      `Guardian server not available. Install guardian-mcp and ensure it is on your PATH.`
    );
  }
}

export function deactivate(): void {
  onSaveDisposable?.dispose();
  client?.dispose();
  client = undefined;
  diagnosticProvider = undefined;
  monitoring = false;
  consecutiveFailures = 0;
}

function isSupportedLanguage(languageId: string): boolean {
  return ["typescript", "javascript", "rust", "python", "go"].includes(
    languageId
  );
}
