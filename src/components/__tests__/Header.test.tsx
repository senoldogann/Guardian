import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Header, type HeaderProps } from "../Header";

const baseProps: HeaderProps = {
  active: true,
  stats: { critical: 3, warning: 7, info: 2, total: 12 },
  usage: { tokens: 500, calls: 42 },
  authSession: null,
  isDesktop: true,
  authLoading: false,
  onLogout: vi.fn(),
  onSettingsClick: vi.fn(),
};

describe("Header", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the Guardian brand name", () => {
    render(<Header {...baseProps} />);
    expect(screen.getByText("Guardian")).toBeInTheDocument();
  });

  it("shows settings button and fires onSettingsClick", () => {
    const onSettingsClick = vi.fn();
    render(<Header {...baseProps} onSettingsClick={onSettingsClick} />);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsButton);
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it("displays stat pills with correct values", () => {
    render(<Header {...baseProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders user avatar and login when authSession is provided", () => {
    render(
      <Header
        {...baseProps}
        authSession={{
          login: "testuser",
          id: 1,
          avatar_url: "https://example.com/avatar.png",
        }}
      />,
    );

    expect(screen.getByText("@testuser")).toBeInTheDocument();
    const avatar = screen.getByAltText("testuser");
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("fires onLogout when logout button is clicked", () => {
    const onLogout = vi.fn();
    render(
      <Header
        {...baseProps}
        authSession={{ login: "testuser", id: 1 }}
        onLogout={onLogout}
      />,
    );

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutButton);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("disables logout button when not on desktop", () => {
    render(
      <Header
        {...baseProps}
        isDesktop={false}
        authSession={{ login: "testuser", id: 1 }}
      />,
    );

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    expect(logoutButton).toBeDisabled();
  });
});
