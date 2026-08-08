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

function foSheetRows_(sheet) {
  if (!sheet || typeof sheet.getDataRange !== 'function') {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0] || [];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const source = values[r] || [];
    const row = {};

    for (let c = 0; c < headers.length; c++) {
      const header = String(headers[c] || '').trim();

      if (!header) {
        continue;
      }

      row[header] = source[c];
    }

    rows.push(row);
  }

  return rows;
}

function foLatestRows_(sheet, runHeader) {
  const rows = foSheetRows_(sheet);

  if (!rows.length) {
    return {
      runId: '',
      rows: []
    };
  }

  const header = String(runHeader || '').trim();

  if (!header) {
    return {
      runId: '',
      rows: []
    };
  }

  const runId = String(
    rows[rows.length - 1][header] || ''
  ).trim();

  if (!runId) {
    return {
      runId: '',
      rows: []
    };
  }

  return {
    runId: runId,
    rows: rows.filter(function(row) {
      return String(row[header] || '').trim() === runId;
    })
  };
}
