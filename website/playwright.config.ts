import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Guardian Website
 * 
 * Tests the production-ready website across multiple browsers and devices.
 * Includes mobile viewport testing and accessibility checks.
 */

const fullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === "1" || !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Limit workers on CI for stability
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["list"],
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: "http://localhost:3000",
    
    // Collect trace on first retry
    trace: "on-first-retry",
    
    // Screenshot on failure
    screenshot: "only-on-failure",
    
    // Video on failure
    video: "retain-on-failure",
  },
  
  // Test projects for different browsers and devices
  projects: fullMatrix
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
        {
          name: "mobile-chrome",
          use: { ...devices["Pixel 5"] },
        },
        {
          name: "mobile-safari",
          use: { ...devices["iPhone 13"] },
        },
        {
          name: "tablet",
          use: { ...devices["iPad Pro"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],
  
  // Run local dev server before starting tests
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
  },
});
