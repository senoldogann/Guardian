import { useEffect, useRef, type RefObject } from "react";

type FocusTrapOptions = {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape?: (() => void) | undefined;
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "details > summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    // Ignore elements that are not actually visible/focusable.
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.tabIndex < 0) return false;

    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  initialFocusRef,
}: FocusTrapOptions): void {
  const onEscapeRef = useRef<FocusTrapOptions["onEscape"]>(onEscape);
  const initialFocusRefRef = useRef<FocusTrapOptions["initialFocusRef"]>(initialFocusRef);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    initialFocusRefRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const prevFocus =
      (document.activeElement instanceof HTMLElement ? document.activeElement : null) ?? null;

    // Initial focus: prefer the provided ref, otherwise first focusable in modal.
    const initialTarget =
      initialFocusRefRef.current?.current ?? getFocusable(container)[0] ?? null;
    if (initialTarget) {
      initialTarget.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (event.key === "Escape" && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      const focusable = getFocusable(currentContainer);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (!activeEl || activeEl === first || !currentContainer.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeEl || activeEl === last || !currentContainer.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (prevFocus) {
        prevFocus.focus();
      }
    };
  }, [active, containerRef]);
}
