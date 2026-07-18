# Release 2.1.0 — Multi-Account Portfolio Intelligence Core

- **Owner:** Portfolio Domain Owner
- **Change classification:** Standard governed additive runtime change
- **Status:** Feature implementation complete; review and Lab validation pending
- **Target:** `origin/develop`
- **Release authority:** Human review, certification, merge, tag, deployment, and production promotion remain pending

## Objective and scope

Release 2.1.0 adds a deterministic multi-account portfolio intelligence core
without changing the platform's authoritative workbook, orchestration order,
investment policy, risk thresholds, or execution authority.

The release includes:

- `InvestmentAccount`, `AccountType`, `Holdings`, and `HouseholdPortfolio` domain contracts;
- an in-memory `AccountRegistry` with `addAccount()`, `removeAccount()`,
  `updateHoldings()`, `refreshMarketValues()`, and `getAccounts()`;
- household aggregation across every account for sector, country, currency,
  asset class, and largest security exposure;
- duplicate holdings plus descriptive sector, currency, and security
  concentration views; and
- automatic migration of legacy single-account holdings and blank account
  values to `Default Account`.

## Architecture and ownership

The [Family Office Portfolio Dashboard remains authoritative](../architecture/ARCHITECTURE-OWNERSHIP-POLICY.md)
for operational holdings and portfolio state. `MultiAccountPortfolioCore.js`
provides in-memory domain objects and calculations for one Apps Script
execution. It adds no worksheet, database, external source, authorization
scope, dependency, trigger, or cross-workbook access.

The domain `AccountRegistry` is not the platform
[Registry Authority](../architecture/R1.3.1.1-REGISTRY-AUTHORITY.md). It owns a
bounded collection of investment accounts supplied by the existing portfolio
source during computation; it does not register platform components or persist
business state.

This is a compatible implementation inside the accepted Portfolio domain and
does not meet an ADR trigger in the
[Architecture Principles](../engineering/ARCHITECTURE_PRINCIPLES.md): no source
of truth, workbook boundary, public worksheet schema, orchestration failure
semantics, investment rule, authorization scope, or platform pattern is
replaced. Human architecture review is still required before release closure.

## Domain contracts

### AccountType

`AccountType` is an immutable enumeration covering `DEFAULT`, `TFSA`, `RRSP`,
`LIRA`, `RESP`, `FHSA`, `TAXABLE`, `CORPORATE`, `TRUST`, `CASH`, and `OTHER`.
Unsupported values fail closed. Account names that do not exactly identify a
governed type remain `OTHER`; the implementation does not infer tax or legal
status.

### Holdings

Each holding has a case-normalized `securityId` and `ticker`, descriptive name,
quantity, current price, market value, sector, country, currency, and asset
class. `securityId` falls back to ticker. Missing dimensions become `Unknown`.
Market value uses an explicit value when supplied, otherwise quantity multiplied
by current price, otherwise zero. Non-finite or negative numeric values fail
closed.

### InvestmentAccount and HouseholdPortfolio

An investment account requires a unique account ID, name, account type,
currency, and holdings collection. A household portfolio contains a
case-insensitively unique account collection and a base currency. Returned
domain objects and holding records are immutable; registry discovery returns a
defensive account array.

## Registry behavior

- `addAccount()` rejects duplicate account IDs.
- `removeAccount()` and `updateHoldings()` reject unknown accounts.
- `updateHoldings()` replaces one account's complete holdings collection after
  validation.
- `refreshMarketValues()` accepts a caller-supplied price function or map,
  validates every supplied price, and atomically replaces account snapshots.
  Missing prices retain their prior values.
- `getAccounts()` returns a defensive array whose mutation cannot change the
  registry.

The registry is intentionally in-memory. Persistence continues to flow through
the existing governed portfolio source and spreadsheet services.

## Unified intelligence and duplicate exposure

All allocations are market-value weighted and sorted deterministically by
descending market value, then name. Largest holdings aggregate the same
`securityId` across accounts. Duplicate holdings require exposure to the same
security in more than one distinct account.

Sector, currency, and security concentration outputs are descriptive ranked
exposures with market value and portfolio weight. Release 2.1.0 deliberately
does not add warning or breach thresholds because investment and risk policy is
outside this release's approved scope.

## Backward compatibility and migration

Legacy inputs that contain a holdings or positions array without an accounts
collection are wrapped automatically in:

- account ID: `DEFAULT-ACCOUNT`;
- account name: `Default Account`; and
- account type: `DEFAULT`.

When Portfolio Master contains a mixture of named and blank accounts, blank
rows map to `Default Account` and named rows retain their account grouping.
Migration is a read-time compatibility adapter and does not rewrite the source
worksheet.

`foBuildPortfolioSnapshot()` retains its existing public entry point,
20-column Portfolio Snapshot worksheet contract, summary write, and
orchestration position. Its returned result adds `accountCount`,
`intelligence`, and `duplicateExposure`; existing result fields are unchanged.

## Validation plan and observed local evidence

The feature branch must pass:

- `npm test` — deterministic domain, registry, aggregation, duplicate,
  negative-input, refresh, migration, and PortfolioEngine compatibility tests;
- `npm run validate` — manifest, required-file, duplicate-global, module,
  version, direct-workbook-access, secret, and smoke-function checks;
- `npm run lint` — repository lint rules; and
- `npm run smoke:inventory` — source inventory including
  `foRunMultiAccountPortfolioCoreSmokeTest()`.

Observed local development validation on 2026-07-18:

- `npm test` — PASS, 4 suites and 43 tests;
- `npm run validate` — PASS, 71 JavaScript files, 648 global functions, 44
  smoke-test functions, zero warnings, and zero errors;
- `npm run lint` — PASS;
- `npm run smoke:inventory` — PASS, 44 source entry points; and
- local-link validation — PASS for all five changed documentation files.

The smoke function has deterministic unit coverage, but source inventory and
Node execution are not Apps Script runtime evidence. After independent review
and integration, the Release Validator must run the core and Portfolio Engine
smoke tests in the designated Lab Apps Script project, inspect the affected Lab
Portfolio Snapshot output, verify blank-account compatibility, confirm no
unintended writes, and record the exact commit and environment.

## Operational impact, limitations, and rollback

- No new network call, authorization scope, trigger, worksheet, or persistent
  storage is introduced.
- Market-value refresh requires caller-supplied prices; direct broker or market
  data ingestion is not added.
- Missing country and other dimensions remain visible as `Unknown` rather than
  being inferred.
- Calculations are descriptive and advisory; no trade or allocation action is
  authorized.

Before merge, rollback is branch deletion or abandoning the pull request.
After merge but before production promotion, use a reviewed Git revert of the
Release 2.1.0 commits. If promoted later, follow the
[Release Policy rollback process](../engineering/RELEASE_POLICY.md#rollback-and-forward-recovery),
redeploy the last approved production commit, and rerun the governed portfolio
and platform checks. No worksheet restoration is expected because this release
does not add or migrate persisted source data.
