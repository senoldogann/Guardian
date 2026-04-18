import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import { Field, TextInput } from "../ui/Field";
import { SectionHeader } from "../ui/SectionHeader";
import { DialogShell } from "../ui/DialogShell";

describe("UI primitives", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("renders a button with icon content and disabled state", () => {
        render(
            <Button
                type="button"
                variant="primary"
                size="md"
                disabled
                leadingIcon={<span data-testid="button-icon">+</span>}
            >
                Save changes
            </Button>,
        );

        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
        expect(screen.getByTestId("button-icon")).toBeInTheDocument();
    });

    it("renders a badge label", () => {
        render(
            <Badge variant="success" size="md">
                Ready
            </Badge>,
        );

        expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    it("renders a panel wrapper", () => {
        render(
            <Panel surface="subtle" padding="md" rounded="xl">
                Panel body
            </Panel>,
        );

        expect(screen.getByText("Panel body")).toBeInTheDocument();
    });

    it("renders field label, note, error, and input control", () => {
        render(
            <Field label="Model" note="Pick a model" error="Model is required">
                <TextInput value="" onChange={vi.fn()} placeholder="gpt-4.1-mini" />
            </Field>,
        );

        expect(screen.getByText("Model")).toBeInTheDocument();
        expect(screen.getByText("Pick a model")).toBeInTheDocument();
        expect(screen.getByText("Model is required")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("gpt-4.1-mini")).toBeInTheDocument();
    });

    it("renders section header title and action", () => {
        const onRefresh = vi.fn();
        render(
            <SectionHeader
                title="Semantic Embeddings"
                action={(
                    <button type="button" onClick={onRefresh}>
                        Refresh
                    </button>
                )}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        expect(screen.getByText("Semantic Embeddings")).toBeInTheDocument();
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("renders nothing when dialog shell is closed", () => {
        const { container } = render(
            <DialogShell
                open={false}
                title="Settings"
                onClose={vi.fn()}
            >
                Body
            </DialogShell>,
        );

        expect(container.firstChild).toBeNull();
    });

    it("renders an open dialog shell and handles close", () => {
        const onClose = vi.fn();
        render(
            <DialogShell
                open
                title="Settings"
                description="Configure Guardian"
                closeLabel="Close dialog"
                onClose={onClose}
            >
                Body
            </DialogShell>,
        );

        expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
        expect(screen.getByText("Configure Guardian")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});