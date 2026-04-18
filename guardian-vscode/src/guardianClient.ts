import { ChildProcess, spawn } from "child_process";
import * as vscode from "vscode";

// ── Types matching guardian-mcp JSON-RPC protocol ──────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

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

export interface ScanResult {
  critiques: Critique[];
}

export interface CritiquesResult {
  critiques: Critique[];
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
      for (const { reject } of this.pending.values()) {
        reject(new Error("Guardian MCP server process exited"));
      }
      this.pending.clear();
    });

    // Send MCP initialize handshake
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "guardian-vscode",
        version: "0.1.0",
      },
    });

    // Send initialized notification (no response expected)
    this.sendNotification("initialized", {});

    this.initialized = true;
  }

  async scanFile(path: string, profile: string): Promise<ScanResult> {
    await this.ensureInitialized();

    const result = await this.send("tools/call", {
      name: "scan_file",
      arguments: { path, profile },
    });

    return this.parseScanResult(result);
  }

  async listCritiques(severity?: string): Promise<CritiquesResult> {
    await this.ensureInitialized();

    const params: Record<string, unknown> = {
      name: "list_critiques",
      arguments: severity ? { severity } : {},
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

  private send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("Guardian MCP server is not running"));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pending.set(id, { resolve, reject });

      const line = JSON.stringify(request) + "\n";
      this.process.stdin.write(line, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
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
        const handler = this.pending.get(response.id);
        if (handler) {
          this.pending.delete(response.id);
          if (response.error) {
            handler.reject(
              new Error(
                `MCP error ${response.error.code}: ${response.error.message}`
              )
            );
          } else {
            handler.resolve(response.result);
          }
        }
      } catch {
        this.output.appendLine(
          `[guardian-mcp] failed to parse response: ${line}`
        );
      }
    }
  }

  private parseScanResult(raw: unknown): ScanResult {
    // TODO: Parse actual MCP tool response into Critique objects
    // For now, return an empty result as the MCP server stubs are not yet implemented
    this.output.appendLine(
      `[guardian-mcp] raw scan result: ${JSON.stringify(raw)}`
    );
    return { critiques: [] };
  }

  private parseCritiquesResult(raw: unknown): CritiquesResult {
    // TODO: Parse actual MCP tool response into Critique objects
    this.output.appendLine(
      `[guardian-mcp] raw critiques result: ${JSON.stringify(raw)}`
    );
    return { critiques: [] };
  }
}
