# Release 2.1.0 RC2 — Multi-Account Portfolio Intelligence Core

- **Owner:** Portfolio Domain Owner
- **Change classification:** Standard governed additive remediation
- **Status:** RC2 implemented; independent review and Lab validation pending
- **Version metadata:** `v2.1.0-rc.2` / `CB-002`
- **Target:** draft PR #8 into `origin/develop`
- **Release authority:** Human architecture review, certification, merge, tag, deployment, and production promotion remain pending

## Objective, scope, and non-goals

RC2 resolves the Architecture Review blockers found in the first Release 2.1.0
candidate while preserving the accepted Release 2.0-era workbook architecture
and all existing public entry points and worksheet schemas. It introduces no
new product capability, persistent source, worksheet, dependency, network
integration, scope, trigger, investment threshold, trading rule, or execution
authority.

The remediation establishes one household aggregation authority, an explicit
base-currency market-value contract, canonical account/security identities,
defined duplicate semantics, strict domain construction, release lineage, and
regression coverage.

## Architecture and ownership

The [Family Office Portfolio Dashboard remains authoritative](../architecture/ARCHITECTURE-OWNERSHIP-POLICY.md)
for operational holdings and portfolio state. `MultiAccountPortfolioCore.js`
provides in-memory objects and calculations for one Apps Script execution. The
domain `AccountRegistry` remains separate from the platform
[Registry Authority](../architecture/R1.3.1.1-REGISTRY-AUTHORITY.md).

`foAggregateHouseholdPortfolio()` is now the single source for household total
market value, account/sector/country/currency/asset-class exposure, security
concentration, and duplicate classification. Unified Portfolio Intelligence,
Duplicate Exposure Analysis, Portfolio Engine Summary, Portfolio Performance,
Portfolio Valuation, Portfolio State, and Portfolio Exposure Attribution
consume its immutable output, as do the existing attribution, coverage, risk,
legacy-state, and executive-reporting calculations that require household
totals or exposure. Projections retain prior result and worksheet shapes. See
the canonical
[API contract](PORTFOLIO-AGGREGATION-API.md).

This remains a compatible implementation within the accepted Portfolio domain
and does not meet an ADR trigger: no authority, workbook boundary, public
worksheet schema, orchestration/failure semantics, authorization scope,
investment rule, or platform pattern is replaced. Human architecture review is
still required before release closure.

## Market-value contract

RC2 adopts Option A: all `marketValue` values are household-base-currency
amounts before aggregation. Native holding `currency` remains descriptive.
Explicit valuation/price currency metadata must match the household base
currency or construction fails. Legacy `marketValue` without separate unit
metadata retains the established Portfolio Master base-currency meaning.
Governed FX conversion, when needed, occurs upstream; the aggregation engine
does not convert or silently mix currencies.

## Domain and identity contracts

Direct `InvestmentAccount` construction requires ID, name, type, currency, and
holdings. Only the legacy ingestion adapter supplies documented defaults.
Returned accounts, holdings, household portfolios, and aggregation results are
immutable; registry reads remain defensive.

Account identity is normalized at ingestion. Blank values become
`DEFAULT-ACCOUNT` / `Default Account`, as does the legacy `Unknown` placeholder;
known account names are matched without case or surrounding-whitespace
sensitivity. Consumers use canonical IDs/names, not raw worksheet values.

Security identity precedence is canonical security ID, security ID, ISIN,
CUSIP, SEDOL, then uppercase ticker fallback. Identity source remains visible
in output. Different ticker labels with the same canonical ID aggregate; the
same ticker with different canonical IDs does not.

## Duplicate rules

- Cross-account duplicates share a canonical security identity across two or
  more canonical account IDs.
- Same-account duplicates share a canonical security identity across two or
  more holding rows within one canonical account.
- Matching rows aggregate market value, cost basis, holding count, and account
  membership before classification.
- Duplicate results are descriptive and add no warning, breach, or trading
  policy.

The existing `duplicateHoldings` projection remains a cross-account alias;
explicit cross-account, same-account, and all-duplicate collections are
additive.

## Backward compatibility and migration

Legacy single-account holdings are wrapped automatically in the documented
default account. Mixed named/blank Portfolio Master rows are normalized at
read time without rewriting the source worksheet. Existing Portfolio Snapshot,
Portfolio Engine Summary, Portfolio Performance, Portfolio Valuation,
Portfolio State, and Portfolio Exposure Attribution worksheet schemas are
unchanged. Existing public result fields remain; RC2 additions are additive.

See the [RC2 migration guide](MIGRATION-2.1.0-RC2.md).

## Release lineage

The repository contains no Release 2.0 tag or certified baseline. RC2 records
the actual ancestry instead of inventing one:

1. production release `v1.3.0` (`659ad79`);
2. Engineering Lab governance/registry lineage through `r1.3.1.1` on
   `origin/develop`; and
3. draft candidate `v2.1.0-rc.2` on PR #8.

`CB-002` remains the configuration baseline. No RC2 tag is created while the
pull request is draft.

## Validation plan and evidence boundary

Required repository checks are `npm ci`, `npm test`, `npm run lint`,
`npm run validate`, `npm run smoke:inventory`, `git diff --check`, Apps Script
source/status validation, and synthetic workbook regression tests. Coverage
includes empty portfolios, mixed native currencies, explicit currency
mismatches, account case/whitespace/default normalization, same- and
cross-account duplicates, security-ID precedence, exposure reconciliation,
large households, existing worksheet shapes, and deterministic smoke entry
points.

Local Node/Jest/static checks do not constitute Apps Script Lab execution,
live workbook inspection, CI, certification, or release approval. The Release
Validator must run `foRunMultiAccountPortfolioCoreSmokeTest()`, the affected
portfolio smoke tests, and workbook inspection in the designated Lab against
the exact reviewed commit before the draft may advance.

## Operational impact, risks, and rollback

No new network call, scope, trigger, worksheet, or storage is introduced.
Runtime work remains linear in the number of holdings plus deterministic group
sorting. The principal remaining risk is unobserved behavior in the designated
Apps Script Lab/workbook until human-controlled runtime validation occurs.

Before merge, rollback is a reviewed revert or abandonment of the RC2 branch.
After a future merge, use a reviewed Git revert, redeploy the last approved
commit under the Release Policy, and rerun portfolio/platform checks. No
worksheet restoration is expected because RC2 changes no persisted schema.
