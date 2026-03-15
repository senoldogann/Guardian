#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from maestro_telemetry import traced_script

ROOT = Path(__file__).resolve().parent.parent
MAESTRO = ROOT / ".maestro"
SHARED_AGENTS = MAESTRO / "agents"
SHARED_SKILLS = MAESTRO / "skills"
SHARED_WORKFLOWS = MAESTRO / "workflows"
ANTIGRAVITY_PACK = MAESTRO / "provider-packs" / "antigravity"
COPILOT_PACK = MAESTRO / "provider-packs" / "copilot" / "github"
OPENCODE_PACK = MAESTRO / "provider-packs" / "opencode"
PROJECT_PROVIDERS_PATH = MAESTRO / "project-providers.json"

SUPPORTED_PROVIDERS = (
    "antigravity",
    "claude",
    "codex",
    "copilot",
    "opencode",
)

UNSUPPORTED_PATHS = [
    ".cursor",
    ".roo",
    ".windsurf",
    ".kilocode",
    ".clinerules",
    ".roorules",
    ".cursorrules",
    ".windsurfrules",
    ".aiderules",
    ".kilocoderules",
    ".rules",
    "QWEN.md",
]

EXTRANEOUS_PATHS = [
    ".DS_Store",
    ".opencode/.gitignore",
    ".opencode/package.json",
    ".opencode/bun.lock",
    ".opencode/node_modules",
]

MANAGED_PROVIDER_PATHS = {
    "antigravity": [ROOT / ".agent"],
    "claude": [ROOT / "CLAUDE.md", ROOT / ".claude"],
    "codex": [ROOT / ".codex", ROOT / ".agents"],
    "copilot": [
        ROOT / ".github" / "copilot-instructions.md",
        ROOT / ".github" / "instructions",
        ROOT / ".github" / "agents",
        ROOT / ".github" / "prompts",
        ROOT / ".github" / "skills",
        ROOT / ".vscode" / "settings.json",
    ],
    "opencode": [ROOT / "opencode.json", ROOT / ".opencode"],
}

CLAUDE_SETTINGS = {
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "permissions": {
        "defaultMode": "acceptEdits",
        "disableBypassPermissionsMode": "disable",
        "allow": [
            "Bash(pwd)",
            "Bash(ls)",
            "Bash(ls *)",
            "Bash(readlink *)",
            "Bash(find *)",
            "Bash(rg *)",
            "Bash(cat *)",
            "Bash(sed *)",
            "Bash(head *)",
            "Bash(tail *)",
            "Bash(wc *)",
            "Bash(sort *)",
            "Bash(uniq *)",
            "Bash(diff *)",
            "Bash(git status)",
            "Bash(git status *)",
            "Bash(git diff)",
            "Bash(git diff *)",
            "Bash(python3 scripts/bootstrap_providers.py *)",
            "Bash(python3 scripts/sync_agents.py)",
            "Bash(python3 scripts/verify_all.py)",
            "Bash(python3 scripts/generate_skill_index.py)",
            "Bash(python3 scripts/provider_config_validator.py)",
            "Bash(python3 scripts/checklist.py)",
            "Bash(python3 scripts/dependency_analyzer.py)",
            "Bash(scripts/skill.sh *)",
            "WebFetch",
            "WebSearch",
        ],
        "ask": [
            "Bash(python3 *)",
            "Bash(git add *)",
            "Bash(git commit *)",
            "Bash(git push *)",
        ],
        "deny": [
            "Bash(curl *)",
            "Bash(wget *)",
            "Bash(sudo *)",
            "Bash(rm -rf *)",
            "Bash(git reset --hard)",
            "Bash(git reset --hard *)",
            "Bash(git clean -fd)",
            "Bash(git clean -fd *)",
            "Read(./.env)",
            "Read(./.env.*)",
            "Read(./secrets/**)",
            "Read(./config/credentials.json)",
            "Read(./*.pem)",
            "Read(./*.key)",
        ],
    },
}


def build_codex_config() -> str:
    return """# Codex CLI - Project Configuration
# Ref: https://developers.openai.com/codex/config-basic

model = "gpt-5.4"
# GPT-5.4 supports a 1,050,000-token context window in OpenAI's official model docs.
model_context_window = 1050000
# Compact before the hard limit so Codex preserves headroom for the next response.
model_auto_compact_token_limit = 1000000
# Use scripts/codex-*.sh for task-specific overrides.
# Project-local profile blocks are intentionally omitted because current Codex CLI
# builds do not resolve them consistently across subcommands.

project_doc_max_bytes = 65536
project_doc_fallback_filenames = ["AGENTS.md", ".maestro/SYSTEM.md"]

[features]
multi_agent = true

[agents.reviewer]
description = "Kod incelemesi, mimari, guvenlik, performans ve test risk analizi"

[agents.explorer]
description = "Hızlı codebase keşfi (read-only)"

[agents.researcher]
description = "Guncel dokumantasyon, web arastirmasi ve kaynak dogrulama"
"""


def build_claude_md() -> str:
    return """# Maestro Claude Adapter

Read `AGENTS.md` first, then `.maestro/SYSTEM.md`.

## Claude Runtime
- Use provider-local assets under `.claude/`
- Shared agents live at `.claude/agents`
- Shared skills live at `.claude/skills`
- Shared slash commands live at `.claude/commands`

## Required Workflow
- After any rule or adapter change, run `python3 scripts/sync_agents.py`
- Before considering the task done, run `python3 scripts/verify_all.py`
- If a shared capability is missing, run `scripts/skill.sh ensure "<query-or-skill-name>"`
"""


def build_opencode_config() -> dict:
    return {
        "$schema": "https://opencode.ai/config.json",
        "model": "opencode/minimax-m2.5-free",
        "small_model": "opencode/minimax-m2.5-free",
        "default_agent": "build",
        "instructions": [
            "AGENTS.md",
            ".maestro/SYSTEM.md",
        ],
        "permission": {
            "*": "ask",
            "external_directory": "deny",
            "doom_loop": "deny",
            "webfetch": "allow",
            "websearch": "allow",
            "bash": {
                "*": "ask",
                "pwd": "allow",
                "ls *": "allow",
                "readlink *": "allow",
                "find *": "allow",
                "rg *": "allow",
                "cat *": "allow",
                "sed *": "allow",
                "head *": "allow",
                "tail *": "allow",
                "wc *": "allow",
                "git status*": "allow",
                "git diff*": "allow",
                "python3 scripts/bootstrap_providers.py*": "allow",
                "python3 scripts/sync_agents.py*": "allow",
                "python3 scripts/verify_all.py*": "allow",
                "python3 scripts/generate_skill_index.py*": "allow",
                "python3 scripts/provider_config_validator.py*": "allow",
                "python3 scripts/checklist.py*": "allow",
                "python3 scripts/dependency_analyzer.py*": "allow",
                "scripts/skill.sh*": "allow",
                "rm *": "deny",
                "sudo *": "deny",
            },
            "read": {
                "*": "allow",
                ".env": "deny",
                ".env.*": "deny",
                "secrets/**": "deny",
                "*.pem": "deny",
                "*.key": "deny",
                "config/credentials.json": "deny",
            },
            "edit": {
                "*": "ask",
                "AGENTS.md": "allow",
                ".maestro/**": "allow",
                ".agent/**": "allow",
                ".codex/**": "allow",
                ".claude/**": "allow",
                ".github/**": "allow",
                ".opencode/**": "allow",
                ".vscode/**": "allow",
                "opencode.json": "allow",
                "scripts/**": "allow",
            },
        },
        "agent": {
            "review": {
                "description": "Read-only review for provider rules, drift, security, and verification gaps",
                "mode": "subagent",
                "temperature": 0.1,
                "permission": {
                    "edit": "deny",
                    "webfetch": "allow",
                    "bash": {
                        "*": "ask",
                        "git status*": "allow",
                        "git diff*": "allow",
                        "find *": "allow",
                        "rg *": "allow",
                        "cat *": "allow",
                        "sed *": "allow",
                        "head *": "allow",
                        "tail *": "allow",
                        "wc *": "allow",
                        "python3 scripts/checklist.py*": "allow",
                        "python3 scripts/dependency_analyzer.py*": "allow",
                        "python3 scripts/provider_config_validator.py*": "allow",
                        "python3 scripts/verify_all.py*": "allow",
                    },
                },
                "prompt": "Review changes to this rules repository. Focus on provider-doc drift, unsupported config keys, architecture regressions, security exposure, performance blind spots, missing edge-case coverage, and verification gaps. Do not modify files.",
            },
            "verify": {
                "description": "Run Maestro sync and verification workflow with minimal drift risk",
                "mode": "subagent",
                "temperature": 0.1,
                "permission": {
                    "webfetch": "allow",
                    "edit": "ask",
                    "bash": {
                        "*": "ask",
                        "pwd": "allow",
                        "ls *": "allow",
                        "rg *": "allow",
                        "cat *": "allow",
                        "sed *": "allow",
                        "python3 scripts/bootstrap_providers.py*": "allow",
                        "python3 scripts/sync_agents.py*": "allow",
                        "python3 scripts/verify_all.py*": "allow",
                        "python3 scripts/generate_skill_index.py*": "allow",
                        "python3 scripts/provider_config_validator.py*": "allow",
                        "python3 scripts/checklist.py*": "allow",
                        "python3 scripts/dependency_analyzer.py*": "allow",
                        "scripts/skill.sh*": "allow",
                    },
                },
                "prompt": "Run the repository sync and verification workflow. If a check fails, identify the exact file or config mismatch before making any fix.",
            },
            "research": {
                "description": "Current-docs and web research specialist for stale, comparative, or uncertain tasks",
                "mode": "subagent",
                "temperature": 0.1,
                "permission": {
                    "edit": "deny",
                    "webfetch": "allow",
                    "bash": {
                        "*": "ask",
                        "pwd": "allow",
                        "ls *": "allow",
                        "find *": "allow",
                        "rg *": "allow",
                        "cat *": "allow",
                        "sed *": "allow",
                        "scripts/skill.sh search*": "allow",
                    },
                },
                "prompt": "When a task depends on current facts, official guidance, or the best available option, search the web and read primary-source documentation before answering. Do not loop on the same failed attempt; change evidence source immediately.",
            },
        },
    }


def build_vscode_settings(selected_providers: set[str]) -> dict:
    claude_enabled = "claude" in selected_providers
    return {
        "chat.useAgentsMdFile": True,
        "chat.useClaudeMdFile": claude_enabled,
        "chat.useAgentSkills": True,
        "chat.instructionsFilesLocations": {
            ".github/instructions": True,
            ".claude/rules": False,
            "~/.copilot/instructions": False,
            "~/.claude/rules": False,
        },
        "chat.agentFilesLocations": {
            ".github/agents": True,
            ".claude/agents": claude_enabled,
            "~/.copilot/agents": False,
        },
        "chat.promptFilesLocations": {
            ".github/prompts": True,
        },
        "chat.agentSkillsLocations": {
            ".github/skills": True,
            ".claude/skills": claude_enabled,
            "~/.copilot/skills": False,
            "~/.claude/skills": False,
        },
    }


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def remove_path(path: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    if path.is_symlink() or path.is_file():
        path.unlink()
        return
    shutil.rmtree(path)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def ensure_symlink(link_path: Path, target: str) -> None:
    if link_path.is_symlink() and os.readlink(link_path) == target:
        return
    remove_path(link_path)
    ensure_dir(link_path.parent)
    link_path.symlink_to(target)


def write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, content: dict) -> None:
    write_text(path, json.dumps(content, indent=2) + "\n")


def copy_file(source: Path, target: Path) -> None:
    ensure_dir(target.parent)
    shutil.copy2(source, target)


def copy_tree(source: Path, target: Path) -> None:
    remove_path(target)
    ensure_dir(target.parent)
    shutil.copytree(source, target, symlinks=True)


def remove_if_empty(path: Path) -> None:
    if path.is_dir() and not any(path.iterdir()):
        path.rmdir()


def load_selected_providers() -> set[str]:
    if PROJECT_PROVIDERS_PATH.exists():
        payload = load_json(PROJECT_PROVIDERS_PATH)
        selected = payload.get("selected_providers", list(SUPPORTED_PROVIDERS))
    else:
        selected = list(SUPPORTED_PROVIDERS)

    invalid = sorted(set(selected) - set(SUPPORTED_PROVIDERS))
    if invalid:
        raise SystemExit(
            "Unsupported providers in .maestro/project-providers.json: "
            + ", ".join(invalid)
        )
    return set(selected)


def read_frontmatter_metadata(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}

    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}

    metadata: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"')
    return metadata


def generate_github_specialist_agents(target_dir: Path) -> None:
    ensure_dir(target_dir)
    for source_path in sorted(SHARED_AGENTS.glob("*.md")):
        metadata = read_frontmatter_metadata(source_path)
        agent_name = metadata.get("name", source_path.stem)
        description = metadata.get(
            "description",
            "Shared specialist wrapper generated from the Maestro source tree.",
        )
        wrapper = (
            "---\n"
            f"name: {agent_name}\n"
            f"description: {description}\n"
            "---\n\n"
            f"Use [AGENTS.md](../../AGENTS.md), [`.maestro/SYSTEM.md`](../../.maestro/SYSTEM.md), and "
            f"[the shared specialist definition](../../.maestro/agents/{source_path.name}) as the operating contract.\n\n"
            "Adopt the specialist role defined in that shared source file. Keep recommendations, implementation choices, "
            "and verification aligned with that domain's guardrails.\n"
        )
        write_text(target_dir / f"{source_path.stem}.agent.md", wrapper)


def cleanup_unsupported() -> None:
    print("  - Removing unsupported provider adapters...")
    for rel in UNSUPPORTED_PATHS:
        remove_path(ROOT / rel)


def cleanup_extraneous() -> None:
    print("  - Removing extraneous local runtime artifacts...")
    for rel in EXTRANEOUS_PATHS:
        remove_path(ROOT / rel)


def cleanup_unselected(selected_providers: set[str]) -> None:
    print("  - Removing unselected provider adapters...")
    for provider, paths in MANAGED_PROVIDER_PATHS.items():
        if provider in selected_providers:
            continue
        for path in paths:
            remove_path(path)
    remove_if_empty(ROOT / ".github")
    remove_if_empty(ROOT / ".vscode")


def sync_antigravity() -> None:
    print("  - Syncing Antigravity...")
    ensure_dir(ROOT / ".agent")
    copy_file(ANTIGRAVITY_PACK / "agent.gitignore", ROOT / ".agent" / ".gitignore")
    copy_file(
        ANTIGRAVITY_PACK / ".maestro.state.template.json",
        ROOT / ".agent" / ".maestro.state.template.json",
    )
    ensure_symlink(ROOT / ".agent" / "SYSTEM.md", "../.maestro/SYSTEM.md")
    ensure_symlink(ROOT / ".agent" / "ARCHITECTURE.md", "../.maestro/ARCHITECTURE.md")
    ensure_symlink(ROOT / ".agent" / "agents", "../.maestro/agents")
    ensure_symlink(ROOT / ".agent" / "skills", "../.maestro/skills")
    ensure_symlink(ROOT / ".agent" / "workflows", "../.maestro/workflows")
    ensure_symlink(
        ROOT / ".agent" / "rules",
        "../.maestro/provider-packs/antigravity/rules",
    )


def sync_codex() -> None:
    print("  - Syncing Codex...")
    write_text(ROOT / ".codex" / "config.toml", build_codex_config())
    ensure_symlink(ROOT / ".agents" / "skills", "../.maestro/skills")


def sync_claude() -> None:
    print("  - Syncing Claude Code...")
    write_text(ROOT / "CLAUDE.md", build_claude_md())
    ensure_symlink(ROOT / ".claude" / "agents", "../.maestro/agents")
    ensure_symlink(ROOT / ".claude" / "skills", "../.maestro/skills")
    ensure_symlink(ROOT / ".claude" / "commands", "../.maestro/workflows")
    write_json(ROOT / ".claude" / "settings.json", CLAUDE_SETTINGS)
    remove_path(ROOT / ".claude" / "rules")
    remove_path(ROOT / ".claude" / "workflows")


def sync_opencode() -> None:
    print("  - Syncing OpenCode...")
    write_json(ROOT / "opencode.json", build_opencode_config())
    ensure_symlink(ROOT / ".opencode" / "agents", "../.maestro/agents")
    ensure_symlink(ROOT / ".opencode" / "skills", "../.maestro/skills")
    copy_tree(OPENCODE_PACK / "commands", ROOT / ".opencode" / "commands")
    remove_path(ROOT / ".opencode" / "instructions")


def sync_vscode_copilot(selected_providers: set[str]) -> None:
    print("  - Syncing VS Code GitHub Copilot...")
    ensure_dir(ROOT / ".github")
    copy_file(
        COPILOT_PACK / "copilot-instructions.md",
        ROOT / ".github" / "copilot-instructions.md",
    )
    copy_tree(COPILOT_PACK / "instructions", ROOT / ".github" / "instructions")
    copy_tree(COPILOT_PACK / "prompts", ROOT / ".github" / "prompts")
    copy_tree(COPILOT_PACK / "agents", ROOT / ".github" / "agents")
    generate_github_specialist_agents(ROOT / ".github" / "agents")
    ensure_symlink(ROOT / ".github" / "skills", "../.maestro/skills")
    write_json(ROOT / ".vscode" / "settings.json", build_vscode_settings(selected_providers))


def main() -> None:
    selected_providers = load_selected_providers()
    with traced_script("sync_agents", {"selected_providers": sorted(selected_providers)}) as trace:
        print("🔄 Maestro Sync Engine starting...")
        print("  - Selected providers:", ", ".join(sorted(selected_providers)))
        cleanup_unsupported()
        cleanup_extraneous()
        cleanup_unselected(selected_providers)

        if "antigravity" in selected_providers:
            sync_antigravity()
        if "codex" in selected_providers:
            sync_codex()
        if "claude" in selected_providers:
            sync_claude()
        if "opencode" in selected_providers:
            sync_opencode()
        if "copilot" in selected_providers:
            sync_vscode_copilot(selected_providers)

        trace.event("sync-complete", {"selected_providers": sorted(selected_providers)})
        print(
            "✅ Sync completed for selected providers:",
            ", ".join(sorted(selected_providers)),
        )


if __name__ == "__main__":
    main()
