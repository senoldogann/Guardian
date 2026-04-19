import { ChildProcess, spawn } from "child_process";
import * as vscode from "vscode";
import type { CritiquesResult, ScanResult } from "./models";
import {
  GuardianParseError,
  GuardianTransportError,
  parseCritiquesToolResult,
  parseScanToolResult,
} from "./resultParsers";

export type { Critique, CritiquesResult, ScanResult } from "./models";
export { GuardianParseError, GuardianTransportError } from "./resultParsers";

const CLIENT_VERSION = "1.3.0";

// ── Types matching guardian-mcp JSON-RPC protocol ──────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── Guardian MCP Client (stdio transport) ──────────────────────────

export class GuardianClient {
  private process: ChildProcess | undefined;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  private buffer = "";
  private initialized = false;

  constructor(
    private readonly serverPath: string,
    private readonly output: vscode.OutputChannel
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.process = spawn(this.serverPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.onData(data.toString());
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      this.output.appendLine(`[guardian-mcp stderr] ${data.toString().trim()}`);
    });

    this.process.on("error", (err) => {
      this.output.appendLine(`[guardian-mcp] process error: ${err.message}`);
    });

    this.process.on("exit", (code) => {
      this.output.appendLine(`[guardian-mcp] process exited with code ${code}`);
      this.initialized = false;
      this.rejectAllPending(
        new GuardianTransportError("Guardian MCP server process exited.")
      );
    });

    // Send MCP initialize handshake
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "guardian-vscode",
        version: CLIENT_VERSION,
      },
    });

    // Send initialized notification (no response expected)
    this.sendNotification("initialized", {});

    this.initialized = true;
  }

  async scanFile(
    path: string,
    profile: string,
    workspacePath?: string
  ): Promise<ScanResult> {
    await this.ensureInitialized();

    const result = await this.send("tools/call", {
      name: "scan_file",
      arguments: {
        path,
        profile,
        ...(workspacePath ? { workspace_path: workspacePath } : {}),
      },
    });

    return this.parseScanResult(result);
  }

  async listCritiques(
    severity?: string,
    workspacePath?: string
  ): Promise<CritiquesResult> {
    await this.ensureInitialized();

    const params: Record<string, unknown> = {
      name: "list_critiques",
      arguments: {
        ...(severity ? { severity } : {}),
        ...(workspacePath ? { workspace_path: workspacePath } : {}),
      },
    };

    const result = await this.send("tools/call", params);
    return this.parseCritiquesResult(result);
  }

  dispose(): void {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.initialized = false;
    this.pending.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private rejectAllPending(reason: Error): void {
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    for (const entry of pending) {
      entry.reject(reason);
    }
  }

  private send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(
          new GuardianTransportError("Guardian MCP server is not running.")
        );
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        const entry = this.pending.get(id);
        if (entry) {
          this.pending.delete(id);
          entry.reject(
            new GuardianTransportError(
              `MCP request timed out after ${GuardianClient.REQUEST_TIMEOUT_MS}ms: ${method}`
            )
          );
        }
      }, GuardianClient.REQUEST_TIMEOUT_MS);

      const pendingEntry = {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (reason: Error) => {
          clearTimeout(timer);
          reject(reason);
        },
      };

      this.pending.set(id, pendingEntry);

      const line = JSON.stringify(request) + "\n";
      this.process.stdin.write(line, (err) => {
        if (err) {
          const removed = this.pending.delete(id);
          if (removed) {
            pendingEntry.reject(
              new GuardianTransportError(err.message)
            );
          }
        }
      });
    });
  }

  private sendNotification(
    method: string,
    params: Record<string, unknown>
  ): void {
    if (!this.process?.stdin) {
      return;
    }
    // Notifications have no id
    const message = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    this.process.stdin.write(message);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;

    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line) {
        continue;
      }

      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const responseId =
          typeof response.id === "number" ? response.id : undefined;
        const handler =
          responseId !== undefined ? this.pending.get(responseId) : undefined;
        if (handler && responseId !== undefined) {
          this.pending.delete(responseId);
          if (response.error) {
            handler.reject(
              new GuardianTransportError(
                `MCP error ${response.error.code}: ${response.error.message}`
              )
            );
          } else {
            handler.resolve(response.result);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.output.appendLine(
          `[guardian-mcp] failed to parse response: ${line}`
        );
        this.rejectAllPending(
          new GuardianParseError(
            `Failed to parse JSON-RPC response from guardian-mcp: ${message}`
          )
        );
      }
    }
  }

  private parseScanResult(raw: unknown): ScanResult {
    return parseScanToolResult(raw);
  }

  private parseCritiquesResult(raw: unknown): CritiquesResult {
    return parseCritiquesToolResult(raw);
  }
}
