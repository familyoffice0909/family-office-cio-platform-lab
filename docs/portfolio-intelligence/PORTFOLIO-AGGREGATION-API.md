# Household Portfolio Aggregation API Contract

- **Owner:** Portfolio Domain Owner
- **Contract version:** `HOUSEHOLD_PORTFOLIO_AGGREGATION_V1`
- **Introduced by:** Release 2.1.0 RC2
- **Compatibility:** Governed additive extension; Release 2.0 worksheet and public entry-point contracts are unchanged

## Canonical authority

`foAggregateHouseholdPortfolio()` is the only household portfolio aggregation
authority. It owns total market value, account/sector/country/currency/asset-class
allocation, security exposure, concentration rollups, and duplicate
classification. Consumers may project or format its immutable output but must
not independently regroup or re-sum market values.

Current consumers are Unified Portfolio Intelligence, Duplicate Exposure
Analysis, Portfolio Engine Summary, Portfolio Performance, Portfolio Valuation,
Portfolio State (including its legacy ingestion adapter), Portfolio Exposure
Attribution, Portfolio Attribution/Coverage, Position/Portfolio Risk, and
Executive Reporting. Future recommendation engines must consume this contract
when they need household exposure.

## Units and currency

The market-value contract is `HOUSEHOLD_BASE_CURRENCY`:

- every `marketValue` and every price used to derive it is already expressed in
  `HouseholdPortfolio.baseCurrency`;
- `currency` on a holding is its native/descriptive security currency and does
  not change the unit of `marketValue`;
- `marketValueCurrency`, `valuationCurrency`, `currentPriceCurrency`, or
  `priceCurrency`, when supplied, must equal the household base currency;
- `marketValueCAD` explicitly means CAD and is rejected in a non-CAD household;
- a legacy `marketValue` without a separate unit retains the established
  Portfolio Master meaning: household-base-currency value; and
- inconsistent explicit units fail before aggregation. No FX conversion or
  silent CAD/USD addition occurs in this engine.

Caller-supplied prices used by `refreshMarketValues()` follow the same rule.
They may be a number (base-currency by contract) or an object containing a
price and explicit currency. An explicit mismatch is rejected.

## Domain inputs

Direct `InvestmentAccount` construction requires all five fields:

| Field | Rule |
|---|---|
| `accountId` | Non-blank; trimmed, uppercased, and separator-normalized |
| `name` | Non-blank; surrounding/internal whitespace normalized |
| `type` | Required member of `AccountType` |
| `currency` | Required three-letter reporting currency |
| `holdings` | Required `Holdings` instance or array; an empty array is valid |

Defaults are supplied only by the compatibility ingestion adapter. Blank
legacy account values become ID `DEFAULT-ACCOUNT`, name `Default Account`, type
`DEFAULT`, currency equal to household base currency, and holdings equal to the
legacy rows. `HouseholdPortfolio.baseCurrency` defaults to CAD for compatibility.

## Account normalization

`foCreateHouseholdPortfolioFromPositions()` is the ingestion boundary. It
trims and collapses whitespace, matches known account types case-insensitively,
creates a canonical account ID, and maps blanks and the legacy `Unknown`
placeholder to `Default Account` before any engine calculation. Thus `TFSA`,
`tfsa`, and ` TFSA ` all become
`ACCOUNT-TFSA` / `TFSA`. Consumers use canonical account IDs and names from the
aggregation output, never raw worksheet values.

## Security identity and matching

Security identity precedence is:

1. `canonicalSecurityId`;
2. `securityId`;
3. `isin`;
4. `cusip`;
5. `sedol`; and
6. normalized uppercase ticker/symbol fallback.

Matching is exact after whitespace and case normalization. Governed identifier
fields share an identifier namespace, while ticker fallback has a separate
namespace. Different tickers with the same canonical security ID match;
identical tickers with different canonical IDs do not. Output includes
`securityIdSource` so fallback behavior remains visible.

## Duplicate semantics

- **Cross-account duplicate:** the same canonical security identity appears in
  two or more distinct canonical account IDs.
- **Same-account duplicate:** the same canonical security identity appears in
  two or more holding rows within one canonical account. Separate lots are
  still classified as duplicates descriptively; the engine does not infer an
  error or trading action.
- **Aggregation:** all matching rows are combined for market value, cost basis,
  holding count, and account membership before classification.

`duplicates.crossAccount`, `duplicates.sameAccount`, and `duplicates.all` are
the canonical sets. The compatibility field `duplicateHoldings` remains an
alias for cross-account duplicates.

## Output and reconciliation

The frozen aggregation result contains base/market-value currency, account and
holding counts, total market value and cost basis, normalized positions,
allocations, full security exposure, concentration, and duplicate sets. For
each allocation dimension and for security exposure, the sum of group market
values must equal `totalMarketValue`; weights are zero for an empty/zero-value
portfolio and otherwise reconcile to one subject to JavaScript floating-point
precision.

## Errors and validation

Construction fails for missing account contract fields, duplicate account IDs,
missing security identity, unsupported account types, invalid currency codes,
non-finite or negative quantities/prices/market values, explicit currency
mismatches, and invalid aggregation options. Validation happens before output;
partial results are not returned. Empty portfolios are valid and return zero
totals with empty exposure collections.
