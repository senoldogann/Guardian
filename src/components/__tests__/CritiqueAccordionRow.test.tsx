import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { CritiqueAccordionRow, type Critique } from "../CritiqueAccordionRow";

const invokeMock = invoke as unknown as Mock;

describe("CritiqueAccordionRow", () => {
  it("renders file path summary and triggers quick fix", async () => {
    const user = userEvent.setup();

    const log: Critique = {
      file_path: "root/a/b/file.ts",
      severity: "Critical",
      message: "Unsafe pattern detected",
      suggestion: "Refactor this",
      suggested_diff: "// patched content",
    };

    invokeMock.mockResolvedValue("ok");

    render(
      <CritiqueAccordionRow
        log={log}
        index={1}
        isExpanded={false}
        onToggle={() => {}}
        onAskGuru={() => {}}
        rootPath="root"
      />
    );

    expect(screen.getByText("a/b/...")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();

    await user.click(screen.getByTitle("Quick Fix: Apply this patch immediately"));

    expect(invokeMock).toHaveBeenCalledWith("apply_fix_now", {
      filePath: log.file_path,
      newContent: log.suggested_diff,
      root: "root",
    });
  });
});
