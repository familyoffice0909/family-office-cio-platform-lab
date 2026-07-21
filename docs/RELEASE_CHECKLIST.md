# Release Checklist

This is the canonical operational checklist for the release lifecycle defined by [Release Governance](engineering/RELEASE_GOVERNANCE.md) and the [Release Policy](engineering/RELEASE_POLICY.md). Copy it into the release issue or evidence record, identify the operator and approvers, and mark non-applicable controls with a reason. Do not edit a completed historical checklist to represent a later release.

## Release identity

- [ ] Wave, semantic version, scope, owner, and target date are recorded
- [ ] Candidate commit on `origin/develop` is recorded
- [ ] Expected Lab `main` and production `main` commit lineage is defined
- [ ] Lab and production Apps Script projects, workbooks, and Drive destinations are unambiguously identified without exposing secrets
- [ ] Required Domain Owner, Engineering Lead, CIO / Investment Policy Owner, Release Manager, and Production Operator approvals are identified

## Before pull request approval

- [ ] Scope matches the engineering wave
- [ ] [Definition of Done](engineering/DEFINITION_OF_DONE.md) and Pull Request checklist are complete
- [ ] Required ADR and Architecture Review checklist are approved
- [ ] `npm ci` succeeds
- [ ] `npm run validate` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes for behavior changes
- [ ] Smoke-test inventory is generated when public smoke entry points change
- [ ] No secrets or local credentials are committed
- [ ] Relevant Apps Script smoke test completes
- [ ] Expected Google Sheets outputs are validated
- [ ] Existing data is not unintentionally overwritten
- [ ] Apps Script manifest, scopes, Script Properties, triggers, quotas, and scheduling effects are reviewed
- [ ] Schema compatibility, migration, backup, data impact, and Drive permissions are reviewed
- [ ] Changelog is updated
- [ ] Rollback approach is documented
- [ ] Known limitations, accepted warnings, monitoring, and support owner are documented

## Lab certification

- [ ] CI status checks pass
- [ ] Pull request review is complete
- [ ] Integrated candidate is deployed only to the designated Lab Apps Script project
- [ ] Platform health and integrity checks pass in Lab
- [ ] Modular and relevant engine/orchestrator smoke tests pass in Lab
- [ ] Affected Lab worksheet schemas, values, formatting, lineage, and validation outputs are inspected
- [ ] Controlled stable/improvement/deterioration/restoration scenarios pass where applicable
- [ ] Duplicate suppression, retry/idempotency, and failure behavior pass where applicable
- [ ] Lab inputs and outputs are restored to the intended stable state
- [ ] Evidence records commit, version, baseline, environment, timestamp, operator, expected outcome, and actual outcome
- [ ] Blocking controls are zero; warnings have explicit acceptance, owner, and disposition
- [ ] Certification decision and accountable human approvals are recorded

## Lab main and production repository promotion

- [ ] Release branch contains only approved scope and release metadata/fixes
- [ ] Release pull request from `develop` to `origin/main` is approved and checks pass
- [ ] Resulting Lab-certified `origin/main` commit is recorded and reviewed
- [ ] Version metadata and release notes identify the approved commit
- [ ] Exact approved commit is promoted through a reviewable, non-force process to `production/main`
- [ ] Production repository has no unexplained production-only code divergence
- [ ] Lab and production commit hashes, approvers, timestamp, and promotion mechanism are recorded
- [ ] Semantic version tag is unique, immutable, and points to the intended production commit

## Before production Apps Script deployment

- [ ] Production Operator verifies repository, branch, clean worktree, commit, Google account, Script ID, and target workbooks
- [ ] Production credentials, Script Properties, workbook IDs, and Drive permissions are separate from Lab
- [ ] Required operational backups or exports are complete and recoverable
- [ ] Migration order, maintenance window, communication, and rollback trigger are confirmed
- [ ] Apps Script authorization or scope changes have explicit approval
- [ ] No deployment is sourced from `develop`, a feature branch, or an uncommitted worktree

## Production deployment and validation

- [ ] Controlled Apps Script deployment completes
- [ ] Platform health check passes
- [ ] Platform integrity check passes
- [ ] Modular smoke test passes
- [ ] Version and build identifiers are confirmed
- [ ] Executive outputs render correctly
- [ ] Production commit, platform version, baseline, run IDs, and output lineage reconcile
- [ ] Triggers, schedules, execution logs, quotas, and Drive outputs are correct
- [ ] No unintended worksheet writes, duplicate events, schema drift, or permission changes occurred
- [ ] Deployment result is recorded
- [ ] Observation window and support owner are active

## Release creation

- [ ] Semantic version selected
- [ ] Git tag points to the intended `production/main` commit
- [ ] Release notes summarize features, fixes, tests, limitations, and rollback
- [ ] `CHANGELOG.md` is updated
- [ ] Release is marked latest only when production validation is complete
- [ ] Release and certification evidence locations are linked
- [ ] Short-lived branches are deleted after retention requirements are satisfied

## Rollback, if triggered

- [ ] Promotion/deployment is stopped and accountable owners are notified
- [ ] Logs, failed outputs, evidence, and the affected commit are preserved
- [ ] Reviewed revert or approved forward fix is applied without rewriting shared history or moving tags
- [ ] Affected Sheets/Drive state is restored from the controlled backup where necessary
- [ ] Known-good production commit is redeployed and all post-deploy checks are rerun
- [ ] Rollback result, impact, root cause, follow-up owner, and patch release are recorded
