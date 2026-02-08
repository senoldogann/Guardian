import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility function", () => {
  it("should merge class names correctly", () => {
    const result = cn("class1", "class2");
    expect(result).toBe("class1 class2");
  });

  it("should handle conditional classes", () => {
    const condition = true;
    const result = cn("base", condition && "conditional");
    expect(result).toBe("base conditional");
  });

  it("should filter out falsy values", () => {
    const result = cn("class1", false && "class2", undefined, null, "class3");
    expect(result).toBe("class1 class3");
  });

  it("should handle tailwind class conflicts", () => {
    const result = cn("px-2 py-1", "px-4");
    // tailwind-merge should keep the last conflicting class
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("should handle empty arguments", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should handle array of classes", () => {
    const result = cn(["class1", "class2"]);
    expect(result).toBe("class1 class2");
  });
});
