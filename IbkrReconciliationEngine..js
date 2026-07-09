/************************************************************
 * IbkrReconciliationEngine.gs
 * Wave 2.3.3 — Interactive Brokers Reconciliation Engine
 ************************************************************/

function foSeedIbkrPositionSnapshot() {
  const module = 'IbkrReconciliationEngine';

  try {
    foInfo_(module, 'Start', 'Seeding IBKR position snapshot.');

    const dashboard = foDashboard_();

    const sheet = foEnsureSheet_(dashboard, 'IBKR Position Snapshot', [
      'Timestamp',
      'Ticker',
      'Quantity',
      'Market Price',
      'Market Value',
      'Currency',
      'Average Price',
      'Unrealized P&L',
      'Daily P&L',
      'Asset Class',
      'Source',
      'Platform Version',
      'Baseline'
    ]);

    sheet.clearContents();

    sheet.getRange(1, 1, 1, 13).setValues([[
      'Timestamp',
      'Ticker',
      'Quantity',
      'Market Price',
      'Market Value',
      'Currency',
      'Average Price',
      'Unrealized P&L',
      'Daily P&L',
      'Asset Class',
      'Source',
      'Platform Version',
      'Baseline'
    ]]);

    const rows = [
      [
        new Date(),
        'QBTS',
        47.5,
        21.19000055,
        1006.52502613,
        'USD',
        17.63271368,
        168.97112613,
        26.12502613,
        'STK',
        'IBKR Live Connector Snapshot',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ],
      [
        new Date(),
        'RGTI',
        80,
        17.01000025,
        1360.80002,
        'USD',
        16.23447125,
        62.04232,
        7.20002,
        'STK',
        'IBKR Live Connector Snapshot',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]
    ];

    sheet.getRange(2, 1, rows.length, 13).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 13);

    foInfo_(module, 'Complete', 'IBKR position snapshot seeded.');

    return {
      status: 'SUCCESS',
      positionsSeeded: rows.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foRunIbkrReconciliation() {
  const module = 'IbkrReconciliationEngine';

  try {
    foInfo_(module, 'Start', 'IBKR reconciliation started.');

    const dashboard = foDashboard_();
    const portfolioSheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);
    const ibkrSheet = dashboard.getSheetByName('IBKR Position Snapshot');

    if (!portfolioSheet) {
      throw new Error('Portfolio Master sheet not found.');
    }

    if (!ibkrSheet) {
      throw new Error('IBKR Position Snapshot sheet not found. Run foSeedIbkrPositionSnapshot first.');
    }

    const portfolioValues = portfolioSheet.getDataRange().getValues();
    const portfolioHeaders = portfolioValues[0].map(String);

    const ibkrValues = ibkrSheet.getDataRange().getValues();
    const ibkrHeaders = ibkrValues[0].map(String);

    const portfolioMap = foBuildIbkrPortfolioMap_(portfolioValues, portfolioHeaders);
    const ibkrMap = foBuildIbkrSnapshotMap_(ibkrValues, ibkrHeaders);

    const rows = [];

    Object.keys(ibkrMap).forEach(function(ticker) {
      const broker = ibkrMap[ticker];
      const local = portfolioMap[ticker];

      if (!local) {
        rows.push(foIbkrReconRow_(
          ticker,
          'MISSING_IN_PORTFOLIO',
          'HIGH',
          '',
          broker.quantity,
          '',
          broker.marketPrice,
          '',
          broker.averagePrice,
          '',
          broker.marketValue,
          'IBKR position exists but Portfolio Master has no matching Interactive Brokers row.'
        ));
        return;
      }

      const quantityDiff = broker.quantity - local.quantity;
      const priceDiff = broker.marketPrice - local.currentPrice;
      const avgCostDiff = broker.averagePrice - local.averageCost;
      const marketValueDiff = broker.marketValue - local.marketValue;

      const quantityStatus = Math.abs(quantityDiff) < 0.0001 ? 'MATCH' : 'MISMATCH';
      const priceStatus = Math.abs(priceDiff) <= 0.25 ? 'MATCH' : 'STALE_OR_MISMATCH';
      const avgCostStatus = Math.abs(avgCostDiff) <= 0.05 ? 'MATCH' : 'MISMATCH';
      const marketValueStatus = Math.abs(marketValueDiff) <= 5 ? 'MATCH' : 'MISMATCH';

      rows.push(foIbkrReconRow_(
        ticker,
        quantityStatus,
        quantityStatus === 'MATCH' ? 'INFO' : 'HIGH',
        local.quantity,
        broker.quantity,
        local.currentPrice,
        broker.marketPrice,
        local.averageCost,
        broker.averagePrice,
        local.marketValue,
        broker.marketValue,
        'Quantity comparison.'
      ));

      rows.push(foIbkrReconRow_(
        ticker,
        priceStatus,
        priceStatus === 'MATCH' ? 'INFO' : 'LOW',
        local.quantity,
        broker.quantity,
        local.currentPrice,
        broker.marketPrice,
        local.averageCost,
        broker.averagePrice,
        local.marketValue,
        broker.marketValue,
        'Price comparison. Small differences are normal during live market movement.'
      ));

      rows.push(foIbkrReconRow_(
        ticker,
        avgCostStatus,
        avgCostStatus === 'MATCH' ? 'INFO' : 'MEDIUM',
        local.quantity,
        broker.quantity,
        local.currentPrice,
        broker.marketPrice,
        local.averageCost,
        broker.averagePrice,
        local.marketValue,
        broker.marketValue,
        'Average cost comparison.'
      ));

      rows.push(foIbkrReconRow_(
        ticker,
        marketValueStatus,
        marketValueStatus === 'MATCH' ? 'INFO' : 'MEDIUM',
        local.quantity,
        broker.quantity,
        local.currentPrice,
        broker.marketPrice,
        local.averageCost,
        broker.averagePrice,
        local.marketValue,
        broker.marketValue,
        'Market value comparison.'
      ));
    });

    Object.keys(portfolioMap).forEach(function(ticker) {
      if (!ibkrMap[ticker]) {
        const local = portfolioMap[ticker];

        rows.push(foIbkrReconRow_(
          ticker,
          'MISSING_IN_IBKR',
          'HIGH',
          local.quantity,
          '',
          local.currentPrice,
          '',
          local.averageCost,
          '',
          local.marketValue,
          '',
          'Portfolio Master shows Interactive Brokers position but IBKR snapshot does not.'
        ));
      }
    });

    foWriteIbkrReconciliationReport_(dashboard, rows);

    foInfo_(module, 'Complete', 'IBKR reconciliation completed. Rows: ' + rows.length);

    return {
      status: 'SUCCESS',
      reconciliationRows: rows.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildIbkrPortfolioMap_(values, headers) {
  const map = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    const account = String(foGetVal_(row, headers, 'Account') || '').trim().toUpperCase();

    if (!ticker || account !== 'INTERACTIVE BROKERS') continue;

    const quantity = foIbkrNumber_(foGetVal_(row, headers, 'Quantity'));
    const currentPrice = foIbkrNumber_(foGetVal_(row, headers, 'Current Price'));
    const averageCost =
      foIbkrNumber_(foGetVal_(row, headers, 'Average Cost')) ||
      foIbkrNumber_(foGetVal_(row, headers, 'Avg Cost'));
    const marketValue = foIbkrNumber_(foGetVal_(row, headers, 'Market Value'));
    const costBasis = foIbkrNumber_(foGetVal_(row, headers, 'Cost Basis'));

    map[ticker] = {
      ticker: ticker,
      quantity: quantity,
      currentPrice: currentPrice,
      averageCost: averageCost,
      marketValue: marketValue,
      costBasis: costBasis
    };
  }

  return map;
}

function foBuildIbkrSnapshotMap_(values, headers) {
  const map = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    if (!ticker) continue;

    map[ticker] = {
      ticker: ticker,
      quantity: foIbkrNumber_(foGetVal_(row, headers, 'Quantity')),
      marketPrice: foIbkrNumber_(foGetVal_(row, headers, 'Market Price')),
      marketValue: foIbkrNumber_(foGetVal_(row, headers, 'Market Value')),
      currency: String(foGetVal_(row, headers, 'Currency') || '').trim(),
      averagePrice: foIbkrNumber_(foGetVal_(row, headers, 'Average Price')),
      unrealizedPnl: foIbkrNumber_(foGetVal_(row, headers, 'Unrealized P&L')),
      dailyPnl: foIbkrNumber_(foGetVal_(row, headers, 'Daily P&L')),
      assetClass: String(foGetVal_(row, headers, 'Asset Class') || '').trim()
    };
  }

  return map;
}

function foIbkrReconRow_(ticker, status, severity, localQty, ibkrQty, localPrice, ibkrPrice, localAvgCost, ibkrAvgCost, localMarketValue, ibkrMarketValue, notes) {
  return [
    new Date(),
    ticker,
    status,
    severity,
    localQty,
    ibkrQty,
    localPrice,
    ibkrPrice,
    localAvgCost,
    ibkrAvgCost,
    localMarketValue,
    ibkrMarketValue,
    notes,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ];
}

function foWriteIbkrReconciliationReport_(dashboard, rows) {
  const sheet = foEnsureSheet_(dashboard, 'IBKR Reconciliation Report', [
    'Timestamp',
    'Ticker',
    'Status',
    'Severity',
    'Local Quantity',
    'IBKR Quantity',
    'Local Price',
    'IBKR Price',
    'Local Avg Cost',
    'IBKR Avg Cost',
    'Local Market Value',
    'IBKR Market Value',
    'Notes',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 15).setValues([[
    'Timestamp',
    'Ticker',
    'Status',
    'Severity',
    'Local Quantity',
    'IBKR Quantity',
    'Local Price',
    'IBKR Price',
    'Local Avg Cost',
    'IBKR Avg Cost',
    'Local Market Value',
    'IBKR Market Value',
    'Notes',
    'Platform Version',
    'Baseline'
  ]]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 15).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 15);
}

function foIbkrNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function foRunIbkrReconciliationSmokeTest() {
  const module = 'IbkrReconciliationEngine';

  try {
    foInfo_(module, 'Start', 'IBKR reconciliation smoke test started.');

    foSeedIbkrPositionSnapshot();
    const result = foRunIbkrReconciliation();

    foInfo_(module, 'Complete', 'IBKR reconciliation smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}