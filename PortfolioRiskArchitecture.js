/**
 * Wave A2.1 — Portfolio Risk Architecture & Data Contracts.
 *
 * This wave creates the institutional risk worksheet contracts.
 * It does not calculate portfolio risk. Calculation engines begin in A2.2.
 */

/**
 * Wave A2.1.1 — Portfolio Risk Architecture Integration.
 *
 * Corrects A2.1 so that the Portfolio Risk Engine consumes the existing
 * exposure-attribution worksheets instead of attempting to replace them.
 *
 * New risk-owned worksheets:
 * - Portfolio Risk
 * - Position Risk
 * - Risk Limits
 * - Stress Scenarios
 * - Risk Dashboard
 * - Risk History
 *
 * Existing upstream dependencies:
 * - Sector Exposure
 * - Currency Exposure
 *
 * Risk-owned exposure output:
 * - Country Exposure
 */

const FO_PORTFOLIO_RISK_CONTRACTS_A211 = {
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
  COUNTRY_EXPOSURE: [
    'Run ID',
    'Timestamp',
    'Country',
    'Market Value',
    'Portfolio Weight %',
    'Position Count',
    'Tickers',
    'Data Quality Status',
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

const FO_PORTFOLIO_RISK_EXPOSURE_DEPENDENCIES_A211 = [
  {
    sheetName: FO_SHEETS.SECTOR_EXPOSURE,
    dimension: 'Sector',
    requiredHeaders: [
      'Timestamp',
      'Group',
      'Market Value',
      'Portfolio Weight',
      'Platform Version',
      'Baseline'
    ]
  },
  {
    sheetName: FO_SHEETS.CURRENCY_EXPOSURE,
    dimension: 'Currency',
    requiredHeaders: [
      'Timestamp',
      'Group',
      'Market Value',
      'Portfolio Weight',
      'Platform Version',
      'Baseline'
    ]
  }
];

function foSetupPortfolioRiskArchitecture() {
  const module = 'PortfolioRiskArchitecture';
  const dashboard = foDashboard_();

  foInfo_(
    module,
    'Start',
    'Portfolio Risk architecture integration setup started.'
  );

  const ownedDefinitions = foPortfolioRiskOwnedDefinitionsA211_();

  ownedDefinitions.forEach(function(definition) {
    foEnsureRiskContractSheetA211_(
      dashboard,
      definition[0],
      definition[1]
    );
  });

  const dependencies = foValidateExposureDependenciesA211_(dashboard);

  foSeedDefaultRiskLimitsA211_(dashboard);
  foSeedDefaultStressScenariosA211_(dashboard);

  foInfo_(
    module,
    'Complete',
    'Portfolio Risk architecture integration setup completed.'
  );

  return {
    status: 'SUCCESS',
    ownedWorksheetsEnsured: ownedDefinitions.length,
    exposureDependenciesValidated: dependencies.length,
    countryExposureOwnership: 'Portfolio Risk',
    exposureDependencies: dependencies,
    riskLimitsSeeded: foCountPopulatedRowsA211_(
      dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS)
    ),
    stressScenariosSeeded: foCountPopulatedRowsA211_(
      dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS)
    ),
    calculationsImplemented: false,
    platformVersion: FO_CONFIG.PLATFORM_VERSION,
    baseline: FO_CONFIG.BASELINE
  };
}

function foPortfolioRiskOwnedDefinitionsA211_() {
  return [
    [
      FO_SHEETS.PORTFOLIO_RISK,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.PORTFOLIO_RISK
    ],
    [
      FO_SHEETS.POSITION_RISK,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.POSITION_RISK
    ],
    [
      FO_SHEETS.COUNTRY_EXPOSURE,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.COUNTRY_EXPOSURE
    ],
    [
      FO_SHEETS.RISK_LIMITS,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.RISK_LIMITS
    ],
    [
      FO_SHEETS.STRESS_SCENARIOS,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.STRESS_SCENARIOS
    ],
    [
      FO_SHEETS.RISK_DASHBOARD,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.RISK_DASHBOARD
    ],
    [
      FO_SHEETS.RISK_HISTORY,
      FO_PORTFOLIO_RISK_CONTRACTS_A211.RISK_HISTORY
    ]
  ];
}

function foEnsureRiskContractSheetA211_(spreadsheet, name, headers) {
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
      'Risk-owned contract mismatch for "' +
        name +
        '". Expected: ' +
        JSON.stringify(headers) +
        ' Actual: ' +
        JSON.stringify(actual)
    );
  }

  return sheet;
}

function foValidateExposureDependenciesA211_(dashboard) {
  return FO_PORTFOLIO_RISK_EXPOSURE_DEPENDENCIES_A211.map(
    function(dependency) {
      const sheet = dashboard.getSheetByName(dependency.sheetName);

      if (!sheet) {
        throw new Error(
          'Required exposure dependency missing: ' +
            dependency.sheetName
        );
      }

      const actual = foGetSheetHeaders_(sheet);
      const missing = dependency.requiredHeaders.filter(
        function(header) {
          return actual.indexOf(header) < 0;
        }
      );

      if (missing.length) {
        throw new Error(
          'Exposure dependency contract invalid for "' +
            dependency.sheetName +
            '". Missing: ' +
            JSON.stringify(missing) +
            ' Actual: ' +
            JSON.stringify(actual)
        );
      }

      return {
        worksheet: dependency.sheetName,
        dimension: dependency.dimension,
        status: 'PASS',
        columns: actual.length,
        rows: Math.max(sheet.getLastRow() - 1, 0),
        ownership: 'Portfolio Exposure Attribution'
      };
    }
  );
}

function foSeedDefaultRiskLimitsA211_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS);
  const existing = foReadFirstColumnValuesA211_(sheet);

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

function foSeedDefaultStressScenariosA211_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS);
  const existing = foReadFirstColumnValuesA211_(sheet);

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

function foReadFirstColumnValuesA211_(sheet) {
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

function foCountPopulatedRowsA211_(sheet) {
  return sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
}

function foRunPortfolioRiskArchitectureSmokeTest() {
  const setup = foSetupPortfolioRiskArchitecture();
  const dashboard = foDashboard_();
  const ownedChecks = [];

  foPortfolioRiskOwnedDefinitionsA211_().forEach(
    function(definition) {
      const sheet = dashboard.getSheetByName(definition[0]);
      const actual = sheet ? foGetSheetHeaders_(sheet) : [];
      const expected = definition[1];

      if (!sheet) {
        throw new Error(
          'Missing risk-owned worksheet: ' + definition[0]
        );
      }

      if (
        actual.length !== expected.length ||
        !expected.every(function(header, index) {
          return actual[index] === header;
        })
      ) {
        throw new Error(
          'Invalid risk-owned contract for ' +
            definition[0] +
            ': ' +
            JSON.stringify(actual)
        );
      }

      ownedChecks.push({
        worksheet: definition[0],
        status: 'PASS',
        columns: actual.length,
        ownership: 'Portfolio Risk'
      });
    }
  );

  const dependencyChecks =
    foValidateExposureDependenciesA211_(dashboard);

  const riskLimitCount = foCountPopulatedRowsA211_(
    dashboard.getSheetByName(FO_SHEETS.RISK_LIMITS)
  );
  const scenarioCount = foCountPopulatedRowsA211_(
    dashboard.getSheetByName(FO_SHEETS.STRESS_SCENARIOS)
  );

  if (riskLimitCount < 5) {
    throw new Error(
      'Expected at least 5 default risk limits; found ' +
        riskLimitCount
    );
  }

  if (scenarioCount < 6) {
    throw new Error(
      'Expected at least 6 default stress scenarios; found ' +
        scenarioCount
    );
  }

  return {
    status: 'PASS',
    setup: setup,
    riskOwnedWorksheetChecks: ownedChecks,
    exposureDependencyChecks: dependencyChecks,
    riskLimits: riskLimitCount,
    stressScenarios: scenarioCount,
    calculationsImplemented: false,
    correctedWave: 'A2.1.2',
    nextWave: 'A2.2 — Position Risk Engine'
  };
}
