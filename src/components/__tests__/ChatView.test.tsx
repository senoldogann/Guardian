import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ChatView } from "../ChatView";

const invokeMock = invoke as unknown as Mock;

describe("ChatView", () => {
  it("sends message and renders guru response", async () => {
    const user = userEvent.setup();

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_chat_history") {
        return Promise.resolve([]);
      }
      if (cmd === "ask_guru") {
        return Promise.resolve("Short answer from Guru");
      }
      return Promise.resolve(null);
    });

    render(
      <ChatView
        path="/tmp/project"
        webSearchEnabled={false}
        webSearchReady={false}
        onWebSearchToggle={() => {}}
      />
    );

    const input = screen.getByPlaceholderText(/Ask the Guru/i);
    await user.type(input, "Hello Guardian");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(invokeMock).toHaveBeenCalledWith("ask_guru", {
      path: "/tmp/project",
      query: "Hello Guardian",
      webSearch: false,
    });

    expect(await screen.findByText("Short answer from Guru")).toBeInTheDocument();
  });

  it("auto-sends the prompt when provided", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_chat_history") {
        return Promise.resolve([]);
      }
      if (cmd === "ask_guru") {
        return Promise.resolve("Auto response from Guru");
      }
      return Promise.resolve(null);
    });

    render(
        <ChatView
          path="/tmp/project"
          autoPrompt={{ id: "stall-1", prompt: "Resolve the stall", useWebSearch: false }}
          webSearchEnabled={false}
          webSearchReady={false}
          onWebSearchToggle={() => {}}
        />
    );

    expect(invokeMock).toHaveBeenCalledWith("ask_guru", {
      path: "/tmp/project",
      query: "Resolve the stall",
      webSearch: false,
    });

    expect(await screen.findByText("Auto response from Guru")).toBeInTheDocument();
  });
});
