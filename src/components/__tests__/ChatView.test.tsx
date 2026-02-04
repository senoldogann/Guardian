import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ChatView } from "../ChatView";

const invokeMock = invoke as unknown as Mock;

describe("ChatView", () => {
  it("sends message and renders guru response", async () => {
    const user = userEvent.setup();

    invokeMock.mockResolvedValue("Short answer from Guru");

    render(<ChatView path="/tmp/project" />);

    const input = screen.getByPlaceholderText(/Ask the Guru/i);
    await user.type(input, "Hello Guardian");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(invokeMock).toHaveBeenCalledWith("ask_guru", {
      path: "/tmp/project",
      query: "Hello Guardian",
    });

    expect(await screen.findByText("Short answer from Guru")).toBeInTheDocument();
  });

  it("auto-sends the prompt when provided", async () => {
    invokeMock.mockResolvedValue("Auto response from Guru");

    render(<ChatView path="/tmp/project" autoPrompt="Resolve the stall" />);

    expect(invokeMock).toHaveBeenCalledWith("ask_guru", {
      path: "/tmp/project",
      query: "Resolve the stall",
    });

    expect(await screen.findByText("Auto response from Guru")).toBeInTheDocument();
  });
});
