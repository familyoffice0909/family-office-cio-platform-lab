# G CLOSURE RECORD — Operational Data Recovery / v3.4.4

## Release identity
- Tag: v3.4.4
- Production main SHA: 5f2491ac3a5f7081bd2b32f2f77e2fef2e0067bd
- Production Apps Script: 17C0pZa79v4cJkGFpw3QBYe2PHPlNMfsgJpwwTv2Z65RUxd_wYhY2zsJi

## Verification performed
Independent, not inherited from ChatGPT's G.4-G.9 claims:
- production/main HEAD, PR #79 merge state, tag target, .clasp.json
  integrity all independently confirmed via git/gh.
- Live production Apps Script source pulled directly (clasp pull) and
  byte-compared against production/main.
- Lab repo (develop and main, both local and origin) independently
  confirmed to contain commit 779966c, byte-identical to production/main
  on both fixed files. npm test: 17/17 suites, 215/215 tests, clean
  tree. This closes the same class of gap that caused the v3.4.1-v3.4.3
  incident - production and the recorded git state are NOT diverged
  this time, on either repo.

## Recovery execution (this session, production, real data)
1. `foRunMarketDataRefresh` - completed cleanly. QBTS resolved
   NASDAQ:QBTS / PRICE_FOUND / $20.16 at this step (see final state
   below for the closing value, which differs due to a later re-run).
   8/8 tickers resolved.
2. `foRunPortfolioDataSynchronization` - completed cleanly, zero errors.
   All 9 Price Timestamps advanced from stale (7 at 2026-07-29, ~12
   days; 2 at 2026-08-08) to current (2026-08-10). 21/21 reconciliation
   checks PASS (3 source-availability + 18 per-ticker quantity/cost-basis),
   zero variance. Lab's earlier Interactive Brokers reconciliation FAIL
   confirmed environmental (Lab lacked that source tab; production has
   one with real data) - not a code defect.
3. `foRunMarketDataRefresh` (re-run) - restored live prices for
   QBTS/RGTI, which step 2's sync had reverted to a stale 2026-07-07
   IBKR snapshot. Confirmed this second refresh does not affect
   Price Timestamp.

## Final production state (verified, not assumed)
All 9 positions: Price Timestamp = 2026-08-10, Price Source preserved
correctly per position. Current Price = live market data for all 9.
Closing values as of the final (second) refresh: QBTS $20.19, RGTI
$17.76 - these are the numbers that persist; step 1's $20.16/$17.81
were superseded by step 3 and should not be read as the end state.

Decision Price Freshness Coverage: NOT YET RE-MEASURED - requires a
fresh Weekly report run through the governed A233/A240 pipeline,
deliberately not triggered as part of this data-recovery step.

## QNC / concentration / risk classification
NOT recomputed. Per explicit governance rule, the authoritative
re-decision is a separate, deliberate next step.

## New finding, out of scope for v3.4.4, needs its own initiative — elevated priority
Refresh/sync ordering dependency. `foRunPortfolioDataSynchronization`
overwrites Current Price from Interactive Brokers' static source-tab
snapshot (dated 2026-07-07), silently reverting any live price
`foRunMarketDataRefresh` had just written - while still advancing
Price Timestamp. If sync runs after refresh (the wrong order),
QBTS/RGTI show a FRESH timestamp against a STALE price.

This is currently unguarded in production - nothing prevents a future
manual or scheduled sync from re-triggering it. Because Price Timestamp
is the freshness signal `ExecutiveDecisionIntegrationA233.js` reads to
gate capital deployment (traced in Phase B of this initiative), an
ordering violation could feed the decision engine a false-fresh signal
on genuinely stale data. This makes the ordering fix a precondition
for trusting the upcoming A233 re-decision, not merely a lower-priority
cleanup item - recommend sequencing it ahead of, or at minimum
alongside, the A233 re-decision rather than treating it as fully
independent follow-up work.

## Pre-existing, confirmed unrelated (from F, reconfirmed during G)
Lab's Interactive Brokers reconciliation FAIL was environmental, not a
code defect. The required:false declaration mismatch (a source declared
optional still causing a hard reconciliation failure when absent) may
still merit review as a separate, minor item.

## Housekeeping still open
1. 3 orphaned Lab-only scratch scripts remain on the Lab v2 Apps
   Script project (IsolatedFixTest.gs, LabSyncSourceSetup.gs,
   LabAddQbtsRow.gs) - manual deletion, not blocking.
2. A local scratch clone of production source remains at
   `.../scratchpad/prod-verify/` on this machine - session-local,
   harmless.
3. Branch `fix/price-timestamp-freshness` (779966c) is now fully merged
   and superseded on origin - stale, safe to delete.

## Status
G CLOSED. v3.4.4 certified in production, verified independently on
both repos, operational data recovery complete for all 9 positions.

## Next, deliberately not started tonight
A233 re-decision / Weekly report regeneration - the first step in
this whole initiative whose output could change a capital-allocation
signal rather than just a data field, running on freshly-recovered
inputs never before exercised through that pipeline. Recommend a
fresh session with an explicit before/after comparison on QNC's
classification, portfolio risk, and capital deployment authorization -
and recommend the ordering-dependency fix be scoped into or ahead of
that same session, given the finding above.
