import React from "react";
import "@testing-library/jest-dom/vitest";
import { vi, beforeEach } from "vitest";
import { listen, clearTauriListeners } from "./tauriMock";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  open: vi.fn(),
  openUrl: vi.fn(),
  openPath: vi.fn(),
  revealItemInDir: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: Record<string, unknown>) =>
        React.createElement("div", props),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: {},
  writable: true,
  configurable: true,
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver as unknown as typeof ResizeObserver;

window.alert = vi.fn();

Element.prototype.scrollIntoView = vi.fn();

// Node.js runtimes can expose a non-browser `localStorage` shim.
// Force a Storage-like implementation so tests are deterministic.
const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  } as Storage;
};

const installStableLocalStorage = () => {
  const current = (globalThis as Record<string, unknown>).localStorage as
    | Storage
    | undefined;
  const needsPolyfill =
    !current ||
    typeof current.getItem !== "function" ||
    typeof current.setItem !== "function" ||
    typeof current.removeItem !== "function";

  const storage = needsPolyfill ? createMemoryStorage() : current;

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
};

installStableLocalStorage();

beforeEach(() => {
  vi.clearAllMocks();
  clearTauriListeners();
  installStableLocalStorage();
  if (typeof window?.localStorage?.clear === "function") {
    window.localStorage.clear();
  }
});
