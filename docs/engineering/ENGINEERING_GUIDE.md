# Engineering Guide

## Purpose and scope

This guide is the governance entry point for engineering the Family Office CIO Platform. It defines how decisions are owned, how work is evidenced, and where authoritative policy lives. It applies to source code, Apps Script projects, Google Sheets workbooks, Google Drive artifacts, CI, releases, documentation, and AI-assisted work.

The guide does not redefine investment policy or the detailed architecture. Accepted ADRs and the CIO governance model remain authoritative for those decisions.

## Governance document map

| Subject | Canonical document |
|---|---|
| Engineering governance and ownership | This guide |
| System structure and current layers | [Repository Architecture](../ARCHITECTURE.md) |
| Durable architecture constraints and ADR triggers | [Architecture Principles](ARCHITECTURE_PRINCIPLES.md) |
| Investment decision-support posture | [CIO Philosophy](CIO_PHILOSOPHY.md) |
| Change lifecycle, tests, Definition of Done, PR review | [Development Workflow](DEVELOPMENT_WORKFLOW.md) |
| Branch and remote rules | [Branching Strategy](BRANCHING_STRATEGY.md) |
| Versioning, release gates, Lab-to-Production promotion | [Release Policy](RELEASE_POLICY.md) |
| Operational release controls | [Release Checklist](../RELEASE_CHECKLIST.md) |
| AI and human collaboration | [AI Collaboration Model](AI_COLLABORATION_MODEL.md) |
| Binding architecture decisions | Accepted ADRs in [`docs/architecture/`](../architecture/) and [`docs/risk/`](../risk/) |
| Current delivery priorities | [Roadmap](../ROADMAP.md) |

When documents conflict, use this order: legal, fiduciary, security, and privacy obligations; accepted ADRs; engineering policies; wave-specific designs and evidence; explanatory summaries. A later accepted ADR may supersede an earlier ADR and must say so explicitly. Historical evidence must not be rewritten to match a later policy.

## Shared terminology

- **Engineering Lab (Lab):** the controlled environment and `origin` repository where changes are developed, integrated, and certified before production promotion.
- **Production:** the separately governed `production` repository, Apps Script project, workbooks, triggers, and Drive outputs serving the live operating platform.
- **Wave:** one bounded, traceable delivery unit with an objective, acceptance criteria, test evidence, and rollback plan.
- **Baseline:** a named and versioned statement of configuration, architecture, code, and operational expectations.
- **Certification:** a human-owned decision, supported by evidence, that a release candidate meets its stated gates. A passing CI job alone is not certification.
- **Governed additive change:** a backward-compatible extension that preserves authoritative sources, workbook ownership, schemas, and existing consumers unless an approved migration says otherwise.
- **Engine-owned output:** a worksheet produced by controlled code and read-only to people and other components except through its defined contract.
- **Policy/reference worksheet:** governed input that may be manually edited only through its approved review and audit process.

## Engineering principles

1. **Protect capital and decision integrity.** Reliability, traceability, and truthful uncertainty outrank delivery speed.
2. **One authority per concern.** Code lives in GitHub; operational state and reports live in their governed workbooks; broker sources retain raw account evidence.
3. **Evidence over assertion.** Every material decision, test result, deployment, and certification must be traceable to observable evidence.
4. **Additive by default.** Preserve compatible contracts and migrate deliberately. Breaking changes require an ADR, migration, rollback, and explicit approval.
5. **Deterministic and explainable outputs.** The same governed inputs and version must produce explainable results, or documented external variability must be controlled and recorded.
6. **Fail visibly and safely.** Missing, stale, invalid, or incomplete data must reduce confidence, block unsafe action, or produce an explicit warning; it must not be converted silently into certainty.
7. **Least privilege and minimum data.** Limit credentials, scopes, workbook access, logs, test data, and AI context to what the task requires.
8. **Human accountability.** Automation and AI assist judgment. Named humans remain accountable for architecture acceptance, investment policy, release approval, and production operation.
9. **Reversibility.** Material changes need a tested or credible rollback path and must preserve audit evidence.
10. **Operational ownership.** A feature is incomplete until it is observable, supportable, documented, and owned after release.

## Governance model

| Role | Accountable for | Must not delegate solely to AI |
|---|---|---|
| CIO / Investment Policy Owner | Investment objectives, policy, risk appetite, material decision rules | Investment-policy approval and capital decisions |
| Engineering Lead | Technical governance, architecture process, quality bar, repository controls | Architecture acceptance and exceptions |
| Domain Owner | Domain contracts, data quality, acceptance criteria, operational fitness | Domain sign-off |
| Change Author | Scoped implementation, documentation, tests, evidence, rollback | Accuracy of the submitted change |
| Independent Reviewer | Correctness, controls, maintainability, evidence challenge | Pull request approval |
| Release Manager | Version, release record, promotion gates, traceability | Production promotion approval |
| Production Operator | Controlled deployment, authorization, post-deploy validation, recovery | Confirmation of the live operational result |

One person may hold multiple roles in a small team, but a material or high-risk change still requires an independent review. The author, including an AI author, cannot be the sole approver or certifier.

Exceptions to policy require a named owner, reason, risk assessment, compensating control, expiry or review date, and approval by the accountable role. Store the exception with the relevant ADR, pull request, or release evidence.

## Platform responsibility model

| System | Owns | Does not own | Minimum control |
|---|---|---|---|
| GitHub | Source, documentation, reviews, CI evidence, tags, releases, change history | Live portfolio state or workbook execution evidence | Protected branches, pull requests, traceable commits, no secrets |
| Google Apps Script | Versioned execution logic, services, orchestration, validations, controlled worksheet writes | Source-of-truth history outside GitHub or ad hoc investment discretion | Deployment tied to an approved commit; least scopes; execution logs |
| Google Sheets | Governed operational inputs, engine outputs, validation, certification, executive reporting | Source code or uncontrolled schema evolution | Registered ownership, protected engine outputs, schema validation, backups |
| Google Drive | Controlled workbook and report storage, access boundaries, retained evidence | An alternative source repository or ungoverned release channel | Least-privilege sharing, stable locations, retention and naming controls |
| External broker/account sources | Raw holdings and transaction evidence before ingestion | Platform-derived recommendations or CIO reporting | Reconciliation, freshness, provenance, secure access |

Workbook domain ownership remains defined by [Architecture Ownership Policy](../architecture/ARCHITECTURE-OWNERSHIP-POLICY.md) and ADR-001/ADR-002.

## Documentation standards

- Give each document one clear purpose, owner, and canonical subject. Link rather than copy policy text.
- Put enduring decisions in ADRs; current system descriptions in architecture docs; procedures in runbooks/checklists; planned work in the roadmap; observed results in validation evidence.
- Record status, date, wave/release, assumptions, consequences, and superseded documents when they affect interpretation.
- Use repository-relative Markdown links and established names exactly. Keep diagrams consistent with declared source-of-truth boundaries.
- Update documentation in the same pull request as the behavior or contract it describes.
- Never overwrite historical certification or test evidence. Add a correction or superseding record with traceable context.
- Do not include secrets, personal financial data, account identifiers, or screenshots containing uncontrolled sensitive data.
- A new document is justified only when no existing canonical document can be extended without mixing concerns.

## Minimum control set

Every change follows the [Development Workflow](DEVELOPMENT_WORKFLOW.md), including its Definition of Done and Pull Request checklist. Architecture-significant work also follows the [Architecture Review checklist](ARCHITECTURE_PRINCIPLES.md#architecture-review-checklist). Every production promotion follows the [Release Policy](RELEASE_POLICY.md) and the canonical [Release Checklist](../RELEASE_CHECKLIST.md).

## Policy maintenance

The Engineering Lead owns this governance set. Review it after a material incident, architecture change, repository-topology change, or at least annually. Policy changes use a pull request and explain which existing guidance is replaced, extended, or retained.
