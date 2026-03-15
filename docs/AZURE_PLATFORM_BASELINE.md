# Azure Platform Baseline

This baseline exists so Azure work does not depend on guesswork or one-off prompts.

## Use this skill first

```text
@azure-platform-master
```

Skill path:
[`.maestro/skills/azure-platform-master/SKILL.md`](/Users/dogan/Desktop/most-current-rules/.maestro/skills/azure-platform-master/SKILL.md)

## What it covers

- landing zones, governance, Bicep, and Azure platform layout
- deployment preflight before infrastructure changes
- identity, Key Vault, App Configuration, and managed identity
- app delivery, API exposure, and service integration
- observability, alerting, and operational readiness
- service-specific Azure skill routing

## Important principle

The system should not pretend to know every Azure service from memory. Instead it should:
- route to the exact Azure service skill when one exists
- use the Azure master skill to choose the right layer
- verify temporal or service-specific details against official Microsoft docs

## Current shared Azure additions

- `azure-devops-cli`
- `azure-deployment-preflight`
- `azure-infra-engineer`

## Recommended first prompt in an Azure repo

```text
Use @azure-platform-master and @enterprise-azure-fullstack-readiness. Audit this repository for Azure platform readiness, secret handling, CI/CD safety, API exposure, observability, and service-specific gaps. Tell me what must be fixed before production work starts.
```
