# Changelog

All notable changes to the Family Office CIO Platform are documented here.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Reconciled repository metadata, static tests, validation, and CI with the released `v1.3.0` / `CB-002` baseline in wave R1.3.0.1

### Added
- Enterprise engineering documentation
- Institutional engineering governance for the SDLC, readiness and completion gates, release governance, repository quality, ownership, ADRs, and the five-epic roadmap in wave R1.3.0.4
- Repository governance and release checklist
- Automated module, menu, orchestrator, version, manifest, duplicate-function, and secret validation
- CI-generated smoke-test inventory artifact
- Fail-closed LAB/PRODUCTION runtime configuration and governed Dashboard/Ledger workbook access for wave R1.3.0.2
- Runtime locking for the Autonomous CIO Orchestrator, Production Certification, and report-archive workflows; other mutating paths are outside the approved reduced scope
- Explicit Apps Script OAuth scopes and Jest coverage for runtime guard and lock behavior

### Planned
- Buy Zone Intelligence hardening
- Decision explainability
- Recommendation change detection

## [2.1.0-rc.3] - Unreleased (Draft PR #8)

### Fixed

- Removed independent ticker/account duplicate classification from Portfolio Data Integrity; same-account and cross-account findings now consume the canonical Household Aggregation Engine sets
- Preserved explicit valuation currency at ingress and rejected non-base-currency market values without conversion or overwrite
- Added exchange-qualified ticker identity and fail-closed handling for ambiguous ticker-only collisions
- Replaced full Portfolio Snapshot serialization in Step Log with a compact executive projection and deterministic 12,000-character bound
- Canonicalized custom account names across case/whitespace variants and removed the phantom default account from empty portfolios

### Validation

- Added independent RC3 regressions for currency ingress, ticker collisions, canonical duplicate ownership, account normalization, empty portfolios, Step Log bounds, 5,000-position serialization, and workbook schema compatibility

### Lineage

- Recorded actual repository ancestry as `v1.3.0` → `r1.3.1.1` → Release 2.1.0 RC1 → Release 2.1.0 RC2 → Release 2.1.0 RC3

## [2.1.0-rc.2] - 2026-07-18 (Draft PR #8)

### Added

- Multi-account portfolio domain model covering `InvestmentAccount`, `AccountType`, `Holdings`, and `HouseholdPortfolio`
- In-memory account registry operations for account lifecycle, holdings replacement, supplied-price market-value refresh, and defensive account discovery
- One canonical household aggregation result for total value, normalized positions, account/sector/country/currency/asset-class allocation, security exposure, concentration, and duplicate classification
- Explicit cross-account, same-account, and all-duplicate views using canonical security identity with ticker fallback
- Automatic compatibility migration of legacy single-account holdings to `Default Account`

### Changed

- Portfolio snapshot/summary, performance, valuation, state, and exposure-attribution calculations now consume the canonical aggregation output without changing existing worksheet schemas
- Accounts are normalized once at ingestion; blank, case, and whitespace variants resolve consistently
- Market value is explicitly governed as household-base-currency value and inconsistent explicit currency inputs fail closed
- Direct `InvestmentAccount` construction now requires ID, name, type, currency, and holdings; compatibility defaults remain isolated in the legacy adapter
- Release metadata identifies `v2.1.0-rc.2`; ancestry is `v1.3.0` → `r1.3.1.1` → Release 2.1.0 RC1 → Release 2.1.0 RC2

### Validation

- Added regression coverage for empty/large households, currency enforcement, account normalization, duplicate semantics, identity precedence, exposure reconciliation, consumer integration, and worksheet compatibility; live Lab Apps Script/workbook validation remains a release gate

## [1.3.0] - 2026-07-16

### Added
- Unified Weekly CIO Reporting with A2.4.0.2 percentage normalization and executive-output rounding controls

## [1.0.0] - 2026-07-10

### Added
- Enterprise Apps Script architecture and module separation
- Configuration, logging, spreadsheet, version, backup, validation, and trigger services
- Bootstrap, platform health, platform integrity, and modular smoke-test framework
- Portfolio valuation, data integrity, performance, exposure, attribution, and reconciliation engines
- Market data integration and market symbol registry
- Recommendation, market intelligence, CIO decision, executive reporting, and dashboard engines
- Autonomous CIO orchestrator with run and step logging
- Buy Zone Intelligence baseline
- GitHub Actions continuous-integration baseline
- Production tag and GitHub release `v1.0.0`

### Known limitations
- Apps Script uses a seeded IBKR snapshot rather than direct live broker ingestion
- Automated GitHub-to-Apps-Script deployment requires credential hardening
