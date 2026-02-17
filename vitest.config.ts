import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    clearMocks: true,
    restoreMocks: true,
    exclude: ["tests/e2e/**", "**/node_modules/**", "website/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/__tests__/**", "src/main.tsx"],
      thresholds: {
        lines: 35,
        functions: 35,
        branches: 25,
        statements: 35,
      },
      reporter: ["text", "html", "lcov", "json-summary"],
    },
  },
});
