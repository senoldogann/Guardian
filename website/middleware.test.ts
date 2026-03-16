import { describe, expect, it } from "vitest";
import { isIgnoredPath } from "./middleware";

describe("middleware ignored paths", () => {
  it("ignores og image route for social crawlers", () => {
    expect(isIgnoredPath("/og")).toBe(true);
  });

  it("keeps locale redirect active for app pages", () => {
    expect(isIgnoredPath("/docs")).toBe(false);
  });
});
