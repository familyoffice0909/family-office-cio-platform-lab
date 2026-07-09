/************************************************************
 * PortfolioValuationEngine.gs
 * Wave 2.2 — Live Portfolio Valuation Engine
 ************************************************************/

function foRunPortfolioValuation() {
  const module = 'PortfolioValuationEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio valuation started.');

    const dashboard = foDashboard_();
    const portfolioSheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!portfolioSheet) {
      throw new Error('Portfolio Master sheet not found.');
    }

    const values = portfolioSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Portfolio Master has no holdings.');
    }

    const headers = values[0].map(String);

    const result = foCalculatePortfolioValuation_(portfolioSheet, values, headers);
    foWritePortfolioValuationSummary_(dashboard, result);

    foInfo_(
      module,
      'Complete',
      'Portfolio valuation completed. Total value: ' + result.totalMarketValue
    );

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foCalculatePortfolioValuation_(portfolioSheet, values, headers) {
  const tickerIndex = headers.indexOf('Ticker');
  const quantityIndex = headers.indexOf('Quantity');
  const priceIndex = headers.indexOf('Current Price');
  const marketValueIndex = headers.indexOf('Market Value');
  const costBasisIndex = headers.indexOf('Cost Basis');
  const accountIndex = headers.indexOf('Account');

  if (tickerIndex < 0 || quantityIndex < 0 || priceIndex < 0 || marketValueIndex < 0) {
    throw new Error('Portfolio Master requires Ticker, Quantity, Current Price, and Market Value columns.');
  }

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let valuedPositions = 0;
  let missingPriceCount = 0;

  const positionRows = [];

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    if (!ticker) continue;

    const account =
      accountIndex >= 0
        ? String(values[r][accountIndex] || '').trim().toUpperCase()
        : '';

    const quantity = Number(values[r][quantityIndex] || 0);
    const price = Number(values[r][priceIndex] || 0);
    const costBasis =
      costBasisIndex >= 0
        ? Number(values[r][costBasisIndex] || 0)
        : 0;

    if (foIsExcludedValuationRow_(account, ticker, quantity, price)) {
      continue;
    }

    if (quantity <= 0 || price <= 0) {
      missingPriceCount++;
      continue;
    }

    const marketValue = quantity * price;

    portfolioSheet.getRange(r + 1, marketValueIndex + 1).setValue(marketValue);

    totalMarketValue += marketValue;
    totalCostBasis += costBasis;
    valuedPositions++;

    positionRows.push({
      rowNumber: r + 1,
      ticker: ticker,
      account: account,
      quantity: quantity,
      currentPrice: price,
      marketValue: marketValue,
      costBasis: costBasis
    });
  }

  const unrealizedGainLoss = totalMarketValue - totalCostBasis;
  const unrealizedGainLossPct =
    totalCostBasis > 0
      ? unrealizedGainLoss / totalCostBasis
      : 0;

  return {
    status: 'SUCCESS',
    totalMarketValue: totalMarketValue,
    totalCostBasis: totalCostBasis,
    unrealizedGainLoss: unrealizedGainLoss,
    unrealizedGainLossPct: unrealizedGainLossPct,
    valuedPositions: valuedPositions,
    missingPriceCount: missingPriceCount,
    positionRows: positionRows
  };
}

function foIsExcludedValuationRow_(account, ticker, quantity, price) {
  const excludedAccounts = [
    '',
    'N/A',
    'NA',
    'PENDING',
    'REFERENCE',
    'LIBRARY',
    'WATCHLIST',
    'WATCH LIST',
    'TEMPLATE'
  ];

  if (excludedAccounts.indexOf(account) >= 0 && quantity <= 0 && price <= 0) {
    return true;
  }

  return false;
}

function foWritePortfolioValuationSummary_(dashboard, result) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Valuation Summary', [
    'Timestamp',
    'Metric',
    'Value',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 5).setValues([[
    'Timestamp',
    'Metric',
    'Value',
    'Platform Version',
    'Baseline'
  ]]);

  const rows = [
    [new Date(), 'Total Market Value', result.totalMarketValue, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Total Cost Basis', result.totalCostBasis, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Unrealized Gain/Loss', result.unrealizedGainLoss, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Unrealized Gain/Loss %', result.unrealizedGainLossPct, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Valued Positions', result.valuedPositions, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Missing Price Count', result.missingPriceCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
}

function foRunPortfolioValuationSmokeTest() {
  const module = 'PortfolioValuationEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio Valuation smoke test started.');

    const result = foRunPortfolioValuation();

    foInfo_(module, 'Complete', 'Portfolio Valuation smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}