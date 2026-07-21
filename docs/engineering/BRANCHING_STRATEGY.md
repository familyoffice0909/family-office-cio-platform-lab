# Branching Strategy

## Purpose

This strategy separates daily Lab integration, certified release state, and production authority. It reflects the repository's two-remote topology:

- `origin`: `family-office-cio-platform-lab`, the Engineering Lab repository.
- `production`: `family-office-cio-platform`, the production repository.

Repository URLs and remote names must be verified before any push or promotion; a local alias alone is not proof of destination.

Branch selection occurs after the [Definition of Ready](DEFINITION_OF_READY.md) and supports the official [SDLC](SDLC.md). Merge, release, and tagging authority remain governed by [Release Governance](RELEASE_GOVERNANCE.md).

## Long-lived branches

| Branch | Authority | Permitted content |
|---|---|---|
| `origin/develop` | Lab integration baseline | Reviewed waves ready for integrated Lab validation |
| `origin/main` | Lab-certified release baseline | Release candidates approved after Lab certification |
| `production/main` | Production source baseline | Exact approved commits promoted from the Lab-certified baseline |

Protect all long-lived branches. No direct commits or force-pushes. Changes arrive through pull requests, except a documented emergency mechanism administered by an authorized repository owner.

`production/main` must not contain development unique to the production repository. The promoted commit must be identifiable in the Lab history. Environment-specific credentials and identifiers stay outside Git.

## Short-lived branches

Create branches from the correct base and use lowercase, hyphenated descriptions:

| Type | Pattern | Base | Target |
|---|---|---|---|
| Feature wave | `feature/wave-x-y-z-short-description` or established `feature/a2-4-0-short-description` | `origin/develop` | `develop` |
| Defect | `fix/wave-or-issue-short-description` | `origin/develop` | `develop` |
| Documentation | `docs/short-description` | `origin/develop` | `develop` |
| Codex workspace | `codex/short-description` | appropriate governed base | same target as the underlying change type |
| Release preparation | `release/vX.Y.Z` | `develop` | `main` |
| Production hotfix | `hotfix/vX.Y.Z-short-description` | exact `production/main` commit mirrored in Lab | `origin/main`, then `production/main` after approval |
| Rollback | `rollback/vX.Y.Z-or-wave` | affected certified baseline | governed target branch |

One branch contains one coherent wave or release concern. Delete it after merge and evidence retention. Do not keep long-running feature branches as alternative integration lines.

The pattern families are `feature/*`, `hotfix/*`, and `release/*`; the table above defines their permitted bases and targets. `fix/*`, `docs/*`, `codex/*`, and `rollback/*` are governed supporting families and do not bypass the same review or protection rules.

## Normal flow

1. Synchronize local references and branch from `origin/develop`.
2. Push the short-lived branch to `origin` and open a pull request to `develop`.
3. Complete review and checks; merge only after required approvals.
4. Validate the integrated commit in Lab.
5. Prepare `release/vX.Y.Z` from the certified `develop` commit and open a promotion pull request to `origin/main`.
6. Confirm the merge commit or approved commit hash, version metadata, tag plan, and release evidence.
7. Promote that exact commit to `production/main` under the [Release Policy](RELEASE_POLICY.md).

Until CI is configured to run directly on pull requests targeting `develop`, the feature-branch push CI result plus locally recorded required checks are mandatory evidence. This is a known enforcement gap, not permission to skip checks.

## Merge and history policy

- Use a pull request merge that preserves a clear relationship between wave, review, and resulting commit. Follow repository protection settings.
- Merge only after required CI, tests, architecture review, release validation, independent approval, and resolved blocking comments are evidenced for the exact candidate.
- Rebase or merge the base branch before final approval when needed; never rewrite a branch after others depend on it without coordination.
- Tags identify immutable release or certification commits and are never moved or reused.
- A release branch changes only release metadata, documentation, or defects discovered during release qualification. New feature scope returns to `develop`.
- `main` is not a general integration branch. `develop` is not a production deployment source.

## Hotfix flow

1. Establish the exact production commit and incident scope.
2. Create the hotfix in the Lab repository from the mirrored production baseline.
3. Apply the smallest safe correction with review, regression evidence, rollback, and release approval.
4. Merge to `origin/main`, promote the exact approved commit to `production/main`, tag, deploy, and validate.
5. Merge or cherry-pick the hotfix back into `develop` through a pull request so the fix is not lost.
6. Record the incident and any follow-up architecture or control work.

## Branch protection expectations

Require pull requests, passing required status checks, no unresolved review conversations, up-to-date protected branches where practical, restricted force pushes/deletion, and authorized release actors. Material changes require independent approval. Repository administrators should not bypass protections except under a documented emergency procedure.

Protect `main` and `develop` in the Lab repository and `main` in the production repository. No direct commits, force pushes, branch deletion, tag movement, or administrator bypass is permitted except through a documented, authorized emergency process with retained evidence.
