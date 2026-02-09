import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Exclude Playwright E2E tests from Vitest (they should run with playwright test command)
    exclude: ["**/node_modules/**", "**/e2e/**", "**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/app/**", // App router pages
        "**/content/**", // Content files
        "**/public/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
      ],
      thresholds: {
        statements: 15,
        branches: 15,
        functions: 10,
        lines: 15,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
