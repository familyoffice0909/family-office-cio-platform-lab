'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'MultiAccountPortfolioCore.js'),
  'utf8'
);
const portfolioEngineSource = fs.readFileSync(
  path.join(root, 'PortfolioEngine.js'),
  'utf8'
);

function createCore() {
  const context = vm.createContext({ console });
  vm.runInContext(source, context);
  return context;
}

function evaluate(context, expression) {
  return vm.runInContext(expression, context);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPortfolioEngine(values) {
  const written = {};
  const outputSheet = (name) => ({
    getLastRow: () => 1,
    getRange: () => ({
      clearContent: () => undefined,
      setValues: (rows) => { written[name] = rows; }
    })
  });
  const master = {
    getDataRange: () => ({ getValues: () => values })
  };
  const dashboard = {
    getSheetByName: (name) => name === 'Portfolio Master' ? master : null
  };
  const context = vm.createContext({
    console,
    FO_CONFIG: {
      BASE_CURRENCY: 'CAD',
      PLATFORM_VERSION: 'v2.1.0',
      BASELINE: 'CB-002'
    },
    FO_SHEETS: { PORTFOLIO_MASTER: 'Portfolio Master' },
    foDashboard_: () => dashboard,
    foEnsureSheet_: (_dashboard, name) => outputSheet(name),
    foInfo_: () => undefined,
    foWarn_: () => undefined,
    foError_: () => undefined,
    foNowId_: () => 'SNAP-TEST',
    foGetVal_: (row, headers, header) => {
      const index = headers.indexOf(header);
      return index < 0 ? '' : row[index];
    },
    foNum_: (value) => value === '' || value === null || value === undefined
      ? ''
      : Number(value)
  });
  vm.runInContext(source, context);
  vm.runInContext(portfolioEngineSource, context);
  return { context, written };
}

const accountOne = {
  accountId: 'ACCOUNT-TFSA',
  name: 'TFSA',
  type: 'TFSA',
  currency: 'CAD',
  holdings: [
    {
      ticker: 'AAA',
      name: 'Alpha',
      quantity: 10,
      currentPrice: 10,
      sector: 'Technology',
      country: 'Canada',
      currency: 'CAD',
      assetClass: 'Equity'
    },
    {
      ticker: 'BBB',
      name: 'Beta',
      marketValue: 50,
      sector: 'Financials',
      country: 'United States',
      currency: 'USD',
      assetClass: 'Equity'
    }
  ]
};

const accountTwo = {
  accountId: 'ACCOUNT-LIRA',
  name: 'LIRA',
  type: 'LIRA',
  currency: 'CAD',
  holdings: [
    {
      ticker: 'AAA',
      name: 'Alpha',
      marketValue: 150,
      sector: 'Technology',
      country: 'Canada',
      currency: 'CAD',
      assetClass: 'Equity'
    },
    {
      ticker: 'BOND',
      name: 'Bond Fund',
      marketValue: 200,
      sector: 'Fixed Income',
      country: 'Canada',
      currency: 'CAD',
      assetClass: 'Fixed Income'
    }
  ]
};

describe('Release 2.1.0 multi-account domain and registry', () => {
  test('models AccountType, Holdings, InvestmentAccount, and HouseholdPortfolio', () => {
    const context = createCore();
    const result = evaluate(context, `(() => {
      const holdings = new Holdings(${JSON.stringify(accountOne.holdings)});
      const account = new InvestmentAccount({
        accountId: 'ACCOUNT-TFSA',
        name: 'TFSA',
        type: AccountType.TFSA,
        holdings: holdings
      });
      const household = new HouseholdPortfolio({ accounts: [account] });
      return {
        type: account.type,
        holdingCount: account.holdings.getAll().length,
        totalMarketValue: account.holdings.getTotalMarketValue(),
        baseCurrency: household.baseCurrency,
        frozen: Object.isFrozen(account) && Object.isFrozen(household)
      };
    })()`);

    expect(plain(result)).toEqual({
      type: 'TFSA',
      holdingCount: 2,
      totalMarketValue: 150,
      baseCurrency: 'CAD',
      frozen: true
    });
  });

  test('supports add, remove, update, refresh, and defensive account reads', () => {
    const context = createCore();
    context.initialAccount = accountOne;
    context.secondAccount = accountTwo;

    const result = evaluate(context, `(() => {
      const registry = foCreateAccountRegistry({ accounts: [initialAccount] });
      registry.addAccount(secondAccount);
      const returned = registry.getAccounts();
      returned.length = 0;
      registry.updateHoldings('ACCOUNT-TFSA', [{
        ticker: 'AAA', quantity: 4, currentPrice: 10, marketValue: 40
      }]);
      registry.refreshMarketValues({ AAA: 12 });
      const removed = registry.removeAccount('ACCOUNT-LIRA');
      const account = registry.getAccounts()[0];
      return {
        remainingAccounts: registry.getAccounts().length,
        holding: account.holdings.getAll()[0],
        removedAccountId: removed.accountId
      };
    })()`);

    expect(result.remainingAccounts).toBe(1);
    expect(result.removedAccountId).toBe('ACCOUNT-LIRA');
    expect(plain(result.holding)).toEqual(expect.objectContaining({
      ticker: 'AAA',
      quantity: 4,
      currentPrice: 12,
      marketValue: 48
    }));
  });

  test('fails closed for invalid accounts, holdings, and prices', () => {
    const context = createCore();
    context.initialAccount = accountOne;

    expect(() => evaluate(context, `(() => {
      const registry = foCreateAccountRegistry({ accounts: [initialAccount] });
      registry.addAccount(initialAccount);
    })()`)).toThrow('Account already exists');

    expect(() => evaluate(context, `new Holdings([{ ticker: 'AAA', marketValue: -1 }])`))
      .toThrow('Market value cannot be negative');

    expect(() => evaluate(context, `(() => {
      const registry = foCreateAccountRegistry({ accounts: [initialAccount] });
      registry.refreshMarketValues({ AAA: 'not-a-price' });
    })()`)).toThrow('must be a finite number');
  });
});

describe('Release 2.1.0 unified portfolio intelligence', () => {
  test('aggregates accounts and all required allocation dimensions', () => {
    const context = createCore();
    context.accounts = [accountOne, accountTwo];
    const intelligence = evaluate(
      context,
      'foBuildUnifiedPortfolioIntelligence({ accounts: accounts })'
    );

    expect(intelligence.accountCount).toBe(2);
    expect(intelligence.holdingCount).toBe(4);
    expect(intelligence.totalMarketValue).toBe(500);
    expect(plain(intelligence.allocations.sector)).toEqual([
      { name: 'Technology', marketValue: 250, weight: 0.5, holdingCount: 2 },
      { name: 'Fixed Income', marketValue: 200, weight: 0.4, holdingCount: 1 },
      { name: 'Financials', marketValue: 50, weight: 0.1, holdingCount: 1 }
    ]);
    expect(plain(intelligence.allocations.country)).toEqual([
      { name: 'Canada', marketValue: 450, weight: 0.9, holdingCount: 3 },
      { name: 'United States', marketValue: 50, weight: 0.1, holdingCount: 1 }
    ]);
    expect(plain(intelligence.allocations.currency)).toEqual([
      { name: 'CAD', marketValue: 450, weight: 0.9, holdingCount: 3 },
      { name: 'USD', marketValue: 50, weight: 0.1, holdingCount: 1 }
    ]);
    expect(plain(intelligence.allocations.assetClass)).toEqual([
      { name: 'Equity', marketValue: 300, weight: 0.6, holdingCount: 3 },
      { name: 'Fixed Income', marketValue: 200, weight: 0.4, holdingCount: 1 }
    ]);
    expect(plain(intelligence.largestHoldings)[0]).toEqual(expect.objectContaining({
      securityId: 'AAA',
      marketValue: 250,
      weight: 0.5,
      accountCount: 2
    }));
  });

  test('reports duplicate holdings and descriptive concentration without policy thresholds', () => {
    const context = createCore();
    context.accounts = [accountOne, accountTwo];
    const analysis = evaluate(
      context,
      'foAnalyzeDuplicateExposure({ accounts: accounts })'
    );

    expect(analysis.duplicateHoldings).toHaveLength(1);
    expect(plain(analysis.duplicateHoldings[0])).toEqual(expect.objectContaining({
      ticker: 'AAA',
      holdingCount: 2,
      accountCount: 2,
      accountIds: ['ACCOUNT-LIRA', 'ACCOUNT-TFSA']
    }));
    expect(analysis.sectorConcentration[0].name).toBe('Technology');
    expect(analysis.currencyConcentration[0].name).toBe('CAD');
    expect(analysis.securityConcentration[0].securityId).toBe('AAA');
  });

  test('automatically migrates a legacy single-account portfolio to Default Account', () => {
    const context = createCore();
    context.legacy = accountOne.holdings;
    const result = evaluate(context, `(() => {
      const registry = foCreateAccountRegistry(legacy);
      const portfolio = registry.getHouseholdPortfolio();
      return {
        accountId: portfolio.accounts[0].accountId,
        name: portfolio.accounts[0].name,
        type: portfolio.accounts[0].type,
        accountCount: portfolio.accounts.length,
        holdingCount: portfolio.accounts[0].holdings.getAll().length
      };
    })()`);

    expect(plain(result)).toEqual({
      accountId: 'DEFAULT-ACCOUNT',
      name: 'Default Account',
      type: 'DEFAULT',
      accountCount: 1,
      holdingCount: 2
    });
  });

  test('groups mixed legacy positions and defaults only missing account names', () => {
    const context = createCore();
    context.positions = [
      { ticker: 'AAA', account: '', marketValue: 10 },
      { ticker: 'BBB', account: 'TFSA', marketValue: 20 }
    ];
    const portfolio = evaluate(
      context,
      'foCreateHouseholdPortfolioFromPositions(positions, "CAD")'
    );

    expect(Array.from(portfolio.accounts, (account) => account.name))
      .toEqual(['Default Account', 'TFSA']);
    expect(Array.from(portfolio.accounts, (account) => account.type))
      .toEqual(['DEFAULT', 'TFSA']);
  });
});

describe('Release 2.1.0 PortfolioEngine compatibility integration', () => {
  test('preserves the snapshot contract and migrates missing accounts automatically', () => {
    const headers = [
      'Ticker', 'Company', 'Account', 'Quantity', 'Current Price',
      'Market Value', 'Cost Basis', 'Asset Class', 'Sector', 'Country',
      'Currency', 'Target Weight'
    ];
    const { context, written } = createPortfolioEngine([
      headers,
      ['AAA', 'Alpha', '', 10, 10, '', 80, 'Equity', 'Technology', 'Canada', 'CAD', 0.4],
      ['AAA', 'Alpha', 'TFSA', 5, 20, '', 70, 'Equity', 'Technology', 'Canada', 'CAD', 0.4]
    ]);

    const result = context.foBuildPortfolioSnapshot();

    expect(result.status).toBe('SUCCESS');
    expect(result.positions).toBe(2);
    expect(result.marketValue).toBe(200);
    expect(result.accountCount).toBe(2);
    expect(result.intelligence.allocations.sector[0].name).toBe('Technology');
    expect(result.duplicateExposure.duplicateHoldings[0].securityId).toBe('AAA');
    expect(written['Portfolio Snapshot'][0]).toHaveLength(20);
    expect(written['Portfolio Snapshot'][0][4]).toBe('Default Account');
    expect(written['Portfolio Snapshot'][1][4]).toBe('TFSA');
  });
});
