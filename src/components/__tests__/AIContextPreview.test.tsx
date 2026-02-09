import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AIContextPreview } from "../AIContextPreview";
import type { AiContextSnapshot } from "../../types";

describe("AIContextPreview", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows empty state when no context is available", () => {
    render(<AIContextPreview context={null} />);
    expect(screen.getByText("No Captured Context")).toBeInTheDocument();
  });

  it("renders summary, warning, and file previews", () => {
    const context: AiContextSnapshot = {
      timestamp: "2026-02-09T00:00:00Z",
      root: "/tmp/workspace",
      provider_id: "mock",
      model: "mock-model",
      tokens_in: 123,
      files: [
        {
          file_path: "/tmp/workspace/src/a.ts",
          token_estimate: 45,
          redacted: true,
          truncated: false,
          content: "const token = \"[REDACTED_OPENAI_KEY]\";",
        },
      ],
    };

    render(<AIContextPreview context={context} />);

    expect(screen.getByText(/AI Outbound Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider:/)).toBeInTheDocument();
    expect(screen.getByText(/Sensitive content was redacted/i)).toBeInTheDocument();
    expect(screen.getByText(context.files[0].file_path)).toBeInTheDocument();

    const summary = screen.getByText(context.files[0].file_path);
    fireEvent.click(summary);

    expect(screen.getByText(context.files[0].content)).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    const context: AiContextSnapshot = {
      timestamp: "2026-02-09T00:00:00Z",
      root: "/tmp/workspace",
      provider_id: "mock",
      model: "mock-model",
      tokens_in: 1,
      files: [],
    };

    render(<AIContextPreview context={context} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

