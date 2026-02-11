import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FixProposalsView } from "../FixProposalsView";
import type { FixProposalsSnapshot } from "../../types";

describe("FixProposalsView", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows empty state when no snapshot is available", () => {
    render(<FixProposalsView snapshot={null} />);
    expect(screen.getByText("No Fix Proposals")).toBeInTheDocument();
  });

  it("renders proposals and allows requesting review", async () => {
    const onRequestReview = vi.fn();
    const onSetStatus = vi.fn();
    const snapshot: FixProposalsSnapshot = {
      timestamp: "2026-02-09T00:00:00Z",
      root: "/tmp/workspace",
      source_path: "/tmp/workspace/.guardian-proposals/fix_proposals.jsonl",
      proposals: [
        {
          proposal_id: "p1",
          timestamp: "2026-02-09T00:00:00Z",
          status: "pending",
          file_path: "src/a.ts",
          proposed_content: "export const a = 1;",
        },
      ],
    };

    render(
      <FixProposalsView
        snapshot={snapshot}
        onRequestReview={onRequestReview}
        onSetStatus={onSetStatus}
      />
    );

    expect(screen.getByText(/Fix Proposals/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending:/)).toBeInTheDocument();
    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);

    expect(await screen.findByText(snapshot.proposals[0].proposed_content!)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /request review/i }));
    expect(onRequestReview).toHaveBeenCalledTimes(1);
    expect(onRequestReview).toHaveBeenCalledWith(snapshot.proposals[0]);
  });

  it("allows rejecting a proposal", async () => {
    const onSetStatus = vi.fn();
    const snapshot: FixProposalsSnapshot = {
      timestamp: "2026-02-09T00:00:00Z",
      root: "/tmp/workspace",
      source_path: "/tmp/workspace/.guardian-proposals/fix_proposals.jsonl",
      proposals: [
        {
          proposal_id: "p1",
          timestamp: "2026-02-09T00:00:00Z",
          status: "pending",
          file_path: "src/a.ts",
          proposed_content: "export const a = 1;",
        },
      ],
    };

    render(<FixProposalsView snapshot={snapshot} onSetStatus={onSetStatus} />);
    expect(await screen.findByText(snapshot.proposals[0].proposed_content!)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onSetStatus).toHaveBeenCalledTimes(1);
    expect(onSetStatus).toHaveBeenCalledWith("p1", "rejected");
  });
});
