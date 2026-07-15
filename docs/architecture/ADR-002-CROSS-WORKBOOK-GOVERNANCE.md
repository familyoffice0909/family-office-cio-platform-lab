# ADR-002 — Cross-Workbook Governance and Recommendation Event Contract

## Decision

The Family Office Portfolio Dashboard owns current operational portfolio state,
analytics, risk, recommendations, deployment, reporting and certification.

The Family Office Investment Ledger owns immutable recommendation events,
outcomes, decision impact, confidence calibration, lessons learned and playbooks.

Dashboard `Recommendation Ledger` is the operational current-state source.
Investment Ledger `Recommendations` is the immutable event archive. Every event
requires a unique immutable `Event ID`.

The central architecture controls remain hosted in the Dashboard but govern both
workbooks. Every worksheet in both workbooks must be registered and owned.

Dashboard, Ledger and Apps Script use `America/Toronto`.

Production Baseline must record the actual merged commit and published release
tag. `PENDING RELEASE` is not a closed-state value.
