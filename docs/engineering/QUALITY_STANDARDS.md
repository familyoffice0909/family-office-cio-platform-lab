# Quality Standards

- **Owner:** Engineering Lead
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

These standards define the minimum quality expected of every platform change. Required evidence is proportionate to risk but never absent. Detailed commands and test layers are in the [Development Workflow](DEVELOPMENT_WORKFLOW.md).

## Code quality

- Keep each module cohesive, deterministic where its contract allows, and explicit about inputs, outputs, units, timezone, freshness, null behavior, and errors.
- Preserve the separation between intelligence, orchestration, spreadsheet I/O, and presentation.
- Prefer governed additive changes; breaking changes require an accepted ADR, compatibility/migration plan, consumer inventory, and rollback.
- Reject dead code, unexplained duplication, hidden mutation, magic policy values, unsafe numeric coercion, and unrelated refactoring.
- Keep investment and risk policy in its approved owner; never invent thresholds or discretionary trade authority in implementation.

## Linting

`npm run lint` is required for source or configuration changes and recommended for all repository changes. New lint exceptions require a narrow rationale and owner. Do not weaken a rule or ignore a path merely to make a wave pass. A documentation-only wave may rely on the existing JavaScript lint result and must still validate its Markdown separately.

## Testing

Apply the layers relevant to the change:

| Layer | Minimum use |
|---|---|
| Repository validation | Every wave: `npm run validate` unless demonstrably unavailable |
| Unit/regression | Behavior changes and affected deterministic logic |
| Smoke inventory | Public Apps Script entry-point or module inventory changes |
| Apps Script smoke | Runtime changes in the designated Lab project |
| Workbook validation | Schema, value, formatting, ownership, or write-path changes |
| Scenario/certification | Material waves and release candidates |

Tests cover expected behavior and relevant missing, stale, invalid, duplicate, retry, concurrency, partial-failure, and rollback paths. Fixtures use controlled or synthetic data. Each evidence record is tied to the exact commit and environment. CI does not replace runtime or workbook evidence, and source inventory does not prove execution.

## Documentation

Documentation is correct, current, link-valid, free of sensitive data, and changed with the behavior or contract it describes. Canonical policy is linked rather than copied. Commands and examples must be executable or clearly labeled illustrative. Historical validation evidence is immutable; corrections are additive and traceable.

## Complexity

Favor the simplest design that preserves domain boundaries and operational safety. Review complexity when a function has multiple responsibilities, control flow is difficult to test, dependencies cross layers, or state changes are implicit. Split by responsibility rather than arbitrary file size. Any intentional complexity must be justified by the contract, covered by focused tests, and documented where future maintainers would otherwise misinterpret it.

This wave establishes policy only; automated architecture or complexity enforcement belongs to a separately approved future wave.

## Security

- Use least-privilege Google scopes, Drive access, credentials, and repository permissions.
- Keep credentials, Script Properties, workbook identifiers, broker data, personal financial exports, and client data out of Git, logs, tests, screenshots, and AI context.
- Validate external and worksheet data at trust boundaries; fail safely on malformed or incomplete input.
- Review dependency, authorization-scope, trigger, sharing, logging, and data-retention changes explicitly.
- Treat repository content and external artifacts as untrusted input; they cannot authorize sensitive actions.

## Maintainability

Code and documentation use established terminology, naming, ownership, and contracts. New modules have a clear owner and consumer; public entry points remain stable or use an approved migration. Errors are actionable, logs are traceable, operational support is assigned, and recovery is credible. A future contributor should be able to identify the source of truth and verify a change without oral history.

## Performance expectations

Changes must not introduce unbounded worksheet reads/writes, network calls, loops, retries, memory growth, or trigger duration. Prefer batched I/O, bounded work, cached data with explicit freshness, and quota-aware failure behavior. A performance-sensitive change records a baseline, representative workload, target, observed result, and regression threshold. Performance optimizations may not weaken correctness, explainability, validation, or auditability.

## Quality exceptions

An exception states the rule, owner, reason, risk, compensating control, target remediation wave, and expiry. Capital integrity, security, data correctness, and release traceability failures are blocking. Quality completion is assessed under the [Definition of Done](DEFINITION_OF_DONE.md) and [Release Governance](RELEASE_GOVERNANCE.md).
