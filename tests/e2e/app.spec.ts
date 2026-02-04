import { test, expect } from "@playwright/test";

test("loads monitor view", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Guardian V4 Control Hub")).toBeVisible();
  await expect(page.getByRole("button", { name: /Monitor/i })).toBeVisible();
});

test("toggles theme", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  const before = await root.getAttribute("data-theme");

  await page.getByTitle("Toggle Theme").click();

  const expected = before === "dark" ? "light" : "dark";
  await expect(root).toHaveAttribute("data-theme", expected);
});

test("navigates to Guru view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Guru/i }).click();
  await expect(page.getByRole("heading", { name: "Guru Architect" })).toBeVisible();
});
