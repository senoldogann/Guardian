---
name: enterprise-azure-fullstack-readiness
description: "Enterprise delivery pack for Node.js or Java/Spring backends, React frontends, Azure delivery, CI/CD, API security, testing, observability, and AI-assisted engineering. Use when onboarding to consulting or in-house customer projects with high quality expectations."
risk: medium
source: personal
date_added: "2026-03-14"
---

# Enterprise Azure Fullstack Readiness

Use this skill when you are starting or operating in a company project that expects:
- `Node.js` or `Java/Spring Boot` backend work
- `React` and `TypeScript` frontend work
- `Azure` deployment and cloud operations
- `CI/CD`, testing, secure API design, and observability
- disciplined AI-assisted development without sloppy outputs

## What This Pack Does

This pack does not replace the specialist skills. It tells the agent which baseline to activate first so delivery stays safe, reviewable, and production-ready.

## Step 1: Lock the Delivery Baseline

Before implementation, read these shared skills:
- `../architecture-decision-records/SKILL.md`
- `../api-design-principles/SKILL.md`
- `../api-security-best-practices/SKILL.md`
- `../security-review/SKILL.md`
- `../javascript-testing-patterns/SKILL.md`
- `../webapp-testing/SKILL.md`
- `../lint-and-validate/SKILL.md`
- `../vulnerability-scanner/SKILL.md`
- `../observability-monitoring-monitor-setup/SKILL.md`
- `../observability-monitoring-slo-implement/SKILL.md`

Expected baseline:
- architecture decisions captured as ADRs for non-trivial choices
- API contracts versioned and validated
- lint, unit, integration, and end-to-end checks defined before shipping
- security review and dependency scanning treated as required gates
- metrics, logs, traces, dashboards, and alert paths planned before production rollout

## Step 2: Choose the Backend Track

If the repo is `Node.js` or `TypeScript` backend heavy, read:
- `../nodejs-best-practices/SKILL.md`

If the repo is `Java` or `Spring Boot`, read:
- `../java-springboot/SKILL.md`

Backend expectations:
- feature/domain-oriented structure, not chaotic by-layer sprawl
- DTO validation, explicit auth boundaries, and transaction discipline
- secrets never hardcoded
- database migrations and rollback paths defined
- async jobs, queues, and integrations treated as first-class failure domains

## Step 3: Activate the Frontend Track

For `React` and `TypeScript` work, read:
- `../react-best-practices/SKILL.md`
- `../vercel-react-best-practices/SKILL.md`

Frontend expectations:
- performance-aware React patterns, not random re-renders
- explicit loading, error, and empty states
- accessibility and responsive behavior checked
- API consumption typed and validated

## Step 4: Activate the Azure Delivery Track

Read these Azure and DevOps skills when cloud delivery is in scope:
- `../azure-platform-master/SKILL.md`
- `../azd-deployment/SKILL.md`
- `../azure-devops-cli/SKILL.md`
- `../azure-deployment-preflight/SKILL.md`

Language and service-specific Azure skills should be pulled in as needed. Common starting points:
- `../azure-infra-engineer/SKILL.md`
- `../azure-identity-ts/SKILL.md` or `../azure-identity-java/SKILL.md`
- `../azure-keyvault-secrets-ts/SKILL.md` or `../azure-security-keyvault-secrets-java/SKILL.md`
- `../azure-appconfiguration-ts/SKILL.md` or `../azure-appconfiguration-java/SKILL.md`
- `../azure-monitor-opentelemetry-ts/SKILL.md` or `../azure-monitor-opentelemetry-exporter-java/SKILL.md`
- `../azure-servicebus-ts/SKILL.md` if async integration is present
- `../azure-mgmt-apimanagement-py/SKILL.md` or `../azure-mgmt-apimanagement-dotnet/SKILL.md` when API Management is part of the platform

Azure expectations:
- separate dev, test, and production environments
- IaC or `azd`-managed infrastructure, not click-ops drift
- managed identity preferred over static secrets
- Key Vault for secrets and App Configuration for non-secret app settings
- OpenTelemetry wired into Azure Monitor or equivalent telemetry target
- CI/CD rollout gates and rollback path defined before production deployment
- infra changes go through preflight validation before deployment

## Step 5: Work Like an Enterprise Engineer

While using AI agents:
- never trust generated code without tests, lint, and security checks
- do not merge undocumented architectural changes
- treat API schema changes, auth changes, and infra changes as review-heavy work
- keep change sets small and bisectable
- document assumptions, risks, and operational follow-ups
- prefer boring, maintainable choices over flashy complexity

## Step 6: Definition of Done

Work is not done until all of these are true:
- local quality gates pass
- infra/config drift is reviewed
- monitoring and alert paths are defined for new critical flows
- security-sensitive changes were reviewed explicitly
- onboarding notes or ADRs were updated where the change affects future work

## Recommended Startup Prompt

Use this when joining a new company project:

```text
Use @enterprise-azure-fullstack-readiness. Inspect the repository and determine whether the backend track is Node.js or Java/Spring. Then activate the matching backend skill, React frontend guidance, Azure delivery baseline, API/security baseline, testing baseline, and observability baseline. Produce a gap report for architecture, CI/CD, secrets, API quality, testing, monitoring, and AI-agent safety before implementation starts.
```
