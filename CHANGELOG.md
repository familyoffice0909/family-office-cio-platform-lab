# Changelog

All notable changes to the Family Office CIO Platform are documented here.

The project follows [Semantic Versioning](https://semver.org/).

## [v3.4.3] - 2026-08-08

### Changed
- Aligned Weekly Strategy Review conflict-summary semantics with governed A233 conflict status so controlled conflicts remain `CONTROLLED` instead of being presented as `OPEN`
- Sourced largest-position prior/delta comparison from the compatible prior Weekly archive instead of the separate concentration-trend series
- Narrowed the Weekly portfolio-percentage plausibility control to governed portfolio-weight fields rather than scanning all percentage tokens in free-text commentary
- Sourced Weekly return-attribution coverage from A2.3.2 return metrics before coverage-summary fallback
- Preserved blocked execution semantics while retaining underlying accumulation intelligence under critical portfolio risk

### Validation
- 17/17 Jest suites passed
- 215/215 tests passed
- Weekly persisted validation passed 26/26 controls
- Governed Weekly retrieval returned `DELIVERABLE`
- Executive UAT confirmed `CRITICAL_RISK_WITH_ACCUMULATION` as `CONTROLLED — ACTIONS BLOCKED`

### Notes
- Production reconciliation completed through PR #76
- Governance incident recorded through PR #77 in `docs/incidents/GOVERNANCE-GAP-2026-08-08.md`
- Production tag `v3.4.3` confirmed

## [v3.4.2] - 2026-08-08

### Changed
- Corrected Weekly Strategy Review integration around persisted Weekly lineage, comparison eligibility, concentration authority, and report semantics
- Reconciled Weekly largest-position authority with governed A233 and Position Risk evidence
- Hardened Weekly persistence and validation behavior so only validated governed reports become deliverable
- Improved runtime/report compatibility handling for Weekly comparison evidence and baseline selection

### Validation
- Weekly persisted validation passed 26/26 controls
- Live Weekly runtime certification passed
- Governed persisted-report retrieval passed
- Regression suite passed for the certified v3.4.2 baseline

## [v3.4.1] - 2026-08-08

### Fixed
- Restored reliable governed market-value handling for QNC and ONE
- Corrected market-data / valuation propagation needed by downstream Position Risk and Executive Decision evidence
- Re-established reliable portfolio-weight evidence for QNC and ONE in the governed reporting chain

### Validation
- Market-data reliability remediation completed
- QNC / ONE recovery verified through downstream portfolio evidence
- Certified as the reliability baseline preceding Weekly integration corrections

## [v3.4.0] - 2026-08-08

### Added
- R8.3 Executive Evidence Service
- Governed executive-evidence architecture supporting A233 authoritative decision state and executive-report consumers
- Governed baseline `CB-002` for executive evidence compatibility and downstream reporting certification

### Changed
- Established the v3.4.0 production evidence baseline used by subsequent v3.4.x Weekly, market-data reliability, and governance-hardening work

### Validation
- R8.3 Executive Evidence Service certified for production
- Production baseline released as `v3.4.0`
- Governed baseline established as `CB-002`

## [2.9.0-lab] - 2026-07-21

### Completed
- Sprint 2.9.0 — Materiality and Prioritization Intelligence
- Feature integration into `develop`
- Promotion from `develop` into lab `main`
- Synchronization of lab `main` back into `develop`
- Production promotion and GitHub release `v2.9.0`

### Validation
- Platform validator passed
- ESLint passed
- Jest passed
- Sprint 2.9.0 release manifest synchronized with the production repository

### Baseline
- Lab baseline tag: `v2.9.0-lab`
- Production baseline tag: `v2.9.0`
- Future Sprint 3.0.0 development must branch from the synchronized post-v2.9.0 `develop` baseline

## [Unreleased]

### Fixed
- Added fail-closed executive-report write-back verification for the Portfolio Snapshot, Dashboard archive, and Investment Ledger Report Archive in Reporting Engine Enhancement v3.0.1
- Standardized persistence status semantics so expected non-events are not reported as failures
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
