# Development Workflow

## Purpose

This workflow governs a change from intake through Lab validation and handoff to release. It applies to production code, Apps Script configuration, schemas, tests, automation, and documentation. Branch movement and production promotion are defined separately in [Branching Strategy](BRANCHING_STRATEGY.md) and [Release Policy](RELEASE_POLICY.md).

The official stage model is the [SDLC](SDLC.md). The standalone [Definition of Ready](DEFINITION_OF_READY.md) and [Definition of Done](DEFINITION_OF_DONE.md) are the governing entry and wave-closure gates; the checklist below supplies additional development detail.

## Change lifecycle

### 1. Frame the wave

Define the objective, owner, scope, non-goals, acceptance criteria, affected authorities, operational impact, and rollback. Classify the change:

- **Documentation-only:** no runtime, manifest, workflow, schema, or investment-logic change.
- **Standard:** backward-compatible implementation within accepted architecture.
- **Material:** architecture, schema, cross-workbook, authorization, scheduling, orchestration, security, or investment/risk policy impact.
- **Emergency:** urgent correction to a production incident or material control failure.

Material changes require the Architecture Review checklist and, when triggered, an accepted ADR. Emergency changes use the hotfix path but are not exempt from review, evidence, or retrospective documentation.

### 2. Inspect and design

Read the current implementation, tests, documentation, ADRs, schemas, ownership records, and recent relevant history. Confirm the authoritative source and all known consumers. Extend an existing artifact rather than creating a duplicate. For a multi-file or material change, record a short implementation plan before editing.

### 3. Isolate the work

Update the appropriate Lab base branch and create one branch for one coherent wave. Do not mix opportunistic refactoring or unrelated cleanup into the change. Preserve unrelated worktree changes.

### 4. Implement in controlled increments

Keep engines separate from spreadsheet I/O, preserve public `fo` entry points and internal trailing-underscore conventions, use platform logging helpers, and retain idempotency. Make contract, test, and documentation updates together. Do not use production data as a development fixture.

### 5. Verify proportionately

Run the checks required by the testing model below. Failures are fixed or explicitly dispositioned by the accountable reviewer; they are not hidden, weakened, or relabeled. Capture commands, environment, observed result, and evidence location.

### 6. Open and review the pull request

Complete the Pull Request checklist. The reviewer challenges correctness, scope, architecture, data safety, operational behavior, tests, documentation, and rollback. Material changes require the named domain and architecture approvals. Investment-policy changes require the CIO / Investment Policy Owner.

### 7. Validate in the Lab

After integration, deploy only to the designated Lab Apps Script project and Lab workbooks using controlled credentials. Run the relevant runtime smoke tests, inspect execution logs and governed worksheet outputs, verify no unintended writes, and retain wave evidence. A Lab test must never target production identifiers.

### 8. Close or nominate for release

The Change Author resolves review findings and completes the Definition of Done. A release candidate is nominated only after Lab evidence is complete. The Release Manager then follows the [Release Policy](RELEASE_POLICY.md); development completion is not permission to deploy.

## Testing expectations

Testing is risk-based but never evidence-free.

| Layer | Purpose | Minimum expectation |
|---|---|---|
| Repository validation | Detect manifest, module, menu, version, duplicate-global, and secret problems | `npm run validate` for every change unless demonstrably unavailable |
| Lint | Enforce JavaScript quality and prevent common defects | `npm run lint` for source/config changes; recommended for all repository changes |
| Unit/regression | Verify deterministic behavior without a live workbook | `npm test` for behavior changes and every affected test suite |
| Smoke inventory | Confirm expected Apps Script smoke-test entry points exist | `npm run smoke:inventory` when modules or public test entry points change |
| Apps Script smoke | Prove relevant modules execute in the V8 runtime | Relevant `fo...SmokeTest` functions for runtime changes |
| Platform controls | Prove foundation and integrated health | health, integrity, modular smoke, and orchestrator smoke as release scope requires |
| Workbook validation | Prove schemas, values, formatting, ownership, and non-destructive writes | Inspect affected Lab sheets and validation outputs |
| Scenario/certification | Prove acceptance criteria, restoration, and duplicate suppression | Required for material waves and production candidates |

The existing [Smoke-Test Reporting](../SMOKE_TEST.md) document defines minimum release smoke functions and evidence fields. Source inventory does not replace Apps Script execution; Apps Script execution does not replace review of workbook outputs.

### Documentation-only changes

At minimum, inspect the diff, validate Markdown links, confirm only documentation changed, and run repository validation. Run lint/tests when the documentation changes executable examples, command contracts, generated artifacts, or developer behavior whose correctness depends on them.

### Test evidence

Evidence states the commit, wave/release, environment, baseline, timestamp, tester/operator, command or function, expected outcome, actual outcome, and artifact location. Use `PASS`, `PASS WITH WARNINGS`, or `FAIL` consistently. Never edit an old evidence record to represent a new run.

## Development completion checklist

A change is done only when all applicable items are true:

- [ ] Objective, scope, non-goals, acceptance criteria, and owner are recorded.
- [ ] Change is confined to one coherent wave and contains no unexplained unrelated edits.
- [ ] Architecture review and ADR requirements are satisfied.
- [ ] Implementation follows authoritative boundaries and established naming/contracts.
- [ ] Security, privacy, credentials, scopes, and sensitive-data handling were reviewed.
- [ ] Required repository checks, tests, Apps Script smoke tests, and workbook validations pass.
- [ ] Negative, stale/missing-data, retry, duplicate, and failure behavior were tested where relevant.
- [ ] Test evidence is traceable to the exact commit, environment, version, and baseline.
- [ ] Documentation, schemas, runbooks, roadmap/changelog, and examples are updated where applicable.
- [ ] Operational ownership, monitoring/logging, backup, rollback, and recovery are defined.
- [ ] Pull request approvals and required domain/CIO/architecture decisions are recorded.
- [ ] Known limitations and deferred risks have owners and follow-up disposition.
- [ ] Lab outputs are restored to the intended stable state after controlled scenarios.
- [ ] The branch is ready either to close as documentation/internal work or to enter the separate release process.

Production deployment and post-deploy certification are release completion criteria, not development criteria.

## Pull Request checklist

### Intent and scope

- [ ] Title identifies the wave/change and outcome.
- [ ] Description states scope, non-goals, files/components, issue or decision record, and user/operational effect.
- [ ] Change classification and target branch are correct.
- [ ] Unrelated refactoring and generated noise are absent.

### Architecture and data

- [ ] Sources of truth, workbook boundaries, owners, and consumers are preserved.
- [ ] Schema/API changes, compatibility, migrations, and legacy behavior are documented.
- [ ] Investment/risk policy and execution authority are unchanged or have explicit approval.
- [ ] Data quality, freshness, numeric safety, idempotency, and duplicate suppression are addressed.
- [ ] Required ADR and Architecture Review checklist are linked.

### Security and operations

- [ ] No secrets, credentials, production data, personal financial exports, or environment-specific identifiers are committed.
- [ ] Apps Script scopes, Script Properties, triggers, Drive permissions, quotas, and scheduling effects are identified.
- [ ] Logs, lineage, alerts, support ownership, backup, rollback, and failure behavior are adequate.

### Verification and documentation

- [ ] Commands/functions run and actual outcomes are listed; omitted checks are explained.
- [ ] CI passes and runtime/workbook evidence is linked when applicable.
- [ ] Affected outputs were inspected and existing data was not unintentionally overwritten.
- [ ] Documentation and release notes/changelog are updated where applicable.
- [ ] Known limitations, risks, and follow-ups are explicit.

### Approval

- [ ] Independent review is complete.
- [ ] Domain Owner, Engineering Lead, CIO / Investment Policy Owner, or Release Manager approvals are present as required.
- [ ] All blocking comments are resolved and the final diff was reviewed after the last change.

## Defects, incidents, and rollback

Stop promotion when a blocking control fails or evidence is inconsistent. Preserve logs and affected evidence, contain the issue, notify the accountable owner, and use a reviewed revert or forward fix on an appropriate branch. Do not rewrite shared history or delete prior releases. After recovery, rerun the affected controls and record cause, impact, resolution, and preventive action.
