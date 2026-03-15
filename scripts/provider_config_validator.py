#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_PROVIDERS_PATH = ROOT / ".maestro" / "project-providers.json"
SUPPORTED_PROVIDERS = {
    "antigravity",
    "claude",
    "codex",
    "copilot",
    "opencode",
}


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_codex_config(path: Path) -> dict:
    data: dict = {"agents": {}}
    current_section: tuple[str, str] | str | None = None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            if section.startswith("agents."):
                agent_name = section.split(".", 1)[1]
                data["agents"].setdefault(agent_name, {})
                current_section = ("agents", agent_name)
            else:
                data.setdefault(section, {})
                current_section = section
            continue
        if "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        if current_section is None:
            data[key] = value
        elif isinstance(current_section, tuple) and current_section[0] == "agents":
            data["agents"][current_section[1]][key] = value
        else:
            data[current_section][key] = value

    return data


def load_selected_providers() -> set[str]:
    payload = load_json(PROJECT_PROVIDERS_PATH)
    selected = set(payload.get("selected_providers", []))
    invalid = sorted(selected - SUPPORTED_PROVIDERS)
    if invalid:
        raise SystemExit(
            "Unsupported providers in .maestro/project-providers.json: "
            + ", ".join(invalid)
        )
    return selected


def expect_symlink(link_path: Path, target: str, errors: list[str]) -> None:
    if not link_path.is_symlink():
        fail(f"Expected symlink missing: {link_path}", errors)
        return
    if os.readlink(link_path) != target:
        fail(f"Symlink target drift: {link_path} -> {os.readlink(link_path)}", errors)


def expect_absent(path: Path, errors: list[str]) -> None:
    if path.exists() or path.is_symlink():
        fail(f"Unselected provider artifact should not exist: {path}", errors)


def main() -> int:
    errors: list[str] = []
    selected = load_selected_providers()

    agents_md = ROOT / "AGENTS.md"
    if not agents_md.exists():
        fail("AGENTS.md is missing.", errors)
    else:
        agents_text = agents_md.read_text(encoding="utf-8")
        if "# Maestro Shared Core" not in agents_text:
            fail("AGENTS.md drifted from the shared-core format.", errors)
        if ".maestro/SYSTEM.md" not in agents_text:
            fail("AGENTS.md must point readers to .maestro/SYSTEM.md.", errors)
        if "Maestro Claude Adapter" in agents_text:
            fail("AGENTS.md must not contain the Claude adapter content.", errors)

    required_shared_paths = [
        ROOT / ".maestro" / "SYSTEM.md",
        ROOT / ".maestro" / "ARCHITECTURE.md",
        ROOT / ".maestro" / "agents",
        ROOT / ".maestro" / "skills",
        ROOT / ".maestro" / "workflows",
        ROOT / ".maestro" / "project-providers.json",
    ]
    for path in required_shared_paths:
        if not path.exists():
            fail(f"Shared Maestro path missing: {path}", errors)

    forbidden_local_artifacts = [
        ROOT / ".DS_Store",
        ROOT / ".opencode" / ".gitignore",
        ROOT / ".opencode" / "package.json",
        ROOT / ".opencode" / "bun.lock",
        ROOT / ".opencode" / "node_modules",
    ]
    for path in forbidden_local_artifacts:
        if path.exists():
            fail(f"Extraneous local artifact must be removed: {path}", errors)

    if "codex" in selected:
        codex = parse_codex_config(ROOT / ".codex" / "config.toml")
        required_codex_keys = {
            "model",
            "model_context_window",
            "model_auto_compact_token_limit",
            "project_doc_max_bytes",
            "project_doc_fallback_filenames",
        }
        missing_codex = sorted(required_codex_keys - set(codex))
        if missing_codex:
            fail(f"Codex config missing keys: {', '.join(missing_codex)}", errors)
        if '["AGENTS.md", ".maestro/SYSTEM.md"]' not in codex.get(
            "project_doc_fallback_filenames",
            "",
        ):
            fail("Codex fallback docs must point to AGENTS.md and .maestro/SYSTEM.md.", errors)
        for agent_name in ("reviewer", "explorer", "researcher"):
            agent = codex.get("agents", {}).get(agent_name)
            if not isinstance(agent, dict) or "description" not in agent:
                fail(f"Codex agent '{agent_name}' is missing a description.", errors)
        expect_symlink(ROOT / ".agents" / "skills", "../.maestro/skills", errors)
    else:
        expect_absent(ROOT / ".codex", errors)
        expect_absent(ROOT / ".agents", errors)

    if "claude" in selected:
        claude_path = ROOT / ".claude" / "settings.json"
        claude = load_json(claude_path)
        claude_md = ROOT / "CLAUDE.md"
        if not claude_md.exists():
            fail("CLAUDE.md is missing for the Claude provider.", errors)
        elif "Maestro Claude Adapter" not in claude_md.read_text(encoding="utf-8"):
            fail("CLAUDE.md drifted from the generated Claude adapter content.", errors)

        claude_permissions = claude.get("permissions", {})
        for required in ("allow", "ask", "deny"):
            if required not in claude_permissions:
                fail(f"Claude settings missing permissions.{required}.", errors)
        expect_symlink(ROOT / ".claude" / "agents", "../.maestro/agents", errors)
        expect_symlink(ROOT / ".claude" / "skills", "../.maestro/skills", errors)
        expect_symlink(ROOT / ".claude" / "commands", "../.maestro/workflows", errors)
    else:
        expect_absent(ROOT / "CLAUDE.md", errors)
        expect_absent(ROOT / ".claude", errors)

    if "antigravity" in selected:
        expect_symlink(ROOT / ".agent" / "SYSTEM.md", "../.maestro/SYSTEM.md", errors)
        expect_symlink(ROOT / ".agent" / "ARCHITECTURE.md", "../.maestro/ARCHITECTURE.md", errors)
        expect_symlink(ROOT / ".agent" / "agents", "../.maestro/agents", errors)
        expect_symlink(ROOT / ".agent" / "skills", "../.maestro/skills", errors)
        expect_symlink(ROOT / ".agent" / "workflows", "../.maestro/workflows", errors)
        expect_symlink(
            ROOT / ".agent" / "rules",
            "../.maestro/provider-packs/antigravity/rules",
            errors,
        )
    else:
        expect_absent(ROOT / ".agent", errors)

    if "opencode" in selected:
        opencode = load_json(ROOT / "opencode.json")
        if opencode.get("instructions") != ["AGENTS.md", ".maestro/SYSTEM.md"]:
            fail("OpenCode instructions must point to AGENTS.md and .maestro/SYSTEM.md.", errors)
        allowed_global_permission_keys = {
            "*",
            "external_directory",
            "doom_loop",
            "webfetch",
            "websearch",
            "bash",
            "read",
            "edit",
        }
        unexpected_global_keys = sorted(set(opencode.get("permission", {})) - allowed_global_permission_keys)
        if unexpected_global_keys:
            fail(
                "OpenCode global permission keys are unsupported: "
                + ", ".join(unexpected_global_keys),
                errors,
            )
        expect_symlink(ROOT / ".opencode" / "agents", "../.maestro/agents", errors)
        expect_symlink(ROOT / ".opencode" / "skills", "../.maestro/skills", errors)
    else:
        expect_absent(ROOT / "opencode.json", errors)
        expect_absent(ROOT / ".opencode", errors)

    if "copilot" in selected:
        vscode_settings = load_json(ROOT / ".vscode" / "settings.json")
        required_vscode_flags = {
            "chat.useAgentsMdFile": True,
            "chat.useClaudeMdFile": "claude" in selected,
            "chat.useAgentSkills": True,
        }
        for key, expected in required_vscode_flags.items():
            if vscode_settings.get(key) != expected:
                fail(f"VS Code setting '{key}' must be {expected!r}.", errors)

        expected_location_settings = {
            "chat.instructionsFilesLocations": {
                ".github/instructions": True,
            },
            "chat.agentFilesLocations": {
                ".github/agents": True,
                ".claude/agents": "claude" in selected,
            },
            "chat.promptFilesLocations": {
                ".github/prompts": True,
            },
            "chat.agentSkillsLocations": {
                ".github/skills": True,
                ".claude/skills": "claude" in selected,
            },
        }
        for setting_name, expected_entries in expected_location_settings.items():
            setting_value = vscode_settings.get(setting_name, {})
            if not isinstance(setting_value, dict):
                fail(f"VS Code setting '{setting_name}' must be an object.", errors)
                continue
            for entry_key, entry_value in expected_entries.items():
                if setting_value.get(entry_key) != entry_value:
                    fail(
                        f"VS Code setting '{setting_name}.{entry_key}' must be {entry_value!r}.",
                        errors,
                    )

        expect_symlink(ROOT / ".github" / "skills", "../.maestro/skills", errors)
        copilot_agents_dir = ROOT / ".github" / "agents"
        for agent_path in sorted((ROOT / ".maestro" / "agents").glob("*.md")):
            generated_wrapper = copilot_agents_dir / f"{agent_path.stem}.agent.md"
            if not generated_wrapper.exists():
                fail(f"Missing GitHub Copilot agent wrapper: {generated_wrapper}", errors)
    else:
        expect_absent(ROOT / ".github" / "copilot-instructions.md", errors)
        expect_absent(ROOT / ".github" / "instructions", errors)
        expect_absent(ROOT / ".github" / "agents", errors)
        expect_absent(ROOT / ".github" / "prompts", errors)
        expect_absent(ROOT / ".github" / "skills", errors)
        expect_absent(ROOT / ".vscode" / "settings.json", errors)

    if errors:
        print("Provider config validation failed:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("Provider config validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
