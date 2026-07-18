# ADR-004 — Registry Authority

- **Status:** Accepted
- **Decision date:** 2026-07-18
- **Owners:** Chief Architect; Platform Governance Domain Owner
- **Approvers:** Chief Architect; CIO
- **Wave / release:** R1.3.1.1 — Registry Authority
- **Supersedes:** None
- **Superseded by:** None

## Context

The platform already has multiple registries that own distinct business data.
`FO_SHEETS` owns canonical worksheet names,
`FO_REQUIRED_DASHBOARD_SHEETS` owns the health-check worksheet inventory, and
the Market Symbol Registry owns provider-symbol mappings. These registries are
used directly by existing consumers and must not be replaced or migrated.

The platform needs one governance layer that records which registries are
recognized, who owns them, which authority governs registration, and which
function validates each registration. Without that layer, registry identity,
ownership, version, and registration state cannot be discovered or checked
consistently.

This decision implements the CIO-approved R1.3.1.1 Architecture Specification
and Implementation Work Package. It preserves [ADR-001](../architecture/ADR-001-PRODUCTION-ARCHITECTURE.md),
[ADR-002](../architecture/ADR-002-CROSS-WORKBOOK-GOVERNANCE.md), and the
[Architecture Ownership Policy](../architecture/ARCHITECTURE-OWNERSHIP-POLICY.md).

## Decision drivers

- Establish one authoritative registration and discovery contract.
- Preserve every existing registry's business-data ownership and consumers.
- Detect ambiguous or incomplete registry governance before accepting it.
- Add governance without workbook access, orchestration changes, or runtime
  redesign.
- Limit initial adoption to the three registries approved for R1.3.1.1.

## Decision

The platform will provide an additive Registry Authority implemented in
`RegistryAuthority.js`.

Every registration contains these required metadata fields:

| Field | Contract |
|---|---|
| Registry Name | Non-empty, case-insensitively unique identifier |
| Owner | Non-empty, case-insensitively unique accountable owner |
| Version | Non-empty registry contract version |
| Authority | Non-empty registration authority; initially `Registry Authority` |
| Validation Function | Callable function that validates registry-owned data |
| Registration Status | One of `REGISTERED`, `SUSPENDED`, or `RETIRED` |

The public registration API fails closed if the candidate catalog has a
duplicate registry name, duplicate owner, missing metadata, missing validation
function, invalid registration status, or failed registry-owned validation.
The discovery API exposes immutable metadata views and deliberately omits the
registry business-data reference. Existing consumers continue reading
`FO_SHEETS`, `FO_REQUIRED_DASHBOARD_SHEETS`, and `FO_MARKET_SYMBOLS` directly.

The initial authority catalog contains only:

1. `FO_SHEETS`
2. `FO_REQUIRED_DASHBOARD_SHEETS`
3. Market Symbol Registry

Catalog bootstrap is lazy and in-memory for each Apps Script execution. It does
not write a worksheet, create a new data store, change execution ordering, or
persist registration state outside source control.

## Alternatives considered

### Alternative 1 — Consolidate business data into one central registry

This would simplify physical storage but replace existing owners, require broad
consumer migration, and create breaking runtime and data-contract changes. It
was rejected because Registry Authority governs registries; it does not become
their business-data owner.

### Alternative 2 — Store authority metadata in a worksheet

A worksheet could allow runtime editing but would create a new operational data
source, spreadsheet I/O, protection and schema requirements, and additional
failure modes. It was rejected because the approved wave requires governance
without runtime or spreadsheet redesign.

### Alternative 3 — Leave each registry self-governing

This avoids new code but cannot provide authoritative discovery or cross-catalog
checks for duplicate identities, duplicate ownership, incomplete metadata, or
invalid registration state. It does not meet the approved objective.

## Consequences

### Positive

- Registry governance and discovery use one explicit contract.
- Invalid or ambiguous registration fails before catalog mutation.
- Existing registry objects, data, callers, and runtime paths are unchanged.
- Initial adoption is deterministic and source-controlled.
- The authority can be extended through separately approved future work.

### Negative and trade-offs

- Registration state is rebuilt per Apps Script execution rather than persisted.
- Owner uniqueness allows one accountable owner assignment per adopted registry
  in this wave; any future shared-owner policy requires a reviewed contract
  change.
- Validation functions add a small cost only when authority APIs are called.

### Risks and technical debt

- The authority is not yet wired into dependency enforcement or orchestration.
  Those capabilities remain deferred to separately approved roadmap waves.
- No Lab workbook execution is performed by repository tests. The smoke-test
  entry point provides the controlled future Lab validation surface.

## Affected authorities and contracts

- **GitHub:** owns Registry Authority source, metadata, tests, documentation,
  and change history.
- **Apps Script:** gains additive public functions for registration, discovery,
  validation, and smoke testing.
- **Dashboard and Ledger:** no ownership, schema, data, or write-path changes.
- **Google Drive and external sources:** no change.
- **Existing registries:** retain all business data and direct consumer
  contracts.
- **Investment policy and trade authority:** no change.

The additive public functions are:

- `foRegisterRegistry(metadata)`
- `foDiscoverRegistries(criteria)`
- `foDiscoverRegistry(registryName)`
- `foValidateRegistryAuthority()`
- `foRunRegistryAuthoritySmokeTest()`

## Security, privacy, and data

No authorization scope, credential, workbook permission, external connection,
or sensitive-data handling changes. Metadata contains platform component names
and accountable domain labels only. The authority performs no logging and no
spreadsheet or Drive access.

## Compatibility and migration

The change is additive. There is no migration, dual write, deprecation, or
consumer update. Existing registries and all direct accesses remain valid.
Adoption registers references for validation only and never copies or mutates
registry-owned business data.

## Operational impact

There are no schedules, triggers, workbook writes, locks, retries, or
orchestration changes. Lazy bootstrap is deterministic and idempotent within an
execution. Failed registration leaves the existing catalog unchanged. Support
ownership is Platform Governance with the relevant registry owner responsible
for its validation function and business-data contract.

## Validation

Acceptance requires repository validation, focused and complete Jest tests,
lint, JavaScript syntax checks, Apps Script source inventory, Markdown
validation, and `git diff --check`. Tests must demonstrate all required
validation failures, the three-record adoption boundary, metadata-only
discovery, failed registration rollback, and a passing smoke test.

Live workbook validation is not required because this implementation performs
no workbook access or mutation. A future authorized Lab operator may run
`foRunRegistryAuthoritySmokeTest()` without changing workbook state.

## Rollback and recovery

Revert the R1.3.1.1 commits, then rerun repository validation, unit tests, lint,
syntax validation, Markdown validation, and Apps Script source inventory. No
data restoration is required because the authority has no persistent state and
does not mutate the adopted registries or workbooks.

## Approval record

| Role | Name | Decision | Date | Evidence link |
|---|---|---|---|---|
| Chief Architect / Engineering Lead | Chief Architect | Accepted | 2026-07-18 | CIO-approved R1.3.1.1 Architecture Specification and Implementation Work Package |
| Domain Owner | Platform Governance | Accepted | 2026-07-18 | CIO-approved R1.3.1.1 Architecture Specification and Implementation Work Package |
| CIO / Investment Policy Owner | CIO | Approved; no investment-policy effect | 2026-07-18 | CIO-approved R1.3.1.1 Architecture Specification and Implementation Work Package |
| Release Manager | Not assigned | Not applicable to implementation-only Draft PR | 2026-07-18 | No release authorized |

## References

- [Registry Authority architecture](../architecture/R1.3.1.1-REGISTRY-AUTHORITY.md)
- [Registry Authority validation evidence](../validation/R1.3.1.1-REGISTRY-AUTHORITY-EVIDENCE.md)
- [ADR Guide](README.md)
- [Architecture Principles](../engineering/ARCHITECTURE_PRINCIPLES.md)
- [Engineering Governance](../engineering/ENGINEERING_GOVERNANCE.md)
