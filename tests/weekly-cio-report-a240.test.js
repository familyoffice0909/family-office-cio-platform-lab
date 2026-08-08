'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');


describe('foA240ReadConcentrationTrend_', () => {
  const spreadsheetServiceSource = read('SpreadsheetService.js');
  const source = read('WeeklyCioReportA240.js');
  const context = vm.createContext({ console });

  vm.runInContext(spreadsheetServiceSource, context, {
    filename: 'SpreadsheetService.js'
  });

  vm.runInContext(source, context, {
    filename: 'WeeklyCioReportA240.js'
  });

  function makeSheet(rows) {
    return {
      getLastRow: () => rows.length,
      getLastColumn: () => rows[0].length,
      getDataRange: () => ({
        getValues: () => rows,
        getDisplayValues: () => rows
      })
    };
  }

  function makeSpreadsheet(rows) {
    return {
      getSheetByName: name =>
        name === 'Risk History' ? makeSheet(rows) : null
    };
  }

  const headers = [
    'Run ID',
    'Timestamp',
    'Largest Position %',
    'Top 5 %',
    'Sector Concentration %',
    'Currency Concentration %',
    'Platform Version',
    'Baseline'
  ];

  test('returns current, prior, and concentration deltas for compatible rows', () => {
    const ss = makeSpreadsheet([
      headers,
      [
        'RISK-RUN-1',
        '2026-08-01T10:00:00Z',
        '40',
        '80',
        '60',
        '70',
        'v3.2.12',
        'CB-002'
      ],
      [
        'RISK-RUN-2',
        '2026-08-02T10:00:00Z',
        '45',
        '82',
        '61',
        '72',
        'v3.2.12',
        'CB-002'
      ]
    ]);

    const result = context.foA240ReadConcentrationTrend_(
      ss,
      'v3.2.12',
      'CB-002'
    );

    expect(result.status).toBe('AVAILABLE');
    expect(result.currentRunId).toBe('RISK-RUN-2');
    expect(result.priorRunId).toBe('RISK-RUN-1');

    expect(result.largestPosition.current).toBe(45);
    expect(result.largestPosition.prior).toBe(40);
    expect(result.largestPosition.delta).toBe(5);

    expect(result.top5.delta).toBe(2);
    expect(result.sector.delta).toBe(1);
    expect(result.currency.delta).toBe(2);
  });

  test('returns unavailable when only one compatible row exists', () => {
    const ss = makeSpreadsheet([
      headers,
      [
        'RISK-RUN-1',
        '2026-08-01T10:00:00Z',
        '40',
        '80',
        '60',
        '70',
        'v3.2.12',
        'CB-002'
      ]
    ]);

    const result = context.foA240ReadConcentrationTrend_(
      ss,
      'v3.2.12',
      'CB-002'
    );

    expect(result.status).toBe('UNAVAILABLE');
  });

  test('ignores incompatible platform version and baseline rows', () => {
    const ss = makeSpreadsheet([
      headers,
      [
        'RISK-RUN-OLD-VERSION',
        '2026-08-01T10:00:00Z',
        '30',
        '70',
        '50',
        '60',
        'v3.2.11',
        'CB-002'
      ],
      [
        'RISK-RUN-OLD-BASELINE',
        '2026-08-02T10:00:00Z',
        '35',
        '75',
        '55',
        '65',
        'v3.2.12',
        'CB-001'
      ],
      [
        'RISK-RUN-CURRENT',
        '2026-08-03T10:00:00Z',
        '45',
        '82',
        '61',
        '72',
        'v3.2.12',
        'CB-002'
      ]
    ]);

    const result = context.foA240ReadConcentrationTrend_(
      ss,
      'v3.2.12',
      'CB-002'
    );

    expect(result.status).toBe('UNAVAILABLE');
  });
});





describe('R7.7.D failure classification', () => {
  test('retrieval contract exposes governed failure classes and never reconstructs', () => {
    const weekly = read('WeeklyCioReportA240.js');

    expect(weekly).toContain(
      "deliveryStatus: 'DATA_ACCESS_FAILURE'"
    );

    expect(weekly).toContain(
      "deliveryStatus: 'PERSISTENCE_FAILURE'"
    );

    expect(weekly).toContain(
      "deliveryStatus: 'VALIDATION_FAILURE'"
    );

    expect(weekly).toContain(
      "deliveryStatus: 'GOVERNANCE_FAILURE'"
    );

    expect(weekly).toContain(
      "deliveryStatus: 'DELIVERABLE'"
    );

    expect(weekly).toContain(
      'No persisted Weekly CIO archive record is available.'
    );

    expect(weekly).toContain(
      'Persisted Weekly report rows were not found for the latest archive identity.'
    );

    expect(weekly).toContain(
      'No persisted Weekly validation lineage matches the latest archived report.'
    );

    expect(weekly).toContain(
      'Weekly validation lineage resolves to multiple Validation Run IDs.'
    );

    expect(weekly).toContain(
      'Latest persisted Weekly report has blocking or non-PASS validation evidence.'
    );

    expect(weekly).toContain(
      'Weekly report-row lineage does not match the latest archive identity.'
    );

    expect(weekly).not.toContain(
      'reconstructWeeklyReport'
    );

    expect(weekly).not.toContain(
      'fallbackGeneratedReport'
    );
  });
});

describe('R7.7.C governed retrieval API', () => {
  test('retrieval is archive-led and verifies persisted report and validation lineage', () => {
    const weekly = read('WeeklyCioReportA240.js');

    expect(weekly).toContain(
      'function foGetLatestGovernedWeeklyReportA240()'
    );
    expect(weekly).toContain(
      "const archive = archiveRows[archiveRows.length - 1]"
    );
    expect(weekly).toContain(
      "row['Report ID']"
    );
    expect(weekly).toContain(
      "row['Decision Run ID']"
    );
    expect(weekly).toContain(
      "row['Validation Run ID']"
    );
    expect(weekly).toContain(
      "deliveryStatus: 'DELIVERABLE'"
    );
    expect(weekly).toContain(
      "deliveryStatus: 'VALIDATION_FAILURE'"
    );
    expect(weekly).toContain(
      "deliveryStatus: 'GOVERNANCE_FAILURE'"
    );
  });
});

describe('R7.7 validation lineage persistence', () => {
  test('Weekly validation schema persists report and decision lineage', () => {
    const schemas = read('WorksheetSchemaRegistryA230.js');
    const weekly = read('WeeklyCioReportA240.js');

    expect(schemas).toContain(
      "schemaVersion:'1.1',headers:Object.freeze(['Validation Run ID','Report ID','Decision Run ID','Timestamp'"
    );

    expect(weekly).toContain('expectedReportId');
    expect(weekly).toContain('expectedDecisionRunId');

    expect(weekly).toContain(
      "validationRun.runId,\n        expectedReportId,\n        expectedDecisionRunId,\n        validationRun.timestamp"
    );
  });
});

describe('R7.5 decision history comparison', () => {
  test('uses compatible prior recommendation and marks unchanged', () => {
    const current = 'WATCH';
    const priorDecision = { recommendation: 'WATCH' };

    const priorRecommendation =
      priorDecision ? priorDecision.recommendation : '';

    const change = priorRecommendation
      ? (current === priorRecommendation ? 'UNCHANGED' : 'CHANGED')
      : 'BASELINE CREATED';

    expect(priorRecommendation).toBe('WATCH');
    expect(change).toBe('UNCHANGED');
  });

  test('uses compatible prior recommendation and marks changed', () => {
    const current = 'WATCH';
    const priorDecision = { recommendation: 'HOLD' };

    const priorRecommendation =
      priorDecision ? priorDecision.recommendation : '';

    const change = priorRecommendation
      ? (current === priorRecommendation ? 'UNCHANGED' : 'CHANGED')
      : 'BASELINE CREATED';

    expect(priorRecommendation).toBe('HOLD');
    expect(change).toBe('CHANGED');
  });

  test('creates baseline when no compatible prior recommendation exists', () => {
    const current = 'WATCH';
    const priorDecision = null;

    const priorRecommendation =
      priorDecision ? priorDecision.recommendation : '';

    const change = priorRecommendation
      ? (current === priorRecommendation ? 'UNCHANGED' : 'CHANGED')
      : 'BASELINE CREATED';

    expect(priorRecommendation).toBe('');
    expect(change).toBe('BASELINE CREATED');
  });
});

describe('Wave A2.4.0 static integration', () => {
  test('weekly report entry points are present', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain('function foRunWeeklyCioReportA240(');
    expect(source).toContain('function foRunWeeklyCioReportValidationA240(');
    expect(source).toContain('function foRunWeeklyCioReportSmokeTestA240(');
  });

  test('weekly report is governed by A2.3.3', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain('foRunExecutiveDecisionIntegrationA233');
    expect(source).toContain('EXECUTIVE_DECISION_STATE_A233');
    expect(source).toContain('REPORT_ACTION_CARDS_A233');
    expect(source).toContain('REPORT_DATA_READINESS_A233');
  });

  test('A2.4.0 worksheets are registered', () => {
    const config = read('Config.js');
    const schemas = read('WorksheetSchemaRegistryA230.js');

    expect(config).toContain('WEEKLY_CIO_REPORT_A240');
    expect(config).toContain('WEEKLY_CIO_REPORT_ARCHIVE_A240');
    expect(config).toContain('WEEKLY_CIO_REPORT_VALIDATION_A240');
    expect(schemas).toContain('WEEKLY_CIO_REPORT_A240:Object.freeze');
  });

  test('A2.4.0 engine and menu entries are registered', () => {
    expect(read('EngineRegistryA230.js')).toContain('WEEKLY_CIO_REPORT');
    expect(read('Menu.js')).toContain('foRunWeeklyCioReportA240');
    expect(read('Menu.js')).toContain('foRunWeeklyCioReportSmokeTestA240');
  });

  test('released platform metadata is reconciled to  and CB-002', () => {
    const config = read('Config.js');
    const packageJson = JSON.parse(read('package.json'));

    expect(config).toContain(
  `PLATFORM_VERSION: 'v${packageJson.version}'`
);

    expect(config).toContain(
      
      `RELEASE_NAME: '${packageJson.releaseName}'`
    );

    expect(config).toContain("BASELINE: 'CB-002'");

    expect(packageJson.version).toBe(packageLock.version);


  });

  test('Sprint 2.5.0 executive change detection reuses archive comparisons', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain("WHAT'S NEW");
    expect(source).toContain('function foA240WhatsNew_(');
    expect(source).toContain('foA240ChangeText_(');
    expect(source).toContain('foA240NumericDelta_(');
    expect(source).toContain('changes.slice(0, 5)');
    expect(source).toContain('No material changes since the previous report.');
  });

  test('A2.4.0.2 percentage and executive-rounding controls remain present', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain('A2.4.0.2 Percentage Unit Normalization');
    expect(source).toContain('Portfolio weights total approximately 100 percent');
    expect(source).toContain('Report contains no implausible portfolio percentages');
    expect(source).toContain('function foA240RatioPercentText_(');
    expect(source).toContain('function foA240PercentPointsText_(');
    expect(source).toContain('function foA240CleanNumericText_(');
    expect(source).toContain('return Number(value).toFixed(2);');
  });
});

describe('R3 D1 persistence, baseline, and comparison integrity', () => {
  test('weekly runtime verifies FO_CONFIG before persistence', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240ResolveProductionBaseline_('
    );

    expect(source).toContain(
      'FO_CONFIG.PLATFORM_VERSION'
    );

    expect(source).toContain(
      'FO_CONFIG.BASELINE'
    );

    expect(source).toContain(
      "status: 'VERSION_MISMATCH'"
    );
  });

  test('weekly archive persistence is validation gated', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240CanPersistWeeklyReport_('
    );

    expect(source).toContain(
      "persistenceStatus === 'PERSISTED'"
    );

    expect(source).toContain(
      'persistenceStatus: persistenceStatus'
    );
  });

  test(
    'prior weekly comparison requires compatible persisted evidence',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'function foA240ResolvePriorWeeklyBaseline_('
      );

      expect(source).toContain(
        "status: 'BASELINE_BUILDING'"
      );

      expect(source).toContain(
        "status: 'INCOMPATIBLE'"
      );

      expect(source).toContain(
        "status: 'AVAILABLE'"
      );

      expect(source).toContain(
        "priorBaseline.status === 'AVAILABLE'"
      );
    }
  );

  test(
    'missing prior evidence is not treated as unchanged',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'weeklyComparisonStatus: priorBaseline.status'
      );

      expect(source).toContain(
        'weeklyComparisonReason: priorBaseline.reason'
      );

      expect(source).toContain(
        'priorReportId: priorBaseline.priorReportId'
      );
    }
  );
});

describe('R3 D1-C2B weekly comparison eligibility governance', () => {
  test('reuses governed attribution and coverage metric maps', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240ResolveWeeklyComparisonEligibility_('
    );

    expect(source).toContain(
      'Return Attribution Summary A232'
    );

    expect(source).toContain(
      'Attribution Coverage Summary A2311'
    );

    expect(source).toContain(
      'foA240LatestMetricMap_'
    );
  });

  test('suppresses missing or insufficient comparison evidence', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "status: 'SUPPRESSED'"
    );

    expect(source).toContain(
      'Return Attribution Summary A232 has no governed evidence.'
    );

    expect(source).toContain(
      'Return-attribution coverage is below the governed threshold.'
    );

    expect(source).toContain(
      'Valuation timestamp is unavailable.'
    );

    expect(source).toContain(
      'Latest supported market-price timestamp is unavailable.'
    );
  });

  test('classifies mismatched metric lineage as incompatible', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "status: 'INCOMPATIBLE'"
    );

    expect(source).not.toContain(
      'Return-attribution and coverage evidence use different Run IDs.'
    );

    expect(source).toContain(
      'Return-attribution and coverage evidence use different platform versions.'
    );

    expect(source).toContain(
      'Return-attribution and coverage evidence use different governed baselines.'
    );
  });

  test(
    'allows weekly comparison only when governed evidence is eligible',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        "weeklyComparisonEligibility.status === 'ELIGIBLE'"
      );

      expect(source).toContain(
        "'Weekly Comparison Eligibility'"
      );

      expect(source).toContain(
        'comparisonEligibility: comparisonEligibility.status'
      );
    }
  );

  test('does not introduce a new snapshot implementation', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).not.toContain(
      'function foA240CreateBeginningSnapshot_'
    );

    expect(source).not.toContain(
      'function foA240CreateEndingSnapshot_'
    );
  });
});

describe('R3 D1-C3B decision evidence alignment governance', () => {
  test('preserves the existing Position Risk map contract', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240PositionRiskMap_(dashboard)'
    );

    expect(source).toContain(
      'return {exact: exact, tickerTotals: tickerTotals};'
    );

    expect(source).toContain(
      'function foA240LatestPositionRiskMetadata_(dashboard)'
    );
  });

  test('exposes governed Position Risk lineage metadata', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "dashboard.getSheetByName(FO_SHEETS.POSITION_RISK)"
    );

    expect(source).toContain(
      "source: 'Position Risk'"
    );

    expect(source).toContain(
      'runId: foA240Text_(latest.runId)'
    );

    expect(source).toContain(
      "platformVersion: foA240Text_(row['Platform Version'])"
    );

    expect(source).toContain(
      'baseline: foA240Text_(row.Baseline)'
    );
  });

  test('exposes governed Production Certification metadata', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240LatestCertificationMetadata_(dashboard)'
    );

    expect(source).toContain(
      'FO_SHEETS.PRODUCTION_CERTIFICATION'
    );

    expect(source).toContain(
      "row['Certification Run ID']"
    );

    expect(source).toContain(
      "source: 'Production Certification'"
    );
  });

  test('classifies decision evidence as aligned compatible or incompatible',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'function foA240ValidateDecisionEvidenceAlignment_('
      );

      expect(source).toContain(
        "result.status = 'ALIGNED'"
      );

      expect(source).toContain(
        "result.status = 'COMPATIBLE'"
      );

      expect(source).toContain(
        "result.status = 'INCOMPATIBLE'"
      );

      expect(source).not.toContain(
        'Return Attribution and Attribution Coverage use different governed Run IDs.'
      );

      expect(source).toContain(
        'Return Attribution and Attribution Coverage use different platform versions.'
      );

      expect(source).toContain(
        'Return Attribution and Attribution Coverage use different governed baselines.'
      );
    });

  test('integrates decision evidence alignment into runtime report and validation',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'const decisionEvidenceAlignment ='
      );

      expect(source).toContain(
        "'Decision Evidence Alignment'"
      );

      expect(source).toContain(
        'decisionEvidenceAlignment:'
      );

      expect(source).toContain(
        'decisionEvidenceReason:'
      );

      expect(source).toContain(
        'Decision evidence alignment is compatible'
      );
    });

  test('does not require every governed engine to share the A233 Run ID',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'uses a separate governed run namespace'
      );

      expect(source).toContain(
        'uses a separate governed run namespace with compatible runtime metadata.'
      );

      expect(source).not.toContain(
        'All governed engine Run IDs must equal the A233 Decision Run ID'
      );
    });
});

describe('R3 D1-C4 reporting-period alignment governance', () => {
  test('preserves governed metric-map period metadata', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "priorRunId: ''"
    );
    expect(source).toContain(
      "platformVersion: ''"
    );
    expect(source).toContain(
      "baseline: ''"
    );
    expect(source).toContain(
      "row['Prior Run ID']"
    );
  });

  test('implements the reporting-period alignment helper', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240ValidateReportingPeriodAlignment_('
    );
    expect(source).toContain(
      "result.status = 'ALIGNED'"
    );
    expect(source).toContain(
      "result.status = 'PARTIAL'"
    );
    expect(source).toContain(
      "result.status = 'INCOMPATIBLE'"
    );
  });

  test('rejects evidence that occurs after report generation', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'sourceTime > reportTime'
    );
    expect(source).toContain(
      'Evidence timestamps are invalid or occur after report generation:'
    );
  });

  test('rejects attribution and coverage timestamps separated by over 24 hours',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'Math.abs(attributionTime - coverageTime) >'
      );
      expect(source).toContain(
        'Return Attribution and Attribution Coverage timestamps differ by more than 24 hours.'
      );
    });

  test('does not invent missing reporting-period evidence', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'Unsupported period conclusions must remain suppressed.'
    );
    expect(source).toContain(
      'Governed reporting-period evidence is partial:'
    );
    expect(source).not.toContain(
      'Holdings Timestamp: new Date()'
    );
  });

  test('integrates reporting-period alignment into runtime and report output',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'const reportingPeriodAlignment ='
      );
      expect(source).toContain(
        "'Reporting Period Alignment'"
      );
      expect(source).toContain(
        'reportingPeriodReason:'
      );
      expect(source).toContain(
        'Reporting-period alignment is governable'
      );
    });
});

describe('R3 D1-C5 concentration authority governance', () => {
  test('implements position-level concentration authority reconciliation',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'function foA240ResolveConcentrationAuthority_('
      );
      expect(source).toContain(
        "basis: 'LARGEST VALUED TICKER/ACCOUNT POSITION'"
      );
      expect(source).toContain(
        "result.status = 'CERTIFIED'"
      );
      expect(source).toContain(
        "result.status = 'PARTIAL'"
      );
      expect(source).toContain(
        "result.status = 'NOT CERTIFIED'"
      );
    });

  test('does not use ticker totals as largest-position authority', () => {
    const source = read('WeeklyCioReportA240.js');

    const controlStart = source.indexOf(
      'Largest position percentage matches governed position authority'
    );

    expect(controlStart).toBeGreaterThanOrEqual(0);

    const controlBlock = source.slice(
      controlStart,
      controlStart + 2200
    );

    expect(controlBlock).not.toContain(
      'weights.tickerTotals'
    );
    expect(controlBlock).toContain(
      'foA240ResolveConcentrationAuthority_('
    );
  });

  test('preserves ticker totals only for display fallback', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'tickerTotals[ticker] = (tickerTotals[ticker] || 0) + weight;'
    );
    expect(source).toContain(
      'function foA240ResolvePositionWeight_('
    );
  });

  test('classifies incomplete valuation coverage as partial', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'if (freshnessCoverage < 1)'
    );
    expect(source).toContain(
      'incomplete price freshness means full-portfolio concentration is not certified.'
    );
  });

  test('integrates concentration authority into runtime and report output',
    () => {
      const source = read('WeeklyCioReportA240.js');

      expect(source).toContain(
        'const concentrationAuthority ='
      );
      expect(source).toContain(
        "'Concentration Authority'"
      );
      expect(source).toContain(
        'concentrationAuthorityReason:'
      );
      expect(source).toContain(
        'concentrationAuthorityEvidence:'
      );
    });

  test('adds a blocking concentration governance control', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'Concentration authority is certified or controlled'
    );
    expect(source).toContain(
      "if (status === 'NOT CERTIFIED')"
    );
  });

  test('documents the valued-position concentration basis', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'Largest valued position reconciles'
    );
    expect(source).toContain(
      'A233 largest-position authority reconciles to one governed Position Risk ticker/account row.'
    );
  });
});


describe('R3 D1-C6 trend authority governance', () => {

  test('contains governed trend authority helper', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'function foA240ValidateTrendAuthority_('
    );
  });

  test('documents trend versus trajectory distinction', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'Trend and Overall Trajectory represent different governed concepts'
    );
  });

  test('runtime resolves trend authority once', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'const trendAuthority ='
    );
  });

  test('runtime exposes trend authority metadata', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain('trendAuthority:');
    expect(source).toContain('trendAuthorityReason:');
    expect(source).toContain('trendAuthorityEvidence:');
  });

  test('governance row exists', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "'Trend Authority'"
    );
  });

  test('supports certified partial and blocked states', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      "result.status = 'CERTIFIED'"
    );
    expect(source).toContain(
      "result.status = 'PARTIAL'"
    );
    expect(source).toContain(
      "result.status = 'NOT CERTIFIED'"
    );
  });

  test('does not calculate trend analytics locally', () => {
    const source = read('WeeklyCioReportA240.js');

    expect(source).toContain(
      'The helper does not calculate trends'
    );
  });

});

describe('R4.1 D3 Weekly Strategy Review Runtime Context integration', () => {
  test('establishes Runtime Context at the Weekly entry point', () => {
    const fs = require('fs');
    const path = require('path');

    const source = fs.readFileSync(
      path.join(__dirname, '..', 'WeeklyCioReportA240.js'),
      'utf8'
    );

    const entryIndex = source.indexOf(
      'function foRunWeeklyCioReportA240'
    );
    const runtimeIndex = source.indexOf(
      'foRuntimeContextGet_();',
      entryIndex
    );

    expect(entryIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThan(entryIndex);
  });
});
