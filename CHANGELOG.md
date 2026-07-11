# Changelog

All notable changes to the Family Office CIO Platform are documented here.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Enterprise engineering documentation
- Repository governance and release checklist
- Automated module, menu, orchestrator, version, manifest, duplicate-function, and secret validation
- CI-generated smoke-test inventory artifact

### Planned
- Buy Zone Intelligence hardening
- Decision explainability
- Recommendation change detection

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
