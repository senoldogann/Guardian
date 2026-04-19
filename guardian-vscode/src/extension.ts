import path from "node:path";
import * as vscode from "vscode";
import { GuardianClient } from "./guardianClient";
import {
  buildCritiquesNotification,
  buildScanNotification,
  describeClientError,
} from "./feedback";
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
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Guardian extension activating…");

  const config = vscode.workspace.getConfiguration("guardian");
  const configuredServerUrl = config.get<string>("serverUrl");
  if (configuredServerUrl && configuredServerUrl !== "stdio") {
    const message =
      "Guardian: remote guardian.serverUrl values are not supported in this release. Clear the setting or set it to 'stdio'.";
    outputChannel.appendLine(
      `[guardian] unsupported serverUrl '${configuredServerUrl}'`
    );
    void vscode.window.showErrorMessage(message);
    return;
  }

  const serverPath = config.get<string>("serverPath", "guardian-mcp");

  client = new GuardianClient(serverPath, outputChannel);
  diagnosticProvider = new GuardianDiagnosticProvider();

  const showNotification = (plan: { level: "info" | "warning" | "error"; message: string }) => {
    if (plan.level === "info") {
      void vscode.window.showInformationMessage(plan.message);
      return;
    }

    if (plan.level === "warning") {
      void vscode.window.showWarningMessage(plan.message);
      return;
    }

    void vscode.window.showErrorMessage(plan.message);
  };

  const workspacePathForUri = (uri?: vscode.Uri): string | undefined => {
    if (uri) {
      return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
    }

    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  };

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
      const workspacePath = workspacePathForUri(editor.document.uri) ?? path.dirname(filePath);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Guardian: Scanning ${vscode.workspace.asRelativePath(filePath)}…`,
          cancellable: false,
        },
        async () => {
          try {
            const result = await client!.scanFile(filePath, profile, workspacePath);
            diagnosticProvider!.update(editor.document.uri, result.critiques);
            outputChannel.appendLine(
              `[guardian] scanCurrentFile ${result.status}/${result.kind}: ${result.message}`
            );
            showNotification(
              buildScanNotification(
                vscode.workspace.asRelativePath(filePath),
                result
              )
            );
          } catch (err: unknown) {
            const plan = describeClientError(err);
            outputChannel.appendLine(`[guardian] scanCurrentFile failed: ${plan.message}`);
            showNotification(plan);
          }
        }
      );
    }),

    vscode.commands.registerCommand("guardian.showCritiques", async () => {
      try {
        const severity = config.get<string>("severityFilter", "low");
        const workspacePath = workspacePathForUri(
          vscode.window.activeTextEditor?.document.uri
        );

        if (!workspacePath) {
          vscode.window.showWarningMessage(
            "Guardian: open a workspace folder before loading critiques."
          );
          return;
        }

        const result = await client!.listCritiques(severity, workspacePath);
        diagnosticProvider!.updateAll(result.critiques);
        outputChannel.appendLine(
          `[guardian] showCritiques ${result.status}/${result.kind}: ${result.message}`
        );
        if (result.critiqueCount > 0) {
          void vscode.commands.executeCommand("workbench.action.problems.focus");
        }
        showNotification(buildCritiquesNotification(result));
      } catch (err: unknown) {
        const plan = describeClientError(err);
        outputChannel.appendLine(`[guardian] showCritiques failed: ${plan.message}`);
        showNotification(plan);
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
            const workspacePath =
              workspacePathForUri(document.uri) ?? path.dirname(document.uri.fsPath);
            const result = await client!.scanFile(
              document.uri.fsPath,
              profile,
              workspacePath
            );
            diagnosticProvider!.update(document.uri, result.critiques);
            consecutiveFailures = 0;
            if (result.status !== "ok") {
              outputChannel.appendLine(
                `[guardian] monitoring ${result.status}/${result.kind} for ${document.uri.fsPath}: ${result.message}`
              );
            }
          } catch (err: unknown) {
            consecutiveFailures++;
            const plan = describeClientError(err);
            outputChannel.appendLine(
              `Guardian: monitoring scan failed for ${document.uri.fsPath}: ${plan.message}`
            );
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              vscode.window.showWarningMessage(
                `Guardian: monitoring disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Last error: ${plan.message}`
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
