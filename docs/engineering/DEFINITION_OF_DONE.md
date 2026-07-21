# Definition of Done

- **Owner:** Engineering Lead
- **Status:** Governing completion gate
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

A wave is complete only when every applicable criterion below has traceable evidence. A criterion may be marked not applicable only with a recorded rationale and approval by the accountable role.

## Required checklist

- [ ] **Implementation complete.** Approved scope and acceptance criteria are satisfied with no unexplained unrelated change.
- [ ] **Tests pass.** Required repository, unit, integration, runtime, workbook, scenario, and recovery checks pass as applicable.
- [ ] **Lint passes.** Required lint checks pass against the exact candidate.
- [ ] **Documentation updated.** Architecture, contracts, schemas, runbooks, release notes, and operational guidance reflect the change.
- [ ] **ADR updated.** Required ADRs are accepted and implemented consistently, or non-applicability is recorded.
- [ ] **Architecture Review complete.** The final implementation conforms to accepted architecture and all blocking findings are resolved.
- [ ] **Release Validation complete.** The exact candidate commit passes all applicable [release gates](RELEASE_GOVERNANCE.md).
- [ ] **PR merged.** Independent approval and protected-branch controls are satisfied, and the pull request is merged to its governed target.
- [ ] **Roadmap updated.** Delivered, deferred, and future scope is accurately reflected in the [Roadmap](ROADMAP.md).
- [ ] **Release tagged.** The authorized Release Manager creates the immutable tag and release record on the correct approved commit.

## Evidence quality

Evidence records the wave/release, commit, environment, baseline, time, operator, command or function, expected result, actual result, and artifact location. A passing local command is not CI, Apps Script execution, workbook review, release approval, or production certification. Historical evidence is never rewritten.

## Documentation-only waves

Documentation-only waves must still pass scope inspection, Markdown-link validation, repository validation, independent review, merge, roadmap reconciliation, and the approved release/tag process. Apps Script and workbook checks may be not applicable only when the diff proves no runtime, manifest, schema, spreadsheet, or deployment behavior changed.

## Closure authority

The Implementation Engineer prepares evidence. The Chief Architect / Engineering Lead confirms architecture and quality. The Release Validator confirms release evidence. The Release Manager closes the release. No author or AI assistant may self-approve, self-certify, merge, or tag without the required human authority.

See [Engineering Governance](ENGINEERING_GOVERNANCE.md), the [SDLC](SDLC.md), [Quality Standards](QUALITY_STANDARDS.md), and [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).
