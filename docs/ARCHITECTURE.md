# Architecture

## Governance context

This document describes the platform's current structure. Durable constraints and review gates are defined in [Architecture Principles](engineering/ARCHITECTURE_PRINCIPLES.md). Accepted decisions in `docs/architecture/` and `docs/risk/` remain binding; the [Engineering Guide](engineering/ENGINEERING_GUIDE.md) explains document authority and ownership.

## Operating model

```text
Engineering Lab GitHub repository (origin)
      ↓
Feature review, CI and Lab integration
      ↓
Lab Apps Script and workbook validation
      ↓
Lab-certified main and exact-commit promotion
      ↓
Production GitHub repository (production)
      ↓
Controlled production Apps Script deployment
      ↓
Governed Google Sheets and Drive outputs
      ↓
Family Office CIO Platform
```

## Architectural layers

### 1. Foundation services

- Configuration
- Logging
- Spreadsheet service
- Utilities
- Versioning
- Validation
- Backup
- Scheduling and triggers

#### Registry Authority

R1.3.1.1 adds an in-memory Registry Authority for governed registration,
metadata-only discovery, and validation of platform registries. The authority
initially adopts only `FO_SHEETS`, `FO_REQUIRED_DASHBOARD_SHEETS`, and the
Market Symbol Registry. Each existing registry retains its business data and
direct consumer contracts. The authority performs no workbook access and does
not change orchestration or runtime behavior. See the
[Registry Authority architecture](architecture/R1.3.1.1-REGISTRY-AUTHORITY.md)
and [ADR-004](adr/ADR-004-REGISTRY-AUTHORITY.md).

#### Runtime safety (reduced scope)

Governed Dashboard and Ledger access flows through `foDashboard_()` and
`foLedger_()` in `SpreadsheetService.js`. The single direct
`SpreadsheetApp.openById()` call intentionally remains only at that adapter
boundary because the Apps Script API must perform the physical workbook open.
`RuntimeSafety.js` validates the environment-bound Script Property ID before
the open, verifies the returned workbook identity afterward, and requires the
workbook-resident `FO_RUNTIME_ENVIRONMENT` and `FO_RUNTIME_WORKBOOK_ROLE`
named ranges to match the configured environment and workbook role. No direct
`SpreadsheetApp.openByUrl()` access remains.

Read authorization through `foDashboardRead_()` and `foLedgerRead_()` validates
configuration, identity, and workbook binding without requiring Production write
enablement. The mixed-use legacy `foDashboard_()` and `foLedger_()` accessors
retain write authorization for backward compatibility, and write authorization
additionally requires `FO_PRODUCTION_WRITE_ENABLED=TRUE` in Production. The
legacy `foAssertRuntimeSafety_()` helper also retains write-assertion semantics.

The explicit runtime-lock inventory contains only:

- `foRunAutonomousCioOrchestrator()`
- `foRunProductionCertification()`
- `foArchiveReport()`
- `foRunProductionCertificationWave311()`
- `foRunExecutiveReportEngine()` as the Executive Report archive workflow
- `foRunWeeklyCioReportA240()` as the Weekly CIO Report archive workflow

Root protected calls validate both governed workbook bindings before invoking
their callback; nested protected calls join the existing lock. Other mutating
execution paths are not represented as lock-protected, so this reduced scope is
not a script-wide locking or governed-writer guarantee.

### 2. Portfolio intelligence

- Portfolio state
- Market data
- Symbol registry
- Valuation
- Data integrity
- Performance
- Exposure and attribution
- Broker reconciliation

### 3. CIO intelligence

- Recommendation engine
- Buy Zone Intelligence
- Market Intelligence
- CIO Decision Engine
- Recommendation policy and explainability roadmap

### 4. Executive outputs

- Executive Dashboard
- Executive CIO Report
- Daily and weekly reports
- Investment Committee outputs
- Event-driven alerts roadmap

### 5. Autonomous operations

The Autonomous CIO Orchestrator executes registered modules in controlled order and records:

- Run ID
- Step status
- Start and completion times
- Duration
- Result or error details
- Overall success, partial success, or failure

## Core governance principles

- GitHub is the authoritative codebase
- `main` represents the production baseline
- Feature branches isolate changes
- CI blocks invalid manifests, missing modules, broken menu references, duplicate global functions, and committed secrets
- Apps Script deployments must be traceable to a Git commit
- Google Sheets are operational data and reporting surfaces, not the source-code authority
- The Family Office Portfolio Dashboard owns operational current state; the Family Office Investment Ledger owns governed learning and immutable recommendation events
- Reporting consumes governed decision state and does not invent independent portfolio posture or execution authority
- Lab and production repositories, Apps Script projects, workbooks, credentials, and permissions remain distinct

## Detailed architecture record

- [ADR-001 — Production Architecture and Workbook Boundaries](architecture/ADR-001-PRODUCTION-ARCHITECTURE.md)
- [ADR-002 — Cross-Workbook Governance and Recommendation Event Contract](architecture/ADR-002-CROSS-WORKBOOK-GOVERNANCE.md)
- [ADR-003 — Position and Portfolio Risk Scoring](risk/ADR-003-POSITION-PORTFOLIO-RISK-SCORING.md)
- [ADR-004 — Registry Authority](adr/ADR-004-REGISTRY-AUTHORITY.md)
- [Architecture Ownership Policy](architecture/ARCHITECTURE-OWNERSHIP-POLICY.md)
- [Production Dependency Baseline](architecture/PRODUCTION-DEPENDENCY-BASELINE.md)
