/**
 * Runtime safety controls for environment-bound workbook access.
 * Wave R1.3.0.2 — Runtime Safety (Reduced Scope)
 */

const FO_RUNTIME_PROPERTY_KEYS_ = Object.freeze({
  ENVIRONMENT: 'FO_ENVIRONMENT',
  DASHBOARD_SPREADSHEET_ID: 'FO_DASHBOARD_SPREADSHEET_ID',
  LEDGER_SPREADSHEET_ID: 'FO_LEDGER_SPREADSHEET_ID',
  PRODUCTION_WRITE_ENABLED: 'FO_PRODUCTION_WRITE_ENABLED'
});

const FO_RUNTIME_ENVIRONMENTS_ = Object.freeze([
  'LAB',
  'PRODUCTION'
]);

function foGetRuntimeConfiguration_() {
  const properties = PropertiesService.getScriptProperties();
  const environment = String(
    properties.getProperty(FO_RUNTIME_PROPERTY_KEYS_.ENVIRONMENT) || ''
  ).trim().toUpperCase();
  const dashboardSpreadsheetId = String(
    properties.getProperty(
      FO_RUNTIME_PROPERTY_KEYS_.DASHBOARD_SPREADSHEET_ID
    ) || ''
  ).trim();
  const ledgerSpreadsheetId = String(
    properties.getProperty(
      FO_RUNTIME_PROPERTY_KEYS_.LEDGER_SPREADSHEET_ID
    ) || ''
  ).trim();

  if (FO_RUNTIME_ENVIRONMENTS_.indexOf(environment) === -1) {
    throw foRuntimeSafetyError_(
      'FO_ENVIRONMENT must be exactly LAB or PRODUCTION'
    );
  }

  foAssertRuntimeSpreadsheetId_(
    dashboardSpreadsheetId,
    FO_RUNTIME_PROPERTY_KEYS_.DASHBOARD_SPREADSHEET_ID
  );
  foAssertRuntimeSpreadsheetId_(
    ledgerSpreadsheetId,
    FO_RUNTIME_PROPERTY_KEYS_.LEDGER_SPREADSHEET_ID
  );

  if (dashboardSpreadsheetId === ledgerSpreadsheetId) {
    throw foRuntimeSafetyError_(
      'dashboard and ledger workbook targets must be distinct'
    );
  }

  if (
    environment === 'PRODUCTION' &&
    properties.getProperty(
      FO_RUNTIME_PROPERTY_KEYS_.PRODUCTION_WRITE_ENABLED
    ) !== 'TRUE'
  ) {
    throw foRuntimeSafetyError_(
      'production writes are disabled; set ' +
        FO_RUNTIME_PROPERTY_KEYS_.PRODUCTION_WRITE_ENABLED +
        ' to TRUE through the governed production setup process'
    );
  }

  return Object.freeze({
    environment: environment,
    dashboardSpreadsheetId: dashboardSpreadsheetId,
    ledgerSpreadsheetId: ledgerSpreadsheetId
  });
}

function foAssertRuntimeSpreadsheetId_(spreadsheetId, propertyName) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId)) {
    throw foRuntimeSafetyError_(
      propertyName + ' is missing or is not a valid workbook identifier'
    );
  }
}

function foAssertRuntimeSafety_(operationName) {
  const operation = String(operationName || '').trim();

  if (!operation) {
    throw foRuntimeSafetyError_('operation name is required');
  }

  return foGetRuntimeConfiguration_();
}

function foAssertRuntimeSpreadsheet_(spreadsheet, role, operationName) {
  const configuration = foAssertRuntimeSafety_(operationName);
  const normalizedRole = String(role || '').trim().toUpperCase();

  if (
    !spreadsheet ||
    typeof spreadsheet.getId !== 'function'
  ) {
    throw foRuntimeSafetyError_('opened workbook identity is unavailable');
  }

  const actualSpreadsheetId = String(spreadsheet.getId() || '').trim();
  const expectedSpreadsheetIds = [];

  if (normalizedRole === 'DASHBOARD' || normalizedRole === 'ANY') {
    expectedSpreadsheetIds.push(configuration.dashboardSpreadsheetId);
  }
  if (normalizedRole === 'LEDGER' || normalizedRole === 'ANY') {
    expectedSpreadsheetIds.push(configuration.ledgerSpreadsheetId);
  }
  if (expectedSpreadsheetIds.length === 0) {
    throw foRuntimeSafetyError_('workbook role must be DASHBOARD, LEDGER or ANY');
  }
  if (expectedSpreadsheetIds.indexOf(actualSpreadsheetId) === -1) {
    throw foRuntimeSafetyError_(
      'opened workbook does not match the configured ' +
        normalizedRole.toLowerCase() + ' target'
    );
  }

  return configuration;
}

function foGetRuntimeEnvironment_() {
  return foAssertRuntimeSafety_('Read runtime environment').environment;
}

function foGetRuntimeDashboardSpreadsheetId_() {
  return foAssertRuntimeSafety_(
    'Read dashboard workbook configuration'
  ).dashboardSpreadsheetId;
}

function foGetRuntimeLedgerSpreadsheetId_() {
  return foAssertRuntimeSafety_(
    'Read ledger workbook configuration'
  ).ledgerSpreadsheetId;
}

function foRuntimeSafetyError_(detail) {
  return new Error('Runtime safety blocked operation: ' + detail);
}
