import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";
import type { RefObject } from "react";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  listen: vi.fn(async () => () => {}),
  openDialog: vi.fn(),
}));

function makeMutableRef<T>(value: T): RefObject<T> {
  return { current: value } as RefObject<T>;
}

describe("useFocusTrap", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    cleanup();
  });

  it("calls onEscape when Escape key is pressed", () => {
    const onEscape = vi.fn();
    const containerRef = makeMutableRef<HTMLElement>(container);

    renderHook(() =>
      useFocusTrap({ active: true, containerRef, onEscape }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does nothing when not active", () => {
    const onEscape = vi.fn();
    const containerRef = makeMutableRef<HTMLElement>(container);

    renderHook(() =>
      useFocusTrap({ active: false, containerRef, onEscape }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("focuses the first focusable element on activation", () => {
    const button = document.createElement("button");
    button.textContent = "Click me";
    container.appendChild(button);

    const focusSpy = vi.spyOn(button, "focus");
    const containerRef = makeMutableRef<HTMLElement>(container);

    renderHook(() =>
      useFocusTrap({ active: true, containerRef }),
    );

    expect(focusSpy).toHaveBeenCalled();
  });

  it("prevents default on Tab when no focusable elements exist", () => {
    const containerRef = makeMutableRef<HTMLElement>(container);

    renderHook(() =>
      useFocusTrap({ active: true, containerRef }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalled();
  });
});
