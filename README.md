# Family Office CIO Platform

[![CIO Platform CI](https://github.com/familyoffice0909/family-office-cio-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/familyoffice0909/family-office-cio-platform/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/familyoffice0909/family-office-cio-platform)](https://github.com/familyoffice0909/family-office-cio-platform/releases)
[![License](https://img.shields.io/badge/license-private%20use-lightgrey)](#license)

Institutional-grade Family Office CIO Platform built on Google Sheets and Google Apps Script, with GitHub-based source control, validation, reporting, portfolio analytics, broker reconciliation, and autonomous CIO orchestration.

## Current production baseline

- Release: `v1.0.0`
- Default branch: `main`
- Development model: feature branch → CI → pull request → merge → Apps Script deployment
- Runtime: Google Apps Script V8
- Base currency: CAD

## Major capabilities

- Platform bootstrap, configuration, logging, versioning, validation, and backups
- Portfolio valuation, data integrity, performance, exposure, and attribution
- Market data integration and symbol registry
- IBKR reconciliation and executive data-quality scoring
- Recommendation, market intelligence, and CIO decision engines
- Executive dashboard and reporting
- Buy Zone Intelligence
- Autonomous CIO orchestration with run and step logs
- Modular smoke-test framework

## Repository workflow

```text
ChatGPT / Developer
        ↓
Feature branch
        ↓
GitHub Actions CI
        ↓
Tests and validation
        ↓
Pull request review
        ↓
Merge to main
        ↓
Controlled Apps Script deployment
        ↓
Google Sheets platform
```

Never develop directly on `main`. Use one feature branch per engineering wave.

## Local setup

```bash
npm install
npm run validate
npm run lint
```

For Apps Script synchronization:

```bash
clasp login
clasp pull
clasp push
```

Never commit `.clasprc.json`, OAuth tokens, service-account keys, broker credentials, or `.env` files.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Smoke-test reporting](docs/SMOKE_TEST.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Release policy

The project follows Semantic Versioning:

- Patch: backward-compatible fixes
- Minor: new backward-compatible capabilities
- Major: breaking architecture or operating-model changes

## Known limitation

The Apps Script broker-reconciliation module currently consumes a seeded IBKR snapshot. ChatGPT can read the live IBKR connector, but Apps Script cannot call that connector directly without a supported API or secure intermediary.

## License

Private family-office use. No public redistribution or investment-advice warranty is granted.
