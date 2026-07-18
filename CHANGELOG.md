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

## [2.1.0] - Unreleased

### Added

- Multi-account portfolio domain model covering `InvestmentAccount`, `AccountType`, `Holdings`, and `HouseholdPortfolio`
- In-memory account registry operations for account lifecycle, holdings replacement, supplied-price market-value refresh, and defensive account discovery
- Unified household aggregation for sector, country, currency, asset-class, and largest-security exposure
- Duplicate-holding and descriptive sector, currency, and security concentration analysis
- Automatic compatibility migration of legacy single-account holdings to `Default Account`

### Changed

- Portfolio snapshots now interpret a missing legacy account as `Default Account` and return additive household intelligence without changing the existing snapshot worksheet schema

### Validation

- Added deterministic Jest coverage and an Apps Script smoke-test entry point; Lab Apps Script and workbook validation remain release gates after review and integration

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
