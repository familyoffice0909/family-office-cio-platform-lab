# Smoke-Test Reporting

## Purpose

Smoke tests prove that critical modules can execute together without fatal errors and can read or write their expected platform outputs.

## Minimum release smoke tests

- `foBootstrap`
- `foRunPlatformHealthCheck`
- `foRunPlatformIntegrityCheck`
- `foRunModularSmokeTest`
- Relevant engine-specific smoke test
- `foRunAutonomousCioOrchestratorSmokeTest` before autonomous-operation releases

## Evidence to capture

- Function name
- Execution timestamp
- Execution status
- Duration
- Platform version
- Baseline
- Output sheets affected
- PASS, PASS WITH WARNINGS, or FAIL
- Error details and rollback action

## CI inventory

The CI pipeline generates a `smoke-test-summary.md` artifact containing all discovered global functions whose names include `SmokeTest`. This inventory does not replace execution inside Apps Script; it confirms that expected test entry points are present in source control.
