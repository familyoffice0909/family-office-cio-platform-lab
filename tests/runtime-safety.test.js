'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const DASHBOARD_ID = 'synthetic-dashboard-id-0001';
const LEDGER_ID = 'synthetic-ledger-id-000002';

function createRuntime(options = {}) {
  const values = {
    FO_ENVIRONMENT: 'LAB',
    FO_DASHBOARD_SPREADSHEET_ID: DASHBOARD_ID,
    FO_LEDGER_SPREADSHEET_ID: LEDGER_ID,
    ...options.properties
  };
  const scriptProperties = {
    getProperty: jest.fn((key) => values[key] || null)
  };
  const lock = options.lock || {
    tryLock: jest.fn(() => true),
    releaseLock: jest.fn()
  };
  const context = vm.createContext({
    FO_CONFIG: options.FO_CONFIG || {
      PLATFORM_VERSION: 'v3.2.10',
      BASELINE: 'CB-002'
    },
    PropertiesService: {
      getScriptProperties: jest.fn(() => scriptProperties)
    },
    LockService: {
      getScriptLock: jest.fn(() => lock)
    },
    SpreadsheetApp: options.SpreadsheetApp,
    console
  });

  vm.runInContext(read('RuntimeSafety.js'), context);
  vm.runInContext(read('RuntimeLockService.js'), context);

  return { context, lock, scriptProperties };
}

function createMorningBriefPreflightRuntime(options = {}) {
  const dashboardSheets = new Set(options.dashboardSheets || [
    'Executive Dashboard',
    'Portfolio Master',
    'Portfolio Snapshot',
    'Portfolio Performance Positions',
    'Portfolio Valuation Summary',
    'Portfolio Optimization Summary',
    'Portfolio Scenario Summary',
    'Risk Budget Summary',
    'Investment Decision Support',
    'Executive Decision State A233',
    'Executive CIO Report',
    'Automation Log',
    'Executive Report Archive',
    'Knowledge Base'
  ]);

  const ledgerSheets = new Set(options.ledgerSheets || [
    'Version History',
    'Canadian Market Access Library',
    'Outcomes',
    'Lessons Learned',
    'Orchestration Log',
    'Report Archive'
  ]);

  const dashboard = options.dashboard === null ? null : {
    getName: jest.fn(function() {
      return 'Family Office Portfolio Dashboard';
    }),
    getSheetByName: jest.fn(function(sheetName) {
      return dashboardSheets.has(sheetName)
        ? { getName: function() { return sheetName; } }
        : null;
    })
  };

  const ledger = options.ledger === null ? null : {
    getName: jest.fn(function() {
      return 'Family Office Investment Ledger';
    }),
    getSheetByName: jest.fn(function(sheetName) {
      return ledgerSheets.has(sheetName)
        ? { getName: function() { return sheetName; } }
        : null;
    })
  };

  const context = vm.createContext({
    console: console,
    foDashboard_: jest.fn(function() { return dashboard; }),
    foLedger_: jest.fn(function() { return ledger; })
  });

  vm.runInContext(read('ExecutiveDashboardEngine.js'), context);
  vm.runInContext(read('ExecutiveReportingEngine.js'), context);

  return {
    context: context,
    dashboard: dashboard,
    ledger: ledger
  };
}

describe('Wave R1.3.0.2 runtime guard', () => {
  test('accepts a complete LAB configuration', () => {
    const { context } = createRuntime();

    const configuration = context.foAssertRuntimeSafety_('Unit test');

    expect(configuration.environment).toBe('LAB');
    expect(configuration.dashboardSpreadsheetId).toBe(DASHBOARD_ID);
    expect(configuration.ledgerSpreadsheetId).toBe(LEDGER_ID);
  });

  test.each([
    ['missing environment', { FO_ENVIRONMENT: '' }],
    ['unknown environment', { FO_ENVIRONMENT: 'STAGING' }],
    ['missing dashboard', { FO_DASHBOARD_SPREADSHEET_ID: '' }],
    ['missing ledger', { FO_LEDGER_SPREADSHEET_ID: '' }],
    ['same workbook for both roles', {
      FO_DASHBOARD_SPREADSHEET_ID: DASHBOARD_ID,
      FO_LEDGER_SPREADSHEET_ID: DASHBOARD_ID
    }]
  ])('fails closed for %s', (_label, properties) => {
    const { context } = createRuntime({ properties });

    expect(() => context.foAssertRuntimeSafety_('Unit test'))
      .toThrow('Runtime safety blocked operation');
  });

  test('requires an explicit production write enable flag', () => {
    const disabled = createRuntime({
      properties: { FO_ENVIRONMENT: 'PRODUCTION' }
    });
    const enabled = createRuntime({
      properties: {
        FO_ENVIRONMENT: 'PRODUCTION',
        FO_PRODUCTION_WRITE_ENABLED: 'TRUE'
      }
    });

    expect(() => disabled.context.foAssertRuntimeSafety_('Production test'))
      .toThrow('production writes are disabled');
    expect(enabled.context.foAssertRuntimeSafety_('Production test').environment)
      .toBe('PRODUCTION');
  });

  test('SpreadsheetService validates the opened workbook identity', () => {
    const SpreadsheetApp = {
      openById: jest.fn(() => ({ getId: () => LEDGER_ID }))
    };
    const { context } = createRuntime({ SpreadsheetApp });
    vm.runInContext(read('SpreadsheetService.js'), context);

    expect(() => context.foDashboard_())
      .toThrow('opened workbook does not match the configured dashboard target');
    expect(SpreadsheetApp.openById).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  test('invalid configuration blocks access before SpreadsheetApp is called', () => {
    const SpreadsheetApp = { openById: jest.fn() };
    const { context } = createRuntime({
      properties: { FO_ENVIRONMENT: '' },
      SpreadsheetApp
    });
    vm.runInContext(read('SpreadsheetService.js'), context);

    expect(() => context.foDashboard_())
      .toThrow('Runtime safety blocked operation');
    expect(SpreadsheetApp.openById).not.toHaveBeenCalled();
  });
});




describe('R8.3 A233 adapter compatibility', () => {

  test('anchors ancillary evidence to decision state even when ancillary sheets have newer runs', () => {
    const context = loadRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['EXEC-1', '2026-08-08T10:00:00Z', 'OLD'],
        ['EXEC-2', '2026-08-08T11:00:00Z', 'CURRENT']
      ]),

      'Report Action Cards A233': makeSheet([
        ['Run ID', 'Timestamp', 'Action'],
        ['EXEC-2', '2026-08-08T11:01:00Z', 'CURRENT'],
        ['EXEC-3', '2026-08-08T12:01:00Z', 'UNRELATED NEWER RUN']
      ]),

      'Report Conflicts A233': makeSheet([
        ['Run ID', 'Timestamp', 'Conflict'],
        ['EXEC-2', '2026-08-08T11:02:00Z', 'CURRENT'],
        ['EXEC-4', '2026-08-08T12:02:00Z', 'UNRELATED NEWER RUN']
      ]),

      'Report Data Readiness A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['EXEC-2', '2026-08-08T11:03:00Z', 'CURRENT'],
        ['EXEC-5', '2026-08-08T12:03:00Z', 'UNRELATED NEWER RUN']
      ])
    });

    const evidence = context.foGetA233ExecutiveEvidence_(dashboard);

    expect(evidence.decisionState.runId).toBe('EXEC-2');
    expect(evidence.actionCards.runId).toBe('EXEC-2');
    expect(evidence.conflicts.runId).toBe('EXEC-2');
    expect(evidence.dataReadiness.runId).toBe('EXEC-2');

    expect(evidence.actionCards.rows).toEqual([
      {
        'Run ID': 'EXEC-2',
        Timestamp: '2026-08-08T11:01:00Z',
        Action: 'CURRENT'
      }
    ]);

    expect(evidence.conflicts.rows).toEqual([
      {
        'Run ID': 'EXEC-2',
        Timestamp: '2026-08-08T11:02:00Z',
        Conflict: 'CURRENT'
      }
    ]);

    expect(evidence.dataReadiness.rows).toEqual([
      {
        'Run ID': 'EXEC-2',
        Timestamp: '2026-08-08T11:03:00Z',
        Metric: 'CURRENT'
      }
    ]);
  });

  function loadRuntime() {
    const context = vm.createContext({
      console,
      FO_SHEETS: {
        EXECUTIVE_DECISION_STATE_A233: 'Executive Decision State A233',
        REPORT_ACTION_CARDS_A233: 'Report Action Cards A233',
        REPORT_CONFLICTS_A233: 'Report Conflicts A233',
        REPORT_DATA_READINESS_A233: 'Report Data Readiness A233'
      }
    });

    vm.runInContext(
      read('SpreadsheetService.js'),
      context,
      { filename: 'SpreadsheetService.js' }
    );

    vm.runInContext(
      read('ExecutiveEvidenceService.js'),
      context,
      { filename: 'ExecutiveEvidenceService.js' }
    );

    return context;
  }

  function makeSheet(values) {
    return {
      getDataRange: () => ({
        getValues: () => values
      })
    };
  }

  function makeDashboard(sheets) {
    return {
      getSheetByName: name => sheets[name] || null
    };
  }

  test('shared decision-state resolver preserves legacy final-physical-run semantics', () => {
    const context = loadRuntime();

    const sheet = makeSheet([
      ['Run ID', 'Timestamp', 'Metric', 'Value'],
      ['EXEC-1', '2026-08-08T09:00:00Z', 'Portfolio Posture', 'HOLD'],
      ['EXEC-2', '2026-08-08T10:00:00Z', 'Portfolio Posture', 'RISK REDUCTION FIRST'],
      ['EXEC-1', '2026-08-08T11:00:00Z', 'Execution Status', 'BLOCKED']
    ]);

    const dashboard = makeDashboard({
      'Executive Decision State A233': sheet
    });

    const legacy = context.foLatestRows_(sheet, 'Run ID');

    const shared = context.foGetExecutiveEvidenceSource_(
      'decisionState',
      dashboard
    );

    expect(shared.runId).toBe(legacy.runId);
    expect(shared.rows).toEqual(legacy.rows);
  });

  test('shared A233 sources preserve same-run filtering required by Weekly', () => {
    const context = loadRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['EXEC-1', '2026-08-08T10:00:00Z', 'Portfolio Posture'],
        ['EXEC-2', '2026-08-08T11:00:00Z', 'Portfolio Posture']
      ]),

      'Report Action Cards A233': makeSheet([
        ['Run ID', 'Timestamp', 'Action'],
        ['EXEC-1', '2026-08-08T10:01:00Z', 'OLD'],
        ['EXEC-2', '2026-08-08T11:01:00Z', 'CURRENT']
      ]),

      'Report Conflicts A233': makeSheet([
        ['Run ID', 'Timestamp', 'Conflict'],
        ['EXEC-1', '2026-08-08T10:02:00Z', 'OLD'],
        ['EXEC-2', '2026-08-08T11:02:00Z', 'CURRENT']
      ]),

      'Report Data Readiness A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['EXEC-1', '2026-08-08T10:03:00Z', 'OLD'],
        ['EXEC-2', '2026-08-08T11:03:00Z', 'CURRENT']
      ])
    });

    const evidence = context.foGetA233ExecutiveEvidence_(dashboard);

    const decisionRunId = evidence.decisionState.runId;

    expect(decisionRunId).toBe('EXEC-2');

    expect(
      evidence.actionCards.rows.every(
        row => row['Run ID'] === decisionRunId
      )
    ).toBe(true);

    expect(
      evidence.conflicts.rows.every(
        row => row['Run ID'] === decisionRunId
      )
    ).toBe(true);

    expect(
      evidence.dataReadiness.rows.every(
        row => row['Run ID'] === decisionRunId
      )
    ).toBe(true);
  });

  test('shared evidence path does not synthesize missing A233 evidence', () => {
    const context = loadRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp']
      ])
    });

    const evidence = context.foGetA233ExecutiveEvidence_(dashboard);

    expect(evidence.decisionState.available).toBe(false);
    expect(evidence.decisionState.runId).toBe('');
    expect(evidence.decisionState.rows).toEqual([]);
  });
});

describe('R8.3 ExecutiveEvidenceService resolver', () => {
  function loadEvidenceRuntime() {
    const context = vm.createContext({
      console,
      FO_SHEETS: {
        EXECUTIVE_DECISION_STATE_A233: 'Executive Decision State A233',
        REPORT_ACTION_CARDS_A233: 'Report Action Cards A233',
        REPORT_CONFLICTS_A233: 'Report Conflicts A233',
        REPORT_DATA_READINESS_A233: 'Report Data Readiness A233'
      }
    });

    vm.runInContext(
      read('SpreadsheetService.js'),
      context,
      { filename: 'SpreadsheetService.js' }
    );

    vm.runInContext(
      read('ExecutiveEvidenceService.js'),
      context,
      { filename: 'ExecutiveEvidenceService.js' }
    );

    return context;
  }

  function makeSheet(values) {
    return {
      getDataRange: () => ({
        getValues: () => values
      })
    };
  }

  function makeDashboard(sheets) {
    return {
      getSheetByName: name => sheets[name] || null
    };
  }

  test('resolver selects the run represented by the final physical row', () => {
    const context = loadEvidenceRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric', 'Value'],
        ['RUN-1', '2026-08-08T10:00:00Z', 'A', 1],
        ['RUN-2', '2026-08-08T11:00:00Z', 'B', 2],
        ['RUN-1', '2026-08-08T12:00:00Z', 'C', 3]
      ])
    });

    const result = context.foGetExecutiveEvidenceSource_(
      'decisionState',
      dashboard
    );

    expect(result.available).toBe(true);
    expect(result.runId).toBe('RUN-1');
    expect(result.rows).toEqual([
      {
        'Run ID': 'RUN-1',
        Timestamp: '2026-08-08T10:00:00Z',
        Metric: 'A',
        Value: 1
      },
      {
        'Run ID': 'RUN-1',
        Timestamp: '2026-08-08T12:00:00Z',
        Metric: 'C',
        Value: 3
      }
    ]);
  });

  test('resolver normalizes timestamp and preserves selected metadata field', () => {
    const context = loadEvidenceRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['RUN-9', '2026-08-08T13:45:00Z', 'Portfolio Posture']
      ])
    });

    const result = context.foGetExecutiveEvidenceSource_(
      'decisionState',
      dashboard
    );

    expect(result.timestamp).toBe('2026-08-08T13:45:00Z');
    expect(result.rawMetadata.runIdField).toBe('Run ID');
    expect(result.rawMetadata.timestampField).toBe('Timestamp');
  });

  test('resolver fails closed when source sheet is unavailable', () => {
    const context = loadEvidenceRuntime();
    const dashboard = makeDashboard({});

    const result = context.foGetExecutiveEvidenceSource_(
      'decisionState',
      dashboard
    );

    expect(result.available).toBe(false);
    expect(result.runId).toBe('');
    expect(result.rows).toEqual([]);
    expect(result.diagnostics).toContain('SOURCE_UNAVAILABLE');
  });

  test('resolver fails closed when current run identity is unavailable', () => {
    const context = loadEvidenceRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp', 'Metric'],
        ['', '2026-08-08T13:45:00Z', 'Portfolio Posture']
      ])
    });

    const result = context.foGetExecutiveEvidenceSource_(
      'decisionState',
      dashboard
    );

    expect(result.available).toBe(false);
    expect(result.runId).toBe('');
    expect(result.rows).toEqual([]);
    expect(result.diagnostics).toContain('RUN_ID_UNAVAILABLE');
  });

  test('A233 aggregate resolves all four governed evidence sources', () => {
    const context = loadEvidenceRuntime();

    const dashboard = makeDashboard({
      'Executive Decision State A233': makeSheet([
        ['Run ID', 'Timestamp'],
        ['DEC-1', '2026-08-08T10:00:00Z']
      ]),
      'Report Action Cards A233': makeSheet([
        ['Run ID', 'Timestamp'],
        ['DEC-1', '2026-08-08T10:01:00Z']
      ]),
      'Report Conflicts A233': makeSheet([
        ['Run ID', 'Timestamp'],
        ['DEC-1', '2026-08-08T10:02:00Z']
      ]),
      'Report Data Readiness A233': makeSheet([
        ['Run ID', 'Timestamp'],
        ['DEC-1', '2026-08-08T10:03:00Z']
      ])
    });

    const result = context.foGetA233ExecutiveEvidence_(dashboard);

    expect(result.decisionState.available).toBe(true);
    expect(result.actionCards.available).toBe(true);
    expect(result.conflicts.available).toBe(true);
    expect(result.dataReadiness.available).toBe(true);

    expect(result.decisionState.runId).toBe('DEC-1');
    expect(result.actionCards.runId).toBe('DEC-1');
    expect(result.conflicts.runId).toBe('DEC-1');
    expect(result.dataReadiness.runId).toBe('DEC-1');
  });
});

describe('R8.2 SpreadsheetService shared row primitives', () => {
  function loadSpreadsheetService() {
    const context = vm.createContext({ console });

    vm.runInContext(
      read('SpreadsheetService.js'),
      context,
      { filename: 'SpreadsheetService.js' }
    );

    return context;
  }

  function makeSheet(values) {
    return {
      getDataRange: () => ({
        getValues: () => values
      })
    };
  }

  test('foSheetRows_ converts physical sheet rows to header-keyed objects', () => {
    const context = loadSpreadsheetService();

    const sheet = makeSheet([
      ['Run ID', 'Metric', 'Value'],
      ['RUN-1', 'A', 10],
      ['RUN-2', 'B', 20]
    ]);

    expect(context.foSheetRows_(sheet)).toEqual([
      {
        'Run ID': 'RUN-1',
        Metric: 'A',
        Value: 10
      },
      {
        'Run ID': 'RUN-2',
        Metric: 'B',
        Value: 20
      }
    ]);
  });

  test('foSheetRows_ ignores blank headers while preserving physical row order', () => {
    const context = loadSpreadsheetService();

    const sheet = makeSheet([
      ['Run ID', '', 'Value'],
      ['RUN-1', 'ignored-1', 10],
      ['RUN-2', 'ignored-2', 20]
    ]);

    expect(context.foSheetRows_(sheet)).toEqual([
      {
        'Run ID': 'RUN-1',
        Value: 10
      },
      {
        'Run ID': 'RUN-2',
        Value: 20
      }
    ]);
  });

  test('foSheetRows_ returns empty rows for unavailable or header-only sheets', () => {
    const context = loadSpreadsheetService();

    expect(context.foSheetRows_(null)).toEqual([]);

    expect(
      context.foSheetRows_(
        makeSheet([
          ['Run ID', 'Value']
        ])
      )
    ).toEqual([]);
  });

  test('foLatestRows_ uses the run represented by the final physical row', () => {
    const context = loadSpreadsheetService();

    const sheet = makeSheet([
      ['Run ID', 'Value'],
      ['RUN-1', 10],
      ['RUN-2', 20],
      ['RUN-1', 30]
    ]);

    expect(
      context.foLatestRows_(sheet, 'Run ID')
    ).toEqual({
      runId: 'RUN-1',
      rows: [
        {
          'Run ID': 'RUN-1',
          Value: 10
        },
        {
          'Run ID': 'RUN-1',
          Value: 30
        }
      ]
    });
  });

  test('foLatestRows_ fails closed when run identity is unavailable', () => {
    const context = loadSpreadsheetService();

    const noRows = makeSheet([
      ['Run ID', 'Value']
    ]);

    expect(
      context.foLatestRows_(noRows, 'Run ID')
    ).toEqual({
      runId: '',
      rows: []
    });

    const rows = makeSheet([
      ['Run ID', 'Value'],
      ['RUN-1', 10]
    ]);

    expect(
      context.foLatestRows_(rows, '')
    ).toEqual({
      runId: '',
      rows: []
    });

    expect(
      context.foLatestRows_(rows, 'Unknown Header')
    ).toEqual({
      runId: '',
      rows: []
    });
  });
});

describe('Morning Brief preflight', () => {
  test('succeeds when all required Dashboard and Ledger sheets exist', () => {
    const runtime = createMorningBriefPreflightRuntime();

    const result = runtime.context.foRunMorningBriefPreflight_();

    expect(result.status).toBe('SUCCESS');
    expect(result.dataAccessStatus).toBe('LIVE');
    expect(result.dashboard).toBe(runtime.dashboard);
    expect(result.ledger).toBe(runtime.ledger);
    expect(result.dashboardValidation.requiredSheetCount).toBe(14);
    expect(result.ledgerValidation.requiredSheetCount).toBe(6);
  });

  test('fails when a required Dashboard sheet is missing', () => {
    const runtime = createMorningBriefPreflightRuntime({
      dashboardSheets: [
        'Executive Dashboard',
        'Portfolio Master',
        'Portfolio Snapshot',
        'Portfolio Performance Positions',
        'Portfolio Valuation Summary',
        'Portfolio Optimization Summary',
        'Portfolio Scenario Summary',
        'Risk Budget Summary',
        'Investment Decision Support',
        'Executive Decision State A233',
        'Executive CIO Report',
        'Automation Log',
        'Knowledge Base'
      ]
    });

    expect(function() {
      runtime.context.foRunMorningBriefPreflight_();
    }).toThrow(
      'Family Office Portfolio Dashboard is missing required sheet(s): ' +
      'Executive Report Archive'
    );
  });

  test('fails when a required Ledger sheet is missing', () => {
    const runtime = createMorningBriefPreflightRuntime({
      dashboardSheets: [
        'Executive Dashboard',
        'Portfolio Master',
        'Portfolio Snapshot',
        'Portfolio Performance Positions',
        'Portfolio Valuation Summary',
        'Portfolio Optimization Summary',
        'Portfolio Scenario Summary',
        'Risk Budget Summary',
        'Investment Decision Support',
        'Executive Decision State A233',
        'Executive CIO Report',
        'Automation Log',
        'Executive Report Archive',
        'Knowledge Base'
      ],
      ledgerSheets: [
        'Version History',
        'Canadian Market Access Library',
        'Outcomes',
        'Lessons Learned',
        'Report Archive'
      ]
    });

    expect(function() {
      runtime.context.foRunMorningBriefPreflight_();
    }).toThrow(
      'Family Office Investment Ledger is missing required sheet(s): ' +
      'Orchestration Log'
    );
  });

  test('fails when a workbook reference is unavailable', () => {
    const runtime = createMorningBriefPreflightRuntime({
      dashboard: null
    });

    expect(function() {
      runtime.context.foRunMorningBriefPreflight_();
    }).toThrow(
      'Family Office Portfolio Dashboard workbook is unavailable.'
    );
  });
});

describe('Morning Brief end-to-end smoke test', () => {
  test('runs the executive report engine through preflight, writeback, and archive', () => {
    const valuationValues = [
      ['Metric', 'Value'],
      ['Certification Status', 'CERTIFIED'],
      ['Reconciliation Status', 'PASS'],
      ['Total Market Value', 100000],
      ['Total Cost Basis', 95000],
      ['Unrealized Gain/Loss', 5000],
      ['Unrealized Gain/Loss %', 5.26],
      ['Price Coverage %', 100],
      ['Cost Basis Coverage %', 100],
      ['Missing Price Count', 0],
      ['Reconciliation Variance', 0],
      ['Price Basis', 'LIVE'],
      ['Valuation Timestamp', new Date()]
    ];

    const valuationSheet = {
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => valuationValues)
      }))
    };

    const dashboard = {
      id: 'dashboard-workbook',
      getSheetByName: jest.fn((name) => {
        if (name === 'Portfolio Valuation Summary') {
          return valuationSheet;
        }
        return null;
      })
    };
    const outputRange = {
      clearContent: jest.fn(),
      setValues: jest.fn()
    };
    const outputSheet = {
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => outputRange)
    };
    const governedDecisions = [{
      ticker: 'TEST',
      action: 'HOLD'
    }];
    const integrationA233 = {
      portfolioScenario: {
        available: true,
        preferredScenario: 'BALANCED'
      }
    };
    const summary = {
      averageReadiness: 82,
      overallPriority: 'MEDIUM',
      portfolioRisk: 'MODERATE',
      executiveNarrative: 'Governed smoke-test narrative.',
      totalMarketValue: 100000,
      reviewCount: 1
    };
    const context = vm.createContext({
      console,
      Date,
      FO_CONFIG: {
        PLATFORM_VERSION: 'v3.2.1',
        BASELINE: 'TEST'
      }
    });

    vm.runInContext(read('ExecutiveDashboardEngine.js'), context);
    vm.runInContext(read('RuntimeLockService.js'), context);
    vm.runInContext(read('ExecutiveReportingEngine.js'), context);

    context.foInfo_ = jest.fn();
    context.foError_ = jest.fn();
    context.foRunMorningBriefPreflight_ = jest.fn(() => ({
      status: 'SUCCESS',
      dataAccessStatus: 'LIVE',
      dashboard
    }));
    context.foRunExecutiveDecisionIntegrationA233 = jest.fn(
      () => integrationA233
    );
    context.foApplyPortfolioScenarioExecutiveIntegration_ = jest.fn(
      (integration, receivedDashboard) => {
        expect(integration).toBe(integrationA233);
        expect(receivedDashboard).toBe(dashboard);
        return integration;
      }
    );
    context.foReadGovernedExecutiveDecisions_ = jest.fn(
      (receivedDashboard, integration) => {
        expect(receivedDashboard).toBe(dashboard);
        expect(integration).toBe(integrationA233);
        return governedDecisions;
      }
    );
    context.foNowId_ = jest.fn(() => 'EXEC-RPT-SMOKE');
    context.foBuildExecutiveSummary_ = jest.fn((decisions) => {
      expect(decisions).toBe(governedDecisions);
      return summary;
    });
    context.foEnsureSheet_ = jest.fn(
      (receivedDashboard, sheetName, headers) => {
        expect(receivedDashboard).toBe(dashboard);
        expect(sheetName).toBe('Executive CIO Report');
        expect(headers).toHaveLength(10);
        return outputSheet;
      }
    );
    context.foAppendExecutiveDecisionStateRowsA233_ = jest.fn(
      (rows, integration, reportId) => {
        expect(integration).toBe(integrationA233);
        expect(reportId).toBe('EXEC-RPT-SMOKE');
        rows.push([
          'Executive Decision State',
          'TEST',
          'READY',
          '',
          '',
          'Smoke test row',
          reportId,
          'v3.2.1',
          'TEST',
          new Date()
        ]);
      }
    );
    context.foAppendPortfolioOptimizationExecutiveRows_ = jest.fn();
    context.foAppendPortfolioScenarioExecutiveRows_ = jest.fn();
    context.foAppendRiskBudgetExecutiveRows_ = jest.fn();
    context.foAppendDecisionSectionA233_ = jest.fn();
    context.foArchiveExecutiveReport_ = jest.fn();

    const result = context.foRunExecutiveReportEngine();

    expect(context.foRunMorningBriefPreflight_).toHaveBeenCalledTimes(1);
    expect(context.foRunExecutiveDecisionIntegrationA233)
      .toHaveBeenCalledTimes(1);
    expect(context.foReadGovernedExecutiveDecisions_)
      .toHaveBeenCalledWith(dashboard, integrationA233);
    expect(context.foEnsureSheet_).toHaveBeenCalledTimes(1);
    expect(outputSheet.getRange).toHaveBeenCalledWith(
      2,
      1,
      result.rowsWritten,
      10
    );
    expect(outputRange.setValues).toHaveBeenCalledTimes(1);
    expect(outputRange.setValues.mock.calls[0][0])
      .toHaveLength(result.rowsWritten);
    expect(context.foArchiveExecutiveReport_).toHaveBeenCalledWith(
      dashboard,
      'EXEC-RPT-SMOKE',
      summary
    );
    expect(context.foInfo_).toHaveBeenLastCalledWith(
      'ExecutiveReportingEngine',
      'Complete',
      'Executive report generated: EXEC-RPT-SMOKE'
    );
    expect(context.foError_).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'SUCCESS',
      reportId: 'EXEC-RPT-SMOKE',
      rowsWritten: 23,
      averageReadiness: 82,
      preferredPortfolioScenario: 'BALANCED'
    });
  });
});

describe('R4.1 runtime context lifecycle', () => {
  test('creates one immutable Runtime Context', () => {
    const { context } = createRuntime();

    const runtimeContext = context.foRuntimeContextGet_();

    expect(runtimeContext.runtimeId).toMatch(/^RUNTIME-\d+-\d+$/);
    expect(runtimeContext.executionMode).toBe('PRODUCTION_RUNTIME');
    expect(runtimeContext.authorityLevel).toBe('FULL');
    expect(runtimeContext.platformVersion).toBe('v3.2.10');
    expect(runtimeContext.startedAt).toBeTruthy();
    expect(Object.isFrozen(runtimeContext)).toBe(true);
  });

  test('returns the same Runtime Context to repeated consumers', () => {
    const { context } = createRuntime();

    const first = context.foRuntimeContextGet_();
    const second = context.foRuntimeContextGet_();

    expect(second).toBe(first);
  });

  test('prevents mutation of the Runtime Context', () => {
    const { context } = createRuntime();

    const runtimeContext = context.foRuntimeContextGet_();

    expect(function() {
      runtimeContext.executionMode = 'ANALYSIS_ONLY';
    }).toThrow();

    expect(runtimeContext.executionMode).toBe('PRODUCTION_RUNTIME');
  });

  test('reset creates a new Runtime Context for tests', () => {
    const { context } = createRuntime();

    const first = context.foRuntimeContextGet_();

    context.foRuntimeContextReset_();

    const second = context.foRuntimeContextGet_();

    expect(second).not.toBe(first);
    expect(second.runtimeId).not.toBe(first.runtimeId);
  });

  test('reads the platform version from FO_CONFIG', () => {
    const { context } = createRuntime({
      FO_CONFIG: {
        PLATFORM_VERSION: 'v-test-runtime-context',
        BASELINE: 'TEST'
      }
    });

    expect(context.foRuntimeContextGet_().platformVersion)
      .toBe('v-test-runtime-context');
  });
});

describe('Wave R1.3.0.2 runtime locking', () => {
  test('blocks protected helpers when no runtime lock is held', () => {
    const { context } = createRuntime();

    expect(() => context.foAssertRuntimeLockHeld_('Direct helper test'))
      .toThrow('Runtime safety blocked unlocked operation');
  });

  test('serializes an operation and releases the lock', () => {
    const { context, lock } = createRuntime();
    const callback = jest.fn(() => 'complete');

    expect(context.foWithRuntimeLock_('Locked test', callback))
      .toBe('complete');
    expect(lock.tryLock).toHaveBeenCalledWith(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('fails closed when another execution holds the lock', () => {
    const lock = {
      tryLock: jest.fn(() => false),
      releaseLock: jest.fn()
    };
    const { context } = createRuntime({ lock });
    const callback = jest.fn();

    expect(() => context.foWithRuntimeLock_('Contended test', callback))
      .toThrow('Runtime safety blocked concurrent operation');
    expect(callback).not.toHaveBeenCalled();
    expect(lock.releaseLock).not.toHaveBeenCalled();
  });

  test('releases the lock when the protected operation throws', () => {
    const { context, lock } = createRuntime();

    expect(() => context.foWithRuntimeLock_('Throwing test', () => {
      throw new Error('synthetic failure');
    })).toThrow('synthetic failure');
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('supports nested protected services without reacquiring the script lock', () => {
    const { context, lock } = createRuntime();

    const result = context.foWithRuntimeLock_('Outer test', () => (
      context.foWithRuntimeLock_('Inner test', () => 'nested complete')
    ));

    expect(result).toBe('nested complete');
    expect(lock.tryLock).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });
});

describe('Wave R1.3.0.2 protected surface', () => {
  test.each([
    ['AutonomousCioOrchestrator.js', 'Run Autonomous CIO Orchestrator'],
    ['ProductionCertificationEngine.js', 'Run Production Certification'],
    ['ReportService.js', 'Archive report']
  ])('%s uses the runtime lock guard', (file, operation) => {
    const source = read(file);
    expect(source).toContain('foWithRuntimeLock_(');
    expect(source).toContain(operation);
  });

  test('Apps Script OAuth scopes are explicit', () => {
    const manifest = JSON.parse(read('appsscript.json'));

    expect(manifest.oauthScopes).toEqual(expect.arrayContaining([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/script.container.ui',
      'https://www.googleapis.com/auth/script.scriptapp',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email'
    ]));
  });

  test('direct workbook opens are confined to SpreadsheetService', () => {
    const directOpenPattern = /SpreadsheetApp\s*\.\s*openBy(?:Id|Url)\s*\(/g;
    const sourceFiles = fs.readdirSync(root)
      .filter((file) => file.endsWith('.js'));
    const directOpens = sourceFiles.flatMap((file) => (
      (read(file).match(directOpenPattern) || []).map(() => file)
    ));

    expect(directOpens).toEqual([
      'SpreadsheetService.js',
      'SpreadsheetService.js'
    ]);
    expect(read('SpreadsheetService.js')).not.toMatch(
      /SpreadsheetApp\s*\.\s*openByUrl\s*\(/
    );
  });
});

describe('R4.1 D4 Production Certification Runtime Context integration', () => {
  test('establishes Runtime Context before production certification work', () => {
    const fs = require('fs');
    const path = require('path');

    const source = fs.readFileSync(
      path.join(__dirname, '..', 'ProductionCertificationEngine.js'),
      'utf8'
    );

    const entryIndex = source.indexOf(
      'function foRunProductionCertification'
    );
    const runtimeIndex = source.indexOf(
      'foRuntimeContextGet_();',
      entryIndex
    );

    expect(entryIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThan(entryIndex);
  });
});

describe('v3.4.2 A233 concentration basis', () => {
  test('largest-position ticker and percentage are sourced from the same Position Risk row', () => {
    const source = read('ExecutiveDecisionIntegrationA233.js');

    expect(source).toContain(
      "largest['Portfolio Weight %'] !== undefined"
    );

    expect(source).toContain(
      "? largest['Portfolio Weight %']"
    );

    expect(source).toContain(
      ": largest['Portfolio Weight']"
    );

    expect(source).not.toContain(
      "const largestPct = foA233Number_(\n    portfolioRow['Largest Position %']"
    );
  });
});

describe('v3.4.2 Weekly non-destructive persistence', () => {
  test('failed Weekly validation restores the previously persisted report rows', () => {
    const source = read('WeeklyCioReportA240.js');

    const snapshotIndex = source.indexOf(
      'const previousReportRows ='
    );

    const candidateWriteIndex = source.indexOf(
      'foReplaceRowsA230(reportSheet, model.rows)'
    );

    const validationIndex = source.indexOf(
      'const validation = foRunWeeklyCioReportValidationA240'
    );

    const persistenceIndex = source.indexOf(
      "persistenceStatus === 'PERSISTED'"
    );

    const restoreIndex = source.indexOf(
      'foReplaceRowsA230(\n      reportSheet,\n      previousReportRows'
    );

    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(candidateWriteIndex).toBeGreaterThan(snapshotIndex);
    expect(validationIndex).toBeGreaterThan(candidateWriteIndex);
    expect(persistenceIndex).toBeGreaterThan(validationIndex);
    expect(restoreIndex).toBeGreaterThan(persistenceIndex);
  });

  test('archive append remains restricted to successfully persisted Weekly reports', () => {
    const source = read('WeeklyCioReportA240.js');

    const persistedGateIndex = source.indexOf(
      "if (persistenceStatus === 'PERSISTED')"
    );

    const archiveAppendIndex = source.indexOf(
      'foAppendRowsA230(',
      persistedGateIndex
    );

    const analysisOnlyRestoreIndex = source.indexOf(
      'previousReportRows',
      archiveAppendIndex
    );

    expect(persistedGateIndex).toBeGreaterThan(-1);
    expect(archiveAppendIndex).toBeGreaterThan(persistedGateIndex);
    expect(analysisOnlyRestoreIndex).toBeGreaterThan(archiveAppendIndex);
  });
});
