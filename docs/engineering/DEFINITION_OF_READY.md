# Definition of Ready

- **Owner:** Engineering Lead
- **Status:** Governing entry gate
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

A wave may not enter implementation until every applicable item below is evidenced. Readiness is a planning decision, not release approval.

## Required checklist

- [ ] **Scope approved.** The objective, deliverables, owner, target branch, affected systems, and wave identifier are explicit.
- [ ] **Architecture approved.** Authoritative sources, boundaries, contracts, consumers, security, operations, and architecture-review needs are assessed; required ADRs are accepted.
- [ ] **Dependencies identified.** Upstream data, modules, workbooks, services, permissions, environments, teams, and predecessor waves are listed with owners.
- [ ] **Acceptance criteria documented.** Outcomes are observable and include proportionate validation and evidence expectations.
- [ ] **Risks documented.** Capital integrity, data quality, security, privacy, compatibility, operational, performance, migration, and rollback risks are assessed as applicable.
- [ ] **Out-of-scope documented.** Prohibited changes and deferred concerns are explicit so they cannot enter through incidental refactoring.

## Supporting readiness fields

The wave record must also identify:

- change classification: documentation-only, standard, material, or emergency;
- accountable CIO/Domain Owner, Chief Architect / Engineering Lead, Implementation Engineer, and Release Validator;
- test environments and confirmation that production identifiers or data are not required for development;
- compatibility, migration, backup, rollback, monitoring, and support expectations;
- known assumptions, unresolved non-blocking questions, and time-bounded exceptions;
- roadmap alignment and any technical debt created or retired.

## Approval and loss of readiness

The Domain Owner approves scope and acceptance criteria. The Chief Architect / Engineering Lead approves the architecture assessment. The CIO / Investment Policy Owner approves any investment-policy effect. Approval must be human and traceable.

A material change to scope, architecture, dependencies, acceptance criteria, risk, or non-goals invalidates readiness until the affected items are reassessed. See the [SDLC](SDLC.md), [Architecture Principles](ARCHITECTURE_PRINCIPLES.md), [ADR Guide](../adr/README.md), and [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).
