# Family Office CIO Platform

[![CIO Platform CI](https://github.com/familyoffice0909/family-office-cio-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/familyoffice0909/family-office-cio-platform/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/familyoffice0909/family-office-cio-platform)](https://github.com/familyoffice0909/family-office-cio-platform/releases)
[![License](https://img.shields.io/badge/license-private%20use-lightgrey)](#license)

Institutional-grade Family Office CIO Platform built on Google Sheets and Google Apps Script, with GitHub-based source control, validation, reporting, portfolio analytics, broker reconciliation, and autonomous CIO orchestration.

## Current repository baseline

- Platform version: `v2.1.0-rc.3` (draft Release 2.1.0 RC3)
- Configuration baseline: `CB-002`
- Repository lineage: `v1.3.0` → `r1.3.1.1` → `v2.1.0-rc.1` → `v2.1.0-rc.2` → `v2.1.0-rc.3`
- Release: Multi-Account Portfolio Intelligence Core
- Lab repository: `family-office-cio-platform-lab` (`origin`)
- Production repository: `family-office-cio-platform` (`production`)
- Development model: feature wave → `develop` → Lab validation → Lab-certified `main` → production promotion → controlled Apps Script deployment
- Runtime: Google Apps Script V8
- Base currency: CAD

## Major capabilities

- Platform bootstrap, configuration, logging, versioning, validation, and backups
- Portfolio valuation, data integrity, performance, exposure, and attribution
- Multi-account domain, account registry, household aggregation, and duplicate-exposure analysis
- Market data integration and symbol registry
- IBKR reconciliation and executive data-quality scoring
- Recommendation, market intelligence, and CIO decision engines
- Executive dashboard and reporting
- Buy Zone Intelligence
- Autonomous CIO orchestration with run and step logs
- Modular smoke-test framework

## Repository workflow

```text
Developer / AI collaborator
        ↓
Feature branch
        ↓
GitHub Actions CI
        ↓
Tests and validation
        ↓
Pull request to develop
        ↓
Integrated Lab validation
        ↓
Release pull request to Lab main
        ↓
Exact-commit promotion to production main
        ↓
Controlled production Apps Script deployment
        ↓
Google Sheets platform
```

Never develop directly on `develop` or `main`. Use one short-lived branch per engineering wave and follow the [Branching Strategy](docs/engineering/BRANCHING_STRATEGY.md).

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

- [Engineering Guide](docs/engineering/ENGINEERING_GUIDE.md)
- [Architecture Principles](docs/engineering/ARCHITECTURE_PRINCIPLES.md)
- [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md)
- [CIO Philosophy](docs/engineering/CIO_PHILOSOPHY.md)
- [Branching Strategy](docs/engineering/BRANCHING_STRATEGY.md)
- [Release Policy](docs/engineering/RELEASE_POLICY.md)
- [AI Collaboration Model](docs/engineering/AI_COLLABORATION_MODEL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Release 2.1.0 — Multi-Account Portfolio Intelligence Core](docs/portfolio-intelligence/RELEASE-2.1.0-MULTI-ACCOUNT-CORE.md)
- [Household Portfolio Aggregation API Contract](docs/portfolio-intelligence/PORTFOLIO-AGGREGATION-API.md)
- [Release 2.1.0 RC3 Migration Guide](docs/portfolio-intelligence/MIGRATION-2.1.0-RC3.md)
- [Roadmap](docs/ROADMAP.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Smoke-test reporting](docs/SMOKE_TEST.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Release policy

The project follows Semantic Versioning and evidence-backed promotion from the Engineering Lab to the separate production authority. See the [Release Policy](docs/engineering/RELEASE_POLICY.md) and [Release Checklist](docs/RELEASE_CHECKLIST.md).

## Known limitation

The Apps Script broker-reconciliation module currently consumes a seeded IBKR snapshot. ChatGPT can read the live IBKR connector, but Apps Script cannot call that connector directly without a supported API or secure intermediary.

## License

Private family-office use. No public redistribution or investment-advice warranty is granted.
