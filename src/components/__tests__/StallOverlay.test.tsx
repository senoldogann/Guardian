import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StallOverlay, type StallOverlayProps } from "../StallOverlay";

describe("StallOverlay", () => {
    const defaultProps: StallOverlayProps = {
        stalled: { file: "/src/components/App.tsx", reason: "Critical security violation" },
        open: true,
        onResolve: vi.fn(),
        onDismiss: vi.fn(),
    };

    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("renders nothing when stalled is null", () => {
        const { container } = render(
            <StallOverlay {...defaultProps} stalled={null} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when open is false", () => {
        const { container } = render(
            <StallOverlay {...defaultProps} open={false} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders overlay when stalled and open", () => {
        render(<StallOverlay {...defaultProps} />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Critical Stall")).toBeInTheDocument();
        expect(screen.getByText("App.tsx")).toBeInTheDocument();
    });

    it("extracts filename from path correctly", () => {
        render(
            <StallOverlay
                {...defaultProps}
                stalled={{ file: "deep/nested/path/Component.tsx", reason: "test" }}
            />
        );

        expect(screen.getByText("Component.tsx")).toBeInTheDocument();
    });

    it("calls onResolve when Resolve button is clicked", () => {
        const onResolve = vi.fn();
        render(<StallOverlay {...defaultProps} onResolve={onResolve} />);

        const buttons = screen.getAllByText("Resolve In Guru");
        fireEvent.click(buttons[0]);
        expect(onResolve).toHaveBeenCalledTimes(1);
    });

    it("calls onDismiss when Dismiss button is clicked", () => {
        const onDismiss = vi.fn();
        render(<StallOverlay {...defaultProps} onDismiss={onDismiss} />);

        const buttons = screen.getAllByText("Dismiss");
        fireEvent.click(buttons[0]);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("has accessible dialog role and aria-modal", () => {
        render(<StallOverlay {...defaultProps} />);

        const dialogs = screen.getAllByRole("dialog");
        expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
    });

    it("displays stall reason context", () => {
        render(<StallOverlay {...defaultProps} />);

        expect(screen.getByText(/Critical violation detected/)).toBeInTheDocument();
        expect(screen.getByText(/\/src\/components\/App\.tsx/)).toBeInTheDocument();
        expect(screen.getByText(/Real-time monitoring is paused/)).toBeInTheDocument();
    });
});
