function foDashboard_() {
  return foOpenRuntimeSpreadsheet_('DASHBOARD', 'WRITE');
}

function foLedger_() {
  return foOpenRuntimeSpreadsheet_('LEDGER', 'WRITE');
}

function foDashboardRead_() {
  return foOpenRuntimeSpreadsheet_('DASHBOARD', 'READ');
}

function foLedgerRead_() {
  return foOpenRuntimeSpreadsheet_('LEDGER', 'READ');
}

function foOpenRuntimeSpreadsheet_(role, authorization) {
  const normalizedRole = String(role || '').trim().toUpperCase();
  const access = String(authorization || 'WRITE').trim().toUpperCase();
  const operation =
    'Open ' + normalizedRole.toLowerCase() +
    ' workbook for ' + access.toLowerCase();

  if (normalizedRole !== 'DASHBOARD' && normalizedRole !== 'LEDGER') {
    throw foRuntimeSafetyError_('workbook role must be DASHBOARD or LEDGER');
  }
  if (access === 'READ') {
    foAssertRuntimeReadSafety_(operation);
  } else {
    foAssertRuntimeWriteSafety_(operation);
  }

  // Intentional adapter boundary: callers must not invoke SpreadsheetApp
  // directly. RuntimeSafety validates the configured ID before and after open.
  const spreadsheetId = normalizedRole === 'DASHBOARD'
    ? foGetRuntimeDashboardSpreadsheetId_()
    : foGetRuntimeLedgerSpreadsheetId_();
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  foAssertRuntimeSpreadsheet_(
    spreadsheet,
    normalizedRole,
    operation,
    access
  );
  return spreadsheet;
}

function foAssertRuntimeWorkbookBindings_() {
  foDashboardRead_();
  foLedgerRead_();
}

function foRunRuntimeSafetySmokeTest() {
  const configuration = foAssertRuntimeReadSafety_(
    'Run Runtime Safety smoke test'
  );

  foAssertRuntimeWorkbookBindings_();

  return {
    status: 'PASS',
    environment: configuration.environment,
    workbookBindings: ['DASHBOARD', 'LEDGER'],
    writeAuthorization: configuration.environment === 'PRODUCTION'
      ? 'SEPARATELY GOVERNED'
      : 'LAB'
  };
}

function foEnsureSheet_(spreadsheet, name, headers) {
  foAssertRuntimeSpreadsheet_(
    spreadsheet,
    'ANY',
    'Ensure governed worksheet',
    'WRITE'
  );
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function foGetSheetHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}
