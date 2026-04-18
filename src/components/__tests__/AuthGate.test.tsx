import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AuthGate, type AuthGateProps } from "../AuthGate";

vi.mock("../../lib/tauri", () => ({
  openExternal: vi.fn(),
}));

const baseProps: AuthGateProps = {
  authDevice: null,
  authLoading: false,
  authError: null,
  authWarning: null,
  authCountdown: null,
  authSession: null,
  isDesktop: true,
  showAuthGate: false,
  onStartLogin: vi.fn(),
  onCompleteLogin: vi.fn(),
  onCancel: vi.fn(),
};

describe("AuthGate", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when showAuthGate is false and no device", () => {
    const { container } = render(<AuthGate {...baseProps} />);
    expect(container.textContent).toBe("");
  });

  it("shows sign-in gate when showAuthGate is true", () => {
    render(<AuthGate {...baseProps} showAuthGate />);

    const signInButton = screen.getByRole("button");
    expect(signInButton).toBeInTheDocument();
  });

  it("fires onStartLogin when sign-in button is clicked", () => {
    const onStartLogin = vi.fn();
    render(<AuthGate {...baseProps} showAuthGate onStartLogin={onStartLogin} />);

    const signInButton = screen.getByRole("button");
    fireEvent.click(signInButton);
    expect(onStartLogin).toHaveBeenCalledTimes(1);
  });

  it("disables sign-in button when not on desktop", () => {
    render(<AuthGate {...baseProps} showAuthGate isDesktop={false} />);

    const signInButton = screen.getByRole("button");
    expect(signInButton).toBeDisabled();
  });

  it("shows device code flow when authDevice is provided", () => {
    render(
      <AuthGate
        {...baseProps}
        authDevice={{
          device_code: "abc123",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        }}
      />,
    );

    expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
  });

  it("opens external URL when Open GitHub button is clicked", async () => {
    const { openExternal } = await import("../../lib/tauri");

    render(
      <AuthGate
        {...baseProps}
        authDevice={{
          device_code: "abc123",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        }}
      />,
    );

    const openBtn = screen.getAllByRole("button").find((btn) =>
      btn.textContent?.toLowerCase().includes("github"),
    );
    expect(openBtn).toBeDefined();
    fireEvent.click(openBtn!);
    expect(openExternal).toHaveBeenCalledWith("https://github.com/login/device");
  });

  it("displays auth error message", () => {
    render(
      <AuthGate {...baseProps} showAuthGate authError="Token expired" />,
    );

    expect(screen.getByText("Token expired")).toBeInTheDocument();
  });

  it("displays auth warning message", () => {
    render(
      <AuthGate {...baseProps} showAuthGate authWarning="Rate limited" />,
    );

    expect(screen.getByText("Rate limited")).toBeInTheDocument();
  });
});
