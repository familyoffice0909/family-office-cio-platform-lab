# Release 2.1.0 RC2 Migration Guide

## Scope

RC2 remediates the first PR #8 architecture-review findings without changing the
inherited `v1.3.0` workbook architecture, source-of-truth boundary, orchestration
order, authorization scopes, triggers, investment policy, or execution
authority.

## Release lineage

The traceable repository ancestry at RC2 was:

1. production source release `v1.3.0` at `659ad79`;
2. Engineering Lab governance/registry lineage through tagged baseline
   `r1.3.1.1` on `origin/develop`; and
3. Release 2.1.0 RC1 at commits `0de3968` through `a0147a5`; and
4. draft candidate `v2.1.0-rc.2` at `3d18546` on PR #8, targeting
   `origin/develop`.

`CB-002` remains the configuration baseline. Human architecture review, Lab certification, merge,
tagging, deployment, and production promotion remain pending.

## Automatic compatibility migration

No worksheet migration or source rewrite is required. At ingestion:

- blank account values map to `Default Account`;
- account case and whitespace variants consolidate under one canonical ID;
- legacy holdings/positions arrays are wrapped in a documented default
  `InvestmentAccount`; and
- legacy `marketValue` retains its household-base-currency meaning.

Existing Portfolio Snapshot, Portfolio Engine Summary, Portfolio Performance,
Portfolio Valuation, Portfolio State, and exposure output worksheet schemas are
preserved.

## Caller actions

- New direct `InvestmentAccount` callers must provide `accountId`, `name`,
  `type`, `currency`, and `holdings` explicitly.
- New ingestion integrations should supply a canonical security identifier
  where available and may continue to supply ticker as fallback.
- Inputs with explicit market-value or price currency must use the household
  base currency. Perform governed FX conversion upstream before calling the
  aggregation engine.
- Consumers needing total value, allocation, concentration, or duplicates must
  call `foAggregateHouseholdPortfolio()` once and pass that result to
  projections such as `foBuildUnifiedPortfolioIntelligence()` and
  `foAnalyzeDuplicateExposure()`.

## Rollback

Before merge, abandon or revert the RC2 commits on the feature branch. After a
future merge, use a reviewed Git revert and rerun repository, Apps Script Lab,
and workbook checks. No data restoration is expected because RC2 adds no
persisted source and performs no worksheet schema migration.
