# Architecture

## Operating model

```text
GitHub repository
      ↓
GitHub Actions validation
      ↓
Google Apps Script deployment
      ↓
Google Sheets data and reporting layer
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
