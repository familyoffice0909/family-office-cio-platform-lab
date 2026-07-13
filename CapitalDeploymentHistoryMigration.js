/**
 * Wave 2.6.0-R1-A.1
 * Capital Deployment History Schema Migration
 */

function foMigrateCapitalDeploymentHistorySchema() {
  const dashboard = foDashboard_();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY
  );

  if (!sheet) {
    throw new Error('Capital Deployment History sheet not found.');
  }

  const headers = [
    'Timestamp',
    'Run ID',
    'Portfolio Directive',
    'Top Ticker',
    'Top Account',
    'Top Decision',
    'Top Deployment Score',
    'Deployable Candidates',
    'Blocked Candidates',
    'Portfolio Materiality Score',
    'Platform Version',
    'Baseline',
    'State Signature'
  ];

  const lastRow = sheet.getLastRow();

  if (lastRow < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return {
      status: 'SUCCESS',
      migratedRows: 0,
      preservedRunIdRows: 0,
      totalHistoryRows: 0
    };
  }

  const width = Math.max(sheet.getLastColumn(), headers.length);
  const values = sheet.getRange(1, 1, lastRow, width).getValues();

  let migratedRows = 0;
  let preservedRunIdRows = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const columnB = String(row[1] || '').trim();

    const hasRunId =
      columnB.indexOf('CIO-RUN-') === 0 ||
      columnB.indexOf('CAPITAL-RUN-') === 0;

    if (hasRunId) {
      preservedRunIdRows++;
      continue;
    }

    const isBlankRow = row.every(function(value) {
      return value === '' || value === null;
    });

    if (isBlankRow) {
      continue;
    }

    for (let columnIndex = 11; columnIndex >= 1; columnIndex--) {
      row[columnIndex + 1] = row[columnIndex];
    }

    row[1] = '';
    migratedRows++;
  }

  values[0] = headers;

  const output = values.map(function(row) {
    return row.slice(0, headers.length);
  });

  sheet.clearContents();
  sheet.getRange(1, 1, output.length, headers.length).setValues(output);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 260);
  sheet.setColumnWidth(13, 460);

  return {
    status: 'SUCCESS',
    migratedRows: migratedRows,
    preservedRunIdRows: preservedRunIdRows,
    totalHistoryRows: Math.max(0, lastRow - 1)
  };
}

function foRunCapitalDeploymentHistoryMigrationSmokeTest() {
  const dashboard = foDashboard_();
  const result = foMigrateCapitalDeploymentHistorySchema();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY
  );

  const expectedHeaders = [
    'Timestamp',
    'Run ID',
    'Portfolio Directive',
    'Top Ticker',
    'Top Account',
    'Top Decision',
    'Top Deployment Score',
    'Deployable Candidates',
    'Blocked Candidates',
    'Portfolio Materiality Score',
    'Platform Version',
    'Baseline',
    'State Signature'
  ];

  const actualHeaders = sheet.getRange(
    1,
    1,
    1,
    expectedHeaders.length
  ).getValues()[0].map(String);

  expectedHeaders.forEach(function(header, index) {
    if (actualHeaders[index] !== header) {
      throw new Error(
        'Header mismatch at column ' + (index + 1)
      );
    }
  });

  return result;
}
