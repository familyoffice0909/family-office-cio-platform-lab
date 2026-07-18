# Release Policy

## Purpose

This policy governs versioning, Lab certification, promotion to the production repository, Apps Script deployment, and post-deployment verification. The canonical step-by-step control record is the [Release Checklist](../RELEASE_CHECKLIST.md).

Institutional gate names, accountable decisions, and blocking conditions are defined in [Release Governance](RELEASE_GOVERNANCE.md).

## Release authorities

- `origin/develop` is the integrated Engineering Lab baseline.
- `origin/main` is the Lab-certified release baseline.
- `production/main` is the production source baseline.
- The production Apps Script project is deployed only from an approved `production/main` commit.
- Production Google Sheets and Drive outputs are operational state and evidence, not substitutes for the source or release record.

A merge, tag, GitHub release, `clasp push`, workbook validation, or certification is one control event; no single event substitutes for the entire release lifecycle.

## Versioning

Use Semantic Versioning:

- **Patch (`X.Y.Z+1`):** backward-compatible defect, security, data-quality, or operational correction that does not change approved meaning.
- **Minor (`X.Y+1.0`):** backward-compatible capability, engine, output, or governed extension.
- **Major (`X+1.0.0`):** breaking contract, architecture, source-of-truth, or operating-model change.

Pre-release identifiers may be used for Lab candidates but never imply production approval. A tag is immutable, points to the intended certified commit, and matches platform/package/version metadata. Certification tags and release tags have distinct purposes and must be named clearly.

## Release lifecycle and gates

### 1. Candidate nomination

The intended `develop` commit is frozen for the wave. Scope, acceptance criteria, ADRs, change log, migration, known limitations, operator plan, and rollback are complete. All required CI and review checks pass.

### 2. Lab deployment and integrated validation

Deploy the exact candidate to the designated Lab Apps Script project. Validate health, integrity, modular smoke, relevant engines, schemas, outputs, logs, permissions, triggers, and controlled scenarios. Capture version, baseline, commit, environment, timestamps, and operator. Restore the Lab to its intended stable state.

### 3. Certification decision

The Domain Owner confirms functional acceptance, the Engineering Lead confirms technical gates, and the CIO / Investment Policy Owner confirms any investment-policy effects. The Release Manager records approval or rejection. Warnings and limitations are explicit; unresolved blocking controls stop promotion.

### 4. Lab release baseline

Merge the release pull request to `origin/main`. Confirm the resulting approved commit and ensure all version metadata and release notes refer to it. Do not deploy an unreviewed merge delta.

### 5. Production repository promotion

Promote the exact approved Lab release commit to `production/main` using a reviewable, non-force workflow. Confirm no production-only code divergence. Record Lab commit, production commit, approvers, time, and promotion mechanism.

### 6. Tag and release record

Create the immutable semantic version tag on the production baseline and publish release notes covering scope, changes, migrations, evidence, known limitations, and rollback. Mark a release as latest only after production validation is complete.

### 7. Controlled Apps Script deployment

The Production Operator verifies the repository, branch, commit, Apps Script project, Google account, manifest/scopes, and target workbooks before deployment. Back up affected operational state where required. Deploy through the approved clasp or release mechanism; never deploy production from `develop` or an unmerged feature branch.

### 8. Post-deployment validation and closure

Run platform health, integrity, modular smoke, applicable engine/orchestrator checks, schema validation, and executive-output review. Confirm version/baseline/commit lineage, triggers, logs, and absence of unintended writes. Record outcome and close only when the release is operationally accepted.

## Required release evidence

- Release version, wave, scope, owner, and approved commit hashes in both repositories.
- Pull request, CI, review, ADR, architecture review, and certification references.
- Lab and production Apps Script project/environment identity without exposing secrets.
- Test commands/functions, timestamps, actual results, workbook outputs, and validation records.
- Manifest/scopes, trigger/scheduling, schema/migration, Drive permission, and data-impact assessment.
- Backup/rollback instructions, rollback trigger, recovery owner, and post-rollback checks.
- Known limitations, accepted warnings, operational owner, and follow-up work.

## Promotion rules

- Promotion is by immutable commit identity, not by copying selected local files or deploying an uncommitted worktree.
- Lab and production credentials, Script Properties, workbook IDs, and Drive permissions remain separate.
- Production data is never copied back into Lab without an approved, minimized, and protected data-handling process.
- Schema changes are backward-compatible or have an approved migration and rollback.
- A release with failed controls, inconsistent evidence, an unknown target, or unapproved scope does not proceed.
- Release approval must include a human independent of AI-generated implementation and evidence summaries.

## Rollback and forward recovery

Define rollback before deployment. Prefer a reviewed Git revert or a pre-approved forward fix; never rewrite shared history or move a release tag. Restore affected Sheets from controlled backups when code rollback alone is insufficient. Re-deploy from a known-good production commit, rerun post-deploy checks, and preserve the failed release record. A rollback creates a new patch release when production source or deployment changes.

## Emergency releases

Emergency status may shorten elapsed time but not eliminate commit traceability, independent review, target verification, rollback, or post-deploy validation. Any temporarily deferred non-blocking evidence receives an owner and deadline. Conduct a retrospective for material incidents and update controls or ADRs where necessary.

## Release frequency and support

Release when a coherent wave is certified; do not batch unrelated risk solely for calendar convenience. Each production release has a named support owner and observation window proportionate to risk. During the window, monitor execution failures, data readiness, reconciliation, duplicate events, trigger health, and executive outputs.
