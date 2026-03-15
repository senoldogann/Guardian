import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton Component", () => {
  it("should render skeleton element", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeInTheDocument();
  });

  it("should have pulse animation class", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("animate-pulse");
  });

  it("should have default background color", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("bg-neutral-200");
    expect(skeleton).toHaveClass("dark:bg-neutral-800");
  });

  it("should have rounded-md by default", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("rounded-md");
  });

  it("should apply custom className", () => {
    render(<Skeleton data-testid="skeleton" className="h-10 w-full" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("h-10");
    expect(skeleton).toHaveClass("w-full");
  });

  it("should support custom dimensions", () => {
    render(<Skeleton data-testid="skeleton" className="h-20 w-32 rounded-lg" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("h-20");
    expect(skeleton).toHaveClass("w-32");
    expect(skeleton).toHaveClass("rounded-lg");
  });

  it("should pass through HTML attributes", () => {
    render(<Skeleton data-testid="custom-skeleton" aria-label="Loading" />);
    const skeleton = screen.getByTestId("custom-skeleton");
    expect(skeleton).toHaveAttribute("aria-label", "Loading");
  });

  it("should render children if provided", () => {
    render(
      <Skeleton>
        <span>Loading content</span>
      </Skeleton>
    );
    expect(screen.getByText(/loading content/i)).toBeInTheDocument();
  });
});
