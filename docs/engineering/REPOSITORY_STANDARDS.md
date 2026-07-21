# Repository Standards

- **Owner:** Engineering Lead
- **Status:** Governing policy
- **Established by:** R1.3.0.4 — Engineering Governance

## Purpose

These standards define ownership, naming, dependencies, configuration, logging, and error handling in the Family Office CIO Platform repository. They supplement the [Repository Architecture](../ARCHITECTURE.md), [Architecture Principles](ARCHITECTURE_PRINCIPLES.md), and [Branching Strategy](BRANCHING_STRATEGY.md).

## Authority and folder ownership

GitHub is authoritative for source, documentation, tests, configuration declarations, change history, tags, and releases.

| Path or artifact | Primary owner | Rule |
|---|---|---|
| Root `*.js` engines and services | Relevant Domain Owner; Engineering Lead for shared services | Production source; change with tests and owning documentation |
| `appsscript.json`, `.clasp.json`, `.claspignore` | Engineering Lead / Production Operator | Scope, runtime, project-target, and deployment changes require explicit review |
| `tests/` | Engineering Lead and affected Domain Owner | Tests remain deterministic and use synthetic/controlled data |
| `scripts/` and CI workflows | Engineering Lead | Validation and delivery controls cannot be weakened without review |
| `docs/engineering/` | Engineering Lead | Canonical engineering policy and roadmap |
| `docs/adr/` | Chief Architect / Engineering Lead | ADR process, register, template, and future decision records |
| `docs/architecture/`, `docs/risk/`, domain folders | Chief Architect plus affected Domain Owner | Current architecture, historical accepted ADRs, designs, and baselines |
| `docs/validation/` and release evidence | Release Validator / Release Manager | Append-only traceable evidence; do not rewrite history |

Generated artifacts must be identifiable, reproducible, and excluded from Git when they contain environment-specific or sensitive information.

## Module ownership and boundaries

- Domain engines calculate governed domain results and do not own worksheet transport or presentation.
- Spreadsheet services own worksheet reads/writes and enforce schema and output ownership.
- Reporting and dashboard modules consume governed outputs and do not recreate independent portfolio posture.
- Orchestrators coordinate registered modules and do not embed investment or risk policy.
- Shared services expose narrow, stable contracts and do not create hidden cross-domain dependencies.
- A module change identifies its owner, public entry points, data contracts, consumers, failure behavior, tests, and operational effect.

Cross-workbook, external-system, source-of-truth, or material orchestration changes require architecture review and an ADR under the [ADR Guide](../adr/README.md).

## Naming conventions

- JavaScript source files use established PascalCase domain names and existing wave suffixes only when traceability requires them.
- Apps Script public functions retain the established `fo...` convention; internal helpers retain the trailing-underscore convention where already used.
- Constants use descriptive uppercase names when immutable; variables and functions use descriptive `camelCase`.
- Worksheet, header, schema, version, and baseline names match their registered contracts exactly.
- Branches follow [Branching Strategy](BRANCHING_STRATEGY.md); ADRs use the numbering convention in the [ADR Guide](../adr/README.md).
- Avoid ambiguous abbreviations, generic names such as `data` when a domain term is available, and renames that erase historical traceability.

## Dependency boundaries and import rules

Google Apps Script loads repository source into a shared V8 global environment; do not introduce CommonJS, ESM, bundler, or package imports into runtime files without an approved architecture change. Runtime code may depend only on established platform globals and services whose load and availability contracts are understood.

- Dependencies point inward toward stable domain/shared contracts; presentation must not become a policy authority.
- Avoid circular dependencies, implicit load-order coupling, duplicate globals, and direct worksheet access outside owning services.
- Node dependencies are development-only unless a separately accepted design provides a runtime build and deployment path.
- Add a third-party dependency only with owner, license, security, maintenance, version, and rollback review. Pin through the repository lockfile.
- Test-only mocks and helpers must not leak into Apps Script runtime files.

## Configuration ownership

`Config.js` owns governed platform configuration unless a more specific accepted contract applies. `appsscript.json` owns Apps Script runtime/scopes; clasp files own Lab project synchronization metadata. Secrets, credentials, environment-specific workbook IDs, and Script Properties stay outside committed source. Configuration changes document defaults, validation, environment behavior, migration, and rollback and must not silently redefine investment policy.

## Logging conventions

Use the platform logging service rather than ad hoc output for operational events. Material logs include run identity, component, step, status, timestamp, version/baseline, duration where useful, and actionable error context. Logs distinguish blocking failure, warning, and informational observation. Never log secrets, credentials, account identifiers, full production financial records, or unnecessary personal data.

## Error handling conventions

- Validate preconditions and trust-boundary inputs before mutation or worksheet writes.
- Fail visibly and safely; do not coerce missing, stale, invalid, or incomplete values into favorable results.
- Preserve the original cause and add actionable domain context without exposing sensitive data.
- Use structured results only where partial success is an explicit contract; otherwise throw or surface the blocking failure consistently.
- Bound retries, make retried operations idempotent, suppress duplicates, and record terminal failure.
- Never swallow an exception merely to keep an orchestrator or report green.
- Define recovery and rollback for material writes and verify the state after restoration.

## Repository change control

One branch and pull request contain one coherent concern. Preserve unrelated user changes, inspect the final diff, and stage only intended files. Protected branches require independent review and passing checks. Production deployment, merge, force push, history rewrite, tag, and production-workbook mutation require explicit human authority under [Release Governance](RELEASE_GOVERNANCE.md).
