# Release Governance

- **Owner:** Release Manager
- **Technical owner:** Engineering Lead
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

This policy defines the institutional gates between an approved wave and a closed release. Detailed Lab-to-Production procedures remain in the [Release Policy](RELEASE_POLICY.md) and [Release Checklist](../RELEASE_CHECKLIST.md).

## Release gates

| Gate | Required evidence | Accountable decision | Blocking condition |
|---|---|---|---|
| Architecture Approved | Architecture assessment, accepted ADR or recorded non-applicability | Chief Architect / Engineering Lead | Unapproved material decision or unresolved architecture finding |
| Implementation Complete | Acceptance-criteria mapping and final scoped diff | Implementation Engineer | Missing scope, unexplained change, or incomplete contract/documentation |
| CI Passed | Required status checks on the exact candidate commit | Engineering Lead | Failed, missing, stale, or bypassed required check |
| Tests Passed | Proportionate test record under [Quality Standards](QUALITY_STANDARDS.md) | Implementation Engineer and Domain Owner | Failed control, inadequate coverage, or unverifiable evidence |
| Architecture Review | Completed final architecture checklist | Chief Architect / Engineering Lead | Implementation diverges from approved design or accepted ADR |
| Release Validation | Candidate validation report with actual outcomes and limitations | Release Validator | Failed acceptance criterion, target ambiguity, or inconsistent evidence |
| Merge Approval | Independent review, resolved comments, and protected-branch requirements | Authorized repository approver | Missing approval, unresolved blocking comment, or incorrect base/head |
| Release Tag | Approved version, exact commit, release notes, and immutable tag plan | Release Manager | Incorrect commit/version, incomplete release record, or absent authority |
| Roadmap Update | Delivered/deferred scope and debt reconciled | Engineering Lead | Roadmap misstates completion or omits owned follow-up |

Gates are sequential controls even when evidence is gathered in parallel. A skipped gate requires an explicit, approved not-applicable rationale. A waiver includes owner, risk, compensating control, expiry, and review date; it cannot waive legal, fiduciary, security, investment-authority, or production-target controls.

## Release validation standard

The Release Validator verifies:

- candidate identity, branch, base, version, scope, and repository destination;
- acceptance criteria, architecture decisions, review status, CI, tests, documentation, and known limitations;
- absence of secrets, uncontrolled production data, and unintended source-of-truth or investment-policy changes;
- migrations, backups, rollback, observability, support, and recovery when applicable;
- release notes and roadmap status against the actual diff.

For documentation-only releases, validate Markdown rendering/links, changed-file scope, repository checks, and the absence of runtime, manifest, schema, spreadsheet, and deployment changes. Do not claim live Apps Script or workbook validation when it was not run and was not required.

## Merge, tag, and roadmap controls

The target follows the [Branching Strategy](BRANCHING_STRATEGY.md). Merge approval does not authorize tagging or deployment. The Release Manager creates a semantic version tag only on the approved release baseline after required approvals. Tags are immutable and are never moved or reused. The roadmap is updated with observed status: a draft pull request is not a completed wave, and a merged change is not a production-ready release until the remaining gates pass.

## Failure, rollback, and emergency handling

Any blocking failure stops promotion. Preserve evidence, identify the owner, and use a reviewed revert or forward fix; do not rewrite shared history or relabel a failure. Emergency status may compress elapsed time but does not remove traceability, independent review, target verification, rollback, or post-deploy validation.

## Release record

The release record includes wave, version, scope, owners, approved commit, pull request, CI and test evidence, architecture review, validation decision, tag, roadmap update, known limitations, rollback, and operational handoff. Completion is assessed with the [Definition of Done](DEFINITION_OF_DONE.md) and responsibilities in [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).
