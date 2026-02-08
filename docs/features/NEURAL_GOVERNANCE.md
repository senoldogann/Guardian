# Neural Governance

> **Feature:** Local LLM support without external API calls.

## What is it?
Neural Governance allows Guardian to connect to a local LLM (like Ollama) running on your machine. This means:
*   **Full Privacy:** Your code never leaves your network.
*   **Zero Cost:** No API fees.
*   **Offline Access:** Works without internet (once models are downloaded).

## Quick Setup

### 1. Install Ollama
```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or via Homebrew
brew install ollama
```

### 2. Pull a Model
```bash
ollama pull llama3:8b
# or
ollama pull codellama
```

### 3. Start Ollama Server
```bash
ollama serve
# Runs on http://127.0.0.1:11434
```

### 4. Select in Guardian
1. Open **Settings** in Guardian.
2. Go to **Provider**.
3. Select **Ollama**.
4. Click **Refresh Models** to see downloaded models.
5. Select your model.
6. **Launch Guardian!**

## Recommended Models

| Model | Size | Best For |
|-------|------|----------|
| `llama3:8b` | 4.7 GB | General coding, fast |
| `codellama:13b` | 7.3 GB | Code-specific, accurate |
| `deepseek-coder:6.7b` | 3.8 GB | Code review, efficient |

## Switching Between Local & Cloud
You can switch providers at any time via Settings. Both local (Ollama) and cloud (OpenAI, Anthropic, Gemini) are fully supported.
