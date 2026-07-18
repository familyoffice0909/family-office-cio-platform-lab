# Release 2.1.0 RC3 Compatibility Guide

## Scope

RC3 remediates only the remaining PR #8 architecture-review blockers identified
at RC2 commit `3d18546`. It preserves the inherited `v1.3.0` workbook
architecture, source-of-truth boundary, public entry points, worksheet schemas,
orchestration order, authorization scopes, triggers, investment policy, and
execution authority.

## Release lineage

The traceable repository ancestry is:

1. production source release `v1.3.0` at `659ad79`;
2. Engineering Lab governance/registry baseline `r1.3.1.1` on
   `origin/develop`;
3. Release 2.1.0 RC1 at commits `0de3968` through `a0147a5`;
4. Release 2.1.0 RC2 at `3d18546`; and
5. draft Release 2.1.0 RC3 on PR #8, targeting `origin/develop`.

`CB-002` remains the configuration baseline. Human architecture review, Lab
certification, merge, tagging, deployment, and production promotion remain
pending.

## Compatibility behavior

No worksheet migration or source rewrite is required. At ingestion:

- blank and legacy `Unknown` accounts map to `Default Account`;
- custom account case and whitespace variants map to one uppercase canonical
  name and ID;
- an empty portfolio produces `accountCount = 0`;
- explicit `valuationCurrency` is preserved and must equal household base
  currency before aggregation; no conversion or overwrite occurs;
- security matching prefers canonical identifiers, then exchange plus ticker,
  then ticker-only fallback; and
- ambiguous ticker-only rows remain separate instead of being merged.

The Household Aggregation Engine is the only duplicate-classification
authority. Portfolio Data Integrity consumes its same-account and cross-account
sets. Existing Portfolio Snapshot, Portfolio Engine Summary, Portfolio Data
Integrity, Portfolio Performance, Portfolio Valuation, Portfolio State, and
exposure worksheet schemas are unchanged.

The Portfolio Snapshot public result retains full in-process detail. The
Autonomous CIO Step Log stores only portfolio value, account count, largest
exposure, duplicate counts, and a compact risk summary for that step. Step Log
messages are deterministically limited to 12,000 characters.

## Caller actions

- Supply canonical security identifiers whenever available.
- When canonical identifiers are unavailable, supply `exchange` or
  `primaryExchange` with ticker.
- Supply explicit valuation/price currency when known. Convert upstream under
  governed FX controls before calling aggregation.
- Consume `foAggregateHouseholdPortfolio()` output for totals, allocations,
  concentration, and duplicate classification; do not regroup independently.

## Rollback

Before merge, abandon or revert the RC3 commits on the feature branch. After a
future merge, use a reviewed Git revert and rerun repository, Apps Script Lab,
and workbook checks. No data restoration is expected because RC3 changes no
persisted schema.
