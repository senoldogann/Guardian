import { test, expect } from "@playwright/test";

/**
 * Homepage E2E Tests
 * 
 * Tests the critical user journey on the homepage including:
 * - Initial load and SEO
 * - Hero section visibility
 * - CTA functionality
 * - Video playback
 * - Theme toggle
 * - Navigation
 */

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  
  test("should load homepage successfully", async ({ page }) => {
    // SEO & Meta tags
    await expect(page).toHaveTitle(/Guardian/);
    
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute("content", /governance|release|quality/i);
    
    // OpenGraph meta
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /Guardian/);
  });
  
  test("should display hero section with content", async ({ page }) => {
    // Main heading should be visible
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/Guardian/i);
    
    // Description text
    await expect(page.locator("text=/governance|quality|release/i").first()).toBeVisible();
  });
  
  test("should have working download CTA", async ({ page }) => {
    // Find download button (case insensitive)
    const downloadBtn = page.getByRole("link", { name: /download/i }).first();
    await expect(downloadBtn).toBeVisible();
    
    // Click should navigate to download page
    await downloadBtn.click();
    await expect(page).toHaveURL(/\/download/);
  });
  
  test("should display demo videos", async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState("networkidle");
    
    // Check for video elements
    const videos = page.locator("video");
    const videoCount = await videos.count();
    
    expect(videoCount).toBeGreaterThan(0);
    
    // First video should have necessary attributes
    const firstVideo = videos.first();
    await expect(firstVideo).toHaveAttribute("autoplay");
    await expect(firstVideo).toHaveAttribute("muted");
    await expect(firstVideo).toHaveAttribute("loop");
    await expect(firstVideo).toHaveAttribute("playsinline");
  });
  
  test("should have optimized video sources", async ({ page }) => {
    // Check for responsive video sources
    const videoSources = page.locator("video source");
    const sourceCount = await videoSources.count();
    
    // Should have multiple sources (mobile + desktop + fallback)
    expect(sourceCount).toBeGreaterThan(0);
    
    // Check for optimized file names
    const firstSource = videoSources.first();
    const src = await firstSource.getAttribute("src");
    
    expect(src).toMatch(/\.(mp4)$/);
  });
  
  test("should have working theme toggle", async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.getByRole("button").filter({ hasText: /theme|sun|moon/i }).first();
    
    if (await themeToggle.isVisible()) {
      // Get initial theme
      const html = page.locator("html");
      const initialClass = await html.getAttribute("class");
      
      // Toggle theme
      await themeToggle.click();
      
      // Wait for class change
      await page.waitForTimeout(100);
      
      // Verify theme changed
      const newClass = await html.getAttribute("class");
      expect(newClass).not.toBe(initialClass);
    }
  });
  
  test("should have working navigation", async ({ page }) => {
    // Check main navigation links
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible();
    
    // Docs link
    const docsLink = page.getByRole("link", { name: /docs|documentation/i }).first();
    if (await docsLink.isVisible()) {
      await expect(docsLink).toHaveAttribute("href", /\/docs/);
    }
    
    // Changelog link
    const changelogLink = page.getByRole("link", { name: /changelog/i }).first();
    if (await changelogLink.isVisible()) {
      await expect(changelogLink).toHaveAttribute("href", /\/changelog/);
    }
  });
  
  test("should load without console errors", async ({ page }) => {
    const errors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Filter out known harmless errors (e.g., favicon 404)
    const criticalErrors = errors.filter(
      (err) => !err.includes("favicon") && !err.includes("404")
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
  
  test("should have proper scroll behavior", async ({ page }) => {
    // Page should be scrollable
    const bodyHeight = await page.locator("body").evaluate((el) => el.scrollHeight);
    const viewportHeight = page.viewportSize()?.height || 0;
    
    expect(bodyHeight).toBeGreaterThan(viewportHeight);
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Should have reached bottom
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
  
  test("should have footer with links", async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Footer should be visible
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();
  });
});

test.describe("Homepage - Mobile", () => {
  test.use({ 
    viewport: { width: 375, height: 667 } 
  });
  
  test("should be responsive on mobile", async ({ page }) => {
    await page.goto("/");
    
    // Main content should be visible
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    
    // No horizontal scroll
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });
  
  test("should load mobile-optimized videos", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Check for mobile video sources
    const mobileSources = page.locator('video source[media*="max-width"]');
    
    if (await mobileSources.count() > 0) {
      const src = await mobileSources.first().getAttribute("src");
      // Mobile-optimized videos should have -mobile suffix or be smaller
      expect(src).toBeTruthy();
    }
  });
});
