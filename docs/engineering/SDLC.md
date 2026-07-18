# Software Development Lifecycle

- **Owner:** Engineering Lead
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

This document defines the official lifecycle for every platform wave. It complements the operational [Development Workflow](DEVELOPMENT_WORKFLOW.md), [Engineering Governance](ENGINEERING_GOVERNANCE.md), and [Release Governance](RELEASE_GOVERNANCE.md).

## Lifecycle

| Stage | Required outcome | Accountable role | Exit evidence |
|---|---|---|---|
| 1. Idea | The problem, intended value, sponsor, affected users, and constraints are recorded. | CIO or Domain Owner | Intake or wave proposal |
| 2. Architecture | Sources of truth, boundaries, contracts, consumers, security, operations, and alternatives are assessed. | Chief Architect / Engineering Lead | Architecture assessment |
| 3. ADR | An enduring material decision is proposed and human-accepted when an ADR trigger applies. | Chief Architect / Engineering Lead | Accepted ADR, or recorded non-applicability |
| 4. Planning | Scope, non-goals, dependencies, acceptance criteria, risks, owner, validation, and rollback are approved. | Domain Owner and Change Author | Passed [Definition of Ready](DEFINITION_OF_READY.md) |
| 5. Implementation | The smallest complete change is built on the correct branch with contracts and documentation updated together. | Implementation Engineer | Reviewable diff |
| 6. Testing | Proportionate static, unit, integration, runtime, workbook, security, and recovery checks are executed. | Implementation Engineer | Traceable test evidence |
| 7. Architecture Review | The implemented result is checked against accepted architecture and ADRs. | Chief Architect / Engineering Lead | Review decision and findings |
| 8. Release Validation | The exact candidate commit is evaluated against release gates and acceptance criteria. | Release Validator | Validation report |
| 9. Merge | Independent approval and required checks authorize integration into the governed target branch. | Authorized reviewer | Merged pull request |
| 10. Release Tag | An immutable version tag is created on the approved release commit by an authorized actor. | Release Manager | Tag and release record |
| 11. Roadmap Update | Delivered scope, deferred debt, and next-wave status are reconciled. | Engineering Lead | Updated [Roadmap](ROADMAP.md) |
| 12. Production Readiness | Promotion target, operator, backups, rollback, monitoring, and post-deploy validation are confirmed. | Release Manager and Production Operator | Completed release controls |

Stages may overlap in discovery, but no gate may be represented as complete before its evidence and required approval exist. Documentation-only work may record runtime and workbook stages as not applicable with a reason; production-impacting work cannot.

## Stage controls

### Idea, architecture, and ADR

The proposal must preserve fiduciary and source-of-truth boundaries. The architecture assessment uses the [Architecture Principles](ARCHITECTURE_PRINCIPLES.md). If a trigger applies, use the [ADR Guide](../adr/README.md) and [ADR Template](../adr/ADR_TEMPLATE.md) before implementation.

### Planning

Planning converts intent into a bounded wave. Work starts only after the [Definition of Ready](DEFINITION_OF_READY.md) is satisfied. The branch is selected under the [Branching Strategy](BRANCHING_STRATEGY.md).

### Implementation and testing

Implementation follows [Repository Standards](REPOSITORY_STANDARDS.md) and [Quality Standards](QUALITY_STANDARDS.md). Evidence distinguishes source inspection, automated checks, Apps Script execution, workbook inspection, and production certification; none substitutes automatically for another.

### Review, validation, and merge

Architecture review addresses design conformance. Release validation addresses candidate readiness. Merge approval addresses integration authority. These are separate decisions and must be independently traceable under [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).

### Tag, roadmap, and production readiness

A merge does not authorize a tag or deployment. Versioning, Lab certification, promotion, deployment, and post-deploy verification follow [Release Governance](RELEASE_GOVERNANCE.md), the [Release Policy](RELEASE_POLICY.md), and the [Release Checklist](../RELEASE_CHECKLIST.md). The wave closes only after the [Definition of Done](DEFINITION_OF_DONE.md) is satisfied.

## Change control

If scope, architecture, investment intent, risk, or dependencies materially change after readiness approval, return to the affected earlier stage and reapprove the wave. Preserve prior evidence; do not rewrite it to imply the new scope was previously approved.
