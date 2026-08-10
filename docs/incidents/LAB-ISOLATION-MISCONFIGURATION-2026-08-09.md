# LAB-ISOLATION-MISCONFIGURATION-2026-08-09: Unintended Production Write During Lab Setup

## Status
Resolved same-day. Root cause fixed via corrected Lab Apps Script isolation.

## Finding
During initial setup of an isolated Lab Apps Script project (part of the
Deployment Environment Separation initiative), the new Lab project's
`FO_DASHBOARD_SPREADSHEET_ID` Script Property was set to the real
production Portfolio Dashboard ID (`13jHJ0N1Gzbia7B4FIHkdTqf2tCp1tkXSFicQ2ti8M1w`)
instead of a newly created, isolated Lab workbook. A subsequent
`foRunWeeklyCioReportA240` execution against this misconfigured Lab
project completed successfully and persisted a real, fully governed
Weekly CIO Report — `WEEKLY-CIO-20260809-095357` / decision run
`EXEC-DECISION-20260809-095347`, 09:53:47-09:54:11 AM — into the real
production Archive and Validation tables.

## Root Cause
A separate, concurrent terminal session (same machine, same account,
guided independently) attempted to resolve a `clasp run` permission
error by linking a GCP project to the Lab Apps Script project. In the
course of that work, `FO_DASHBOARD_SPREADSHEET_ID` was set directly to
the known production ID - likely as a shortcut to satisfy
`RuntimeSafety.js`'s "must be configured" check without first doing the
work of creating genuine Lab workbooks (`SpreadsheetApp.create(...)`,
as the original setup script `foLabSetupTemp_` was designed to do, but
never successfully executed due to an unrelated permission error on
that same project).

Contributing factor: two AI-guided sessions (Claude Code and a separate
ChatGPT-guided terminal session) were both operating on the same Lab
Apps Script project and repository directory concurrently, unaware of
each other, without a designated single active driver.

## Impact
- One real Weekly CIO Report was generated and persisted to production
  outside the normal, reviewed generation cadence. Content is believed
  computed correctly from real, live data (RuntimeSafety.js governs
  which workbook is touched, not calculation correctness) - the issue
  is provenance, not accuracy.
- No other writes were identified during investigation (Ledger workbook
  configuration was not confirmed touched; credential exposure during
  investigation was contained - see below).
- A clasp OAuth credential (access token, refresh token, client secret)
  was briefly displayed in a terminal session transcript due to an
  incorrect `jq` filter path during investigation. Not transmitted
  externally. Full `clasp logout` performed as remediation (all
  profiles, not just the affected one).

## Detection and Response Timeline (2026-08-09)
- ~08:47-09:42: Concurrent session performs Lab project setup, GCP
  linkage work, and (per evidence) sets `FO_DASHBOARD_SPREADSHEET_ID`
  to the production ID.
- 09:53:47-09:54:11: `foRunWeeklyCioReportA240` executes against the
  misconfigured Lab project; report persists to real production Archive
  and Validation tables.
- Investigation began after a handoff note described a "return type"
  error masking a successful execution. Verified via direct read-only
  inspection of the real production spreadsheet (not execution logs
  alone) that a genuine new entry existed.
- Confirmed no other active process could execute further commands
  (`ps aux` clean; historical evidence pointed to the now-completed
  concurrent session, confirmed directly by the user).
- Full `clasp logout` performed to close any residual credential risk.
- Lab isolation rebuilt correctly from a fresh, unlinked Apps Script
  project (scriptId `1ysvZ-9oTAKCg3CKriMIkw4jxtUSbnAjaGvQ3JdDi_8KfN7xQgY2GUXXK`),
  with genuinely new, isolated Dashboard and Ledger workbooks
  (`13mp4Wd3HZyR_tOIr7AUHeEy1xmOT4seyW1zCIswPFl8`,
  `1I0QaYV0RemP9Wv3ji04JKx8Rq5bYhd-PaittgdI8BeU`), populated with
  purpose-built synthetic fixtures.
- Verified via a real, full-pipeline execution (`foRunWeeklyCioReportA240`,
  2026-08-09 ~20:08) that the corrected isolation works: the run
  completed, correctly triggered CRITICAL validation failures against
  the synthetic concentration fixtures, and the real production
  Archive/Validation tables received no new entries during or after
  this run.
- 2026-08-09 ~21:10: Stray production report row (B58, Weekly CIO
  Report Archive A240) annotated with a comment identifying its origin
  and referencing this document.

## Resolution
- Corrected Lab Apps Script project created and verified isolated (see
  Deployment Environment Separation initiative, Phase E-F).
- Abandoned first Lab project attempt (scriptId
  `1KwQHbA2bQZvxFdXRhlLEQNuSzjeMZE_inomLbUCXwyfwoWMnV6fGEEVU`) - unknown/
  uncertain configuration state - scheduled for deletion.
- Full `clasp logout` performed; any future session must re-authenticate
  deliberately.
- Stray production report row annotated with a cell comment identifying
  its origin, per this document.

## Prevention
This incident is a direct, concrete demonstration of the exact risk the
Deployment Environment Separation initiative (see
`docs/incidents/GOVERNANCE-GAP-2026-08-08.md`) was already underway to
address: the Lab repository previously had no technical barrier
preventing it from reaching production resources. That barrier now
exists (separate Apps Script projects, separate workbooks, verified via
a real end-to-end test run with no production impact).

Additional practice going forward: do not run multiple AI-guided
sessions (Claude Code, ChatGPT-guided terminal, etc.) against the same
repository/Apps Script project concurrently without a single designated
active driver.

## Owner / Approver
[To be assigned]
