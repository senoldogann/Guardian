import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useToastStore } from "../useToast";

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("starts with an empty toasts array", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("addToast appends a toast with defaults", () => {
    act(() => {
      useToastStore.getState().addToast("Hello", "info");
    });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Hello");
    expect(toasts[0].type).toBe("info");
    expect(toasts[0].duration).toBe(3000);
    expect(toasts[0].id).toBeTruthy();
  });

  it("addToast respects custom duration and action", () => {
    const onClick = () => {};
    act(() => {
      useToastStore
        .getState()
        .addToast("Custom", "warning", 5000, { label: "Undo", onClick });
    });

    const toast = useToastStore.getState().toasts[0];
    expect(toast.duration).toBe(5000);
    expect(toast.action?.label).toBe("Undo");
  });

  it("supports all toast types", () => {
    const types = ["info", "success", "warning", "error"] as const;

    act(() => {
      for (const t of types) {
        useToastStore.getState().addToast(`msg-${t}`, t);
      }
    });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(4);
    expect(toasts.map((t) => t.type)).toEqual([...types]);
  });

  it("removeToast removes the correct toast", () => {
    act(() => {
      useToastStore.getState().addToast("A", "info");
      useToastStore.getState().addToast("B", "error");
    });

    const [a, b] = useToastStore.getState().toasts;
    act(() => {
      useToastStore.getState().removeToast(a.id);
    });

    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it("removeToast is a no-op for unknown id", () => {
    act(() => {
      useToastStore.getState().addToast("A", "info");
    });

    act(() => {
      useToastStore.getState().removeToast("nonexistent");
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("handles multiple toasts with unique ids", () => {
    act(() => {
      for (let i = 0; i < 5; i++) {
        useToastStore.getState().addToast(`toast-${i}`, "success");
      }
    });

    const ids = useToastStore.getState().toasts.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
  });
});
