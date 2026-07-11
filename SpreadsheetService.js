function foDashboard_() {
  return SpreadsheetApp.openById(FO_CONFIG.DASHBOARD_SPREADSHEET_ID);
}

function foLedger_() {
  return SpreadsheetApp.openById(FO_CONFIG.LEDGER_SPREADSHEET_ID);
}

function foEnsureSheet_(spreadsheet, name, headers) {
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