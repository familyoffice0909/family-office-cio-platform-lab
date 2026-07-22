/**
 * Runtime safety controls for environment-bound workbook access.
 * Waves R1.3.0.2–R1.3.0.3 — Runtime Safety (Reduced Scope)
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

const FO_RUNTIME_BINDING_RANGE_NAMES_ = Object.freeze({
  ENVIRONMENT: 'FO_RUNTIME_ENVIRONMENT',
  WORKBOOK_ROLE: 'FO_RUNTIME_WORKBOOK_ROLE'
});

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
  return foAssertRuntimeWriteSafety_(operationName);
}

function foAssertRuntimeReadSafety_(operationName) {
  const operation = String(operationName || '').trim();

  if (!operation) {
    throw foRuntimeSafetyError_('operation name is required');
  }

  return foGetRuntimeConfiguration_();
}

function foAssertRuntimeWriteSafety_(operationName) {
  const configuration = foAssertRuntimeReadSafety_(operationName);
  const properties = PropertiesService.getScriptProperties();

  if (
    configuration.environment === 'PRODUCTION' &&
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

  return configuration;
}

function foAssertRuntimeSpreadsheet_(
  spreadsheet,
  role,
  operationName,
  authorization
) {
  const access = String(authorization || 'WRITE').trim().toUpperCase();
  const configuration = access === 'READ'
    ? foAssertRuntimeReadSafety_(operationName)
    : foAssertRuntimeWriteSafety_(operationName);
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

  const expectedRole = actualSpreadsheetId ===
    configuration.dashboardSpreadsheetId
    ? 'DASHBOARD'
    : 'LEDGER';

  foAssertRuntimeWorkbookBinding_(
    spreadsheet,
    configuration.environment,
    expectedRole
  );

  return configuration;
}

function foAssertRuntimeWorkbookBinding_(
  spreadsheet,
  expectedEnvironment,
  expectedRole
) {
  if (typeof spreadsheet.getRangeByName !== 'function') {
    throw foRuntimeSafetyError_(
      'workbook runtime binding metadata is unavailable'
    );
  }

  const environmentRange = spreadsheet.getRangeByName(
    FO_RUNTIME_BINDING_RANGE_NAMES_.ENVIRONMENT
  );
  const roleRange = spreadsheet.getRangeByName(
    FO_RUNTIME_BINDING_RANGE_NAMES_.WORKBOOK_ROLE
  );

  if (
    !environmentRange ||
    typeof environmentRange.getDisplayValue !== 'function' ||
    !roleRange ||
    typeof roleRange.getDisplayValue !== 'function'
  ) {
    throw foRuntimeSafetyError_(
      'workbook runtime binding named ranges are missing'
    );
  }

  const actualEnvironment = String(
    environmentRange.getDisplayValue() || ''
  ).trim().toUpperCase();
  const actualRole = String(
    roleRange.getDisplayValue() || ''
  ).trim().toUpperCase();

  if (actualEnvironment !== expectedEnvironment) {
    throw foRuntimeSafetyError_(
      'workbook environment binding does not match ' + expectedEnvironment
    );
  }
  if (actualRole !== expectedRole) {
    throw foRuntimeSafetyError_(
      'workbook role binding does not match ' + expectedRole
    );
  }
}

function foGetRuntimeEnvironment_() {
  return foAssertRuntimeReadSafety_('Read runtime environment').environment;
}

function foGetRuntimeDashboardSpreadsheetId_() {
  return foAssertRuntimeReadSafety_(
    'Read dashboard workbook configuration'
  ).dashboardSpreadsheetId;
}

function foGetRuntimeLedgerSpreadsheetId_() {
  return foAssertRuntimeReadSafety_(
    'Read ledger workbook configuration'
  ).ledgerSpreadsheetId;
}

function foRuntimeSafetyError_(detail) {
  return new Error('Runtime safety blocked operation: ' + detail);
}
