# PRODUCTION CERTIFICATION BASELINE — CERT-RUN-20260808-214555

## Why this file exists
The `Production Certification` and `Production Certification Details` tabs on the
production Portfolio Dashboard are written by `foWriteProductionCertification_`,
which calls `clearContents()` before writing. Both tabs therefore retain **only the
most recent certification run** — there is no history.

At the time of capture the tabs held exactly one run, `CERT-RUN-20260808-214555`.
That run is expected to be overwritten by a future certification (either a
standalone `foRunProductionCertification()` or an orchestrator-embedded
`foRunProductionCertificationWave311()`), which is required to clear the v3.4.0
platform-version mismatch currently blocking the Weekly report's LINEAGE and
PERIOD validation controls.

This file is a verbatim snapshot taken **before** any such overwrite, so the
baseline survives.

- Captured: 2026-08-12, read-only, from the live production Portfolio Dashboard
  (`13jHJ0N1Gzbia7B4FIHkdTqf2tCp1tkXSFicQ2ti8M1w`)
- Source tabs: `Production Certification`, `Production Certification Details`
- No data was modified during capture.

## Provenance of this run
This baseline was produced by the **orchestrator-embedded** engine
(`foRunProductionCertificationWave311`), not the standalone
`foRunProductionCertification`. Evidence, from row 15 below:

- Status vocabulary is `PASS WITH OBSERVATIONS`, which only
  `foBuildCertificationSummaryWave311_` emits; the standalone summary builder
  emits `WARN`.
- The control is named `Current Orchestrator Run` (Wave311's validator), not
  `Latest Orchestrator Run` (the standalone validator).
- It evaluated `CIO-RUN-20260808-214358` **"directly"** with 24 in-memory steps —
  Wave311's in-flight branch, only reachable when called from within an
  orchestrator run.

The corresponding orchestrator execution was `foRunAutonomousCioOrchestratorSmokeTest`
on 2026-08-08 at 9:43:55 PM (127.264 s, Completed). That smoke test calls the real
`foRunAutonomousCioOrchestrator()`, so it was a genuine full run, not a reduced-scope test.

A standalone certification run would **not** reproduce this row: with no active
orchestrator run it takes its fallback branch and evaluates the last *historical*
run from the log instead of in-memory steps.

## Summary tab — `Production Certification`

| Certification Run ID | Timestamp | Certification Status | Passed | Warning | Failed | Platform Version | Baseline |
|---|---|---|---|---|---|---|---|
| CERT-RUN-20260808-214555 | 2026-08-08 | CERTIFIED WITH OBSERVATIONS | 14 | 1 | 0 | v3.4.0 | CB-002 |

Verbatim CSV:

```csv
"Certification Run ID","Timestamp","Certification Status","Passed Controls","Warning Controls","Failed Controls","Platform Version","Baseline"
"CERT-RUN-20260808-214555","2026-08-08","CERTIFIED WITH OBSERVATIONS","14","1","0","v3.4.0","CB-002"
```

## Details tab — `Production Certification Details` (15 rows)

All 15 rows share Run ID `CERT-RUN-20260808-214555`, Timestamp `2026-08-08`,
Platform Version `v3.4.0`, Baseline `CB-002`.

| # | Category | Control | Status | Details |
|---|---|---|---|---|
| 1 | SCHEMA | Capital Deployment History | PASS | Schema valid |
| 2 | SCHEMA | Capital Deployment Priorities | PASS | Schema valid |
| 3 | SCHEMA | Portfolio Scenarios | PASS | Schema valid |
| 4 | SCHEMA | Portfolio Scenario Summary | PASS | Schema valid |
| 5 | SCHEMA | Risk Budget Assessment | PASS | Schema valid |
| 6 | SCHEMA | Risk Budget Summary | PASS | Schema valid |
| 7 | SCHEMA | Portfolio Materiality | PASS | Schema valid |
| 8 | SCHEMA | Investment Decision Support | PASS | Schema valid |
| 9 | SCHEMA | Buy Zone Intelligence | PASS | Schema valid |
| 10 | DATA | Buy Zone Intelligence prices | PASS | Price integrity valid |
| 11 | DATA | Investment Decision Support prices | PASS | Price integrity valid |
| 12 | DATA | Capital Deployment Priorities prices | PASS | Price integrity valid |
| 13 | AUDIT | Capital Deployment History | PASS | History schema, directive and lineage valid |
| 14 | CONTROL | Capital Deployment Contract | PASS | Deployment directive is consistent with candidate state |
| 15 | ORCHESTRATION | Current Orchestrator Run | PASS WITH OBSERVATIONS | Run CIO-RUN-20260808-214358 evaluated directly with 24 completed step(s); execution status SUCCESS; observations: 2 [Data Validation, IBKR Reconciliation] |

Verbatim CSV:

```csv
"Certification Run ID","Category","Control","Status","Details","Timestamp","Platform Version","Baseline"
"CERT-RUN-20260808-214555","SCHEMA","Capital Deployment History","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Capital Deployment Priorities","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Portfolio Scenarios","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Portfolio Scenario Summary","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Risk Budget Assessment","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Risk Budget Summary","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Portfolio Materiality","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Investment Decision Support","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","SCHEMA","Buy Zone Intelligence","PASS","Schema valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","DATA","Buy Zone Intelligence prices","PASS","Price integrity valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","DATA","Investment Decision Support prices","PASS","Price integrity valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","DATA","Capital Deployment Priorities prices","PASS","Price integrity valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","AUDIT","Capital Deployment History","PASS","History schema, directive and lineage valid","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","CONTROL","Capital Deployment Contract","PASS","Deployment directive is consistent with candidate state","2026-08-08","v3.4.0","CB-002"
"CERT-RUN-20260808-214555","ORCHESTRATION","Current Orchestrator Run","PASS WITH OBSERVATIONS","Run CIO-RUN-20260808-214358 evaluated directly with 24 completed step(s); execution status SUCCESS; observations: 2 [Data Validation, IBKR Reconciliation]","2026-08-08","v3.4.0","CB-002"
```

## Reconciliation
14 PASS + 1 PASS WITH OBSERVATIONS = 15 controls, matching the summary row's
14 passed / 1 warning / 0 failed.

## Notable
The only non-PASS signal across the entire certification is row 15's two embedded
observations: **Data Validation** and **IBKR Reconciliation**. `foRunIbkrReconciliation`
had not executed in the visible 7-day execution window as of 2026-08-11.

## Related records
- `docs/recovery/OPERATIONAL-DATA-RECOVERY-2026-08-10.md`
- `docs/incidents/LAB-ISOLATION-MISCONFIGURATION-2026-08-09.md`
- `docs/incidents/GOVERNANCE-GAP-2026-08-08.md`
- `docs/incidents/CHATGPT-DELIVERY-METADATA-FABRICATION-2026-08-10.md`
