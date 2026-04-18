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
    exclude: [
      "tests/e2e/**",
      "**/node_modules/**",
      "website/**",
      ".maestro/**",
      ".agents/**",
      "scripts/**",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/main.tsx",
        "src/**/*.generated.*",
        "src/**/*.d.ts",
        "src/vite-env.d.ts",
        "*.config.{ts,js,mjs}",
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 35,
        statements: 40,
      },
      reporter: ["text", "html", "lcov", "json-summary"],
    },
  },
});
