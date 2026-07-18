# Architecture Principles

## Purpose

These principles constrain how the platform evolves. They supplement the current system description in [Repository Architecture](../ARCHITECTURE.md) and the binding decisions in the ADRs; they do not replace either.

## Institutional architecture principles

### 1. Preserve authoritative boundaries

GitHub owns source and release history. The Family Office Portfolio Dashboard owns current operational CIO state. The Family Office Investment Ledger owns immutable recommendation events, outcomes, calibration, lessons, and playbooks. External broker/account sources own raw evidence before ingestion.

No convenience copy may silently become authoritative. New cross-workbook dependencies require explicit ownership, provenance, failure behavior, and an ADR.

### 2. Separate intelligence from transport and presentation

Investment and risk engines calculate governed results. Spreadsheet services own worksheet access and writes. Reporting layers consume governed outputs and must not recalculate independent portfolio posture or deployment authority. Orchestration coordinates registered modules without embedding their domain policy.

### 3. Prefer governed additive change

Extend schemas and services compatibly by default. Do not repurpose a field, worksheet, global function, or output meaning in place. Breaking change requires a new architecture version, migration plan, dual-read or compatibility strategy where practical, rollback, consumer inventory, and accepted ADR.

### 4. Make contracts explicit

Every production input and output has an owner, schema, units, timezone, null behavior, freshness expectation, identifier, and validation rule. Engine-owned worksheets are written only through controlled code. Policy/reference worksheets are editable only through governed review.

### 5. Treat data quality as part of the result

Missing cost basis, stale prices, incomplete coverage, invalid numbers, or reconciliation gaps must be visible in readiness and confidence. Invalid data must never be coerced into favorable classifications. Numeric outputs must be finite and bounded where the contract requires it.

### 6. Keep decision support explainable and advisory

Outputs must expose the drivers, evidence, contradictions, materiality, confidence, trigger, and invalidation conditions required for human review. Automated modules do not create discretionary trade authority. The [CIO Philosophy](CIO_PHILOSOPHY.md) governs this boundary.

### 7. Design deterministic, idempotent operations

Given the same version, baseline, and governed inputs, computation should be reproducible. Scheduled or retried functions must avoid duplicate events and unintended overwrites. Where market data or time creates variability, capture timestamp, source, freshness, and run identity.

### 8. Make operations observable and traceable

Material runs record run ID, step status, timestamps, duration, version/baseline, affected outputs, and errors. A deployment must resolve to a Git commit. A report or decision must retain source-run lineage sufficient to reconstruct its basis.

### 9. Fail safely and isolate failure

Validate preconditions before writes. Prefer staged computation and atomic replacement patterns where Apps Script and Sheets allow. Distinguish blocking control failures from non-blocking observations. Partial orchestration results must be explicit and must not masquerade as full success.

### 10. Secure the control plane

Use least-privilege Google scopes and Drive access. Store environment identifiers and credentials outside source. Review authorization-scope changes explicitly. Logs and test fixtures must minimize sensitive data. Production and Lab resources must be distinguishable and protected against accidental cross-environment writes.

### 11. Operate in the governed timezone

Dashboard, Ledger, and Apps Script use `America/Toronto`, including approved equivalent Eastern-time identifiers described by the timezone validation decision. Store unambiguous timestamps and document any UTC conversion at interfaces.

### 12. Build for recovery

Material writes require backups or an equivalent recovery mechanism, a defined rollback boundary, and validation after restoration. Historical GitHub releases and certification evidence remain immutable audit records even after a rollback.

## Architecture ownership

Domain ownership is defined in [Architecture Ownership Policy](../architecture/ARCHITECTURE-OWNERSHIP-POLICY.md). The Engineering Lead facilitates architecture review; the relevant Domain Owner approves contracts; the CIO / Investment Policy Owner approves any change to investment or risk policy; the Release Manager confirms promotion readiness.

## When an ADR is required

Create or amend an ADR before implementation when a change:

- changes a source of truth, workbook boundary, or domain owner;
- introduces a cross-workbook or external-system dependency;
- changes an investment rule, risk model, scoring meaning, or execution authority;
- breaks or repurposes a public function, worksheet schema, identifier, or output contract;
- adds a production authorization scope, credential class, trigger model, or deployment path;
- changes orchestration ordering or failure semantics materially;
- adopts a new platform, data store, runtime, or architectural pattern;
- accepts a material, enduring exception to these principles.

An ADR is not required for a compatible implementation detail that stays inside an accepted design, but the pull request must state why it is not architecture-significant.

## ADR minimum content

Include title and identifier, status, context, decision, alternatives considered, consequences, affected authorities/contracts, security and data implications, migration, validation, rollback, owners, and superseded decisions. Accepted ADRs are immutable; later changes use a superseding ADR.

## Architecture Review checklist

- [ ] Problem, scope, non-goals, and accountable owners are explicit.
- [ ] Existing ADRs, baselines, ownership policy, schemas, and consumers were reviewed.
- [ ] GitHub, Apps Script, Sheets, Drive, Dashboard, Ledger, and external-source boundaries remain clear.
- [ ] Inputs, outputs, identifiers, schema, units, timezone, freshness, and null/error behavior are defined.
- [ ] Investment-policy and automated-execution boundaries are unchanged or separately approved.
- [ ] Data quality, reconciliation, explainability, and readiness effects are addressed.
- [ ] Compatibility, migration, legacy handling, and deprecation are addressed.
- [ ] Idempotency, duplicate suppression, concurrency, quotas, and retry behavior are addressed.
- [ ] Security, privacy, authorization scopes, credentials, and sensitive logging are addressed.
- [ ] Observability, lineage, support ownership, and operational failure modes are defined.
- [ ] Test strategy covers static, unit, Apps Script, workbook, integration, and regression needs proportionately.
- [ ] Backup, rollback, recovery validation, and blast radius are credible.
- [ ] Alternatives and consequences are documented; required ADR is accepted before implementation.
- [ ] Promotion and post-deployment certification evidence are defined.

## Existing architecture record

This policy intentionally retains and points to the existing record:

- [ADR-001 — Production Architecture and Workbook Boundaries](../architecture/ADR-001-PRODUCTION-ARCHITECTURE.md)
- [ADR-002 — Cross-Workbook Governance and Recommendation Event Contract](../architecture/ADR-002-CROSS-WORKBOOK-GOVERNANCE.md)
- [ADR-003 — Position and Portfolio Risk Scoring](../risk/ADR-003-POSITION-PORTFOLIO-RISK-SCORING.md)
- [Production Baseline](../architecture/PRODUCTION-BASELINE.md)
- [Production Dependency Baseline](../architecture/PRODUCTION-DEPENDENCY-BASELINE.md)
