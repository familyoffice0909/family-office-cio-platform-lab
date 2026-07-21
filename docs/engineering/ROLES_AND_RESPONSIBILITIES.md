# Roles and Responsibilities

- **Owner:** Engineering Lead
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

This policy assigns accountability across the [SDLC](SDLC.md). Named humans retain decision authority; tooling and AI may prepare work and evidence but cannot assume fiduciary, approval, certification, merge, tag, or production authority.

## CIO

The CIO is the Investment Policy Owner and accountable executive for platform outcomes.

**Accountable for:** investment objectives, risk appetite, decision-support boundaries, policy meaning, capital-allocation authority, acceptance of material investment effects, and prioritization of business outcomes.

**Must:** approve any change to investment or risk policy; challenge whether outputs remain explainable and advisory; identify the Domain Owner or sponsor; accept or reject material residual investment risk.

**Must not:** delegate fiduciary judgment or trade authority solely to an engineer, automation, or AI; use technical approval as a substitute for investment-policy approval.

## Chief Architect

The Chief Architect function is held by the Engineering Lead unless separately assigned.

**Accountable for:** architecture principles, source-of-truth boundaries, platform contracts, ADR governance, architecture review, technical exceptions, and long-term coherence.

**Must:** assess materiality; review affected owners and consumers; require an ADR when triggered; evaluate security, compatibility, operations, and recovery; record acceptance, rejection, or required changes.

**Must not:** approve undocumented architecture drift, silently redefine domain policy, or treat a passing test suite as architecture acceptance.

## Implementation Engineer

The Implementation Engineer is the Change Author for the wave.

**Accountable for:** bounded implementation, accurate documentation, appropriate tests, evidence, security hygiene, compatibility, and rollback within approved scope.

**Must:** satisfy the [Definition of Ready](DEFINITION_OF_READY.md); follow [Repository Standards](REPOSITORY_STANDARDS.md) and [Quality Standards](QUALITY_STANDARDS.md); preserve unrelated changes; report actual checks and limitations; resolve review findings.

**Must not:** invent policy, broaden scope without reapproval, expose sensitive data, self-approve, fabricate evidence, deploy, merge, tag, or change production without authority.

## Release Validator

The Release Validator independently evaluates the exact candidate against acceptance criteria and [Release Governance](RELEASE_GOVERNANCE.md).

**Accountable for:** evidence completeness, candidate identity, gate outcomes, limitations, and a clear pass, pass-with-warnings, or fail recommendation.

**Must:** distinguish static checks, CI, Apps Script execution, workbook inspection, and production certification; verify target and commit; stop on inconsistent or failed blocking controls; preserve the validation record.

**Must not:** repair evidence to create a pass, validate a different commit than the candidate, or convert validation into merge, tag, deployment, or certification authority.

## Future contributors

Future contributors include engineers, analysts, operators, reviewers, vendors, and AI collaborators.

**Accountable for:** learning and following current governance, protecting confidential information, respecting ownership boundaries, keeping changes traceable, and escalating ambiguity or conflicts.

**Must:** read the [Engineering Governance](ENGINEERING_GOVERNANCE.md), relevant accepted ADRs, and task-specific policy; use the official lifecycle and branch model; identify assumptions; leave documentation and evidence better aligned with reality.

**Must not:** bypass protections, write directly to engine-owned outputs, treat Google Sheets as source-code authority, alter investment intent, or rely on oral history when a governed record is required.

## Responsibility matrix

| Activity | CIO | Chief Architect | Implementation Engineer | Release Validator | Authorized reviewer / Release Manager |
|---|---|---|---|---|---|
| Approve scope and business outcome | A | C | R | I | I |
| Accept architecture / ADR | C/A for investment policy | A/R | C | I | I |
| Implement and document | I | C | A/R | I | I |
| Execute development tests | I | C | A/R | C | I |
| Complete architecture review | C | A/R | C | I | I |
| Validate release candidate | I | C | C | A/R | I |
| Approve and merge PR | I | C | I | C | A/R |
| Tag and close release | I | C | I | C | A/R |
| Authorize production deployment | C/A for policy effect | C | I | C | A/R |

`A` = accountable, `R` = responsible, `C` = consulted, `I` = informed. One person may hold multiple roles, but material changes require independent review and the author cannot be the sole approver or certifier.

## Escalation

Stop and escalate when investment intent is ambiguous, an ADR or policy conflicts with the request, credentials or production data are required, the target environment is uncertain, a blocking control fails, or the action lacks authority. Record the blocker, safe progress, affected risk, and the human decision required.
