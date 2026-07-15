# ADR-001 — Production Architecture and Workbook Boundaries

## Status

Accepted for A2.1.6.

## Decision

The Family Office CIO Platform uses four governed layers:

1. **GitHub repository** — authoritative source code, documentation, change
   history, tags and releases.
2. **Family Office Portfolio Dashboard** — authoritative operational CIO
   platform for portfolio state, market data, valuation, risk, investment
   decisions, capital deployment, reporting, orchestration and certification.
3. **Family Office Investment Ledger** — supporting governance and learning
   repository for outcomes, decision impact, confidence calibration, lessons
   learned and investment playbooks.
4. **External account/broker sources** — authoritative raw holdings and
   transaction evidence before ingestion.

## Source-of-truth rules

- No new production dependency may target a worksheet classified as Legacy.
- Formula/prototype tabs may not supersede script-owned production outputs
  without a new ADR.
- Apps Script dependency lineage is maintained in code and exposed through the
  Architecture Dependencies worksheet.
- Schema changes require a versioned wave and regression validation.
- Future changes are additive by default. Breaking changes require a new
  architecture version and ADR.
- GitHub releases are historical records and must not be deleted merely because
  certification occurred later.

## Workbook boundaries

### Portfolio Dashboard owns

Portfolio Master, market data, valuation, exposure, risk, CIO decisions,
materiality, capital deployment, executive reporting, orchestration and
production certification.

### Investment Ledger owns

Outcome analysis, decision impact, confidence calibration, lessons learned,
investment playbooks and long-term knowledge feedback.

The Investment Ledger is not the portfolio holdings or transaction book of
record unless a later ADR explicitly changes that boundary.

## Consequences

- A2.2 builds only on production/source-of-truth components.
- Legacy tabs remain available for audit during stabilization but receive no
  new dependencies.
- Workbook timezone should be standardized to America/Toronto in a controlled
  configuration change.
