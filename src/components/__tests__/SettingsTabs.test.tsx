import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmbeddingTab } from "../settings/EmbeddingTab";
import { AboutTab } from "../settings/AboutTab";
import { ExportTab } from "../settings/ExportTab";
import { KeyManagementTab } from "../settings/KeyManagementTab";
import type {
    EmbeddingSettingsProps,
    ProviderSettingsProps,
    UpdateSettingsProps,
} from "../settings/types";

const createProviderProps = (providerId: string, hasKey: boolean): ProviderSettingsProps => ({
    providerDraft: {
        provider_id: providerId,
        base_url: providerId === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1",
        model: providerId === "ollama" ? "llama3.2" : "gpt-4.1-mini",
    },
    providerError: null,
    providerSaving: false,
    providerModels: [],
    providerModelLoading: false,
    providerModelError: null,
    providerTestLoading: false,
    providerTestMessage: null,
    providerTestError: null,
    onProviderChange: vi.fn(),
    onBaseUrlChange: vi.fn(),
    onModelChange: vi.fn(),
    onRefreshModels: vi.fn(),
    onSaveProvider: vi.fn(),
    onTestProviderConnection: vi.fn(),
    apiKeyStatus: {
        has_key: hasKey,
        source: hasKey ? "keychain" : "none",
    },
    apiKeyInput: "",
    apiKeyError: null,
    apiKeySaving: false,
    onApiKeyFocus: vi.fn(),
    onApiKeyChange: vi.fn(),
    onSaveApiKey: vi.fn(),
    onClearApiKey: vi.fn(),
});

const createEmbeddingProps = (mode: "auto" | "openai" | "ollama" | "local"): EmbeddingSettingsProps => ({
    embeddingDraft: {
        mode,
        openai_base_url: "https://api.openai.com/v1",
        ollama_base_url: "http://localhost:11434",
        openai_model: "text-embedding-3-small",
        ollama_model: "nomic-embed-text",
    },
    embeddingError: null,
    embeddingSaving: false,
    embeddingOpenAiKeyStatus: {
        has_key: false,
        source: "none",
    },
    embeddingOpenAiKeyInput: "",
    embeddingOpenAiKeyMasked: false,
    embeddingOpenAiKeyError: null,
    embeddingOpenAiKeySaving: false,
    onEmbeddingModeChange: vi.fn(),
    onEmbeddingOpenAiBaseUrlChange: vi.fn(),
    onEmbeddingOllamaBaseUrlChange: vi.fn(),
    onEmbeddingOpenAiModelChange: vi.fn(),
    onEmbeddingOllamaModelChange: vi.fn(),
    onSaveEmbeddingSettings: vi.fn(),
    onRefreshEmbeddingSettings: vi.fn(),
    onEmbeddingOpenAiKeyFocus: vi.fn(),
    onEmbeddingOpenAiKeyChange: vi.fn(),
    onSaveEmbeddingOpenAiKey: vi.fn(),
    onClearEmbeddingOpenAiKey: vi.fn(),
});

const createUpdateProps = (status: "idle" | "available" | "up_to_date"): UpdateSettingsProps => ({
    updateInfo: {
        status,
        current_version: "1.3.0",
        latest_version: status === "available" ? "1.3.1" : "1.3.0",
        notes: null,
        error: null,
        last_checked_at: "2026-04-18T12:00:00.000Z",
    },
    updateChecking: false,
    updateInstalling: false,
    updateError: null,
    onCheckUpdates: vi.fn(),
    onInstallUpdate: vi.fn(),
});

describe("Settings tabs", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("shows provider setup warning for cloud providers without an API key", () => {
        render(<KeyManagementTab isDesktop providerProps={createProviderProps("openai", false)} />);

        expect(
            screen.getByText("Setup required: add your OpenAI API key to list models and start monitoring."),
        ).toBeInTheDocument();
    });

    it("does not show provider setup warning for Ollama without an API key", () => {
        render(<KeyManagementTab isDesktop providerProps={createProviderProps("ollama", false)} />);

        expect(screen.getAllByText(/API key/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Enter your Ollama/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Setup required:/i)).not.toBeInTheDocument();
    });

    it("shows only OpenAI inputs and key section in OpenAI embedding mode", () => {
        render(<EmbeddingTab isDesktop embeddingProps={createEmbeddingProps("openai")} />);

        expect(screen.getByText("OpenAI Base URL")).toBeInTheDocument();
        expect(screen.getByText("OpenAI Model")).toBeInTheDocument();
        expect(screen.getByText("OpenAI Embedding Key (Optional)")).toBeInTheDocument();
        expect(screen.queryByText("Ollama Base URL")).not.toBeInTheDocument();
        expect(screen.queryByText("Ollama Model")).not.toBeInTheDocument();
    });

    it("shows only Ollama inputs in Ollama embedding mode", () => {
        render(<EmbeddingTab isDesktop embeddingProps={createEmbeddingProps("ollama")} />);

        expect(screen.getByText("Ollama Base URL")).toBeInTheDocument();
        expect(screen.getByText("Ollama Model")).toBeInTheDocument();
        expect(screen.queryByText("OpenAI Base URL")).not.toBeInTheDocument();
        expect(screen.queryByText("OpenAI Embedding Key (Optional)")).not.toBeInTheDocument();
        expect(screen.getByText(/Local setup:/)).toBeInTheDocument();
    });

    it("shows update actions when an update is available", () => {
        render(<AboutTab isDesktop updateProps={createUpdateProps("available")} />);

        expect(screen.getByRole("button", { name: "Check Now" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Install Update" })).toBeInTheDocument();
        expect(screen.getByText("View changelog on website")).toBeInTheDocument();
    });

    it("shows export progress state and rotating message when export is running", () => {
        render(
            <ExportTab
                onExportPDF={vi.fn()}
                exportPdfInProgress
                exportPdfError={null}
            />,
        );

        expect(screen.getByRole("button", { name: "Exporting..." })).toBeDisabled();
        expect(screen.getByText("Preparing report blocks...")).toBeInTheDocument();
    });
});