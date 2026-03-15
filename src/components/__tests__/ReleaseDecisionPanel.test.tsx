import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ReleaseDecisionPanel } from "../ReleaseDecisionPanel";
import type { ReleaseDecisionView } from "../../types";

const makeDecision = (
  overrides: Partial<ReleaseDecisionView> = {},
): ReleaseDecisionView => ({
  schema_version: 1,
  root: "/tmp/workspace",
  policy_path: "/tmp/workspace/guardian.policy.yaml",
  decision: "PASS_WITH_WARNING",
  requires_human_approval: true,
  ai_heavy_change: true,
  critical_findings: 0,
  warning_findings: 0,
  approver: null,
  reason: null,
  override_reason: null,
  decided_at: null,
  audit_path: "/tmp/workspace/.guardian/release_decisions.jsonl",
  decision_reasons: ["AI-heavy intake requires human approval before release."],
  ...overrides,
});

describe("ReleaseDecisionPanel", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders release decision summary and reasons", () => {
    render(
      <ReleaseDecisionPanel
        decision={makeDecision()}
        loading={false}
        error={null}
        onRefresh={vi.fn(async () => undefined)}
        onSetDecision={vi.fn(async () => undefined)}
        onOverride={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("Release Decision")).toBeInTheDocument();
    expect(screen.getByText("Pass With Warning", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/AI-heavy: yes/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI-heavy intake requires human approval before release/i),
    ).toBeInTheDocument();
  });

  it("calls onSetDecision with trimmed approver and reason", async () => {
    const onSetDecision = vi.fn(async () => undefined);
    render(
      <ReleaseDecisionPanel
        decision={makeDecision()}
        loading={false}
        error={null}
        onRefresh={vi.fn(async () => undefined)}
        onSetDecision={onSetDecision}
        onOverride={vi.fn(async () => undefined)}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "  release-manager  " } });
    fireEvent.change(inputs[1], { target: { value: "  Approved after review  " } });
    fireEvent.click(screen.getByRole("button", { name: /save decision/i }));

    await waitFor(() => {
      expect(onSetDecision).toHaveBeenCalledTimes(1);
    });
    expect(onSetDecision).toHaveBeenCalledWith(
      "PASS_WITH_WARNING",
      "release-manager",
      "Approved after review",
    );
  });

  it("shows override section for blocked decisions and calls onOverride", async () => {
    const onOverride = vi.fn(async () => undefined);
    render(
      <ReleaseDecisionPanel
        decision={makeDecision({ decision: "BLOCK_UNTIL_APPROVED" })}
        loading={false}
        error={null}
        onRefresh={vi.fn(async () => undefined)}
        onSetDecision={vi.fn(async () => undefined)}
        onOverride={onOverride}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "  release-manager  " } });
    fireEvent.change(inputs[2], {
      target: { value: "  Emergency production hotfix  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /override block/i }));

    await waitFor(() => {
      expect(onOverride).toHaveBeenCalledTimes(1);
    });
    expect(onOverride).toHaveBeenCalledWith(
      "release-manager",
      "Emergency production hotfix",
    );
  });
});
