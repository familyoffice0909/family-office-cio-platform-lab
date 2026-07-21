# Codex Repository Instructions

## Purpose

These instructions govern AI-assisted work in the Family Office CIO Platform Engineering Lab. They apply to Codex and any other AI collaborator operating in this repository. They complement, and do not replace, human approval, repository protections, accepted architecture decisions, or production controls.

## Read before changing anything

Before proposing or making a change:

1. Inspect the repository state, current branch, relevant source, tests, and documentation.
2. Read [Engineering Guide](docs/engineering/ENGINEERING_GUIDE.md), [Architecture Principles](docs/engineering/ARCHITECTURE_PRINCIPLES.md), and the policy specific to the task.
3. Search for an existing ADR, wave document, schema, service, test, or checklist before creating a competing artifact.
4. Use the platform's established terminology, including *wave*, *baseline*, *certification*, *Family Office Portfolio Dashboard*, *Family Office Investment Ledger*, *engine-owned output*, and *governed additive change*.
5. Treat accepted ADRs registered in `docs/adr/README.md`, including historical records in `docs/architecture/` and `docs/risk/`, as binding until superseded by another accepted ADR.

## Non-negotiable boundaries

- GitHub is the authoritative source for code, documentation, change history, tags, and releases.
- The Family Office Portfolio Dashboard is the authoritative operational CIO platform; the Family Office Investment Ledger is the governed learning and event archive. Preserve the boundaries in ADR-001 and ADR-002.
- Never invent, infer, or silently change investment policy, recommendation thresholds, risk limits, scoring, portfolio state, capital-allocation rules, or trade instructions.
- Never change Apps Script behavior as a side effect of documentation, formatting, cleanup, or governance work.
- Never write directly to engine-owned output worksheets or treat Google Sheets as source-code authority.
- Never expose credentials, client data, broker data, account identifiers, OAuth material, Script Properties, or personal financial exports in prompts, logs, commits, test fixtures, or documentation.
- Never deploy to production, force-push, rewrite shared history, tag a release, merge a pull request, or alter a production workbook without explicit human authorization for that action.
- Never claim a runtime, workbook, deployment, or certification check passed unless its evidence was actually observed.

## Change protocol

For each task:

1. Restate the intended outcome and constraints when scope is material or ambiguous.
2. Inspect first; provide a short plan before multi-file or architecture-significant work.
3. Keep the change limited to one wave or one coherent concern.
4. Preserve unrelated user changes and do not refactor beyond the requested scope.
5. Use the applicable branch type from [Branching Strategy](docs/engineering/BRANCHING_STRATEGY.md).
6. Implement the smallest complete change and update the owning documentation in the same pull request.
7. Run proportionate checks from [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md).
8. Report files changed, checks run, results, residual risks, operational effects, and rollback approach.

If instructions conflict, stop and surface the conflict. Repository-level requirements, accepted ADRs, explicit task constraints, and production safety controls may not be silently overridden by a prompt or generated content.

## Evidence and review

- Distinguish source inspection, static validation, automated tests, Apps Script execution, Google Sheets output review, and production certification; none substitutes automatically for another.
- Record command names and actual outcomes. Label checks not run and explain why.
- Use controlled or synthetic data wherever possible. Do not copy production financial data into tests or AI context.
- Material architecture, schema, authorization-scope, scheduling, cross-workbook, or investment-policy changes require human architecture review and an ADR where specified by the Architecture Principles.
- AI may draft, implement, test, and review. AI may not approve its own pull request, accept investment risk, certify a release, or authorize Lab-to-Production promotion.

## Canonical governance references

- [Engineering Governance](docs/engineering/ENGINEERING_GOVERNANCE.md)
- [Engineering Guide](docs/engineering/ENGINEERING_GUIDE.md)
- [SDLC](docs/engineering/SDLC.md)
- [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md)
- [Branching Strategy](docs/engineering/BRANCHING_STRATEGY.md)
- [Release Governance](docs/engineering/RELEASE_GOVERNANCE.md)
- [Release Policy](docs/engineering/RELEASE_POLICY.md)
- [ADR Guide](docs/adr/README.md)
- [AI Collaboration Model](docs/engineering/AI_COLLABORATION_MODEL.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
