# Enterprise Fullstack Baseline

This baseline is for company projects where you are expected to deliver production-quality work across backend, frontend, Azure, CI/CD, security, and observability.

## Role activation

Use:

```text
@enterprise-azure-fullstack-readiness
```

The skill lives at [`.maestro/skills/enterprise-azure-fullstack-readiness/SKILL.md`](/Users/dogan/Desktop/most-current-rules/.maestro/skills/enterprise-azure-fullstack-readiness/SKILL.md).

## Installed additions for this role

These were added from `skills.sh` because they were real gaps in the local library:
- `java-springboot`
- `azure-devops-cli`

## Minimum company-grade foundation

- ADRs for non-trivial architecture decisions
- versioned API contracts and secure auth boundaries
- CI/CD with lint, tests, build, and security checks
- separate environments for dev, test, and prod
- secrets in a vault, not in repo or pipeline variables as plain text
- metrics, logs, traces, dashboards, and alert runbooks
- pull request review discipline for code, infra, and API changes
- explicit rollback path for risky deployments

## Azure baseline

- `azd` or equivalent IaC-first deployment model
- managed identity preferred over static secrets
- Key Vault for secrets
- App Configuration for non-secret configuration
- OpenTelemetry to Azure Monitor or equivalent
- API gateway or API Management if multiple services or external consumers exist

## AI agent baseline

- generated output is untrusted until verified
- no direct production edits without a runbook and rollback path
- tests and review are mandatory for security, auth, data, and infra changes
- prompts and agent behavior should stay provider-thin; shared logic belongs in `.maestro`
