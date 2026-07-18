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
  const context = vm.createContext({
    console,
    foInfo_: () => undefined,
    foError_: () => undefined
  });
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
      PLATFORM_VERSION: 'v2.1.0-rc.2',
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
      currentPriceCurrency: 'CAD',
      marketValueCurrency: 'CAD',
      sector: 'Technology',
      country: 'Canada',
      currency: 'CAD',
      assetClass: 'Equity'
    },
    {
      ticker: 'BBB',
      name: 'Beta',
      marketValue: 50,
      marketValueCurrency: 'CAD',
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
      marketValueCurrency: 'CAD',
      sector: 'Technology',
      country: 'Canada',
      currency: 'CAD',
      assetClass: 'Equity'
    },
    {
      ticker: 'BOND',
      name: 'Bond Fund',
      marketValue: 200,
      marketValueCurrency: 'CAD',
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
        currency: 'CAD',
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

    expect(() => evaluate(context, `new InvestmentAccount({
      accountId: 'ACCOUNT-TFSA', name: 'TFSA', type: 'TFSA', holdings: []
    })`)).toThrow('currency');

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

  test('returns a reconciled empty canonical aggregation', () => {
    const context = createCore();
    const result = evaluate(
      context,
      'foAggregateHouseholdPortfolio(foCreateHouseholdPortfolioFromPositions([], "CAD"))'
    );

    expect(result.totalMarketValue).toBe(0);
    expect(result.holdingCount).toBe(0);
    expect(result.securityExposure).toHaveLength(0);
    expect(result.allocations.sector).toHaveLength(0);
    expect(result.duplicates.all).toHaveLength(0);
  });

  test('enforces base-currency market values while retaining mixed native currencies', () => {
    const context = createCore();
    context.mixed = [{
      accountId: 'ACCOUNT-MIXED',
      name: 'Mixed Account',
      type: 'OTHER',
      currency: 'CAD',
      holdings: [
        { ticker: 'CADSEC', currency: 'CAD', marketValue: 100, marketValueCurrency: 'CAD' },
        { ticker: 'USDSEC', currency: 'USD', marketValue: 200, marketValueCurrency: 'CAD' }
      ]
    }];
    const result = evaluate(
      context,
      'foAggregateHouseholdPortfolio({ baseCurrency: "CAD", accounts: mixed })'
    );

    expect(result.totalMarketValue).toBe(300);
    expect(plain(result.allocations.currency).map((group) => group.name))
      .toEqual(['USD', 'CAD']);

    expect(() => evaluate(context, `new HouseholdPortfolio({
      baseCurrency: 'CAD',
      accounts: [{
        accountId: 'ACCOUNT-BAD', name: 'Bad Currency', type: 'OTHER', currency: 'CAD',
        holdings: [{ ticker: 'BAD', marketValue: 10, marketValueCurrency: 'USD' }]
      }]
    })`)).toThrow('must match household base currency CAD');

    expect(() => evaluate(context, `new HouseholdPortfolio({
      baseCurrency: 'CAD',
      accounts: [{
        accountId: 'ACCOUNT-BAD-PRICE', name: 'Bad Price', type: 'OTHER', currency: 'CAD',
        holdings: [{
          ticker: 'BADPRICE', quantity: 1, currentPrice: 10,
          currentPriceCurrency: 'USD'
        }]
      }]
    })`)).toThrow('currentPrice currency must match household base currency CAD');
  });

  test('normalizes blank, case, and whitespace account variants once at ingestion', () => {
    const context = createCore();
    context.positions = [
      { ticker: 'A', account: 'TFSA', marketValue: 10 },
      { ticker: 'B', account: 'tfsa', marketValue: 20 },
      { ticker: 'C', account: '  TFSA  ', marketValue: 30 },
      { ticker: 'D', account: '   ', marketValue: 40 },
      { ticker: 'E', account: 'Unknown', marketValue: 50 }
    ];
    const result = evaluate(context, `(() => {
      const aggregation = foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
      );
      return {
        accountCount: aggregation.accountCount,
        names: aggregation.allocations.account.map(function(group) { return group.name; }),
        ids: aggregation.positions.map(function(position) { return position.accountId; })
      };
    })()`);

    expect(plain(result)).toEqual({
      accountCount: 2,
      names: ['Default Account', 'TFSA'],
      ids: [
        'ACCOUNT-TFSA', 'ACCOUNT-TFSA', 'ACCOUNT-TFSA',
        'DEFAULT-ACCOUNT', 'DEFAULT-ACCOUNT'
      ]
    });
  });

  test('distinguishes same-account and cross-account duplicates', () => {
    const context = createCore();
    context.positions = [
      { ticker: 'SAME', account: 'TFSA', marketValue: 10 },
      { ticker: 'SAME', account: 'tfsa', marketValue: 20 },
      { ticker: 'CROSS', account: 'TFSA', marketValue: 30 },
      { ticker: 'CROSS', account: 'LIRA', marketValue: 40 }
    ];
    const result = evaluate(context, `foAnalyzeDuplicateExposure(
      foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
      )
    )`);

    expect(result.sameAccountDuplicates).toHaveLength(1);
    expect(result.sameAccountDuplicates[0].securityId).toBe('SAME');
    expect(plain(result.sameAccountDuplicates[0].sameAccountIds)).toEqual(['ACCOUNT-TFSA']);
    expect(result.crossAccountDuplicates).toHaveLength(1);
    expect(result.crossAccountDuplicates[0].securityId).toBe('CROSS');
    expect(result.allDuplicates).toHaveLength(2);
    expect(result.duplicateHoldings).toBe(result.crossAccountDuplicates);
  });

  test('prefers canonical security identity and uses ticker only as fallback', () => {
    const context = createCore();
    context.positions = [
      {
        ticker: 'AAA', canonicalSecurityId: 'SEC-001', securityId: 'IGNORED',
        account: 'TFSA', marketValue: 10
      },
      { ticker: 'RENAMED', securityId: ' sec-001 ', account: 'LIRA', marketValue: 20 },
      { ticker: 'AAA', securityId: 'SEC-002', account: 'RRSP', marketValue: 30 },
      { ticker: 'FALLBACK', account: 'TFSA', marketValue: 40 },
      { ticker: 'fallback', account: 'LIRA', marketValue: 50 }
    ];
    const result = evaluate(context, `foAnalyzeDuplicateExposure(
      foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
      )
    )`);

    expect(plain(result.crossAccountDuplicates).map((item) => [
      item.securityId, item.securityIdSource, item.marketValue
    ])).toEqual([
      ['FALLBACK', 'TICKER', 90],
      ['SEC-001', 'SECURITY_ID', 30]
    ]);
    expect(result.securityConcentration.find((item) => item.securityId === 'SEC-002'))
      .toBeDefined();
  });

  test('reconciles every exposure dimension and a large household to the canonical total', () => {
    const context = createCore();
    const positions = [];
    for (let account = 0; account < 200; account++) {
      for (let holding = 0; holding < 25; holding++) {
        positions.push({
          ticker: `SEC-${holding}`,
          account: `Account ${account}`,
          marketValue: account + holding + 1,
          marketValueCurrency: 'CAD',
          sector: `Sector ${holding % 5}`,
          currency: holding % 2 ? 'USD' : 'CAD',
          assetClass: holding % 3 ? 'Equity' : 'Fixed Income'
        });
      }
    }
    context.positions = positions;
    const result = evaluate(context, `(() => {
      const aggregation = foAggregateHouseholdPortfolio(
        foCreateHouseholdPortfolioFromPositions(positions, 'CAD')
      );
      function sum(groups) {
        return groups.reduce(function(total, group) { return total + group.marketValue; }, 0);
      }
      return {
        accounts: aggregation.accountCount,
        holdings: aggregation.holdingCount,
        total: aggregation.totalMarketValue,
        accountTotal: sum(aggregation.allocations.account),
        sectorTotal: sum(aggregation.allocations.sector),
        currencyTotal: sum(aggregation.allocations.currency),
        assetClassTotal: sum(aggregation.allocations.assetClass),
        securityTotal: sum(aggregation.securityExposure)
      };
    })()`);

    expect(result.accounts).toBe(200);
    expect(result.holdings).toBe(5000);
    expect(result.accountTotal).toBe(result.total);
    expect(result.sectorTotal).toBe(result.total);
    expect(result.currencyTotal).toBe(result.total);
    expect(result.assetClassTotal).toBe(result.total);
    expect(result.securityTotal).toBe(result.total);
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

  test('provides a deterministic Apps Script smoke-test entry point', () => {
    const context = createCore();

    expect(plain(context.foRunMultiAccountPortfolioCoreSmokeTest())).toEqual({
      status: 'PASS',
      accounts: 2,
      holdings: 2,
      totalMarketValue: 250,
      duplicateHoldings: 1
    });
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
    expect(written['Portfolio Engine Summary'].map((row) => [row[2], row[3]]))
      .toEqual([
        ['Total Positions', 2],
        ['Total Market Value', 200],
        ['Accounts Count', 2],
        ['Asset Classes Count', 1],
        ['Sectors Count', 1]
      ]);
  });
});
