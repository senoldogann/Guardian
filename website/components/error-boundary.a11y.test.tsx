import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "jest-axe";
import { ErrorFallback } from "./error-boundary";

describe("ErrorFallback accessibility", () => {
  it("has no obvious accessibility violations", async () => {
    const { container } = render(
      <ErrorFallback error={new Error("Test error")} errorInfo={null} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
