# Architecture Decision Records

- **Owner:** Chief Architect / Engineering Lead
- **Status:** Governing ADR guide and register
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

Architecture Decision Records capture material, enduring platform decisions and their consequences. They complement the [Architecture Principles](../engineering/ARCHITECTURE_PRINCIPLES.md), [Engineering Governance](../engineering/ENGINEERING_GOVERNANCE.md), and current architecture documentation; they do not replace implementation plans or validation evidence.

## When an ADR is required

Create or amend an ADR before implementation when a change:

- changes a source of truth, workbook boundary, domain owner, or material consumer contract;
- introduces a cross-workbook or external-system dependency;
- changes investment policy, risk-model meaning, scoring, or execution authority;
- breaks or repurposes a public function, worksheet schema, identifier, or output contract;
- adds a production authorization scope, credential class, trigger model, or deployment path;
- materially changes orchestration ordering or failure semantics;
- adopts a new platform, data store, runtime, architectural pattern, or material dependency;
- accepts an enduring material exception to architecture or engineering policy.

A compatible implementation detail within an accepted design normally does not need an ADR, but the pull request records why the trigger does not apply.

## Numbering and naming convention

1. Reserve the next unused repository-wide three-digit number during planning.
2. Use `ADR-NNN-UPPERCASE-SHORT-TITLE.md`, for example `ADR-004-ENGINE-OUTPUT-CONTRACT.md`.
3. ADR numbers are never reused, including for rejected, withdrawn, or superseded records.
4. The numeric identifier is repository-wide across `docs/adr/`, `docs/architecture/`, and `docs/risk/`.
5. New decision records belong in `docs/adr/`. Historical accepted ADRs remain at their original paths so links and audit history stay intact.

The next available number is **ADR-004**. Confirm that it is still unused immediately before reserving it.

## Status lifecycle

Use exactly one status:

- **Proposed:** under review; not implementation authority.
- **Accepted:** approved by the accountable human roles and binding from its decision date.
- **Rejected:** considered and not adopted; retained as history.
- **Superseded:** replaced by a named later ADR; retained and not edited to reflect the replacement.
- **Deprecated:** decision remains historical but is no longer recommended; replacement or exit plan is named.

Only the Chief Architect / Engineering Lead may record architecture acceptance. The CIO / Investment Policy Owner must also approve investment or risk-policy effects. An AI assistant or author cannot accept its own ADR.

## Workflow

1. Search this register, historical ADR locations, baselines, schemas, and relevant wave documents.
2. Reserve the next number and copy [ADR Template](ADR_TEMPLATE.md).
3. Describe the context, decision drivers, alternatives, decision, consequences, affected authorities/contracts, security/data effects, migration, validation, and rollback.
4. Circulate the proposed ADR to affected Domain Owners and reviewers.
5. Record the human decision, date, owners, and approval references.
6. Implement only after acceptance when the ADR is a prerequisite.
7. Link the ADR from the wave, pull request, architecture documents, tests, release evidence, and this register.
8. Supersede an accepted ADR with a new ADR; do not rewrite the accepted decision.

## Decision register

| ADR | Status | Decision | Location |
|---|---|---|---|
| ADR-001 | Accepted | Production architecture and workbook boundaries | [Historical record](../architecture/ADR-001-PRODUCTION-ARCHITECTURE.md) |
| ADR-002 | Accepted | Cross-workbook governance and recommendation-event contract | [Historical record](../architecture/ADR-002-CROSS-WORKBOOK-GOVERNANCE.md) |
| ADR-003 | Accepted | Position and portfolio risk scoring | [Historical record](../risk/ADR-003-POSITION-PORTFOLIO-RISK-SCORING.md) |

## Review standard

An ADR review applies the [Architecture Review checklist](../engineering/ARCHITECTURE_PRINCIPLES.md#architecture-review-checklist). Reviewers confirm that the proposal preserves the Dashboard/Ledger boundaries, keeps investment authority human-owned, makes contracts and failures explicit, handles security and sensitive data, inventories consumers, and provides credible validation and recovery.
