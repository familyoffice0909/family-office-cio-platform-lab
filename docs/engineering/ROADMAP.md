# Engineering Roadmap

- **Owner:** Engineering Lead
- **Status:** Active portfolio record
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

This roadmap organizes platform delivery into five institutional epics. Status is evidence-based: **Completed** means the recorded wave was delivered in the Lab history; **In progress** means work is active but not release-closed; **Future** is not approved implementation authority. Wave readiness and completion follow the [Definition of Ready](DEFINITION_OF_READY.md) and [Definition of Done](DEFINITION_OF_DONE.md).

## Epic 1 — Platform Foundation

**Outcome:** A governed, supportable platform foundation with health, integrity, portfolio state, valuation, risk, market data, and core services.

**Completed:**

- Phase 0 — Enterprise Engineering foundation
- Phase 1 — Core CIO Platform foundation
- A2.1 — Portfolio Risk Architecture
- A2.1.3 — Risk Architecture Validator
- A2.1.6.1 — Timezone alias correction
- A2.2.1 through A2.2.4.2 — Numeric stability and controlled helper/header recovery waves

**Future:**

- Foundation hardening driven by incidents, quota evidence, security review, and recovery exercises
- Explicitly approved dependency, runtime, and configuration modernization

## Epic 2 — Architecture Governance

**Outcome:** Durable architecture decisions, repository integrity, ownership, engineering standards, quality gates, and release controls.

**Completed:**

- A2.3.0 — Architecture Foundation
- R1.3.0.1 — Repository Integrity
- R1.3.0.2 — Runtime Safety
- R1.3.0.4 — Engineering Governance ([release closure evidence](../validation/R1.3.0.4-RELEASE-CLOSURE-EVIDENCE.md))

**In progress:**

- R1.3.0.3 — Runtime Completion
  - Implementation complete
  - Architecture Review complete
  - Static validation complete
  - CI complete
  - Apps Script Lab validation pending
  - Merge pending
- R1.3.1 — Architecture Enforcement
  - R1.3.1.1 — Registry Authority
    - Implementation and automated tests complete on the feature branch
    - ADR, architecture documentation, and validation evidence prepared
    - Architecture review, Draft PR review, merge, and release closure pending

**Future:**

- R1.3.1 — Architecture Enforcement
  - Writer Authority
  - Reporting Authority
  - Failure Authority
  - Certification Authority
  - RunContext
  - Run Identity
  - Dependency Enforcement
- Dependency, schema, documentation-link, and policy-conformance controls
- Periodic governance review and technical-debt portfolio reporting

## Epic 3 — Executive Intelligence

**Outcome:** Explainable, material, decision-ready executive views and reporting with governed lineage.

**Completed:**

- A2.3.3 — Executive Decision Integration
- A2.4.0 — Unified Weekly CIO Report
- Phase 1 executive reporting and dashboard baseline

**Future:**

- Decision explainability: why, why now, evidence, contradictions, triggers, and invalidation
- Executive reporting hardening, dashboard evolution, morning brief, and governed alerts
- Reporting lineage, distribution, and operational resilience improvements

## Epic 4 — Investment Intelligence

**Outcome:** Governed portfolio, attribution, recommendation, materiality, buy-zone, and capital-deployment intelligence that remains advisory to the CIO.

**Completed:**

- A2.3.1 — Portfolio Attribution
- A2.3.1.1 — Cost-Basis Coverage
- A2.3.2 — Portfolio Return Attribution
- Wave 2.4 — Buy Zone Intelligence baseline
- Phase 2 live portfolio intelligence capabilities recorded in the repository history

**In progress:**

- Release 2.1.0 — Multi-Account Portfolio Intelligence Core
  - RC2 architecture remediation implemented: canonical aggregation, base-currency contract, account/security normalization, explicit duplicate rules, release lineage, compatibility migration, and automated regressions
  - Feature review, Apps Script Lab validation, workbook validation, merge, certification, and release closure pending

**Future:**

- Buy Zone hardening, target-entry and freshness controls, history, and holding/watchlist distinction
- Recommendation change detection and duplicate-event prevention
- Recommendation policy, capital deployment, sell/trim discipline, scenarios, benchmarks, and optimization

## Epic 5 — Autonomous CIO

**Outcome:** Controlled orchestration and operations that automate repeatable analysis while preserving human investment and release authority.

**Completed:**

- Phase 1 autonomous orchestration baseline

**Future:**

- Production cycle, market-session awareness, scheduling, bounded retries, runtime locks, and alert automation
- Operational observability, idempotency, recovery drills, and post-run certification
- Broader family-office operating capabilities only through separately approved epics and ADRs

## Roadmap governance

The CIO prioritizes business outcomes; the Engineering Lead owns sequencing and technical dependencies; Domain Owners define acceptance criteria. Update this roadmap at planning, merge, release closure, incident follow-up, and governance review. Do not mark a wave completed from code presence alone. Link validation and release evidence when available, and carry deferred risk into an owned future item under [Engineering Governance](ENGINEERING_GOVERNANCE.md#technical-debt-policy).
