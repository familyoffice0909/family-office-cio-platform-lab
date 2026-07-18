# CIO Philosophy

## Purpose

This document states the decision philosophy that engineering must preserve. It is not an investment mandate, an allocation policy, or authorization to trade. Actual investment objectives, limits, and decisions belong to the CIO and their governed policy records.

## Decision-support posture

The platform exists to improve the quality, consistency, explainability, and auditability of family-office decisions. It should help the CIO see portfolio state, risk, evidence, alternatives, contradictions, readiness, and change over time. It must not manufacture confidence or convert analytical output into discretionary execution authority.

## Principles

1. **Capital stewardship comes first.** Protect against permanent loss, operational error, data failure, and unexamined concentration before optimizing convenience or automation.
2. **Decisions require context.** A score or recommendation is incomplete without drivers, evidence, time horizon, portfolio role, constraints, confidence, trigger, and invalidation condition.
3. **Risk and return are portfolio concepts.** Position analysis must be reconciled with concentration, exposure, liquidity, currency, data quality, and total-portfolio consequences.
4. **Uncertainty must be visible.** Missing cost basis, stale prices, incomplete attribution, model limitations, and conflicting signals reduce readiness; they never become silent zeros or positive evidence.
5. **Current state and learning history are distinct.** The Portfolio Dashboard owns actionable current state. The Investment Ledger preserves immutable events, outcomes, calibration, lessons, and playbooks.
6. **Holdings and opportunities are distinct.** Current portfolio decisions must not be conflated with external watchlist opportunities or assumed capital availability.
7. **Material change earns attention.** The platform should distinguish meaningful deterioration or improvement from noise and suppress duplicate unchanged events.
8. **Explainability precedes automation.** The CIO must be able to understand why, why now, what changed, what contradicts the view, and what would invalidate it.
9. **Advice is not execution.** Recommendations and action cards are governed decision support. Trade approval and execution remain human-controlled unless a separate, explicit fiduciary and architecture decision establishes otherwise.
10. **Learning must be honest.** Outcome analysis should preserve the original decision context, avoid hindsight rewriting, and improve calibration and playbooks over time.

## Engineering implications

- Use deterministic, versioned, bounded calculations and preserve source/run lineage.
- Surface readiness and coverage next to analytical outputs.
- Treat missing or invalid data conservatively, consistent with accepted domain ADRs.
- Prevent independent reporting layers from issuing contradictory posture, execution status, or capital-deployment recommendations.
- Preserve immutable decision-event identifiers and history while allowing current state to evolve.
- Require human approval for investment-policy, scoring-meaning, threshold, risk-limit, and execution-authority changes.
- Test controlled improvement, deterioration, restoration, stability, and duplicate suppression for material decision intelligence.
- Keep production scenarios reversible and restore controlled inputs to the approved baseline after validation.

## Authority boundary

Engineering owns the faithful, secure, reliable implementation of approved policy. Engineering may challenge ambiguity, unsafe behavior, insufficient evidence, and contradictory requirements. Engineering does not select investment objectives or silently encode an investment judgment. AI collaborators inherit the same boundary.

The current risk scoring decision remains governed by [ADR-003](../risk/ADR-003-POSITION-PORTFOLIO-RISK-SCORING.md), and current cross-workbook decision history remains governed by [ADR-002](../architecture/ADR-002-CROSS-WORKBOOK-GOVERNANCE.md).
