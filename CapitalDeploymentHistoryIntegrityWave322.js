/**
 * Wave 3.2.2 — Capital Deployment History Integrity
 */

function foRunCapitalDeploymentHistoryIntegrityMigrationWave322() {
  const dashboard = foDashboard_();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Capital Deployment History is missing or empty.');
  }

  const headers = foCapitalDeploymentHistoryHeadersWave322_();
  foEnsureCapitalDeploymentHistoryHeadersWave322_(sheet, headers);

  const values = sheet.getDataRange().getValues();
  let migratedRows = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const normalized = foNormalizeCapitalDeploymentHistoryRowWave322_(
      values[rowIndex],
      headers,
      rowIndex + 1
    );

    if (!normalized.changed) continue;

    sheet.getRange(
      rowIndex + 1,
      1,
      1,
      headers.length
    ).setValues([normalized.values]);

    migratedRows++;
  }

  return {
    status: 'SUCCESS',
    migratedRows: migratedRows,
    totalRows: values.length - 1
  };
}

function foCapitalDeploymentHistoryHeadersWave322_() {
  return [
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
}

function foEnsureCapitalDeploymentHistoryHeadersWave322_(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function foNormalizeCapitalDeploymentHistoryRowWave322_(
  row,
  headers,
  sheetRow
) {
  const indexes = {};
  headers.forEach(function(header, index) {
    indexes[header] = index;
  });

  const current = {};
  headers.forEach(function(header) {
    current[header] = row[indexes[header]];
  });

  const runId = foCapitalHistoryTextWave322_(current['Run ID']);
  const directive = foCapitalHistoryTextWave322_(
    current['Portfolio Directive']
  );
  const signature = foCapitalHistoryTextWave322_(
    current['State Signature']
  );

  if (runId && directive && signature) {
    return {
      changed: false,
      values: headers.map(function(header) {
        return current[header];
      })
    };
  }

  const timestamp =
    current.Timestamp ||
    foCapitalHistoryFindValueWave322_(
      row,
      function(value) {
        return Object.prototype.toString.call(value) === '[object Date]';
      }
    );

  const resolvedDirective =
    directive ||
    foCapitalHistoryFindTextWave322_(
      row,
      function(value) {
        return (
          value.indexOf('HOLD CASH') >= 0 ||
          value.indexOf('REFRESH DATA') >= 0 ||
          value.indexOf('DEPLOY') >= 0
        );
      }
    );

  const ticker =
    foCapitalHistoryTextWave322_(current['Top Ticker']) ||
    foCapitalHistoryFindTextWave322_(
      row,
      function(value) {
        return /^[A-Z][A-Z0-9.-]{0,9}$/.test(value) &&
          value !== 'BLOCKED' &&
          value !== 'HOLD';
      }
    );

  const account =
    foCapitalHistoryTextWave322_(current['Top Account']) ||
    foCapitalHistoryFindTextWave322_(
      row,
      function(value) {
        return [
          'TFSA',
          'LIRA',
          'RRSP',
          'Taxable',
          'Interactive Brokers'
        ].indexOf(value) >= 0;
      }
    );

  const decision =
    foCapitalHistoryTextWave322_(current['Top Decision']) ||
    foCapitalHistoryFindTextWave322_(
      row,
      function(value) {
        return [
          'BLOCKED',
          'DEPLOY NOW',
          'DEPLOY SOON',
          'HOLD'
        ].indexOf(value) >= 0;
      }
    );

  const numbers = row.filter(function(value) {
    return typeof value === 'number' && isFinite(value);
  });

  const score = foCapitalHistoryNumberWave322_(
    current['Top Deployment Score'],
    numbers[0]
  );
  const deployable = foCapitalHistoryNumberWave322_(
    current['Deployable Candidates'],
    numbers[1]
  );
  const blocked = foCapitalHistoryNumberWave322_(
    current['Blocked Candidates'],
    numbers[2]
  );
  const materiality = foCapitalHistoryNumberWave322_(
    current['Portfolio Materiality Score'],
    numbers[3]
  );

  const platformVersion =
    foCapitalHistoryTextWave322_(current['Platform Version']) ||
    foCapitalHistoryFindTextWave322_(
      row,
      function(value) {
        return /^v\d+\.\d+\.\d+$/.test(value);
      }
    ) ||
    FO_CONFIG.PLATFORM_VERSION;

  const baseline =
    foCapitalHistoryTextWave322_(current.Baseline) ||
    FO_CONFIG.BASELINE;

  const resolvedRunId =
    runId ||
    foBuildLegacyCapitalRunIdWave322_(timestamp, sheetRow);

  if (!resolvedDirective) {
    throw new Error(
      'Unable to reconstruct Portfolio Directive at row ' + sheetRow
    );
  }

  const resolvedSignature = [
    resolvedDirective,
    ticker,
    account,
    decision,
    score,
    deployable,
    blocked,
    materiality
  ].join('|');

  return {
    changed: true,
    values: [
      timestamp,
      resolvedRunId,
      resolvedDirective,
      ticker,
      account,
      decision,
      score,
      deployable,
      blocked,
      materiality,
      platformVersion,
      baseline,
      resolvedSignature
    ]
  };
}

function foBuildLegacyCapitalRunIdWave322_(timestamp, sheetRow) {
  if (
    Object.prototype.toString.call(timestamp) === '[object Date]' &&
    !isNaN(timestamp.getTime())
  ) {
    return Utilities.formatDate(
      timestamp,
      Session.getScriptTimeZone(),
      "'LEGACY-CAPITAL-RUN-'yyyyMMdd-HHmmss"
    );
  }

  return 'LEGACY-CAPITAL-RUN-ROW-' + sheetRow;
}

function foCapitalHistoryFindTextWave322_(row, predicate) {
  for (let index = 0; index < row.length; index++) {
    const value = foCapitalHistoryTextWave322_(row[index]);
    if (value && predicate(value)) return value;
  }
  return '';
}

function foCapitalHistoryFindValueWave322_(row, predicate) {
  for (let index = 0; index < row.length; index++) {
    if (predicate(row[index])) return row[index];
  }
  return '';
}

function foCapitalHistoryTextWave322_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function foCapitalHistoryNumberWave322_(value, fallback) {
  if (value !== '' && value !== null && value !== undefined) {
    const number = Number(value);
    if (isFinite(number)) return number;
  }

  const fallbackNumber = Number(fallback);
  return isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function foRunCapitalDeploymentHistoryIntegritySmokeTestWave322() {
  const migration =
    foRunCapitalDeploymentHistoryIntegrityMigrationWave322();

  const controls = foValidateDeploymentHistory_(foDashboard_());

  if (!controls.length || controls[0].status !== 'PASS') {
    throw new Error(
      'Capital Deployment History validation failed: ' +
        foSafeStringify_(controls)
    );
  }

  return {
    status: 'PASS',
    migration: migration,
    control: controls[0]
  };
}
