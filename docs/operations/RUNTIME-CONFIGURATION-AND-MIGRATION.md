# Runtime Configuration and Migration

## Purpose

This runbook configures the reduced runtime-safety boundary completed by waves
R1.3.0.2 and R1.3.0.3. It does not deploy code, redesign workbook ownership, or
authorize Production promotion. The Architecture Blueprint and accepted ADR-001
and ADR-002 remain authoritative.

## Runtime contract

Configure these Script Properties in each Apps Script environment:

| Property | Required | Contract |
|---|---|---|
| `FO_ENVIRONMENT` | Always | Exactly `LAB` or `PRODUCTION` |
| `FO_DASHBOARD_SPREADSHEET_ID` | Always | ID of that environment's Family Office Portfolio Dashboard |
| `FO_LEDGER_SPREADSHEET_ID` | Always | ID of that environment's Family Office Investment Ledger; must differ from the Dashboard ID |
| `FO_PRODUCTION_WRITE_ENABLED` | Production writes only | Exactly `TRUE`; omit or use any other value to keep Production writes blocked |

Each governed workbook must also contain two single-cell named ranges:

| Workbook | `FO_RUNTIME_ENVIRONMENT` | `FO_RUNTIME_WORKBOOK_ROLE` |
|---|---|---|
| Lab Dashboard | `LAB` | `DASHBOARD` |
| Lab Ledger | `LAB` | `LEDGER` |
| Production Dashboard | `PRODUCTION` | `DASHBOARD` |
| Production Ledger | `PRODUCTION` | `LEDGER` |

Values are trimmed and compared case-insensitively. Missing ranges, empty
values, a role mismatch, an environment mismatch, malformed IDs, or duplicate
Dashboard/Ledger IDs fail closed. Do not commit workbook IDs or Script Property
exports to Git.

## Authorization behavior

- Read paths validate Script Properties, the opened workbook ID, and the two
  workbook-resident binding sentinels. Production reads do not require the
  write-enable property.
- Explicit read-only workbook access uses `foDashboardRead_()` or
  `foLedgerRead_()`. The legacy mixed-use `foDashboard_()` and `foLedger_()`
  accessors remain write-authorized so existing writers do not lose their gate.
- Write paths perform the same checks and require
  `FO_PRODUCTION_WRITE_ENABLED=TRUE` when `FO_ENVIRONMENT=PRODUCTION`.
- A root protected workflow acquires the script lock and verifies both governed
  workbook bindings before its callback can mutate data.
- `foAssertRuntimeSafety_()` remains a write assertion for compatibility;
  new read-only code uses `foAssertRuntimeReadSafety_()` and write code uses
  `foAssertRuntimeWriteSafety_()`.

This is a reduced-scope runtime boundary. It is not a claim that every existing
writer or standalone engine is lock-protected.

## Migration procedure

### 1. Preflight

1. Record the intended environment, repository commit, Apps Script project,
   Dashboard label, Ledger label, operator, and timestamp in controlled evidence.
   Do not place raw IDs in repository evidence.
2. Confirm the Dashboard and Ledger are the governed pair for that environment
   and are distinct.
3. Back up affected Script Properties and workbook configuration through the
   governed operational process.
4. Keep `FO_PRODUCTION_WRITE_ENABLED` absent or not equal to `TRUE` throughout
   Production read validation.

### 2. Add workbook bindings

In each target workbook, select a controlled configuration cell and create the
two named ranges in the matrix above. The values are operational configuration,
not a new worksheet schema or source of investment logic. Restrict editing to
the appropriate operator/owner.

### 3. Configure Script Properties

Set `FO_ENVIRONMENT`, `FO_DASHBOARD_SPREADSHEET_ID`, and
`FO_LEDGER_SPREADSHEET_ID` for the same workbook pair. Do not copy Lab values
into Production or Production values into Lab.

### 4. Validate reads first

After an authorized Lab deployment, run `foRunRuntimeSafetySmokeTest()`. A pass
confirms that both configured IDs opened and both environment/role sentinels
matched. It does not authorize writes, certify workbook contents, or prove
Production behavior.

For a future governed Production rollout, run the same read-only smoke test while
`FO_PRODUCTION_WRITE_ENABLED` remains disabled. Record actual Apps Script logs
and operator evidence before any separate write authorization decision.

### 5. Validate writes only under governance

Lab write validation follows the
[R1.3.0.3 Lab Validation Template](../validation/R1.3.0.3-LAB-VALIDATION-TEMPLATE.md)
with controlled data and restoration. Production write enablement requires the
normal release, operator, backup, and certification controls; this wave does not
perform or authorize it.

## Failure and rollback

If any runtime check fails:

1. Stop; do not bypass or weaken the assertion.
2. Confirm environment, workbook pair, named-range spelling, sentinel values,
   and Script Properties without recording raw IDs in Git.
3. Keep Production writes disabled.
4. Restore the prior deployed code through the governed release process if the
   migration cannot be completed safely.
5. Preserve failure logs and add corrective evidence rather than rewriting a
   prior record.

The named ranges are additive and may remain after a code rollback. Removing or
changing them is an operational workbook change requiring the workbook owner.

## Compatibility notes

The existing Script Property names and public report/certification functions are
unchanged. R1.3.0.3 adds required workbook-resident bindings, so an environment
that has not completed this migration will intentionally fail closed. No registry,
reporting, certification, writer, RunContext, run-ID, or deployment architecture
is changed by this runbook.
