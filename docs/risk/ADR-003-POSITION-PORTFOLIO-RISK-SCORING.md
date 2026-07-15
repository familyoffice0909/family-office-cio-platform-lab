# ADR-003 — Position and Portfolio Risk Scoring

## Status

Accepted for Wave A2.2.

## Decision

A2.2 introduces deterministic, explainable risk scoring based on portfolio weight, data quality, asset classification, sector, currency, speculative-security indicators, and current-price availability.

Portfolio risk aggregates weighted position risk with largest-position, top-five, sector, currency, and data-quality factors.

All scores are bounded from 0 to 100. Missing data increases risk rather than silently increasing confidence. Results are advisory decision support and are not automated trade instructions.

## Risk levels

- LOW: below 35
- MODERATE: 35 to below 55
- HIGH: 55 to below 75
- CRITICAL: 75 and above

## Release target

v1.1.0
