'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const coreSource = fs.readFileSync(
  path.join(root, 'MultiAccountPortfolioCore.js'),
  'utf8'
);

function loadSource(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function createSheetRecorder(written) {
  return (name) => ({
    clearContents: () => undefined,
    getLastRow: () => 1,
    getRange: () => ({
      clearContent: () => undefined,
      setValue: () => undefined,
      setValues: (rows) => { written[name] = rows; }
    }),
    setFrozenRows: () => undefined,
    autoResizeColumns: () => undefined
  });
}

function baseContext(dashboard, written) {
  const outputSheet = createSheetRecorder(written);
  return vm.createContext({
    console,
    FO_CONFIG: {
      BASE_CURRENCY: 'CAD',
      PLATFORM_VERSION: 'v2.1.0-rc.3',
      BASELINE: 'CB-002'
    },
    FO_SHEETS: { PORTFOLIO_MASTER: 'Portfolio Master' },
    foDashboard_: () => dashboard,
    foEnsureSheet_: (_dashboard, name) => outputSheet(name),
    foGetVal_: (row, headers, header) => {
      const index = headers.indexOf(header);
      return index < 0 ? '' : row[index];
    },
    foInfo_: () => undefined,
    foWarn_: () => undefined,
    foError_: () => undefined,
    foNum_: (value) => value === '' || value === null || value === undefined
      ? ''
      : Number(value)
  });
}

describe('canonical aggregation consumers', () => {
  test('Portfolio Exposure Attribution consumes canonical allocations and security concentration', () => {
    const written = {};
    const values = [
      ['Ticker', 'Security ID', 'Account', 'Sector', 'Asset Class', 'Currency', 'Market Value', 'Cost Basis'],
      ['AAA', 'SEC-001', ' TFSA ', 'Technology', 'Equity', 'USD', 100, 80],
      ['RENAMED', 'SEC-001', 'tfsa', 'Technology', 'Equity', 'USD', 50, 40],
      ['AAA', 'SEC-001', 'LIRA', 'Technology', 'Equity', 'USD', 150, 120],
      ['BOND', 'SEC-002', '', 'Fixed Income', 'Fixed Income', 'CAD', 200, 190]
    ];
    const inputSheet = {
      getDataRange: () => ({ getValues: () => values })
    };
    const dashboard = {
      getSheetByName: (name) => name === 'Portfolio Performance Positions'
        ? inputSheet
        : null
    };
    const context = baseContext(dashboard, written);
    vm.runInContext(coreSource, context);
    vm.runInContext(loadSource('PortfolioExposureAttributionEngine.js'), context);

    const result = context.foRunPortfolioExposureAttribution();

    expect(result).toEqual(expect.objectContaining({
      status: 'SUCCESS',
      positions: 4,
      totalMarketValue: 500,
      accountGroups: 3,
      sectorGroups: 2,
      assetClassGroups: 2,
      currencyGroups: 2
    }));
    expect(written['Sector Exposure'][0].slice(1, 4)).toEqual([
      'Technology', 300, 240
    ]);
    expect(written['Account Exposure'].map((row) => row[1])).toEqual([
      'Default Account', 'LIRA', 'TFSA'
    ]);
    expect(written['Portfolio Concentration Summary'][1].slice(1, 4)).toEqual([
      'Largest Position', 300, 'AAA'
    ]);
    expect(written['Sector Exposure'][0]).toHaveLength(11);
    expect(written['Portfolio Concentration Summary'][0]).toHaveLength(6);
  });

  test('Portfolio Performance uses canonical total and normalized accounts', () => {
    const written = {};
    const values = [
      ['Ticker', 'Company', 'Account', 'Quantity', 'Current Price', 'Market Value', 'Cost Basis', 'Asset Class', 'Sector', 'Country', 'Currency'],
      ['AAA', 'Alpha', ' TFSA ', 10, 10, 100, 80, 'Equity', 'Technology', 'Canada', 'CAD'],
      ['BBB', 'Beta', 'tfsa', 5, 20, 100, 70, 'Equity', 'Technology', 'United States', 'USD'],
      ['BOND', 'Bond', '', 2, 50, 100, 90, 'Fixed Income', 'Fixed Income', 'Canada', 'CAD']
    ];
    const inputSheet = {
      getDataRange: () => ({ getValues: () => values })
    };
    const dashboard = {
      getSheetByName: (name) => name === 'Portfolio Master' ? inputSheet : null
    };
    const context = baseContext(dashboard, written);
    vm.runInContext(coreSource, context);
    vm.runInContext(loadSource('PortfolioPerformanceEngine.js'), context);

    const result = context.foRunPortfolioPerformance();

    expect(result.totalMarketValue).toBe(300);
    expect(result.totalCostBasis).toBe(240);
    expect(written['Portfolio Performance Positions'].map((row) => row[4]))
      .toEqual(['TFSA', 'TFSA', 'Default Account']);
    expect(written['Portfolio Performance Positions'].map((row) => row[12]))
      .toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(written['Portfolio Performance Positions'][0]).toHaveLength(17);
  });

  test('Portfolio Valuation and Portfolio State consume canonical totals and positions', () => {
    const valuationWritten = {};
    const valuationValues = [
      ['Ticker', 'Account', 'Quantity', 'Current Price', 'Market Value', 'Cost Basis'],
      ['AAA', ' tfsa ', 10, 10, '', 80],
      ['BBB', 'TFSA', 5, 20, '', 70]
    ];
    const valuationSheet = {
      getDataRange: () => ({ getValues: () => valuationValues }),
      getRange: () => ({ setValue: () => undefined })
    };
    const valuationDashboard = {
      getSheetByName: (name) => name === 'Portfolio Master' ? valuationSheet : null
    };
    const valuationContext = baseContext(valuationDashboard, valuationWritten);
    vm.runInContext(coreSource, valuationContext);
    vm.runInContext(loadSource('PortfolioValuationEngine.js'), valuationContext);

    const valuation = valuationContext.foRunPortfolioValuation();
    expect(valuation).toEqual(expect.objectContaining({
      totalMarketValue: 200,
      totalCostBasis: 150,
      valuedPositions: 2
    }));

    const stateWritten = {};
    const stateValues = [
      ['Position ID', 'Ticker', 'Company', 'Account', 'Quantity', 'Current Price', 'Market Value', 'Target Weight'],
      ['P-1', 'AAA', 'Alpha', ' TFSA ', 10, 10, 100, 0.5],
      ['P-2', 'BBB', 'Beta', 'tfsa', 5, 20, 100, 0.5]
    ];
    const stateSheet = {
      getDataRange: () => ({ getValues: () => stateValues })
    };
    const stateDashboard = {
      getSheetByName: (name) => name === 'Portfolio Master' ? stateSheet : null
    };
    const stateContext = baseContext(stateDashboard, stateWritten);
    vm.runInContext(coreSource, stateContext);
    vm.runInContext(loadSource('PortfolioStateService.js'), stateContext);

    const state = stateContext.foRebuildPortfolioState();
    expect(state).toEqual({ status: 'SUCCESS', rowsWritten: 2 });
    expect(stateWritten['Portfolio State'].map((row) => row[4]))
      .toEqual(['TFSA', 'TFSA']);
    expect(stateWritten['Portfolio State'].map((row) => row[8]))
      .toEqual([0.5, 0.5]);
    expect(stateWritten['Portfolio State'][0]).toHaveLength(13);
  });
});
