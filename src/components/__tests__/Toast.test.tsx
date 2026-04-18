import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { ToastContainer } from "../Toast";
import { useToastStore } from "../../hooks/useToast";

describe("ToastContainer", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    // Reset the zustand store between tests
    act(() => {
      useToastStore.setState({ toasts: [] });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector("[class*='fixed']")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a toast message after adding to the store", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().addToast("Operation succeeded", "success", 5000);
    });

    expect(screen.getByText("Operation succeeded")).toBeInTheDocument();
  });

  it("renders toasts of different types", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().addToast("Info message", "info", 5000);
      useToastStore.getState().addToast("Error message", "error", 5000);
      useToastStore.getState().addToast("Warning message", "warning", 5000);
    });

    expect(screen.getByText("Info message")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.getByText("Warning message")).toBeInTheDocument();
  });

  it("removes a toast when close button is clicked", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().addToast("Dismiss me", "info", 0);
    });

    expect(screen.getByText("Dismiss me")).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button");
    fireEvent.click(closeButtons[0]);

    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });

  it("auto-dismisses a toast after the specified duration", () => {
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().addToast("Temporary", "info", 2000);
    });

    expect(screen.getByText("Temporary")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
  });

  it("renders action button and calls onClick when clicked", () => {
    const actionFn = vi.fn();
    render(<ToastContainer />);

    act(() => {
      useToastStore.getState().addToast("With action", "info", 0, {
        label: "Undo",
        onClick: actionFn,
      });
    });

    const undoButton = screen.getByTitle("Undo");
    fireEvent.click(undoButton);

    expect(actionFn).toHaveBeenCalledTimes(1);
    // Toast should be removed after action
    expect(screen.queryByText("With action")).not.toBeInTheDocument();
  });
});
