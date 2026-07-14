/**
 * Wave A2.1 — Portfolio Risk Architecture & Data Contracts.
 *
 * This wave creates the institutional risk worksheet contracts.
 * It does not calculate portfolio risk. Calculation engines begin in A2.2.
 */

const FO_PORTFOLIO_RISK_CONTRACTS_A21 = {
  PORTFOLIO_RISK: [
    'Run ID',
    'Timestamp',
    'Portfolio Value',
    'Risk Score',
    'Diversification Score',
    'Largest Position %',
    'Top 5 %',
    'Sector Concentration %',
    'Currency Concentration %',
    'Stress Test Score',
    'Overall Risk',
    'Recommendation',
    'Platform Version',
    'Baseline'
  ],
  POSITION_RISK: [
    'Run ID',
    'Timestamp',
    'Rank',
    'Ticker',
    'Account',
    'Quantity',
    'Current Price',
    'Market Value',
    'Portfolio Weight %',
    'Asset Class',
    'Sector',
    'Country',
    'Currency',
    'Concentration Score',
    'Data Quality Score',
    'Risk Score',
    'Risk Level',
    'Primary Risk Driver',
    'Recommendation',
    'Platform Version',
    'Baseline'
  ],
  SECTOR_EXPOSURE: [
    'Run ID',
    'Timestamp',
    'Sector',
    'Market Value',
    'Portfolio Weight %',
    'Limit %',
    'Limit Status',
    'Platform Version',
    'Baseline'
  ],
  COUNTRY_EXPOSURE: [
    'Run ID',
    'Timestamp',
    'Country',
    'Market Value',
    'Portfolio Weight %',
    'Limit %',
    'Limit Status',
    'Platform Version',
    'Baseline'
  ],
  CURRENCY_EXPOSURE: [
    'Run ID',
    'Timestamp',
    'Currency',
    'Market Value',
    'Portfolio Weight %',
    'Limit %',
    'Limit Status',
    'Platform Version',
    'Baseline'
  ],
  RISK_LIMITS: [
    'Limit ID',
    'Category',
    'Scope',
    'Limit Type',
    'Warning Threshold %',
    'Breach Threshold %',
    'Severity',
    'Enabled',
    'Policy Rationale',
    'Last Updated',
    'Platform Version',
    'Baseline'
  ],
  STRESS_SCENARIOS: [
    'Scenario ID',
    'Scenario',
    'Scenario Type',
    'Shock %',
    'Affected Scope',
    'Severity',
    'Enabled',
    'Description',
    'Last Updated',
    'Platform Version',
    'Baseline'
  ],
  RISK_DASHBOARD: [
    'Section',
    'Metric',
    'Value',
    'Status',
    'Commentary',
    'Timestamp',
    'Run ID',
    'Platform Version',
    'Baseline'
  ],
  RISK_HISTORY: [
    'Run ID',
    'Timestamp',
    'Portfolio Value',
    'Risk Score',
    'Overall Risk',
    'Diversification Score',
    'Largest Position %',
    'Top 5 %',
    'Sector Concentration %',
    'Currency Concentration %',
    'Stress Test Score',
    'Recommendation',
    'State Signature',
    'Platform Version',
    'Baseline'
  ]
};

function foSetupPortfolioRiskArchitecture() {
  const module = 'PortfolioRiskArchitecture';
  const dashboard = foDashboard_();

  foInfo_(module, 'Start', 'Portfolio Risk architecture setup started.');

  const definitions = [
    [FO_SHEETS.PORTFOLIO_RISK, FO_PORTFOLIO_RISK_CONTRACTS_A21.PORTFOLIO_RISK],
    [FO_SHEETS.POSITION_RISK, FO_PORTFOLIO_RISK_CONTRACTS_A21.POSITION_RISK],
    [FO_SHEETS.SECTOR_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.SECTOR_EXPOSURE],
    [FO_SHEETS.COUNTRY_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.COUNTRY_EXPOSURE],
    [FO_SHEETS.CURRENCY_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.CURRENCY_EXPOSURE],
    [FO_SHEETS.RISK_LIMITS, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_LIMITS],
    [FO_SHEETS.STRESS_SCENARIOS, FO_PORTFOLIO_RISK_CONTRACTS_A21.STRESS_SCENARIOS],
    [FO_SHEETS.RISK_DASHBOARD, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_DASHBOARD],
    [FO_SHEETS.RISK_HISTORY, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_HISTORY]
  ];

  definitions.forEach(function(definition) {
    foEnsureRiskContractSheetA21_(
      dashboard,
      definition[0],
      definition[1]
    );
  });

  foSeedDefaultRiskLimitsA21_(dashboard);
  foSeedDefaultStressScenariosA21_(dashboard);

  foInfo_(module, 'Complete', 'Portfolio Risk architecture setup completed.');

  return {
    status: 'SUCCESS',
    worksheetsEnsured: definitions.length,
    riskLimitsSeeded: foCountPopulatedRowsA21_(
      dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS)
    ),
    stressScenariosSeeded: foCountPopulatedRowsA21_(
      dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS)
    ),
    platformVersion: FO_CONFIG.PLATFORM_VERSION,
    baseline: FO_CONFIG.BASELINE
  };
}

function foEnsureRiskContractSheetA21_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    const created = spreadsheet.insertSheet(name);
    created.getRange(1, 1, 1, headers.length).setValues([headers]);
    created.setFrozenRows(1);
    return created;
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const actual = foGetSheetHeaders_(sheet);
  const matches =
    actual.length === headers.length &&
    headers.every(function(header, index) {
      return actual[index] === header;
    });

  if (!matches) {
    throw new Error(
      'Risk contract mismatch for "' +
        name +
        '". Expected: ' +
        JSON.stringify(headers) +
        ' Actual: ' +
        JSON.stringify(actual)
    );
  }

  return sheet;
}

function foSeedDefaultRiskLimitsA21_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS);
  const existing = foReadFirstColumnValuesA21_(sheet);

  const rows = [
    [
      'RISK-LIMIT-LARGEST-POSITION',
      'CONCENTRATION',
      'SINGLE POSITION',
      'MAXIMUM',
      15,
      20,
      'HIGH',
      true,
      'Escalate concentrated single-security exposure.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'RISK-LIMIT-TOP-5',
      'CONCENTRATION',
      'TOP 5 POSITIONS',
      'MAXIMUM',
      65,
      75,
      'HIGH',
      true,
      'Control aggregate concentration in the five largest positions.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'RISK-LIMIT-SECTOR',
      'CONCENTRATION',
      'SINGLE SECTOR',
      'MAXIMUM',
      40,
      50,
      'HIGH',
      true,
      'Control excessive sector concentration.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'RISK-LIMIT-CURRENCY',
      'CURRENCY',
      'SINGLE FOREIGN CURRENCY',
      'MAXIMUM',
      70,
      80,
      'MEDIUM',
      true,
      'Monitor unhedged foreign-currency concentration.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'RISK-LIMIT-DATA-QUALITY',
      'DATA QUALITY',
      'PORTFOLIO',
      'MINIMUM',
      80,
      70,
      'HIGH',
      true,
      'Risk calculations require adequate portfolio data quality.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]
  ];

  rows.forEach(function(row) {
    if (!existing[row[0]]) {
      sheet.appendRow(row);
    }
  });
}

function foSeedDefaultStressScenariosA21_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS);
  const existing = foReadFirstColumnValuesA21_(sheet);

  const rows = [
    [
      'STRESS-NASDAQ-15',
      'NASDAQ -15%',
      'MARKET',
      -15,
      'NASDAQ / GROWTH',
      'HIGH',
      true,
      'Broad growth-equity correction.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'STRESS-AI-25',
      'AI THEME -25%',
      'THEME',
      -25,
      'AI / QUANTUM / SEMICONDUCTORS',
      'CRITICAL',
      true,
      'Severe correction in AI-linked and speculative technology holdings.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'STRESS-RATES-100',
      'INTEREST RATES +1%',
      'MACRO',
      1,
      'RATE-SENSITIVE ASSETS',
      'MEDIUM',
      true,
      'Parallel 100-basis-point interest-rate shock.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'STRESS-CAD-5',
      'CAD +5%',
      'CURRENCY',
      5,
      'USD EXPOSURE',
      'MEDIUM',
      true,
      'Canadian-dollar appreciation against USD holdings.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'STRESS-RECESSION',
      'GLOBAL RECESSION',
      'MACRO',
      -20,
      'ALL RISK ASSETS',
      'CRITICAL',
      true,
      'Global recession and broad risk-asset repricing.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ],
    [
      'STRESS-BLACK-SWAN',
      'BLACK SWAN',
      'EXTREME',
      -35,
      'ALL RISK ASSETS',
      'CRITICAL',
      true,
      'Extreme market-dislocation scenario.',
      new Date(),
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]
  ];

  rows.forEach(function(row) {
    if (!existing[row[0]]) {
      sheet.appendRow(row);
    }
  });
}

function foReadFirstColumnValuesA21_(sheet) {
  const result = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return result;
  }

  sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .forEach(function(row) {
      const value = String(row[0] || '').trim();
      if (value) {
        result[value] = true;
      }
    });

  return result;
}

function foCountPopulatedRowsA21_(sheet) {
  return sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
}

function foRunPortfolioRiskArchitectureSmokeTest() {
  const setup = foSetupPortfolioRiskArchitecture();
  const dashboard = foDashboard_();
  const checks = [];

  const definitions = [
    [FO_SHEETS.PORTFOLIO_RISK, FO_PORTFOLIO_RISK_CONTRACTS_A21.PORTFOLIO_RISK],
    [FO_SHEETS.POSITION_RISK, FO_PORTFOLIO_RISK_CONTRACTS_A21.POSITION_RISK],
    [FO_SHEETS.SECTOR_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.SECTOR_EXPOSURE],
    [FO_SHEETS.COUNTRY_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.COUNTRY_EXPOSURE],
    [FO_SHEETS.CURRENCY_EXPOSURE, FO_PORTFOLIO_RISK_CONTRACTS_A21.CURRENCY_EXPOSURE],
    [FO_SHEETS.RISK_LIMITS, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_LIMITS],
    [FO_SHEETS.STRESS_SCENARIOS, FO_PORTFOLIO_RISK_CONTRACTS_A21.STRESS_SCENARIOS],
    [FO_SHEETS.RISK_DASHBOARD, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_DASHBOARD],
    [FO_SHEETS.RISK_HISTORY, FO_PORTFOLIO_RISK_CONTRACTS_A21.RISK_HISTORY]
  ];

  definitions.forEach(function(definition) {
    const sheet = dashboard.getSheetByName(definition[0]);
    const actual = foGetSheetHeaders_(sheet);
    const expected = definition[1];

    if (!sheet) {
      throw new Error('Missing risk worksheet: ' + definition[0]);
    }

    if (
      actual.length !== expected.length ||
      !expected.every(function(header, index) {
        return actual[index] === header;
      })
    ) {
      throw new Error(
        'Invalid risk contract for ' +
          definition[0] +
          ': ' +
          JSON.stringify(actual)
      );
    }

    checks.push({
      worksheet: definition[0],
      status: 'PASS',
      columns: actual.length
    });
  });

  const riskLimitCount = foCountPopulatedRowsA21_(
    dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS)
  );
  const scenarioCount = foCountPopulatedRowsA21_(
    dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS)
  );

  if (riskLimitCount < 5) {
    throw new Error(
      'Expected at least 5 default risk limits; found ' + riskLimitCount
    );
  }

  if (scenarioCount < 6) {
    throw new Error(
      'Expected at least 6 default stress scenarios; found ' + scenarioCount
    );
  }

  return {
    status: 'PASS',
    setup: setup,
    worksheetChecks: checks,
    riskLimits: riskLimitCount,
    stressScenarios: scenarioCount,
    calculationsImplemented: false,
    nextWave: 'A2.2 — Position Risk Engine'
  };
}
