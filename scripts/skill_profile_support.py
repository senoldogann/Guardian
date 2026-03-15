#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTIVE_SKILLS_DIR = ROOT / ".maestro" / "skills"
ARCHIVE_ROOT_DIR = ROOT / ".maestro" / "skills-archive"
DEFAULT_PROFILE = "preferred-stack"


def _parse_block(raw: str) -> set[str]:
    return {line.strip() for line in raw.splitlines() if line.strip()}


KEEP_PREFIXES = tuple(
    line.strip()
    for line in """
azure-
expo-
react-
typescript-
python-
rust-
frontend-
tailwind-
nextjs-
nodejs-
fastapi-
terraform-
kubernetes-
observability-
deployment-
""".splitlines()
    if line.strip()
)

KEEP_EXACT = _parse_block(
    """
agent-browser
agents-md
api-design-principles
api-endpoint-builder
api-patterns
api-security-best-practices
api-security-testing
app-builder
architect-review
architecture
architecture-decision-records
azd-deployment
baseline-ui
bash-defensive-patterns
bash-linux
bash-pro
brainstorming
browse
bug-hunter
bun-development
clean-code
cloud-architect
cloud-devops
codex-review
commit
concise-planning
context-window-management
create-branch
debugger
debugging-strategies
design-md
design-orchestration
devcontainer-setup
development
devops-troubleshooter
differential-review
distributed-tracing
docker-expert
dx-optimizer
e2e-testing
e2e-testing-patterns
enterprise-azure-fullstack-readiness
environment-setup-guide
exa-search
executing-plans
find-bugs
find-skills
fix-review
fixing-accessibility
fixing-motion-performance
gha-security-review
git-advanced-workflows
git-commit-formatter
git-pushing
github-actions-templates
github-automation
github-issue-creator
github-workflow-automation
gitops-workflow
go-concurrency-patterns
go-playwright
go-rod-master
golang-pro
gstack
javascript-mastery
javascript-pro
javascript-testing-patterns
k8s-manifest-generator
k8s-security-policies
kaizen
lint-and-validate
manifest
memory-safety-patterns
microservices-patterns
mobile-design
mobile-developer
monorepo-architect
monorepo-management
native-data-fetching
nestjs-expert
network-engineer
open-source-context
openapi-spec-generation
operational-guidelines
parallel-agents
performance-engineer
performance-optimizer
performance-profiling
plan-ceo-review
plan-eng-review
plan-writing
playwright-skill
postmortem-writing
powershell-windows
pr-writer
production-code-audit
project-development
prometheus-configuration
rag-engineer
rag-implementation
readme
receiving-code-review
reference-builder
requesting-code-review
research-engineer
retro
review
search-specialist
secrets-management
security-audit
security-auditor
security-bluebook-builder
security-requirement-extraction
security-review
security-scanning-security-dependencies
security-scanning-security-hardening
security-scanning-security-sast
semgrep-rule-creator
senior-architect
senior-fullstack
server-management
service-mesh-expert
service-mesh-observability
shadcn-ui
ship
slo-implementation
software-architecture
system-design
systematic-debugging
tavily-web
tdd-orchestrator
tdd-workflow
test-automator
test-driven-development
test-fixing
testing-patterns
testing-qa
track-management
ui-skills
ui-ux-designer
ui-ux-pro-max
ui-visual-validator
using-superpowers
uv-package-manager
variant-analysis
verification-before-completion
vercel-react-best-practices
vexor
vexor-cli
vibe-code-auditor
vulnerability-scanner
wcag-audit-patterns
web-artifacts-builder
web-design-guidelines
web-performance-optimization
web-security-testing
webapp-testing
wiki-architect
wiki-onboarding
wiki-page-writer
wiki-qa
wiki-researcher
workflow-automation
workflow-orchestration-patterns
workflow-patterns
writing-plans
writing-skills
zeroize-audit
zod-validation-expert
zustand-store-ts
"""
)


@dataclass(frozen=True)
class SkillProfile:
    name: str
    description: str
    keep_prefixes: tuple[str, ...]
    keep_exact: frozenset[str]

    @property
    def archive_dir(self) -> Path:
        return ARCHIVE_ROOT_DIR / self.name

    def should_keep(self, skill_name: str) -> bool:
        return skill_name in self.keep_exact or any(
            skill_name.startswith(prefix) for prefix in self.keep_prefixes
        )


PREFERRED_STACK_PROFILE = SkillProfile(
    name=DEFAULT_PROFILE,
    description=(
        "Focused engineering stack for React, TypeScript, React Native, Python, "
        "Rust, Go, Azure, CI/CD, frontend design, architecture, security, and testing."
    ),
    keep_prefixes=KEEP_PREFIXES,
    keep_exact=frozenset(KEEP_EXACT),
)


def get_profile(name: str = DEFAULT_PROFILE) -> SkillProfile:
    if name != DEFAULT_PROFILE:
        raise ValueError(
            f"Unknown skill profile: {name}. Supported profiles: {DEFAULT_PROFILE}"
        )
    return PREFERRED_STACK_PROFILE


def list_skill_dirs(base_dir: Path) -> list[Path]:
    if not base_dir.exists():
        return []
    return sorted(
        path
        for path in base_dir.iterdir()
        if path.is_dir() and not path.name.startswith(".") and path.name != "docs"
    )

