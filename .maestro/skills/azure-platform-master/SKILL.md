---
name: azure-platform-master
description: "Azure master dispatcher for enterprise projects. Routes work across landing zones, identity, secrets, app config, deployment preflight, networking, API exposure, integration, data, observability, and service-specific Azure skills."
risk: medium
source: personal
date_added: "2026-03-14"
---

# Azure Platform Master

Use this skill whenever a project depends on Azure and you want the agent to choose the correct Azure sub-skills instead of guessing.

## Purpose

This is not a single-service skill. It is the Azure control tower for the rest of the skill library.

It should:
- identify which Azure layer is being touched
- load the correct Azure sub-skills
- enforce infrastructure, identity, secret, deployment, and observability guardrails
- fall back to official Microsoft documentation when a service detail might be stale

## Core Rule

Do not assume one Azure service implies a complete platform design.

Always classify the task first:
1. platform foundation
2. application delivery
3. identity and secrets
4. integration and data
5. observability and operations
6. AI services

## Platform Foundation

For landing zones, governance, Bicep, ARM, management groups, policies, hub-spoke networking, and enterprise subscription layout:
- `../azure-infra-engineer/SKILL.md`

For any Azure deployment before execution:
- `../azure-deployment-preflight/SKILL.md`

When app-level deployment uses Azure Developer CLI:
- `../azd-deployment/SKILL.md`

Expected defaults:
- IaC first, not portal click-ops
- separate environments
- policy and RBAC considered early
- private networking preferred for sensitive services

## Identity, Secrets, and Configuration

Choose the matching language skill:
- `../azure-identity-ts/SKILL.md`
- `../azure-identity-java/SKILL.md`
- `../azure-identity-py/SKILL.md`

For secrets:
- `../azure-keyvault-secrets-ts/SKILL.md`
- `../azure-security-keyvault-secrets-java/SKILL.md`
- `../azure-keyvault-py/SKILL.md`

For non-secret configuration:
- `../azure-appconfiguration-ts/SKILL.md`
- `../azure-appconfiguration-java/SKILL.md`
- `../azure-appconfiguration-py/SKILL.md`

Guardrails:
- prefer managed identities over static secrets
- use Key Vault for secrets, not app settings
- use App Configuration for feature flags and non-secret config

## App Delivery and API Exposure

For API platform and gateway concerns:
- `../azure-mgmt-apimanagement-dotnet/SKILL.md`
- `../azure-mgmt-apimanagement-py/SKILL.md`

For Functions-style workloads:
- `../azure-functions/SKILL.md`

For frontend or browser testing on Azure:
- `../azure-microsoft-playwright-testing-ts/SKILL.md`

Always pair with:
- `../api-design-principles/SKILL.md`
- `../api-security-best-practices/SKILL.md`
- `../security-review/SKILL.md`

## Integration and Data

Use the matching skills when those services appear:
- Service Bus: `../azure-servicebus-ts/SKILL.md`, `../azure-servicebus-py/SKILL.md`, `../azure-servicebus-dotnet/SKILL.md`
- Event Hubs: `../azure-eventhub-ts/SKILL.md`, `../azure-eventhub-java/SKILL.md`, `../azure-eventhub-py/SKILL.md`
- Storage: `../azure-storage-blob-ts/SKILL.md`, `../azure-storage-blob-java/SKILL.md`, `../azure-storage-blob-py/SKILL.md`
- Cosmos DB: `../azure-cosmos-ts/SKILL.md`, `../azure-cosmos-java/SKILL.md`, `../azure-cosmos-py/SKILL.md`
- PostgreSQL: `../azure-postgres-ts/SKILL.md`
- Search: `../azure-search-documents-ts/SKILL.md`, `../azure-search-documents-py/SKILL.md`, `../azure-search-documents-dotnet/SKILL.md`

## Observability and Operations

Use:
- `../azure-monitor-opentelemetry-ts/SKILL.md`
- `../azure-monitor-opentelemetry-exporter-java/SKILL.md`
- `../azure-monitor-opentelemetry-exporter-py/SKILL.md`
- `../azure-monitor-query-java/SKILL.md`
- `../azure-monitor-query-py/SKILL.md`
- `../observability-monitoring-monitor-setup/SKILL.md`
- `../observability-monitoring-slo-implement/SKILL.md`
- `../azure-devops-cli/SKILL.md`

Operational expectations:
- logs, metrics, and traces wired before production
- dashboards and alerts exist for critical flows
- deployment pipeline has preflight, validation, and rollback path

## AI Services

When the workload uses Azure AI or Azure OpenAI style services, choose the matching service skill:
- `../azure-ai-projects-ts/SKILL.md`
- `../azure-ai-projects-java/SKILL.md`
- `../azure-ai-projects-py/SKILL.md`
- `../azure-ai-contentsafety-ts/SKILL.md`
- `../azure-ai-openai-dotnet/SKILL.md`

If no exact Azure AI service skill exists for the current stack, stop guessing and consult official Microsoft docs before implementation.

## Enterprise Checklist

Before shipping Azure-related work, confirm:
- deployment path is reproducible
- secret handling is vault-based
- identity model is least privilege
- public exposure is intentional
- monitoring is attached
- preflight validation was run for infra changes
- rollback strategy exists

## Startup Prompt

```text
Use @azure-platform-master. Inspect the repository and classify the Azure work into platform foundation, identity/secrets, app delivery, integration/data, observability, and AI services. Load the matching Azure sub-skills, identify missing guardrails, and produce an Azure readiness gap report before implementation.
```
