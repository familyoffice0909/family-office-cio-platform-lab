/**
 * A2.1.6 — Architecture Freeze & Production Baseline
 *
 * Creates and maintains the runtime architecture registry, dependency inventory,
 * ownership matrix, production baseline and validation evidence.
 *
 * Public functions:
 *   foGenerateArchitectureRegistry()
 *   foGenerateDependencyInventory()
 *   foGenerateOwnershipMatrix()
 *   foGenerateProductionBaseline()
 *   foRunArchitectureFreezeValidation()
 *   foRunArchitectureFreeze()
 *   foRunArchitectureFreezeSmokeTestA216()
 */

const FO_A216_ARCHITECTURE_VERSION = 'ARCH-v1.0';
const FO_A216_STATUS = Object.freeze({
  PRODUCTION: 'PRODUCTION',
  SUPPORTING: 'SUPPORTING',
  LEGACY: 'LEGACY',
  FUTURE: 'FUTURE / PROTOTYPE'
});

const FO_A216_SHEETS = Object.freeze({
  REGISTRY: 'Architecture Registry',
  DEPENDENCIES: 'Architecture Dependencies',
  OWNERSHIP: 'Architecture Ownership',
  BASELINE: 'Production Baseline',
  VALIDATION: 'Architecture Freeze Validation'
});

const FO_A216_REGISTRY_HEADERS = [
  'Component ID', 'Component', 'Component Type', 'Domain', 'Layer', 'Owner',
  'Source of Truth', 'Upstream Dependencies', 'Downstream Consumers',
  'Editable', 'Production Critical', 'Status', 'Architecture Version',
  'Platform Version', 'Baseline', 'Last Reviewed', 'Notes'
];

const FO_A216_DEPENDENCY_HEADERS = [
  'Dependency ID', 'Upstream Component', 'Downstream Component',
  'Dependency Type', 'Criticality', 'Status', 'Architecture Version',
  'Platform Version', 'Baseline', 'Last Reviewed', 'Notes'
];

const FO_A216_OWNERSHIP_HEADERS = [
  'Component ID', 'Component', 'Domain', 'Owner', 'System of Record',
  'Edit Policy', 'Production Critical', 'Status', 'Architecture Version',
  'Platform Version', 'Baseline', 'Last Reviewed'
];

const FO_A216_BASELINE_HEADERS = [
  'Baseline Run ID', 'Timestamp', 'Architecture Version', 'Platform Version',
  'Baseline', 'Workbook', 'Spreadsheet ID', 'Timezone', 'Total Worksheets',
  'Production Worksheets', 'Supporting Worksheets', 'Legacy Worksheets',
  'Future / Prototype Worksheets', 'Production Critical Worksheets',
  'Latest Certification Status', 'Architecture Status', 'Git Commit',
  'Release Target', 'Notes'
];

const FO_A216_VALIDATION_HEADERS = [
  'Validation Run ID', 'Timestamp', 'Category', 'Control', 'Status',
  'Severity', 'Details', 'Rows Evaluated', 'Architecture Version',
  'Platform Version', 'Baseline'
];

/**
 * Runtime dependency manifest. This is intentionally code-owned because
 * Apps Script writes values to the workbook and formula scans cannot reveal
 * the actual lineage.
 */
const FO_A216_DEPENDENCY_MANIFEST = [
  ['TFSA Holdings', 'Portfolio Master', 'DATA FLOW', 'HIGH'],
  ['LIRA Holdings', 'Portfolio Master', 'DATA FLOW', 'HIGH'],
  ['Interactive Brokers', 'Portfolio Master', 'DATA FLOW', 'HIGH'],
  ['Market Symbol Registry', 'Market Data Cache', 'REFERENCE', 'HIGH'],
  ['Market Data Cache', 'Portfolio Master', 'DATA ENRICHMENT', 'HIGH'],
  ['Portfolio Master', 'Portfolio State', 'DATA FLOW', 'CRITICAL'],
  ['Portfolio State', 'Portfolio Valuation', 'CALCULATION', 'CRITICAL'],
  ['Portfolio State', 'Portfolio Performance', 'CALCULATION', 'HIGH'],
  ['Portfolio State', 'Portfolio Exposure Attribution', 'CALCULATION', 'HIGH'],
  ['Portfolio Exposure Attribution', 'Sector Exposure', 'CALCULATION', 'HIGH'],
  ['Portfolio Exposure Attribution', 'Country Exposure', 'CALCULATION', 'HIGH'],
  ['Portfolio Exposure Attribution', 'Currency Exposure', 'CALCULATION', 'HIGH'],
  ['Portfolio Master', 'Portfolio Snapshot', 'SNAPSHOT', 'HIGH'],
  ['Portfolio Snapshot', 'Market Intelligence', 'ANALYTICS', 'HIGH'],
  ['Market Intelligence', 'Buy Zone Intelligence', 'ANALYTICS', 'HIGH'],
  ['Buy Zone Rules', 'Buy Zone Intelligence', 'POLICY', 'HIGH'],
  ['Buy Zone Targets', 'Buy Zone Intelligence', 'POLICY', 'HIGH'],
  ['Conviction Rules', 'Buy Zone Intelligence', 'POLICY', 'HIGH'],
  ['Buy Zone Intelligence', 'Investment Decision Support', 'DECISION INPUT', 'CRITICAL'],
  ['Investment Trends', 'Investment Decision Support', 'DECISION INPUT', 'HIGH'],
  ['Portfolio Materiality', 'Investment Decision Support', 'DECISION INPUT', 'HIGH'],
  ['Investment Decision Support', 'Capital Deployment Priorities', 'DECISION FLOW', 'CRITICAL'],
  ['Capital Deployment Policy', 'Capital Deployment Priorities', 'POLICY', 'CRITICAL'],
  ['Capital Deployment Priorities', 'Capital Deployment History', 'AUDIT', 'HIGH'],
  ['Capital Deployment Priorities', 'Executive Report', 'REPORTING', 'HIGH'],
  ['Portfolio Snapshot', 'Executive Report', 'REPORTING', 'HIGH'],
  ['Executive Report', 'Executive Dashboard', 'REPORTING', 'CRITICAL'],
  ['Position Risk', 'Portfolio Risk', 'RISK AGGREGATION', 'CRITICAL'],
  ['Sector Exposure', 'Portfolio Risk', 'RISK INPUT', 'HIGH'],
  ['Country Exposure', 'Portfolio Risk', 'RISK INPUT', 'HIGH'],
  ['Currency Exposure', 'Portfolio Risk', 'RISK INPUT', 'HIGH'],
  ['Risk Limits', 'Portfolio Risk', 'POLICY', 'CRITICAL'],
  ['Stress Scenarios', 'Portfolio Risk', 'POLICY', 'HIGH'],
  ['Portfolio Risk', 'Risk Dashboard', 'REPORTING', 'HIGH'],
  ['Portfolio Risk', 'Risk History', 'AUDIT', 'HIGH'],
  ['Portfolio Risk Validation', 'Production Certification', 'CONTROL', 'HIGH'],
  ['Platform Health Check', 'Production Certification', 'CONTROL', 'CRITICAL'],
  ['Data Validation', 'Production Certification', 'CONTROL', 'CRITICAL'],
  ['Autonomous CIO Run Log', 'Production Certification', 'ORCHESTRATION', 'CRITICAL'],
  ['Autonomous CIO Step Log', 'Production Certification', 'ORCHESTRATION', 'CRITICAL'],
  ['Production Certification', 'Executive Dashboard', 'CONTROL STATUS', 'HIGH']
];

function foGenerateArchitectureRegistry() {
  const ss = foDashboard_();
  const sheet = foA216EnsureSheet_(ss, FO_A216_SHEETS.REGISTRY, FO_A216_REGISTRY_HEADERS);
  const now = new Date();
  const rows = ss.getSheets()
    .filter(s => !Object.values(FO_A216_SHEETS).includes(s.getName()))
    .map((s, index) => {
      const name = s.getName();
      const profile = foA216ClassifyComponent_(name);
      return [
        'ARCH-COMP-' + Utilities.formatString('%03d', index + 1),
        name,
        profile.componentType,
        profile.domain,
        profile.layer,
        profile.owner,
        profile.sourceOfTruth ? 'YES' : 'NO',
        foA216Upstream_(name).join(' | '),
        foA216Downstream_(name).join(' | '),
        profile.editable ? 'YES' : 'NO',
        profile.critical ? 'YES' : 'NO',
        profile.status,
        FO_A216_ARCHITECTURE_VERSION,
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE,
        now,
        profile.notes
      ];
    });

  foA216ReplaceData_(sheet, FO_A216_REGISTRY_HEADERS, rows);
  return {
    status: 'SUCCESS',
    worksheet: FO_A216_SHEETS.REGISTRY,
    components: rows.length,
    architectureVersion: FO_A216_ARCHITECTURE_VERSION
  };
}

function foGenerateDependencyInventory() {
  const ss = foDashboard_();
  const sheet = foA216EnsureSheet_(ss, FO_A216_SHEETS.DEPENDENCIES, FO_A216_DEPENDENCY_HEADERS);
  const now = new Date();
  const available = new Set(ss.getSheets().map(s => s.getName()));
  const rows = FO_A216_DEPENDENCY_MANIFEST.map((d, index) => {
    const upstreamFound = available.has(d[0]);
    const downstreamFound = available.has(d[1]);
    return [
      'ARCH-DEP-' + Utilities.formatString('%03d', index + 1),
      d[0], d[1], d[2], d[3],
      upstreamFound && downstreamFound ? 'ACTIVE' : 'DOCUMENTED / COMPONENT MISSING',
      FO_A216_ARCHITECTURE_VERSION,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      now,
      (!upstreamFound ? 'Missing upstream. ' : '') +
      (!downstreamFound ? 'Missing downstream.' : '')
    ];
  });
  foA216ReplaceData_(sheet, FO_A216_DEPENDENCY_HEADERS, rows);
  return {
    status: 'SUCCESS',
    worksheet: FO_A216_SHEETS.DEPENDENCIES,
    dependencies: rows.length
  };
}

function foGenerateOwnershipMatrix() {
  const ss = foDashboard_();
  const registry = ss.getSheetByName(FO_A216_SHEETS.REGISTRY);
  if (!registry || registry.getLastRow() < 2) {
    foGenerateArchitectureRegistry();
  }
  const source = ss.getSheetByName(FO_A216_SHEETS.REGISTRY);
  const values = source.getDataRange().getValues();
  const headers = values[0];
  const idx = foA216HeaderMap_(headers);
  const rows = values.slice(1).filter(r => r[idx['Component']]).map(r => [
    r[idx['Component ID']],
    r[idx['Component']],
    r[idx['Domain']],
    r[idx['Owner']],
    r[idx['Source of Truth']],
    r[idx['Editable']] === 'YES' ? 'CONTROLLED MANUAL EDIT' : 'ENGINE-OWNED / READ ONLY',
    r[idx['Production Critical']],
    r[idx['Status']],
    r[idx['Architecture Version']],
    r[idx['Platform Version']],
    r[idx['Baseline']],
    r[idx['Last Reviewed']]
  ]);

  const sheet = foA216EnsureSheet_(ss, FO_A216_SHEETS.OWNERSHIP, FO_A216_OWNERSHIP_HEADERS);
  foA216ReplaceData_(sheet, FO_A216_OWNERSHIP_HEADERS, rows);
  return {
    status: 'SUCCESS',
    worksheet: FO_A216_SHEETS.OWNERSHIP,
    components: rows.length
  };
}

function foGenerateProductionBaseline() {
  const ss = foDashboard_();
  const registry = ss.getSheetByName(FO_A216_SHEETS.REGISTRY);
  if (!registry || registry.getLastRow() < 2) {
    foGenerateArchitectureRegistry();
  }

  const values = ss.getSheetByName(FO_A216_SHEETS.REGISTRY).getDataRange().getValues();
  const headers = values[0];
  const idx = foA216HeaderMap_(headers);
  const data = values.slice(1).filter(r => r[idx['Component']]);
  const countStatus = status => data.filter(r => r[idx['Status']] === status).length;
  const critical = data.filter(r => r[idx['Production Critical']] === 'YES').length;
  const certification = foA216LatestCertificationStatus_(ss);
  const now = new Date();
  const runId = 'ARCH-BASE-' + Utilities.formatDate(
    now, FO_CONFIG.TIMEZONE || Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'
  );

  const row = [[
    runId,
    now,
    FO_A216_ARCHITECTURE_VERSION,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    ss.getName(),
    ss.getId(),
    ss.getSpreadsheetTimeZone(),
    ss.getSheets().length,
    countStatus(FO_A216_STATUS.PRODUCTION),
    countStatus(FO_A216_STATUS.SUPPORTING),
    countStatus(FO_A216_STATUS.LEGACY),
    countStatus(FO_A216_STATUS.FUTURE),
    critical,
    certification,
    'FROZEN WITH GOVERNED ADDITIVE CHANGE',
    'PENDING RELEASE',
    'v1.0.1-production-certified',
    'A2.1.6 architecture baseline generated from live workbook.'
  ]];

  const sheet = foA216EnsureSheet_(ss, FO_A216_SHEETS.BASELINE, FO_A216_BASELINE_HEADERS);
  foA216AppendRows_(sheet, row);
  return {
    status: 'SUCCESS',
    worksheet: FO_A216_SHEETS.BASELINE,
    baselineRunId: runId,
    latestCertificationStatus: certification
  };
}

function foRunArchitectureFreezeValidation() {
  const ss = foDashboard_();
  const now = new Date();
  const runId = 'ARCH-VAL-' + Utilities.formatDate(
    now, FO_CONFIG.TIMEZONE || Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'
  );
  const results = [];

  Object.keys(FO_A216_SHEETS).forEach(key => {
    const name = FO_A216_SHEETS[key];
    if (name === FO_A216_SHEETS.VALIDATION) return;
    const sheet = ss.getSheetByName(name);
    results.push({
      category: 'SCHEMA',
      control: name,
      status: sheet ? 'PASS' : 'FAIL',
      severity: sheet ? 'NONE' : 'CRITICAL',
      details: sheet ? 'Worksheet found.' : 'Worksheet missing.',
      rows: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0
    });
  });

  const registry = ss.getSheetByName(FO_A216_SHEETS.REGISTRY);
  if (registry) {
    const rows = registry.getLastRow() - 1;
    const sourceTruths = foA216CountValue_(registry, 'Source of Truth', 'YES');
    const production = foA216CountValue_(registry, 'Status', FO_A216_STATUS.PRODUCTION);
    results.push({
      category: 'ARCHITECTURE',
      control: 'Registry population',
      status: rows >= 40 ? 'PASS' : 'FAIL',
      severity: rows >= 40 ? 'NONE' : 'HIGH',
      details: rows + ' component(s) registered.',
      rows: rows
    });
    results.push({
      category: 'ARCHITECTURE',
      control: 'Production authority',
      status: sourceTruths > 0 && production > 0 ? 'PASS' : 'FAIL',
      severity: sourceTruths > 0 && production > 0 ? 'NONE' : 'CRITICAL',
      details: sourceTruths + ' source-of-truth component(s); ' +
        production + ' production component(s).',
      rows: rows
    });
  }

  const dependency = ss.getSheetByName(FO_A216_SHEETS.DEPENDENCIES);
  if (dependency) {
    const missing = foA216CountValue_(
      dependency, 'Status', 'DOCUMENTED / COMPONENT MISSING'
    );
    results.push({
      category: 'LINEAGE',
      control: 'Dependency manifest',
      status: missing === 0 ? 'PASS' : 'PASS WITH OBSERVATIONS',
      severity: missing === 0 ? 'NONE' : 'MEDIUM',
      details: missing === 0 ?
        'All documented dependencies resolve.' :
        missing + ' documented dependency pair(s) reference missing or renamed components.',
      rows: Math.max(0, dependency.getLastRow() - 1)
    });
  }

  const tz = ss.getSpreadsheetTimeZone();
  results.push({
    category: 'CONFIGURATION',
    control: 'Workbook timezone',
    status: tz === 'America/Toronto' ? 'PASS' : 'PASS WITH OBSERVATIONS',
    severity: tz === 'America/Toronto' ? 'NONE' : 'MEDIUM',
    details: 'Workbook timezone: ' + tz +
      (tz === 'America/Toronto' ? '' : '. Recommended: America/Toronto.'),
    rows: 1
  });

  const certification = foA216LatestCertificationStatus_(ss);
  const certified = certification.indexOf('CERTIFIED') >= 0;
  results.push({
    category: 'GOVERNANCE',
    control: 'Production certification',
    status: certified ? 'PASS' : 'PASS WITH OBSERVATIONS',
    severity: certified ? 'NONE' : 'HIGH',
    details: 'Latest certification: ' + certification,
    rows: 1
  });

  const outSheet = foA216EnsureSheet_(
    ss, FO_A216_SHEETS.VALIDATION, FO_A216_VALIDATION_HEADERS
  );
  const output = results.map(r => [
    runId, now, r.category, r.control, r.status, r.severity, r.details, r.rows,
    FO_A216_ARCHITECTURE_VERSION, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
  ]);
  foA216AppendRows_(outSheet, output);

  const failures = results.filter(r => r.status === 'FAIL').length;
  const observations = results.filter(r => r.status === 'PASS WITH OBSERVATIONS').length;
  return {
    status: failures ? 'FAIL' :
      observations ? 'PASS WITH OBSERVATIONS' : 'PASS',
    validationRunId: runId,
    failedControls: failures,
    observationControls: observations,
    passedControls: results.length - failures - observations,
    totalControls: results.length,
    blocking: failures > 0,
    architectureVersion: FO_A216_ARCHITECTURE_VERSION
  };
}

function foRunArchitectureFreeze() {
  const startedAt = new Date();
  const registry = foGenerateArchitectureRegistry();
  const dependencies = foGenerateDependencyInventory();
  const ownership = foGenerateOwnershipMatrix();
  const baseline = foGenerateProductionBaseline();
  const validation = foRunArchitectureFreezeValidation();
  return {
    status: validation.status,
    blocking: validation.blocking,
    startedAt: startedAt,
    completedAt: new Date(),
    registry: registry,
    dependencies: dependencies,
    ownership: ownership,
    baseline: baseline,
    validation: validation,
    nextWave: validation.blocking ? 'REMEDIATE A2.1.6' :
      'A2.2 — Position Risk Calculation Engine'
  };
}

function foRunArchitectureFreezeSmokeTestA216() {
  const result = foRunArchitectureFreeze();
  if (result.validation.failedControls > 0) {
    throw new Error('A2.1.6 blocking validation failure: ' + JSON.stringify(result));
  }
  return {
    status: 'PASS',
    architectureStatus: result.status,
    architectureVersion: FO_A216_ARCHITECTURE_VERSION,
    nextWave: 'A2.2 — Position Risk Calculation Engine',
    result: result
  };
}

function foA216EnsureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const existing = sheet.getLastColumn() ?
    sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
      .getDisplayValues()[0].slice(0, headers.length) : [];
  if (sheet.getLastRow() === 0 || existing.join('|') !== headers.join('|')) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

function foA216ReplaceData_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function foA216AppendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

function foA216HeaderMap_(headers) {
  return headers.reduce((m, h, i) => { m[String(h).trim()] = i; return m; }, {});
}

function foA216CountValue_(sheet, header, value) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return 0;
  const idx = values[0].indexOf(header);
  if (idx < 0) return 0;
  return values.slice(1).filter(r => r[idx] === value).length;
}

function foA216Upstream_(component) {
  return FO_A216_DEPENDENCY_MANIFEST
    .filter(d => d[1] === component).map(d => d[0]);
}

function foA216Downstream_(component) {
  return FO_A216_DEPENDENCY_MANIFEST
    .filter(d => d[0] === component).map(d => d[1]);
}

function foA216LatestCertificationStatus_(ss) {
  const sheet = ss.getSheetByName('Production Certification');
  if (!sheet || sheet.getLastRow() < 2) return 'NOT AVAILABLE';
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const idx = headers.indexOf('Certification Status');
  if (idx < 0) return 'SCHEMA UNKNOWN';
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][idx]) return values[i][idx];
  }
  return 'NOT AVAILABLE';
}

function foA216ClassifyComponent_(name) {
  const n = name.toUpperCase();
  const legacyPatterns = [
    'PORTFOLIO DASHBOARD', 'DECISION SUPPORT ENGINE', 'CAPITAL ALLOCATION ENGINE',
    'CIO PRIORITY QUEUE 3.3A', 'WEEKLY EXECUTIVE REPORT', 'DAILY CIO REPORT'
  ];
  const futurePatterns = ['NET WORTH', 'PERFORMANCE', 'CASH FLOW', 'TAX'];
  const supportingPatterns = [
    'DATA DICTIONARY', 'KNOWLEDGE BASE', 'MARKET SYMBOL REGISTRY',
    'BUY ZONE RULES', 'BUY ZONE TARGETS', 'CONVICTION RULES',
    'MATERIALITY POLICY', 'CAPITAL DEPLOYMENT POLICY',
    'DECISION HISTORY POLICY', 'RISK LIMITS', 'STRESS SCENARIOS'
  ];
  const isLegacy = legacyPatterns.some(p => n === p);
  const isFuture = futurePatterns.some(p => n.indexOf(p) >= 0);
  const isSupporting = supportingPatterns.some(p => n === p);
  const status = isLegacy ? FO_A216_STATUS.LEGACY :
    isFuture ? FO_A216_STATUS.FUTURE :
    isSupporting ? FO_A216_STATUS.SUPPORTING :
    FO_A216_STATUS.PRODUCTION;

  let domain = 'OTHER';
  let owner = 'PLATFORM';
  let layer = 'OPERATIONAL';
  let type = 'WORKSHEET';
  if (n.indexOf('RISK') >= 0 || n.indexOf('STRESS') >= 0 ||
      n.indexOf('SECTOR EXPOSURE') >= 0 || n.indexOf('COUNTRY EXPOSURE') >= 0 ||
      n.indexOf('CURRENCY EXPOSURE') >= 0) {
    domain = 'RISK MANAGEMENT'; owner = 'RISK'; layer = 'ANALYTICS';
  } else if (n.indexOf('CERTIFICATION') >= 0 || n.indexOf('VALIDATION') >= 0 ||
             n.indexOf('HEALTH') >= 0 || n.indexOf('LOG') >= 0) {
    domain = 'GOVERNANCE & OPERATIONS'; owner = 'PLATFORM GOVERNANCE'; layer = 'CONTROL';
  } else if (n.indexOf('EXECUTIVE') >= 0 || n.indexOf('REPORT') >= 0 ||
             n.indexOf('DASHBOARD') >= 0) {
    domain = 'EXECUTIVE REPORTING'; owner = 'CIO REPORTING'; layer = 'PRESENTATION';
  } else if (n.indexOf('CAPITAL') >= 0 || n.indexOf('ALLOCATION') >= 0) {
    domain = 'CAPITAL ALLOCATION & EXECUTION'; owner = 'CIO'; layer = 'DECISION';
  } else if (n.indexOf('BUY ZONE') >= 0 || n.indexOf('MARKET') >= 0 ||
             n.indexOf('IBKR') >= 0) {
    domain = 'MARKET INTELLIGENCE'; owner = 'MARKET DATA'; layer = 'ANALYTICS';
  } else if (n.indexOf('DECISION') >= 0 || n.indexOf('MATERIALITY') >= 0 ||
             n.indexOf('CONVICTION') >= 0 || n.indexOf('TREND') >= 0 ||
             n.indexOf('RECOMMENDATION') >= 0 || n.indexOf('CIO') >= 0) {
    domain = 'CIO DECISION INTELLIGENCE'; owner = 'CIO'; layer = 'DECISION';
  } else if (n.indexOf('PORTFOLIO') >= 0 || n.indexOf('HOLDINGS') >= 0 ||
             n.indexOf('LEDGER') >= 0) {
    domain = 'PORTFOLIO DATA & ANALYTICS'; owner = 'PORTFOLIO'; layer = 'DATA';
  } else if (n.indexOf('KNOWLEDGE') >= 0 || n.indexOf('DICTIONARY') >= 0) {
    domain = 'KNOWLEDGE & DOCUMENTATION'; owner = 'PLATFORM GOVERNANCE'; layer = 'REFERENCE';
  }

  const sourceTruth = [
    'Portfolio Master', 'Market Data Cache', 'Market Symbol Registry',
    'Buy Zone Rules', 'Buy Zone Targets', 'Conviction Rules',
    'Capital Deployment Policy', 'Risk Limits', 'Stress Scenarios',
    'Production Certification', 'Investment Decision Support',
    'Capital Deployment Priorities'
  ].indexOf(name) >= 0;

  const engineOwned = [
    'Dashboard', 'Report', 'History', 'Log', 'Validation', 'Snapshot',
    'Performance', 'Exposure', 'Intelligence', 'Priorities', 'Certification'
  ].some(token => name.indexOf(token) >= 0);

  const critical = sourceTruth || [
    'Portfolio State', 'Portfolio Valuation', 'Portfolio Snapshot',
    'Executive Dashboard', 'Autonomous CIO Run Log', 'Autonomous CIO Step Log',
    'Position Risk', 'Portfolio Risk'
  ].indexOf(name) >= 0;

  return {
    componentType: type,
    domain: domain,
    layer: layer,
    owner: owner,
    sourceOfTruth: sourceTruth,
    editable: !engineOwned || isSupporting,
    critical: critical,
    status: status,
    notes: isLegacy ? 'Overlapping prior-generation component. No new dependencies.' :
      isFuture ? 'Not part of current production capability.' :
      isSupporting ? 'Policy/reference/supporting component.' :
      'Authoritative production component unless superseded in Architecture Registry.'
  };
}
