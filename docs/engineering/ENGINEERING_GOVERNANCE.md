# Engineering Governance

- **Owner:** Engineering Lead
- **Accountable executive:** CIO / Investment Policy Owner
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

This policy establishes the institutional engineering system for the Family Office CIO Platform. It governs every wave from idea through production readiness while preserving the authority of accepted architecture decisions, investment policy, repository protections, and release controls.

R1.3.0.4 is a governance-only release. It changes no Apps Script runtime behavior, spreadsheet behavior, production logic, investment logic, deployment, or architecture enforcement.

## Platform vision

The platform provides reliable, explainable, and auditable decision support for the family office CIO. It combines governed portfolio state, investment intelligence, risk analysis, executive reporting, and controlled automation without transferring fiduciary judgment or trade authority from accountable people to software.

## Engineering principles

1. Protect capital and decision integrity before optimizing delivery speed.
2. Preserve one authoritative source for each concern and make ownership explicit.
3. Prefer evidence over assertion; decisions, changes, tests, and releases must be traceable.
4. Make governed additive changes by default and migrate breaking contracts deliberately.
5. Keep outputs deterministic, explainable, observable, and safe under incomplete data.
6. Apply least privilege, minimum necessary data, and explicit human accountability.
7. Design material changes for rollback, recovery, and operational ownership.
8. Treat documentation, tests, and release evidence as part of the product.

The detailed principles and platform responsibility model remain in the [Engineering Guide](ENGINEERING_GUIDE.md).

## Architectural principles

All changes must follow the [Architecture Principles](ARCHITECTURE_PRINCIPLES.md), the [Repository Architecture](../ARCHITECTURE.md), and accepted ADRs. In particular:

- GitHub owns source, documentation, and release history.
- The Family Office Portfolio Dashboard owns current operational CIO state.
- The Family Office Investment Ledger owns governed learning and event history.
- Engines own calculations; spreadsheet services own worksheet access; reporting consumes governed outputs.
- Public contracts, schemas, timezones, provenance, data quality, and failure behavior are explicit.
- Automation remains advisory unless separate, explicit authority is approved.

Architecture-significant changes require an ADR under the [ADR process](../adr/README.md) before implementation.

## Governance model

Governance is a human-controlled system of accountable roles, independent review, recorded evidence, and protected transitions.

| Decision | Accountable role | Required evidence |
|---|---|---|
| Investment policy and risk appetite | CIO / Investment Policy Owner | Approved policy or decision record |
| Architecture and exceptions | Chief Architect / Engineering Lead | Architecture review and ADR when triggered |
| Implementation accuracy | Implementation Engineer / Change Author | Diff, tests, documentation, and traceable evidence |
| Release validation | Release Validator | Gate record tied to the exact commit |
| Merge | Authorized repository approver | Approved pull request and required checks |
| Release and production promotion | Release Manager and Production Operator | Release record, target verification, rollback, and validation |

One person may hold multiple roles in a small team, but material changes require independent review. AI may assist but cannot approve its own work, accept investment risk, certify a release, merge, tag, or authorize production promotion.

## Quality gates

Every wave passes, as applicable:

1. [Definition of Ready](DEFINITION_OF_READY.md)
2. Architecture and ADR approval
3. Implementation and documentation completion
4. Repository validation, lint, tests, and CI
5. Architecture review
6. Release validation
7. Independent merge approval
8. Release tag and roadmap update

The exact release controls and evidence owners are defined in [Release Governance](RELEASE_GOVERNANCE.md). A non-applicable gate must be recorded with its rationale; it is not silently skipped.

## Engineering lifecycle

The official lifecycle is defined in the [SDLC](SDLC.md): idea, architecture, ADR, planning, implementation, testing, architecture review, release validation, merge, release tag, roadmap update, and production readiness. The [Definition of Done](DEFINITION_OF_DONE.md) closes the wave only after all applicable lifecycle outcomes are evidenced.

## Architecture review process

1. Classify the proposed change and identify affected authorities, contracts, and consumers.
2. Review existing ADRs, baselines, schemas, ownership policies, and alternatives.
3. Complete the [Architecture Review checklist](ARCHITECTURE_PRINCIPLES.md#architecture-review-checklist).
4. Draft and obtain human acceptance of an ADR when an ADR trigger applies.
5. Re-review the implemented diff for conformance before release validation.

The author may prepare evidence but cannot be the sole architecture approver.

## Release validation

Release validation proves that the exact candidate commit satisfies its approved scope and controls. It includes repository evidence for every release and proportionate Apps Script, workbook, integration, security, recovery, and operational evidence for runtime-affecting releases. R1.3.0.4 requires documentation scope inspection, Markdown-link validation, repository validation, and confirmation that no runtime files changed.

Validation is not approval, tagging, deployment, or production certification. Those remain separate human-controlled events under [Release Governance](RELEASE_GOVERNANCE.md), the [Release Policy](RELEASE_POLICY.md), and the [Release Checklist](../RELEASE_CHECKLIST.md).

## Repository ownership

GitHub is the authoritative repository. The Engineering Lead owns repository governance and protections; Domain Owners own domain contracts; Change Authors own submitted changes and evidence; authorized reviewers own approval decisions. Folder, module, configuration, logging, error-handling, and dependency rules are in [Repository Standards](REPOSITORY_STANDARDS.md).

## Documentation standards

- Give every artifact a clear purpose, owner, status, and canonical subject.
- Link to canonical policy instead of copying it.
- Store enduring decisions in ADRs, current design in architecture documents, procedures in checklists, plans in the roadmap, and observed results in validation records.
- Use repository-relative Markdown links and established platform terminology.
- Update documentation in the same pull request as the contract or behavior it describes.
- Preserve historical evidence; correct it with a traceable superseding record.
- Exclude credentials, account identifiers, production financial data, and uncontrolled personal information.

## Technical debt policy

Technical debt must be explicit, risk-ranked, owned, and time-bounded. A debt record states the affected contract or control, reason, consequence, compensating control, owner, target wave, and review date. Debt that threatens capital integrity, security, data correctness, release traceability, or recovery is blocking and cannot be deferred without approval from the accountable role. Routine debt is prioritized in the [Roadmap](ROADMAP.md) and reviewed during planning and retrospectives.

Policy exceptions use the same discipline and include an expiry. An exception does not silently redefine architecture or investment policy.

## Continuous improvement

The Engineering Lead reviews this framework after material incidents, architecture or repository-topology changes, material control failures, and at least annually. Retrospectives produce owned improvements to standards, automation, tests, documentation, or training. Quality trends and recurring exceptions inform roadmap priorities. Governance changes use a reviewed pull request and identify what is replaced, extended, or retained.

## Governance map

| Concern | Canonical document |
|---|---|
| Lifecycle | [SDLC](SDLC.md) |
| Entry gate | [Definition of Ready](DEFINITION_OF_READY.md) |
| Completion gate | [Definition of Done](DEFINITION_OF_DONE.md) |
| Branches and merges | [Branching Strategy](BRANCHING_STRATEGY.md) |
| Release gates | [Release Governance](RELEASE_GOVERNANCE.md) |
| Quality | [Quality Standards](QUALITY_STANDARDS.md) |
| Repository conventions | [Repository Standards](REPOSITORY_STANDARDS.md) |
| Accountability | [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md) |
| Durable decisions | [ADR Guide](../adr/README.md) |
| Delivery portfolio | [Roadmap](ROADMAP.md) |
