/**
 * Wave A2.1.3 — Portfolio Risk Architecture Validator.
 */

const FO_RISK_VALIDATION_HEADERS_A213 = [
  'Validation Run ID', 'Timestamp', 'Category', 'Component', 'Status',
  'Severity', 'Details', 'Rows Evaluated', 'Platform Version', 'Baseline'
];

function foRunPortfolioRiskArchitectureValidation() {
  const dashboard = foDashboard_();
  const runId = 'RISK-VAL-' + Utilities.formatDate(
    new Date(), FO_CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss'
  );
  const timestamp = new Date();
  const results = [];

  foEnsureRiskValidationSheetA213_(dashboard);
  foValidateRiskOwnedSheetsA213_(dashboard, results);
  foValidateRiskDependenciesA213_(dashboard, results);
  foValidateRiskSeedTablesA213_(dashboard, results);
  foValidateRiskInputsA213_(dashboard, results);
  foValidateExposureQualityA213_(dashboard, results);

  const failed = results.filter(r => r.status === 'FAIL').length;
  const observations = results.filter(
    r => r.status === 'PASS WITH OBSERVATIONS'
  ).length;
  const passed = results.filter(r => r.status === 'PASS').length;

  foWriteRiskValidationA213_(dashboard, runId, timestamp, results);

  return {
    status: failed ? 'FAIL' :
      observations ? 'PASS WITH OBSERVATIONS' : 'PASS',
    validationRunId: runId,
    passedControls: passed,
    observationControls: observations,
    failedControls: failed,
    totalControls: results.length,
    blocking: failed > 0,
    results: results,
    platformVersion: FO_CONFIG.PLATFORM_VERSION,
    baseline: FO_CONFIG.BASELINE
  };
}

function foRunPortfolioRiskArchitectureValidationSmokeTestA213() {
  const result = foRunPortfolioRiskArchitectureValidation();
  const sheet = foDashboard_().getSheetByName(
    FO_SHEETS.PORTFOLIO_RISK_VALIDATION
  );
  const headers = foGetSheetHeaders_(sheet);

  if (headers.join('|') !== FO_RISK_VALIDATION_HEADERS_A213.join('|')) {
    throw new Error('Portfolio Risk Validation schema mismatch.');
  }
  if (result.failedControls > 0) {
    throw new Error(
      'Blocking Portfolio Risk validation failures: ' +
      JSON.stringify(result)
    );
  }

  return {
    status: 'PASS',
    validation: result,
    worksheet: FO_SHEETS.PORTFOLIO_RISK_VALIDATION,
    nextWave: 'A2.2 — Position Risk Engine'
  };
}

function foEnsureRiskValidationSheetA213_(dashboard) {
  let sheet = dashboard.getSheetByName(
    FO_SHEETS.PORTFOLIO_RISK_VALIDATION
  );
  if (!sheet) {
    sheet = dashboard.insertSheet(
      FO_SHEETS.PORTFOLIO_RISK_VALIDATION
    );
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(
      1, 1, 1, FO_RISK_VALIDATION_HEADERS_A213.length
    ).setValues([FO_RISK_VALIDATION_HEADERS_A213]);
    sheet.setFrozenRows(1);
  }
  const headers = foGetSheetHeaders_(sheet);
  if (headers.join('|') !== FO_RISK_VALIDATION_HEADERS_A213.join('|')) {
    throw new Error(
      'Portfolio Risk Validation contract mismatch: ' +
      JSON.stringify(headers)
    );
  }
}

function foValidateRiskOwnedSheetsA213_(dashboard, results) {
  foPortfolioRiskOwnedDefinitionsA211_().forEach(definition => {
    const name = definition[0];
    const expected = definition[1];
    const sheet = dashboard.getSheetByName(name);
    if (!sheet) {
      return foRiskResultA213_(
        results, 'SCHEMA', name, 'FAIL', 'CRITICAL',
        'Required risk-owned worksheet is missing.', 0
      );
    }
    const actual = foGetSheetHeaders_(sheet);
    const valid = actual.join('|') === expected.join('|');
    foRiskResultA213_(
      results, 'SCHEMA', name, valid ? 'PASS' : 'FAIL',
      valid ? 'NONE' : 'CRITICAL',
      valid ? 'Risk-owned schema valid.' :
        'Schema mismatch. Expected ' + JSON.stringify(expected) +
        '; actual ' + JSON.stringify(actual),
      Math.max(sheet.getLastRow() - 1, 0)
    );
  });
}

function foValidateRiskDependenciesA213_(dashboard, results) {
  FO_PORTFOLIO_RISK_EXPOSURE_DEPENDENCIES_A211.forEach(dependency => {
    const sheet = dashboard.getSheetByName(dependency.sheetName);
    if (!sheet) {
      return foRiskResultA213_(
        results, 'DEPENDENCY', dependency.sheetName, 'FAIL',
        'CRITICAL', 'Required exposure dependency is missing.', 0
      );
    }
    const headers = foGetSheetHeaders_(sheet);
    const missing = dependency.requiredHeaders.filter(
      header => headers.indexOf(header) < 0
    );
    const rows = Math.max(sheet.getLastRow() - 1, 0);
    foRiskResultA213_(
      results, 'DEPENDENCY', dependency.sheetName,
      missing.length ? 'FAIL' :
        rows ? 'PASS' : 'PASS WITH OBSERVATIONS',
      missing.length ? 'CRITICAL' : rows ? 'NONE' : 'MEDIUM',
      missing.length ? 'Missing: ' + missing.join(', ') :
        rows ? 'Dependency contract valid and populated.' :
        'Dependency contract valid but empty.',
      rows
    );
  });
}

function foValidateRiskSeedTablesA213_(dashboard, results) {
  foValidateSeedA213_(
    dashboard, results, FO_SHEETS.RISK_LIMITS, 5, 'RISK POLICY'
  );
  foValidateSeedA213_(
    dashboard, results, FO_SHEETS.STRESS_SCENARIOS, 6, 'STRESS POLICY'
  );
}

function foValidateSeedA213_(
  dashboard, results, sheetName, minimumRows, category
) {
  const sheet = dashboard.getSheetByName(sheetName);
  if (!sheet) {
    return foRiskResultA213_(
      results, category, sheetName, 'FAIL', 'CRITICAL',
      'Required policy worksheet is missing.', 0
    );
  }
  const rows = Math.max(sheet.getLastRow() - 1, 0);
  const ids = rows ? sheet.getRange(2, 1, rows, 1).getValues()
    .map(r => String(r[0] || '').trim()).filter(String) : [];
  const seen = {};
  const duplicates = [];
  ids.forEach(id => {
    if (seen[id] && duplicates.indexOf(id) < 0) duplicates.push(id);
    seen[id] = true;
  });
  const fail = rows < minimumRows || duplicates.length > 0;
  foRiskResultA213_(
    results, category, sheetName, fail ? 'FAIL' : 'PASS',
    fail ? 'HIGH' : 'NONE',
    rows < minimumRows
      ? 'Expected at least ' + minimumRows + ' rows; found ' + rows + '.'
      : duplicates.length
      ? 'Duplicate identifiers: ' + duplicates.join(', ') + '.'
      : 'Seed data present and identifiers unique.',
    rows
  );
}

function foValidateRiskInputsA213_(dashboard, results) {
  [
    [FO_SHEETS.PORTFOLIO_MASTER, ['Ticker']],
    [FO_SHEETS.PORTFOLIO_ATTRIBUTION, []],
    [FO_SHEETS.INVESTMENT_DECISION_SUPPORT, ['Ticker']],
    [FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES, ['Ticker']]
  ].forEach(input => {
    const sheet = dashboard.getSheetByName(input[0]);
    if (!sheet) {
      return foRiskResultA213_(
        results, 'INPUT', input[0], 'FAIL', 'CRITICAL',
        'Required operational input is missing.', 0
      );
    }
    const headers = foGetSheetHeaders_(sheet);
    const missing = input[1].filter(h => headers.indexOf(h) < 0);
    const rows = Math.max(sheet.getLastRow() - 1, 0);
    foRiskResultA213_(
      results, 'INPUT', input[0],
      missing.length ? 'FAIL' :
        rows ? 'PASS' : 'PASS WITH OBSERVATIONS',
      missing.length ? 'HIGH' : rows ? 'NONE' : 'MEDIUM',
      missing.length ? 'Missing: ' + missing.join(', ') :
        rows ? 'Operational input available and populated.' :
        'Operational input exists but is empty.',
      rows
    );
  });
}

function foValidateExposureQualityA213_(dashboard, results) {
  [
    [FO_SHEETS.SECTOR_EXPOSURE, 'Unknown'],
    [FO_SHEETS.CURRENCY_EXPOSURE, '']
  ].forEach(config => {
    const sheet = dashboard.getSheetByName(config[0]);
    if (!sheet || sheet.getLastRow() < 2) return;

    const headers = foGetSheetHeaders_(sheet);
    const groupIndex = headers.indexOf('Group');
    const weightIndex = headers.indexOf('Portfolio Weight');
    const costIndex = headers.indexOf('Cost Basis');
    const valueIndex = headers.indexOf('Market Value');
    if (groupIndex < 0 || weightIndex < 0) return;

    const rows = sheet.getRange(
      2, 1, sheet.getLastRow() - 1, headers.length
    ).getValues();
    let totalWeight = 0;
    let unknownWeight = 0;
    let zeroCostGroups = 0;

    rows.forEach(row => {
      const group = String(row[groupIndex] || '').trim();
      const weight = Number(row[weightIndex]) || 0;
      totalWeight += weight;
      if (config[1] && group === config[1]) unknownWeight += weight;
      if (
        costIndex >= 0 && valueIndex >= 0 &&
        Number(row[costIndex]) === 0 && Number(row[valueIndex]) > 0
      ) zeroCostGroups++;
    });

    const notes = [];
    if (Math.abs(totalWeight - 1) > 0.01) {
      notes.push(
        'Weights total ' + (totalWeight * 100).toFixed(2) + '%.'
      );
    }
    if (unknownWeight > 0.2) {
      notes.push(
        'Unknown classification is ' +
        (unknownWeight * 100).toFixed(2) + '%.'
      );
    }
    if (zeroCostGroups) {
      notes.push(
        zeroCostGroups +
        ' group(s) have positive market value and zero cost basis.'
      );
    }

    foRiskResultA213_(
      results, 'DATA QUALITY', config[0],
      notes.length ? 'PASS WITH OBSERVATIONS' : 'PASS',
      notes.length ? 'MEDIUM' : 'NONE',
      notes.length ? notes.join(' ') :
        'Exposure weights and attribution fields are reasonable.',
      rows.length
    );
  });
}

function foRiskResultA213_(
  results, category, component, status, severity, details, rows
) {
  results.push({
    category: category,
    component: component,
    status: status,
    severity: severity,
    details: details,
    rowsEvaluated: rows || 0
  });
}

function foWriteRiskValidationA213_(
  dashboard, runId, timestamp, results
) {
  if (!results.length) return;
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.PORTFOLIO_RISK_VALIDATION
  );
  const rows = results.map(result => [
    runId, timestamp, result.category, result.component, result.status,
    result.severity, result.details, result.rowsEvaluated,
    FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
  ]);
  sheet.getRange(
    sheet.getLastRow() + 1, 1, rows.length,
    FO_RISK_VALIDATION_HEADERS_A213.length
  ).setValues(rows);
}
