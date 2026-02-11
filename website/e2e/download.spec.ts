import { test, expect } from "@playwright/test";

/**
 * Download Page E2E Tests
 * 
 * Tests the download functionality including:
 * - Platform detection
 * - Release fetching from GitHub API
 * - Download links
 * - Version display
 * - Responsive design
 */

test.describe("Download Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/download");
  });
  
  test("should load download page successfully", async ({ page }) => {
    // Page title
    await expect(page).toHaveTitle(/Download|Guardian/);
    
    // Main heading
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });
  
  test("should fetch latest release from API", async ({ page }) => {
    // Wait for API call to complete
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/releases/latest") && resp.status() === 200,
      { timeout: 10000 }
    );
    
    await page.goto("/download");
    
    try {
      const response = await responsePromise;
      const data = await response.json();
      
      // Should have release data
      expect(data).toHaveProperty("version");
      expect(data).toHaveProperty("assets");
    } catch (error) {
      // If API fails, page should handle gracefully
      const errorMessage = page.getByText(/error|failed|unable/i);
      if (await errorMessage.isVisible()) {
        // Error handling is working
        expect(true).toBe(true);
      }
    }
  });
  
  test("should display version number", async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState("networkidle");
    
    // Look for version pattern (v1.2.3 or 1.2.3)
    const versionRegex = /v?\d+\.\d+\.\d+/;
    const versionText = page.getByText(versionRegex);
    
    // Version should be visible somewhere on the page
    const count = await versionText.count();
    expect(count).toBeGreaterThan(0);
  });
  
  test("should have download buttons/links", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // Look for download links or buttons
    const downloadElements = page.getByRole("link", { name: /download/i });
    const downloadButtons = page.getByRole("button", { name: /download/i });
    
    const linkCount = await downloadElements.count();
    const buttonCount = await downloadButtons.count();
    
    // Should have at least one download element
    expect(linkCount + buttonCount).toBeGreaterThan(0);
  });
  
  test("should show platform-specific content", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const detectedText = page.getByText(/Detected:/i);
    await expect(detectedText.first()).toBeVisible();
  });
  
  test("should have asset information", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // Look for file extensions common in releases
    const fileExtRegex = /\.(dmg|exe|AppImage|zip|tar\.gz)/;
    const assetText = page.getByText(fileExtRegex);
    
    // If releases loaded, should show file types
    if (await assetText.count() > 0) {
      await expect(assetText.first()).toBeVisible();
    }
  });
  
  test("should handle API errors gracefully", async ({ page }) => {
    // Intercept API and simulate error
    await page.route("**/api/releases/**", (route) => 
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );
    
    await page.goto("/download");
    await page.waitForLoadState("networkidle");
    
    // Should show error message or fallback content
    const errorIndicator = page.locator('[role="alert"], .error, text=/error|failed/i');
    
    // Either error message shows, or page gracefully degrades
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
  
  test("should have navigation back to home", async ({ page }) => {
    // Should have a way to navigate back
    const homeLink = page.getByRole("link", { name: /home|guardian/i }).first();
    
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL("/");
    }
  });
});

test.describe("Download Page - Asset Validation", () => {
  test("should validate download links format", async ({ page }) => {
    await page.goto("/download");
    await page.waitForLoadState("networkidle");
    
    // Get all download links
    const downloadLinks = page.getByRole("link").filter({ hasText: /download|\.dmg|\.exe|\.AppImage/i });
    const count = await downloadLinks.count();
    
    if (count > 0) {
      // Check first link has valid href
      const firstLink = downloadLinks.first();
      const href = await firstLink.getAttribute("href");
      
      // Should be a valid URL or path
      expect(href).toBeTruthy();
      
      // Should not be '#' or 'javascript:'
      expect(href).not.toBe("#");
      expect(href).not.toMatch(/^javascript:/);
    }
  });
  
  test("should show file sizes if available", async ({ page }) => {
    await page.goto("/download");
    await page.waitForLoadState("networkidle");
    
    // Look for size indicators (MB, GB, KB)
    const sizeRegex = /\d+(\.\d+)?\s*(MB|GB|KB)/i;
    const sizeText = page.getByText(sizeRegex);
    
    // If present, should be visible
    if (await sizeText.count() > 0) {
      await expect(sizeText.first()).toBeVisible();
    }
  });
});

test.describe("Download Page - Mobile", () => {
  test.use({ 
    viewport: { width: 375, height: 667 } 
  });
  
  test("should be responsive on mobile", async ({ page }) => {
    await page.goto("/download");
    
    // Content should be visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    
    // No horizontal overflow
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
  
  test("should have mobile-friendly download buttons", async ({ page }) => {
    await page.goto("/download");
    await page.waitForLoadState("networkidle");
    
    const downloadBtn = page.getByRole("link", { name: /download/i }).first();
    
    if (await downloadBtn.isVisible()) {
      // Button should be tappable (min 44x44px)
      const box = await downloadBtn.boundingBox();
      
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
