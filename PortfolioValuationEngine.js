/************************************************************
 * PortfolioValuationEngine.gs
 * Wave 2.2.1 — Safe Portfolio Valuation Fix
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
    const headers = values[0].map(String);

    const result = foCalculatePortfolioValuation_(portfolioSheet, values, headers);
    foWritePortfolioValuationSummary_(dashboard, result);

    foInfo_(module, 'Complete', 'Portfolio valuation completed.');

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

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let valuedPositions = 0;
  let missingPriceCount = 0;

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    if (!ticker) continue;

    const account =
      accountIndex >= 0 ? String(values[r][accountIndex] || '').trim().toUpperCase() : '';

    const quantity = foSafeNumber_(values[r][quantityIndex]);
    const price = foSafeNumber_(values[r][priceIndex]);
    const costBasis = costBasisIndex >= 0 ? foSafeNumber_(values[r][costBasisIndex]) : 0;

    if (foIsExcludedValuationRow_(account, ticker, quantity, price)) continue;

    if (quantity <= 0 || price <= 0) {
      missingPriceCount++;
      continue;
    }

    const marketValue = quantity * price;

    portfolioSheet.getRange(r + 1, marketValueIndex + 1).setValue(marketValue);

    totalMarketValue += foSafeNumber_(marketValue);
    totalCostBasis += foSafeNumber_(costBasis);
    valuedPositions++;
  }

  const unrealizedGainLoss = totalMarketValue - totalCostBasis;
  const unrealizedGainLossPct =
    totalCostBasis > 0 ? unrealizedGainLoss / totalCostBasis : 0;

  return {
    status: 'SUCCESS',
    totalMarketValue: totalMarketValue,
    totalCostBasis: totalCostBasis,
    unrealizedGainLoss: unrealizedGainLoss,
    unrealizedGainLossPct: unrealizedGainLossPct,
    valuedPositions: valuedPositions,
    missingPriceCount: missingPriceCount
  };
}

function foSafeNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  const number = Number(cleaned);

  return isNaN(number) ? 0 : number;
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