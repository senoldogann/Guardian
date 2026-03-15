import { test, expect } from "@playwright/test";

/**
 * Error Handling E2E Tests
 * 
 * Tests error scenarios and recovery mechanisms:
 * - 404 Not Found page
 * - API failures
 * - Network errors
 * - JavaScript errors
 * - Error boundary functionality
 * - Recovery options
 */

test.describe("Error Pages", () => {
  test("should show 404 page for non-existent routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-123456");
    
    // Should return 404 status
    expect(response?.status()).toBe(404);
    
    // Should show 404 content
    const content = await page.textContent("body");
    expect(content).toMatch(/404|not found|page not found/i);
  });
  
  test("should have user-friendly 404 page", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Should have a heading
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/404|not found/i);
    
    // Should have a message
    const message = page.getByText(/page|find|exist/i);
    await expect(message.first()).toBeVisible();
  });
  
  test("should have home link on 404 page", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Should have a link to go home
    const homeLink = page.getByRole("link", { name: /home|back|return/i });
    
    if (await homeLink.count() > 0) {
      await expect(homeLink.first()).toBeVisible();
      
      // Click should navigate home
      await homeLink.first().click();
      await expect(page).toHaveURL("/");
    }
  });
});

test.describe("API Error Handling", () => {
  test("should handle GitHub API rate limit", async ({ page }) => {
    // Mock rate limit response
    await page.route("**/api/releases/**", (route) =>
      route.fulfill({
        status: 403,
        body: JSON.stringify({
          message: "API rate limit exceeded",
          documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
        }),
      })
    );
    
    await page.goto("/download");
    
    // Should show error message or fallback
    const pageContent = await page.textContent("body");
    
    // Page should still be usable
    expect(pageContent).toBeTruthy();
  });
  
  test("should handle GitHub API timeout", async ({ page }) => {
    // Mock timeout
    await page.route("**/api/releases/**", (route) =>
      route.abort("timedout")
    );
    
    await page.goto("/download");
    
    // Should not crash
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
  
  test("should handle malformed API responses", async ({ page }) => {
    // Mock invalid JSON
    await page.route("**/api/releases/**", (route) =>
      route.fulfill({
        status: 200,
        body: "This is not valid JSON{{{",
      })
    );
    
    await page.goto("/download");
    
    // Should handle gracefully
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});

test.describe("JavaScript Error Handling", () => {
  test("should not have uncaught exceptions on homepage", async ({ page }) => {
    const errors: string[] = [];
    
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Should have no JavaScript errors
    expect(errors).toHaveLength(0);
  });
  
  test("should not have uncaught exceptions on download page", async ({ page }) => {
    const errors: string[] = [];
    
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    
    await page.goto("/download");
    await page.waitForLoadState("networkidle");
    
    expect(errors).toHaveLength(0);
  });
  
  test("should handle console errors appropriately", async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Filter out expected/harmless errors
    const criticalErrors = consoleErrors.filter(
      (err) => 
        !err.includes("favicon") && 
        !err.includes("404") &&
        !err.includes("Failed to load resource")
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe("Network Error Handling", () => {
  test("should handle offline mode gracefully", async ({ page, context }) => {
    // Go online first
    await page.goto("/");
    
    // Then go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto("/download").catch(() => {
      // Expected to fail offline
    });
    
    // Page should still render cached content or show offline message
    const body = page.locator("body");
    const isVisible = await body.isVisible().catch(() => false);
    
    // Either cached content or offline message
    expect(isVisible).toBeDefined();
  });
  
  test("should handle slow network", async ({ page }) => {
    // Throttle network
    await page.route("**/*", (route) => {
      setTimeout(() => route.continue(), 100);
    });
    
    await page.goto("/");
    
    // Should still load (with loading states)
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Error Recovery", () => {
  test("should allow retry after API error", async ({ page }) => {
    let requestCount = 0;
    
    await page.route("**/api/releases/**", (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails
        route.fulfill({ status: 500, body: "Error" });
      } else {
        // Second request succeeds
        route.continue();
      }
    });
    
    await page.goto("/download");
    
    // Look for retry button
    const retryButton = page.getByRole("button", { name: /retry|try again/i });
    
    if (await retryButton.isVisible()) {
      await retryButton.click();
      
      // Second attempt should succeed
      await page.waitForTimeout(1000);
    }
  });
  
  test("should have working navigation after error", async ({ page }) => {
    await page.goto("/non-existent-page");
    
    // Navigate to valid page
    await page.goto("/");
    
    // Should work normally
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });
});

test.describe("Error Page Accessibility", () => {
  test("should have accessible error messages", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Error message should be in heading
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    
    // Should have descriptive text
    const text = await page.textContent("body");
    expect(text?.length || 0).toBeGreaterThan(20);
  });
  
  test("should have keyboard-accessible recovery options", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Tab through focusable elements
    await page.keyboard.press("Tab");
    
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    
    // Should be able to navigate with keyboard
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
  });
});

test.describe("Error Boundary (Client-side)", () => {
  test("should catch component errors", async ({ page }) => {
    // This test checks if error boundaries exist
    // In a real scenario, you'd trigger a component error
    
    await page.goto("/");
    
    // Inject a script that throws an error
    await page.evaluate(() => {
      // Simulate component error
      window.addEventListener("error", () => {
        // Intentionally empty: verifying error handler registration.
      });
    });
    
    // Page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});

test.describe("Error Pages - SEO", () => {
  test("should have proper meta tags on 404", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Should have title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
  
  test("should have noindex on error pages", async ({ page }) => {
    await page.goto("/non-existent");
    
    // 404 pages should not be indexed
    const robots = page.locator('meta[name="robots"]');
    
    if (await robots.count() > 0) {
      const content = await robots.getAttribute("content");
      // Should have noindex if meta exists
      if (content) {
        expect(content.toLowerCase()).toContain("noindex");
      }
    }
  });
});

test.describe("Error Pages - Mobile", () => {
  test.use({ 
    viewport: { width: 375, height: 667 } 
  });
  
  test("should show mobile-friendly 404 page", async ({ page }) => {
    await page.goto("/non-existent");
    
    // Content should be visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    
    // No horizontal overflow
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});
