import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
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
    expect(screen.getByText(/SYSTEM STALLED:/i)).toBeInTheDocument();

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
      if (cmd === "ping") {
        return Promise.reject(new Error("no backend"));
      }
      return Promise.resolve(null);
    });

    render(<App />);

    expect(screen.getByDisplayValue("/tmp")).toBeInTheDocument();

    const launchButton = screen.getByRole("button", { name: /launch guardian/i });
    expect(launchButton).not.toBeDisabled();
    fireEvent.click(launchButton);

    expect(await screen.findByText("Monitoring Active")).toBeInTheDocument();

    expect(await screen.findByTestId("guardian-activity")).toBeInTheDocument();

    localStorage.removeItem("guardian_last_path");
  });
});
