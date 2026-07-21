function foDashboard_() {
  // Intentional adapter boundary: callers must not invoke SpreadsheetApp
  // directly. RuntimeSafety validates the configured ID before and after open.
  const spreadsheet = SpreadsheetApp.openById(
    foGetRuntimeDashboardSpreadsheetId_()
  );
  foAssertRuntimeSpreadsheet_(
    spreadsheet,
    'DASHBOARD',
    'Open dashboard workbook'
  );
  return spreadsheet;
}

function foLedger_() {
  // Intentional adapter boundary: callers must not invoke SpreadsheetApp
  // directly. RuntimeSafety validates the configured ID before and after open.
  const spreadsheet = SpreadsheetApp.openById(
    foGetRuntimeLedgerSpreadsheetId_()
  );
  foAssertRuntimeSpreadsheet_(
    spreadsheet,
    'LEDGER',
    'Open ledger workbook'
  );
  return spreadsheet;
}

function foEnsureSheet_(spreadsheet, name, headers) {
  foAssertRuntimeSpreadsheet_(
    spreadsheet,
    'ANY',
    'Ensure governed worksheet'
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
