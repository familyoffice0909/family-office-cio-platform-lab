'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const coreSource = read('MultiAccountPortfolioCore.js');
const integritySource = read('PortfolioDataIntegrityEngine.js');
const portfolioEngineSource = read('PortfolioEngine.js');
const orchestratorSource = read('AutonomousCioOrchestrator.js');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCoreContext(extra) {
  const context = vm.createContext(Object.assign({
    console,
    foInfo_: () => undefined,
    foWarn_: () => undefined,
    foError_: () => undefined
  }, extra || {}));
  vm.runInContext(coreSource, context);
  return context;
}

function evaluate(context, expression) {
  return vm.runInContext(expression, context);
}

function createWorkbookContext(values, sources) {
  const written = {};
  const schemas = {};
  const master = {
    getDataRange: () => ({ getValues: () => values })
  };
  const dashboard = {
    getSheetByName: (name) => name === 'Portfolio Master' ? master : null
  };
  const context = createCoreContext({
    FO_CONFIG: {
      BASE_CURRENCY: 'CAD',
      PLATFORM_VERSION: 'v2.1.0-rc.3',
      BASELINE: 'CB-002'
    },
    FO_SHEETS: { PORTFOLIO_MASTER: 'Portfolio Master' },
    foDashboard_: () => dashboard,
    foEnsureSheet_: (_workbook, name, headers) => {
      schemas[name] = headers.slice();
      return {
        clearContents: () => undefined,
        getLastRow: () => 1,
        getRange: () => ({
          clearContent: () => undefined,
          setValues: (rows) => { written[name] = rows; }
        }),
        setFrozenRows: () => undefined,
        autoResizeColumns: () => undefined
      };
    },
    foGetVal_: (row, headers, header) => {
      const index = headers.indexOf(header);
      return index < 0 ? '' : row[index];
    },
    foNum_: (value) => value === '' || value === null || value === undefined
      ? ''
      : Number(value),
    foNowId_: () => 'SNAP-RC3'
  });
  sources.forEach((source) => vm.runInContext(source, context));
  return { context, written, schemas };
}

describe('Release 2.1.0 RC3 blocker regressions', () => {
  test('preserves valuationCurrency at ingress and rejects a base-currency mismatch', () => {
    const context = createCoreContext();
    context.validPositions = [{
      ticker: 'CAD-ONLY',
      account: 'Broker One',
      marketValue: 125,
      valuationCurrency: 'cad'
    }];
    const valid = evaluate(context, `foAggregateHouseholdPortfolio(
      foCreateHouseholdPortfolioFromPositions(validPositions, 'CAD')
    )`);

    expect(valid.positions[0].valuationCurrency).toBe('CAD');
    expect(valid.positions[0].marketValueCurrency).toBe('CAD');

    context.invalidPositions = [{
      ticker: 'USD-ONLY',
      account: 'Broker One',
      marketValue: 125,
      valuationCurrency: 'USD'
    }];
    expect(() => evaluate(context, `foCreateHouseholdPortfolioFromPositions(
      invalidPositions, 'CAD'
    )`)).toThrow('must match household base currency CAD');

    const workbook = createWorkbookContext([
      ['Ticker', 'Account', 'Market Value', 'Valuation Currency'],
      ['USD-ONLY', 'Broker One', 125, 'USD']
    ], [portfolioEngineSource]);
    expect(() => workbook.context.foBuildPortfolioSnapshot())
      .toThrow('must match household base currency CAD');
    expect(workbook.written['Portfolio Snapshot']).toBeUndefined();
  });

  test('uses canonical ID, exchange+ticker, then collision-safe ticker fallback', () => {
    const context = createCoreContext();
    context.positions = [
      { ticker: 'SAME', exchange: 'TSX', account: 'TFSA', marketValue: 10 },
      { ticker: 'same', exchange: 'tsx', account: 'LIRA', marketValue: 20 },
      { ticker: 'SAME', exchange: 'NYSE', account: 'RRSP', marketValue: 30 },
      { ticker: 'CANON-A', canonicalSecurityId: 'SEC-1', account: 'TFSA', marketValue: 40 },
      { ticker: 'CANON-B', securityId: 'sec-1', account: 'LIRA', marketValue: 50 },
      { ticker: 'FALLBACK', company: 'One Fund', account: 'TFSA', marketValue: 60 },
      { ticker: 'fallback', company: 'One Fund', account: 'LIRA', marketValue: 70 },
      { ticker: 'COLLIDE', company: 'Alpha PLC', account: 'TFSA', marketValue: 80 },
      { ticker: 'collide', company: 'Beta PLC', account: 'LIRA', marketValue: 90 }
    ];
    const result = evaluate(context, `foAggregateHouseholdPortfolio(
      foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
    )`);

    const exposures = plain(result.securityExposure);
    const same = exposures.filter((item) => item.ticker === 'SAME');
    const collide = exposures.filter((item) => item.ticker === 'COLLIDE');
    expect(same).toHaveLength(2);
    expect(same.map((item) => [item.exchange, item.marketValue]).sort()).toEqual([
      ['NYSE', 30],
      ['TSX', 30]
    ]);
    expect(collide).toHaveLength(2);
    expect(result.duplicates.crossAccount.map((item) => item.securityId).sort())
      .toEqual(['FALLBACK', 'SAME', 'SEC-1']);
    expect(result.duplicates.crossAccount.find((item) => item.securityId === 'SAME').exchange)
      .toBe('TSX');
  });

  test('PortfolioDataIntegrityEngine consumes canonical same- and cross-account duplicates', () => {
    const values = [
      [
        'Ticker', 'Canonical Security ID', 'Account', 'Quantity', 'Current Price',
        'Market Value', 'Cost Basis', 'Asset Class', 'Sector', 'Valuation Currency'
      ],
      ['ROW-A', 'SEC-SAME', 'Broker One', 1, 10, 10, 8, 'Equity', 'Technology', 'CAD'],
      ['ROW-B', 'SEC-SAME', ' broker one ', 1, 20, 20, 16, 'Equity', 'Technology', 'CAD'],
      ['ROW-C', 'SEC-CROSS', 'Broker One', 1, 30, 30, 24, 'Equity', 'Technology', 'CAD'],
      ['ROW-D', 'SEC-CROSS', 'LIRA', 1, 40, 40, 32, 'Equity', 'Technology', 'CAD'],
      ['SAME-TICKER', 'SEC-DISTINCT-1', 'TFSA', 1, 50, 50, 40, 'Equity', 'Technology', 'CAD'],
      ['SAME-TICKER', 'SEC-DISTINCT-2', 'TFSA', 1, 60, 60, 48, 'Equity', 'Technology', 'CAD']
    ];
    const { context, written } = createWorkbookContext(values, [integritySource]);

    const result = context.foRunPortfolioDataIntegrity();
    const duplicateRows = written['Portfolio Data Integrity'].filter((row) =>
      row[4] === 'Duplicate Position' || row[4] === 'Cross-Account Duplicate Exposure'
    );

    expect(result.status).toBe('SUCCESS');
    expect(duplicateRows.map((row) => [row[1], row[2], row[4]])).toEqual([
      [3, 'ROW-B', 'Duplicate Position'],
      [4, 'ROW-C', 'Cross-Account Duplicate Exposure']
    ]);
    expect(duplicateRows.some((row) => row[2] === 'SAME-TICKER')).toBe(false);
  });

  test('normalizes custom account names to one representation', () => {
    const context = createCoreContext();
    context.positions = [
      { ticker: 'A', account: 'Broker One', marketValue: 10 },
      { ticker: 'B', account: 'broker one', marketValue: 20 },
      { ticker: 'C', account: ' BROKER ONE ', marketValue: 30 }
    ];
    const result = evaluate(context, `foAggregateHouseholdPortfolio(
      foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
    )`);

    expect(result.accountCount).toBe(1);
    expect(plain(result.positions).map((position) => position.accountName))
      .toEqual(['BROKER ONE', 'BROKER ONE', 'BROKER ONE']);
    expect(result.allocations.account[0].name).toBe('BROKER ONE');
  });

  test('returns zero accounts for every empty compatibility input', () => {
    const context = createCoreContext();
    const result = evaluate(context, `({
      positions: foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions([], 'CAD')
      ).accountCount,
      legacyArray: foAggregateHouseholdPortfolio([]).accountCount,
      legacyObject: foAggregateHouseholdPortfolio({ holdings: [] }).accountCount
    })`);

    expect(plain(result)).toEqual({
      positions: 0,
      legacyArray: 0,
      legacyObject: 0
    });
  });

  test('keeps Portfolio Snapshot Step Log payload executive-only and deterministically bounded', () => {
    const context = createCoreContext();
    vm.runInContext(orchestratorSource, context);
    context.snapshotResult = {
      status: 'SUCCESS',
      snapshotId: 'SNAP-LARGE',
      marketValue: 5000,
      accountCount: 2,
      intelligence: {
        largestHoldings: [{
          securityId: 'SEC-1', ticker: 'ONE', marketValue: 2500,
          weight: 0.5, accountCount: 2, accountIds: ['A', 'B']
        }]
      },
      duplicateExposure: {
        allDuplicates: Array.from({ length: 5000 }, (_, index) => ({
          securityId: `SEC-${index}`,
          detail: 'x'.repeat(100)
        })),
        crossAccountDuplicates: [{ securityId: 'SEC-1' }],
        sameAccountDuplicates: [{ securityId: 'SEC-2' }]
      }
    };

    const step = evaluate(context, `foRunOrchestratorStep_(
      'RUN-1', 'Portfolio Snapshot', function() { return snapshotResult; }
    )`);
    const payload = JSON.parse(step.message);
    const oversizedOne = evaluate(context, 'foSafeStringify_({ value: "x".repeat(30000) })');
    const oversizedTwo = evaluate(context, 'foSafeStringify_({ value: "x".repeat(30000) })');

    expect(step.message.length).toBeLessThan(1000);
    expect(payload).toEqual({
      status: 'SUCCESS',
      snapshotId: 'SNAP-LARGE',
      portfolioValue: 5000,
      householdAccounts: 2,
      largestExposure: {
        securityId: 'SEC-1', ticker: 'ONE', marketValue: 2500,
        weight: 0.5, accountCount: 2
      },
      duplicateCount: 5000,
      riskSummary: {
        crossAccountDuplicateCount: 1,
        sameAccountDuplicateCount: 1,
        largestExposureWeight: 0.5
      }
    });
    expect(step.message).not.toContain('duplicateExposure');
    expect(oversizedOne).toBe(oversizedTwo);
    expect(oversizedOne).toHaveLength(12000);
    expect(oversizedOne).toMatch(/\.\.\.\[TRUNCATED 30012 CHARS\]$/);
  });

  test('serializes a real 5,000-position snapshot without exceeding a Sheets cell', () => {
    const context = createCoreContext();
    vm.runInContext(orchestratorSource, context);
    const positions = [];
    for (let account = 0; account < 200; account++) {
      for (let security = 0; security < 25; security++) {
        positions.push({
          ticker: `SEC-${security}`,
          exchange: 'TSX',
          account: `Broker ${account}`,
          marketValue: 1,
          valuationCurrency: 'CAD'
        });
      }
    }
    context.positions = positions;
    const result = evaluate(context, `(() => {
      const aggregation = foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
      );
      const snapshot = {
        status: 'SUCCESS', snapshotId: 'SNAP-5000',
        positions: aggregation.holdingCount,
        marketValue: aggregation.totalMarketValue,
        accountCount: aggregation.accountCount,
        intelligence: foBuildUnifiedPortfolioIntelligence(aggregation),
        duplicateExposure: foAnalyzeDuplicateExposure(aggregation)
      };
      return {
        internalHoldingCount: aggregation.holdingCount,
        internalDuplicateCount: snapshot.duplicateExposure.allDuplicates.length,
        message: foBuildOrchestratorStepMessage_('Portfolio Snapshot', snapshot)
      };
    })()`);
    const payload = JSON.parse(result.message);

    expect(result.internalHoldingCount).toBe(5000);
    expect(result.internalDuplicateCount).toBe(25);
    expect(result.message.length).toBeLessThan(50000);
    expect(payload.portfolioValue).toBe(5000);
    expect(payload.householdAccounts).toBe(200);
    expect(payload.duplicateCount).toBe(25);
    expect(result.message).not.toContain('BROKER 199');
  });

  test('preserves workbook schemas for snapshot, summary, and integrity outputs', () => {
    const values = [
      ['Ticker', 'Account', 'Quantity', 'Current Price', 'Market Value', 'Cost Basis'],
      ['AAA', 'TFSA', 1, 10, 10, 8]
    ];
    const { context, schemas } = createWorkbookContext(
      values,
      [portfolioEngineSource, integritySource]
    );
    context.foBuildPortfolioSnapshot();
    context.foRunPortfolioDataIntegrity();

    expect(schemas['Portfolio Snapshot']).toHaveLength(20);
    expect(schemas['Portfolio Engine Summary']).toEqual([
      'Timestamp', 'Snapshot ID', 'Metric', 'Value', 'Platform Version', 'Baseline'
    ]);
    expect(schemas['Portfolio Data Integrity']).toEqual([
      'Timestamp', 'Row', 'Ticker', 'Account', 'Issue Type', 'Severity',
      'Details', 'Suggested Fix', 'Platform Version', 'Baseline'
    ]);
  });
});
