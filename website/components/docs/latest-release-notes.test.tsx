import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GithubRelease } from "../../lib/github";
import { LatestReleaseNotes } from "./latest-release-notes";

const fetchReleaseSnapshotMock = vi.fn<(...args: unknown[]) => Promise<GithubRelease[]>>();

vi.mock("../../lib/releases-source", () => ({
  fetchReleaseSnapshot: (...args: unknown[]) => fetchReleaseSnapshotMock(...args),
}));

function makeRelease(overrides?: Partial<GithubRelease>): GithubRelease {
  return {
    id: 1,
    tag_name: "v1.2.5",
    name: "v1.2.5",
    body: "### Highlights\n- Better mobile docs rendering\n- Auto latest release notes in docs",
    html_url: "https://github.com/senoldogann/guardian-distribution/releases/tag/v1.2.5",
    published_at: "2026-03-16T00:00:00Z",
    prerelease: false,
    draft: false,
    assets: [],
    ...overrides,
  };
}

describe("LatestReleaseNotes", () => {
  beforeEach(() => {
    fetchReleaseSnapshotMock.mockReset();
  });

  it("renders latest release title and highlights", async () => {
    fetchReleaseSnapshotMock.mockResolvedValue([makeRelease()]);

    const ui = await LatestReleaseNotes({ locale: "en" });
    expect(ui).not.toBeNull();
    render(ui);

    expect(screen.getByText("What's New in v1.2.5")).toBeInTheDocument();
    expect(screen.getByText("Better mobile docs rendering")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full changelog" })).toHaveAttribute(
      "href",
      "/en/changelog",
    );
  });

  it("returns null when no releases are available", async () => {
    fetchReleaseSnapshotMock.mockResolvedValue([]);

    const ui = await LatestReleaseNotes({ locale: "tr" });
    expect(ui).toBeNull();
  });
});
