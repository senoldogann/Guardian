import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { describe, expect, it, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { emitTauriEvent } from "../test/tauriMock";
import App from "../App";

const invokeMock = invoke as unknown as Mock;

describe("App", () => {
  it("renders incoming critique events", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_project_context") {
        return Promise.resolve({
          file_structure: [],
          dependencies: [],
          total_files: 0,
          intent_summary: "",
        });
      }
      if (cmd === "get_provider_config") {
        return Promise.resolve({
          provider_id: "ollama",
          base_url: "https://ollama.com",
          model: "gemini-3-flash-preview:cloud",
        });
      }
      if (cmd === "get_auth_session") {
        return Promise.resolve({
          user: { login: "tester", id: 1 },
          verified: true,
          warning: null,
        });
      }
      if (cmd === "get_tavily_key_status") {
        return Promise.resolve({ has_key: false, source: "none" });
      }
      if (cmd === "ping") {
        return Promise.resolve("pong");
      }
      return Promise.resolve(null);
    });

    render(<App />);

    emitTauriEvent("guardian:critique", {
      file_path: "src/main.tsx",
      severity: "Critical",
      message: "Critical violation detected",
      suggestion: "Fix it",
    });

    expect(await screen.findByText("Critical violation detected")).toBeInTheDocument();
  });

  it("shows existing and new findings together when baseline is valid", async () => {
    cleanup();
    localStorage.setItem("guardian_last_path", "/tmp");

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_project_context") {
        return Promise.resolve({
          file_structure: [],
          dependencies: [],
          total_files: 0,
          intent_summary: "",
        });
      }
      if (cmd === "get_monitor_critiques") {
        return Promise.resolve([
          {
            file_path: "/tmp/src/legacy.ts",
            severity: "Warning",
            message: "Legacy finding",
            suggestion: null,
            finding_id: "finding-legacy",
          },
          {
            file_path: "/tmp/src/new.ts",
            severity: "Critical",
            message: "New finding",
            suggestion: null,
            finding_id: "finding-new",
          },
        ]);
      }
      if (cmd === "get_baseline") {
        return Promise.resolve({
          schema_version: 2,
          created_at: "2026-02-10T00:00:00Z",
          workspace_id: "ws",
          rules_hash: "hash",
          finding_ids: ["finding-legacy"],
          findings: [],
        });
      }
      if (cmd === "get_baseline_status") {
        return Promise.resolve({
          valid: true,
          baseline_age_days: 0,
          active: 1,
          new_since_baseline: 1,
          resolved_since_baseline: 0,
          rules_hash_current: "hash",
          rules_hash_baseline: "hash",
          created_at: "2026-02-10T00:00:00Z",
        });
      }
      if (cmd === "get_provider_config") {
        return Promise.resolve({
          provider_id: "ollama",
          base_url: "https://ollama.com",
          model: "gemini-3-flash-preview:cloud",
        });
      }
      if (cmd === "get_auth_session") {
        return Promise.resolve({
          user: { login: "tester", id: 1 },
          verified: true,
          warning: null,
        });
      }
      if (cmd === "get_tavily_key_status") {
        return Promise.resolve({ has_key: false, source: "none" });
      }
      if (cmd === "ping") {
        return Promise.resolve("pong");
      }
      return Promise.resolve(null);
    });

    render(<App />);

    expect(await screen.findByText("Legacy finding")).toBeInTheDocument();
    expect(await screen.findByText("New finding")).toBeInTheDocument();

    localStorage.removeItem("guardian_last_path");
  });

  it("merges live critique updates by finding_id", async () => {
    cleanup();
    localStorage.setItem("guardian_last_path", "/tmp");

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_project_context") {
        return Promise.resolve({
          file_structure: [],
          dependencies: [],
          total_files: 0,
          intent_summary: "",
        });
      }
      if (cmd === "get_monitor_critiques") {
        return Promise.resolve([
          {
            file_path: "/tmp/src/main.tsx",
            severity: "Warning",
            message: "Snapshot finding",
            suggestion: null,
            finding_id: "finding-merge",
          },
        ]);
      }
      if (cmd === "get_provider_config") {
        return Promise.resolve({
          provider_id: "ollama",
          base_url: "https://ollama.com",
          model: "gemini-3-flash-preview:cloud",
        });
      }
      if (cmd === "get_auth_session") {
        return Promise.resolve({
          user: { login: "tester", id: 1 },
          verified: true,
          warning: null,
        });
      }
      if (cmd === "get_tavily_key_status") {
        return Promise.resolve({ has_key: false, source: "none" });
      }
      if (cmd === "ping") {
        return Promise.resolve("pong");
      }
      return Promise.resolve(null);
    });

    render(<App />);

    expect(await screen.findByText("Snapshot finding")).toBeInTheDocument();

    emitTauriEvent("guardian:critique", {
      file_path: "/tmp/src/main.tsx",
      severity: "Critical",
      message: "Live finding update",
      suggestion: "Fix now",
      finding_id: "finding-merge",
    });

    expect(await screen.findByText("Live finding update")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Snapshot finding")).not.toBeInTheDocument();
    });

    localStorage.removeItem("guardian_last_path");
  });

  it("lets users dismiss the stall overlay while keeping the stall banner", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_project_context") {
        return Promise.resolve({
          file_structure: [],
          dependencies: [],
          total_files: 0,
          intent_summary: "",
        });
      }
      if (cmd === "get_provider_config") {
        return Promise.resolve({
          provider_id: "ollama",
          base_url: "https://ollama.com",
          model: "gemini-3-flash-preview:cloud",
        });
      }
      if (cmd === "get_auth_session") {
        return Promise.resolve({
          user: { login: "tester", id: 1 },
          verified: true,
          warning: null,
        });
      }
      if (cmd === "get_tavily_key_status") {
        return Promise.resolve({ has_key: false, source: "none" });
      }
      if (cmd === "ping") {
        return Promise.reject(new Error("no backend"));
      }
      return Promise.resolve(null);
    });

    render(<App />);

    emitTauriEvent("guardian:stall-requested", {
      file_path: "scripts/verify_audit.py",
      reason: "Critical violation",
    });

    expect(await screen.findByText("Critical Stall")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /resolve in guru/i }));

    expect(screen.queryByText("Critical Stall")).not.toBeInTheDocument();

    emitTauriEvent("guardian:stall-requested", {
      file_path: "scripts/verify_audit.py",
      reason: "Critical violation",
    });

    expect(screen.queryByText("Critical Stall")).not.toBeInTheDocument();
  });

  it("shows activity animation when monitoring starts", async () => {
    cleanup();
    localStorage.setItem("guardian_last_path", "/tmp");

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_project_context") {
        return Promise.resolve({
          file_structure: [],
          dependencies: [],
          total_files: 0,
          intent_summary: "",
        });
      }
      if (cmd === "get_provider_config") {
        return Promise.resolve({
          provider_id: "ollama",
          base_url: "https://ollama.com",
          model: "gemini-3-flash-preview:cloud",
        });
      }
      if (cmd === "get_auth_session") {
        return Promise.resolve({
          user: { login: "tester", id: 1 },
          verified: true,
          warning: null,
        });
      }
      if (cmd === "get_tavily_key_status") {
        return Promise.resolve({ has_key: false, source: "none" });
      }
      if (cmd === "get_api_key_status") {
        return Promise.resolve({ has_key: true, source: "user" });
      }
      if (cmd === "stop_monitoring") {
        return Promise.resolve(null);
      }
      if (cmd === "start_monitoring") {
        return Promise.resolve(null);
      }
      if (cmd === "ping") {
        return Promise.reject(new Error("no backend"));
      }
      return Promise.resolve(null);
    });

    render(<App />);

    expect(screen.getByDisplayValue("tmp")).toBeInTheDocument();

    const launchButton = screen.getByRole("button", { name: /launch guardian/i });
    await waitFor(() => expect(launchButton).not.toBeDisabled());
    fireEvent.click(launchButton);

    expect(await screen.findByTestId("guardian-activity")).toBeInTheDocument();

    localStorage.removeItem("guardian_last_path");
  });
});
