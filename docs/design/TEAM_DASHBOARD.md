# Team Analytics Dashboard — Design Document

> **Status:** Draft
> **Author:** Guardian Team
> **Date:** 2025-07-15
> **Guardian Version:** 1.2.6+

---

## 1. Feature Overview

The Team Analytics Dashboard aggregates code governance data from individual Guardian desktop instances across a team, providing engineering leads and developers with visibility into:

- **Code health trends** — how critique counts, severity distributions, and fix rates change over time
- **Scan coverage** — which projects are actively scanned and which are falling behind
- **Release gate compliance** — how often releases pass, get warnings, or are blocked
- **Contributor activity** — who is fixing critiques, reviewing AI suggestions, and maintaining baselines
- **AI usage patterns** — token consumption, AI-heavy change frequency, and provider distribution

Guardian today operates as a standalone desktop app (Tauri + React + Rust + SQLite). Each developer runs scans locally. The Team Dashboard introduces an optional server component that collects anonymized scan telemetry, enabling org-wide analytics without compromising local-first principles.

---

## 2. Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Developer Machines                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Guardian     │  │  Guardian     │  │  Guardian     │             │
│  │  Desktop App  │  │  Desktop App  │  │  Desktop App  │             │
│  │  (Tauri)      │  │  (Tauri)      │  │  (Tauri)      │             │
│  │              │  │              │  │              │              │
│  │ SQLite + JSONL│  │ SQLite + JSONL│  │ SQLite + JSONL│             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          │  Scan telemetry │  (HTTPS/TLS)    │
          │  submissions    │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Team Dashboard Server                            │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │  API Gateway   │  │  Aggregation  │  │  Scheduler    │           │
│  │  (Auth + Rate  │──│  Engine       │──│  (Rollups,    │           │
│  │   Limiting)    │  │  (Metrics +   │  │   Alerts)     │           │
│  └───────┬───────┘  │   Trends)     │  └───────────────┘           │
│          │          └───────────────┘                               │
│          │                 │                                        │
│  ┌───────▼─────────────────▼───────┐                               │
│  │        PostgreSQL               │                               │
│  │  (Teams, Scans, Critiques,     │                               │
│  │   Metrics, Rollups)            │                               │
│  └─────────────────────────────────┘                               │
│                                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │  REST API
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Dashboard UI                            │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ Team       │  │ Project    │  │ Member     │                    │
│  │ Overview   │  │ Detail     │  │ Activity   │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
│                                                                     │
│  React SPA · TailwindCSS · Recharts                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
1. Developer runs Guardian scan on local workspace
2. Guardian produces Critiques, FixProposals, ReleaseDecisions, HistoryEvents
3. On scan completion, Tauri backend packages a ScanSubmission payload
4. Payload is POSTed to Team Dashboard server (opt-in, requires API key)
5. Server validates, deduplicates, and stores scan results
6. Aggregation engine computes rollup metrics (hourly/daily/weekly)
7. Web UI queries the API to render dashboards
```

### 2.3 Design Principles

| Principle | Detail |
|-----------|--------|
| **Local-first** | Guardian continues working fully offline. Dashboard submission is opt-in. |
| **Privacy-aware** | No source code is transmitted. Only metadata, severity counts, and file paths (optionally hashed). |
| **Idempotent ingestion** | Duplicate scan submissions are safely ignored via `scan_id`. |
| **Incremental rollout** | MVP ships submission + read-only dashboard. Advanced features (alerts, RBAC) come later. |

---

## 3. Data Model

### 3.1 Entity Relationship

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Team    │1─────*│  Member  │1─────*│  Scan    │
└──────────┘       └──────────┘       └────┬─────┘
      │                                     │
      │1                                   1│
      │                                     │
      *                                     *
┌──────────┐                         ┌──────────┐
│ Project  │1───────────────────────*│ Critique │
└──────────┘                         └──────────┘
      │                                     │
      │1                                   1│
      *                                     *
┌──────────────┐                     ┌──────────┐
│ ProjectRollup│                     │   Fix    │
└──────────────┘                     └──────────┘
```

### 3.2 Table Schemas

#### `teams`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Team display name |
| `slug` | VARCHAR(100) | URL-safe identifier, unique |
| `api_key_hash` | VARCHAR(64) | SHA-256 hash of team API key |
| `settings` | JSONB | Team preferences (privacy level, retention days) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `team_id` | UUID | FK → teams |
| `external_id` | VARCHAR(255) | GitHub login or email hash — maps to Guardian's `GithubUser.login` |
| `display_name` | VARCHAR(255) | |
| `role` | VARCHAR(20) | `owner`, `admin`, `member` |
| `joined_at` | TIMESTAMPTZ | |

#### `projects`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `team_id` | UUID | FK → teams |
| `name` | VARCHAR(255) | Repository or workspace name |
| `default_branch` | VARCHAR(100) | e.g., `main` |
| `policy_packs` | TEXT[] | Maps to Guardian's `GuardianPolicy.packs` (e.g., `["clean_architecture", "api_backend_guardrails"]`) |
| `scan_profile` | VARCHAR(20) | Maps to Guardian's `ScanProfile` enum: `source`, `extended`, `full` |
| `created_at` | TIMESTAMPTZ | |

#### `scans`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key — matches Guardian's local scan ID |
| `project_id` | UUID | FK → projects |
| `member_id` | UUID | FK → members (who triggered the scan) |
| `scan_profile` | VARCHAR(20) | `source`, `extended`, `full` — from `ScanProfile` enum |
| `files_scanned` | INTEGER | Total files processed |
| `critical_count` | INTEGER | Maps to `Stats.critical` |
| `warning_count` | INTEGER | Maps to `Stats.warning` |
| `info_count` | INTEGER | Maps to `Stats.info` |
| `total_findings` | INTEGER | Maps to `Stats.total` |
| `new_since_baseline` | INTEGER | From `BaselineStatusView.new_since_baseline` |
| `resolved_since_baseline` | INTEGER | From `BaselineStatusView.resolved_since_baseline` |
| `release_decision` | VARCHAR(30) | `PASS`, `PASS_WITH_WARNING`, `BLOCK_UNTIL_APPROVED`, `OVERRIDDEN` — from `ReleaseDecision` |
| `ai_heavy_change` | BOOLEAN | From `ReleaseDecisionView.ai_heavy_change` |
| `tokens_used` | INTEGER | From `UsageStats.tokens` |
| `duration_ms` | INTEGER | Wall-clock scan time |
| `scanned_at` | TIMESTAMPTZ | |

#### `critiques`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `scan_id` | UUID | FK → scans |
| `finding_id` | VARCHAR(64) | Maps to `Critique.finding_id` — stable across scans for dedup |
| `file_path` | VARCHAR(500) | Relative path (optionally hashed per team privacy settings) |
| `file_kind` | VARCHAR(20) | `source`, `infra`, `doc`, `lock`, `test`, `other` — from `FileKind` enum |
| `severity` | VARCHAR(10) | `Critical`, `Warning`, `Info` — matches Guardian's severity values |
| `message` | TEXT | Critique description (can be redacted per privacy settings) |
| `has_suggestion` | BOOLEAN | True if `Critique.suggestion` was present |
| `has_diff` | BOOLEAN | True if `Critique.suggested_diff` was present |
| `rule_pack` | VARCHAR(100) | Which policy pack triggered this critique |
| `created_at` | TIMESTAMPTZ | |

#### `fixes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `critique_id` | UUID | FK → critiques |
| `scan_id` | UUID | FK → scans (the scan that confirmed the fix) |
| `member_id` | UUID | FK → members (who applied the fix) |
| `proposal_status` | VARCHAR(20) | `applied`, `rejected`, `manual` — based on `FixProposal.status` |
| `confidence` | REAL | From `FixProposal.confidence` (0.0–1.0) |
| `applied_at` | TIMESTAMPTZ | Maps to `FixHistoryEntry.applied_at` |
| `time_to_fix_hours` | REAL | Hours between critique creation and fix application |

#### `project_rollups` (materialized daily/weekly)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `project_id` | UUID | FK → projects |
| `period` | VARCHAR(10) | `daily`, `weekly`, `monthly` |
| `period_start` | DATE | |
| `total_scans` | INTEGER | |
| `total_critiques` | INTEGER | |
| `critical_count` | INTEGER | |
| `warning_count` | INTEGER | |
| `info_count` | INTEGER | |
| `fix_count` | INTEGER | |
| `fix_rate` | REAL | `fix_count / total_critiques` |
| `avg_time_to_fix_hours` | REAL | |
| `release_pass_count` | INTEGER | |
| `release_block_count` | INTEGER | |
| `scan_coverage_pct` | REAL | Files scanned / estimated project files |
| `active_contributors` | INTEGER | Distinct members who scanned |
| `tokens_used` | INTEGER | |

### 3.3 Aggregate Metrics

These metrics are derived from the tables above and served via the API:

| Metric | Calculation | Granularity |
|--------|-------------|-------------|
| **Critiques/week** | `COUNT(critiques) WHERE scanned_at IN week` | Weekly |
| **Fix rate** | `fixes.count / critiques.count` over period | Daily/Weekly |
| **Scan coverage** | `DISTINCT files scanned / total project files` | Per scan |
| **Mean time to fix** | `AVG(fixes.time_to_fix_hours)` | Weekly |
| **Release pass rate** | `scans WHERE release_decision = 'PASS' / total` | Weekly |
| **Health score** | Composite: `0.3 × fix_rate + 0.3 × (1 - critical_ratio) + 0.2 × scan_frequency + 0.2 × coverage` | Daily |
| **AI adoption** | `fixes WHERE proposal_status = 'applied' / total fixes` | Weekly |

---

## 4. API Design

### 4.1 Authentication

All endpoints require an `Authorization` header:

```
Authorization: Bearer <team-api-key>
```

The API key is generated per-team during onboarding and hashed with SHA-256 for storage. Keys can be rotated via the dashboard settings.

### 4.2 Endpoints

#### `POST /api/scans` — Submit Scan Results

Submitted by Guardian desktop app after each scan completes.

**Request:**

```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_name": "my-api-service",
  "branch": "main",
  "member_external_id": "dogan",
  "scan_profile": "extended",
  "scanned_at": "2025-07-15T10:30:00Z",
  "duration_ms": 45200,
  "stats": {
    "critical": 2,
    "warning": 8,
    "info": 15,
    "total": 25
  },
  "baseline_status": {
    "new_since_baseline": 3,
    "resolved_since_baseline": 5,
    "baseline_age_days": 12
  },
  "release_decision": {
    "decision": "PASS_WITH_WARNING",
    "ai_heavy_change": false,
    "requires_human_approval": false
  },
  "usage": {
    "tokens": 12400,
    "calls": 8
  },
  "critiques": [
    {
      "finding_id": "f-abc123",
      "file_path": "src/handlers/user.rs",
      "file_kind": "source",
      "severity": "Critical",
      "message": "Unwrapped Result without error handling",
      "has_suggestion": true,
      "has_diff": true,
      "rule_pack": "clean_architecture"
    }
  ],
  "fixes_applied": [
    {
      "finding_id": "f-xyz789",
      "proposal_status": "applied",
      "confidence": 0.92,
      "applied_at": "2025-07-15T10:28:00Z"
    }
  ],
  "policy": {
    "packs": ["clean_architecture", "api_backend_guardrails"],
    "gate": {
      "pass_max_warnings": 5,
      "block_on_critical": true
    }
  }
}
```

**Response:** `201 Created`

```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "accepted",
  "critiques_stored": 25,
  "fixes_recorded": 1
}
```

**Error cases:**
- `409 Conflict` — scan_id already submitted (idempotent, safe to retry)
- `422 Unprocessable Entity` — validation failure (missing required fields)
- `429 Too Many Requests` — rate limit exceeded

---

#### `GET /api/teams/:id/analytics` — Team Metrics

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `weekly` | `daily`, `weekly`, `monthly` |
| `from` | ISO date | 30 days ago | Start of range |
| `to` | ISO date | now | End of range |

**Response:** `200 OK`

```json
{
  "team": {
    "id": "team-uuid",
    "name": "Platform Engineering",
    "member_count": 8
  },
  "period": "weekly",
  "health_score": 78,
  "summary": {
    "total_scans": 142,
    "total_critiques": 387,
    "total_fixes": 301,
    "fix_rate": 0.78,
    "avg_time_to_fix_hours": 4.2,
    "release_pass_rate": 0.85,
    "ai_fix_adoption_rate": 0.64,
    "scan_coverage_avg": 0.91
  },
  "severity_breakdown": {
    "critical": 18,
    "warning": 156,
    "info": 213
  },
  "trends": [
    {
      "week": "2025-W28",
      "scans": 35,
      "critiques": 92,
      "fixes": 78,
      "fix_rate": 0.85,
      "health_score": 81
    },
    {
      "week": "2025-W27",
      "scans": 38,
      "critiques": 101,
      "fixes": 74,
      "fix_rate": 0.73,
      "health_score": 76
    }
  ],
  "top_contributors": [
    {
      "member_id": "member-uuid",
      "display_name": "dogan",
      "scans": 22,
      "fixes_applied": 45,
      "critiques_resolved": 52
    }
  ],
  "projects": [
    {
      "project_id": "project-uuid",
      "name": "my-api-service",
      "health_score": 85,
      "last_scan_at": "2025-07-15T10:30:00Z",
      "open_criticals": 1
    }
  ]
}
```

---

#### `GET /api/projects/:id/trends` — Project Trends

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `weekly` | `daily`, `weekly`, `monthly` |
| `from` | ISO date | 90 days ago | Start of range |
| `to` | ISO date | now | End of range |

**Response:** `200 OK`

```json
{
  "project": {
    "id": "project-uuid",
    "name": "my-api-service",
    "scan_profile": "extended",
    "policy_packs": ["clean_architecture", "api_backend_guardrails"]
  },
  "health_score": 85,
  "scan_history": [
    {
      "scan_id": "scan-uuid",
      "scanned_at": "2025-07-15T10:30:00Z",
      "member": "dogan",
      "stats": { "critical": 2, "warning": 8, "info": 15 },
      "release_decision": "PASS_WITH_WARNING",
      "new_since_baseline": 3,
      "resolved_since_baseline": 5
    }
  ],
  "severity_trends": [
    {
      "week": "2025-W28",
      "critical": 4,
      "warning": 32,
      "info": 48
    }
  ],
  "fix_velocity": {
    "avg_time_to_fix_hours": 3.1,
    "p50_hours": 1.8,
    "p90_hours": 8.4,
    "trend": "improving"
  },
  "top_critique_categories": [
    { "rule_pack": "clean_architecture", "count": 45, "fix_rate": 0.82 },
    { "rule_pack": "secrets_security_hygiene", "count": 12, "fix_rate": 0.91 }
  ],
  "baseline_health": {
    "baseline_age_days": 12,
    "active_findings": 18,
    "drift_direction": "improving"
  }
}
```

---

#### Additional Endpoints (MVP+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/:id/members` | List team members with activity stats |
| `GET` | `/api/members/:id/activity` | Individual contributor activity feed |
| `POST` | `/api/teams` | Create a new team (returns API key) |
| `PUT` | `/api/teams/:id/settings` | Update team privacy/retention settings |
| `POST` | `/api/teams/:id/api-keys/rotate` | Rotate API key |
| `GET` | `/api/projects/:id/scans` | Paginated scan history for a project |
| `GET` | `/api/health` | Server health check |

---

## 5. UI Wireframes

### 5.1 Team Dashboard — Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛡 Guardian Team Dashboard           Platform Engineering    [Settings]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ HEALTH     │  │ FIX RATE   │  │ SCANS      │  │ OPEN       │       │
│  │ SCORE      │  │            │  │ THIS WEEK  │  │ CRITICALS  │       │
│  │            │  │            │  │            │  │            │       │
│  │    78      │  │   78%      │  │    35      │  │     4      │       │
│  │   ▲ +2     │  │   ▲ +5%   │  │   ▼ -3    │  │   ▼ -2    │       │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘       │
│                                                                         │
│  CRITIQUE TRENDS (Last 12 Weeks)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  120│                                                           │   │
│  │     │    ██                                                     │   │
│  │  100│    ██  ██                                                 │   │
│  │     │ ██ ██  ██  ██                                             │   │
│  │   80│ ██ ██  ██  ██  ██                                         │   │
│  │     │ ██ ██  ██  ██  ██  ██  ██                                 │   │
│  │   60│ ██ ██  ██  ██  ██  ██  ██  ██  ██                         │   │
│  │     │ ██ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██             │   │
│  │   40│ ██ ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██             │   │
│  │     └───────────────────────────────────────────────────────    │   │
│  │      W17 W18 W19 W20 W21 W22 W23 W24 W25 W26 W27 W28          │   │
│  │      ■ Critical  ■ Warning  ■ Info                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  TOP CONTRIBUTORS                       PROJECTS                       │
│  ┌──────────────────────────┐           ┌──────────────────────────┐   │
│  │ 1. dogan      45 fixes  │           │ my-api-service     ● 85  │   │
│  │ 2. alex       38 fixes  │           │ web-frontend       ● 79  │   │
│  │ 3. priya      31 fixes  │           │ auth-service       ● 72  │   │
│  │ 4. marco      28 fixes  │           │ data-pipeline      ● 68  │   │
│  │ 5. sarah      22 fixes  │           │ mobile-app         ● 91  │   │
│  └──────────────────────────┘           └──────────────────────────┘   │
│                                          ● = health score              │
│  RELEASE GATE SUMMARY                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PASS ████████████████████████████████████████  85%             │   │
│  │  WARN ████████████                              10%             │   │
│  │  BLOCK ███                                       4%             │   │
│  │  OVERRIDE █                                      1%             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Project Detail View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛡 Guardian   ← Back to Team          my-api-service          [Export]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  HEALTH: 85  │  Profile: Extended  │  Policy: clean_arch, api_guards   │
│  Last scan: 2 hours ago by dogan   │  Baseline age: 12 days            │
│                                                                         │
│  SCAN HISTORY                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Date       │ By    │ C │ W │ I  │ Decision          │ Baseline │   │
│  │────────────┼───────┼───┼───┼────┼───────────────────┼──────────│   │
│  │ Jul 15 10a │ dogan │ 2 │ 8 │ 15 │ PASS_WITH_WARNING │ +3 / -5  │   │
│  │ Jul 14  3p │ alex  │ 1 │ 6 │ 12 │ PASS              │ +1 / -3  │   │
│  │ Jul 14  9a │ dogan │ 3 │ 9 │ 14 │ BLOCK             │ +4 / -1  │   │
│  │ Jul 13  4p │ priya │ 0 │ 5 │ 11 │ PASS              │ +0 / -7  │   │
│  │ Jul 12  2p │ dogan │ 2 │ 7 │ 13 │ PASS_WITH_WARNING │ +2 / -4  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  SEVERITY BREAKDOWN (12 Weeks)        FIX VELOCITY                     │
│  ┌──────────────────────────┐         ┌──────────────────────────┐     │
│  │ Critical ▼ ━━━━━━━       │         │ Median time to fix:      │     │
│  │          2 (was 5)       │         │   1.8 hours              │     │
│  │ Warning  ▼ ━━━━━━━━━━━━  │         │                          │     │
│  │          8 (was 14)      │         │ P90 time to fix:         │     │
│  │ Info     ━ ━━━━━━━━━━━━━ │         │   8.4 hours              │     │
│  │          15 (stable)     │         │                          │     │
│  └──────────────────────────┘         │ Trend: ▲ Improving       │     │
│                                        │ AI fix adoption: 64%     │     │
│  TOP CRITIQUE CATEGORIES               └──────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ clean_architecture        ███████████████████  45  (82% fixed) │   │
│  │ secrets_security_hygiene  ██████               12  (91% fixed) │   │
│  │ api_backend_guardrails    ████                  8  (75% fixed) │   │
│  │ error_handling            ███                   6  (67% fixed) │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Security

### 6.1 Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| **Scan submission** | Team API key (Bearer token). One key per team, rotatable. |
| **Dashboard access** | OAuth 2.0 via GitHub (maps `GithubUser.login` to `members.external_id`). |
| **Role-based access** | `owner` can manage team settings and API keys. `admin` can view all data. `member` sees only their own activity + aggregate team metrics. |
| **Rate limiting** | 100 scan submissions/min per API key. 1000 reads/min per user session. |

### 6.2 Data Protection

| Concern | Approach |
|---------|----------|
| **In transit** | TLS 1.3 required for all API communication. |
| **At rest** | PostgreSQL with AES-256 encryption for the data volume. API keys stored as SHA-256 hashes only. |
| **File paths** | Teams can enable path hashing (SHA-256) so actual file paths are never stored server-side. |
| **Critique messages** | Optionally redacted — store severity + category only, without the actual message text. |
| **No source code** | The submission payload never includes file contents, diffs, or `suggested_diff` text. Only metadata. |

### 6.3 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Right to erasure** | `DELETE /api/members/:id` removes all associated scans, critiques, and fixes. Cascade delete in DB. |
| **Data minimization** | Only governance metadata is collected — no source code, no commit messages, no file contents. |
| **Retention policy** | Configurable per-team (default: 365 days). Automated purge job deletes data older than retention window. |
| **Data export** | `GET /api/members/:id/export` returns all data associated with a member in JSON format. |
| **Consent** | Submission is opt-in. Users must explicitly enable dashboard sync in Guardian desktop settings. |
| **Processing records** | Server maintains an audit log of all data access and deletion requests. |

---

## 7. MVP Scope

### 7.1 MVP (v1.0) — Ship First

**Goal:** Prove the value of team-wide visibility with minimal server infrastructure.

| Component | Scope |
|-----------|-------|
| **Guardian desktop** | Add opt-in "Team Sync" toggle in settings. On scan completion, POST `ScanSubmission` to configured server URL. |
| **Server** | Single-binary Go or Rust service. PostgreSQL storage. Three endpoints: `POST /api/scans`, `GET /api/teams/:id/analytics`, `GET /api/projects/:id/trends`. |
| **Dashboard UI** | React SPA with two views: Team Overview (health score, critique trends, project list) and Project Detail (scan history, severity breakdown). |
| **Auth** | API key for submissions. GitHub OAuth for dashboard login. |
| **Data model** | `teams`, `members`, `projects`, `scans`, `critiques` tables. No rollup tables — compute on read. |
| **Privacy** | No source code transmitted. Optional path hashing. |

**Explicitly excluded from MVP:**
- Fix tracking and fix velocity metrics
- AI adoption analytics
- Alerts and notifications
- RBAC beyond owner/member
- Custom dashboards or saved views
- Embedded dashboard in Guardian desktop app

### 7.2 v1.1 — Fix Tracking & Velocity

| Addition | Detail |
|----------|--------|
| `fixes` table | Track fix applications, confidence, and time-to-fix |
| Fix velocity panel | Median/P90 time-to-fix, trend direction |
| AI adoption metric | Percentage of fixes from AI suggestions vs manual |
| `project_rollups` table | Pre-computed daily/weekly aggregates for performance |

### 7.3 v1.2 — Contributor Insights & Alerts

| Addition | Detail |
|----------|--------|
| Member activity view | Per-contributor scan count, fixes, and critique resolution |
| Top contributors leaderboard | Ranked by fixes applied (opt-in, privacy-respecting) |
| Slack/email alerts | Configurable: "Critical count exceeded threshold", "No scans in 7 days" |
| Baseline drift alerts | Notify when baseline age exceeds configured limit |

### 7.4 v2.0 — Enterprise Features

| Addition | Detail |
|----------|--------|
| Multi-team support | Organization-level dashboards aggregating across teams |
| RBAC | Fine-grained permissions (view-only, project-scoped access) |
| SSO/SAML | Enterprise identity provider integration |
| Embedded dashboard | Show team context directly inside Guardian desktop app |
| API webhooks | Push events to external systems on scan completion |
| Compliance reports | Exportable PDF/CSV reports for audit purposes |
| Custom health score weights | Teams can tune the health score formula |

---

## 8. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Should file paths be hashed by default or opt-in? | Privacy vs debuggability trade-off |
| 2 | Should the server be self-hosted only or offer a managed SaaS option? | Deployment model, pricing |
| 3 | How do we handle projects scanned by multiple team members with different policy configs? | Data consistency |
| 4 | Should health score weights be fixed or team-configurable from v1? | Complexity vs flexibility |
| 5 | What is the maximum acceptable payload size for `POST /api/scans`? | Large monorepo scans could produce thousands of critiques |

---

## 9. References

- Guardian type definitions: `src/types/guardian.ts`
- Rust critique model: `src-tauri/src/ai_client.rs`
- Scan policy and profiles: `guardian-scan-policy/src/lib.rs`
- Release decision logic: `src-tauri/src/release_decision.rs`
- History event logging: `src-tauri/src/history_logger.rs`
- Triage and file classification: `src-tauri/src/triage.rs`
- Rule definitions: `guardian-rules/src/lib.rs`
- Guardian policy config: `guardian.policy.yaml`
- Telemetry queue: `src-tauri/src/storage/mod.rs`
