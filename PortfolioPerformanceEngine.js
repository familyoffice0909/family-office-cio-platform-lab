/************************************************************
 * PortfolioPerformanceEngine.gs
 * Wave 2.3.1 — Core Portfolio Performance Calculations
 ************************************************************/

function foRunPortfolioPerformance() {
  const module = 'PortfolioPerformanceEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio performance calculation started.');

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
    const inputPositions = foBuildPerformancePositions_(values, headers);
    const householdPortfolio = foCreateHouseholdPortfolioFromPositions(
      inputPositions,
      FO_CONFIG.BASE_CURRENCY
    );
    const aggregation = foAggregateHouseholdPortfolio(householdPortfolio);
    const positions = aggregation.positions.map(function(position) {
      return Object.assign({}, position, {
        account: position.accountName,
        quantity: position.quantity === null ? 0 : position.quantity,
        currentPrice: position.currentPrice === null ? 0 : position.currentPrice,
        costBasis: position.costBasis === null ? 0 : position.costBasis,
        portfolioWeight: position.weight
      });
    });
    const totalMarketValue = aggregation.totalMarketValue;
    const totalCostBasis = aggregation.totalCostBasis;

    positions.forEach(function(p) {
      p.unrealizedGainLoss = p.marketValue - p.costBasis;
      p.unrealizedReturnPct = p.costBasis > 0 ? p.unrealizedGainLoss / p.costBasis : 0;
      p.portfolioWeight = p.weight;
      p.averageCost = p.quantity > 0 ? p.costBasis / p.quantity : 0;
    });

    const summary = foBuildPortfolioPerformanceSummary_(positions, totalMarketValue, totalCostBasis);

    foWritePortfolioPerformancePositions_(dashboard, positions);
    foWritePortfolioPerformanceSummary_(dashboard, summary);

    foInfo_(
      module,
      'Complete',
      'Portfolio performance completed. Positions: ' + positions.length
    );

    return {
      status: 'SUCCESS',
      positions: positions.length,
      totalMarketValue: totalMarketValue,
      totalCostBasis: totalCostBasis,
      portfolioReturnPct: summary.portfolioReturnPct
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildPerformancePositions_(values, headers) {
  const positions = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    if (!ticker) continue;

    const account = String(foGetVal_(row, headers, 'Account') || '').trim();
    const company =
      foGetVal_(row, headers, 'Company') ||
      foGetVal_(row, headers, 'Company / Fund') ||
      '';

    const quantity = foPerfNumber_(foGetVal_(row, headers, 'Quantity'));
    const price = foPerfNumber_(foGetVal_(row, headers, 'Current Price'));
    const marketValue = foPerfNumber_(foGetVal_(row, headers, 'Market Value'));
    const costBasis = foPerfNumber_(foGetVal_(row, headers, 'Cost Basis'));
    const assetClass = String(foGetVal_(row, headers, 'Asset Class') || '').trim();
    const sector = String(foGetVal_(row, headers, 'Sector') || '').trim();

    if (foIsExcludedPerformanceRow_(account, quantity, marketValue, price)) {
      continue;
    }

    if (quantity <= 0 && marketValue <= 0) {
      continue;
    }

    positions.push({
      rowNumber: r + 1,
      ticker: ticker,
      canonicalSecurityId: foGetVal_(row, headers, 'Canonical Security ID') || '',
      securityId: foGetVal_(row, headers, 'Security ID') || '',
      isin: foGetVal_(row, headers, 'ISIN') || '',
      cusip: foGetVal_(row, headers, 'CUSIP') || '',
      sedol: foGetVal_(row, headers, 'SEDOL') || '',
      company: company,
      account: account,
      quantity: quantity,
      currentPrice: price,
      marketValue: marketValue,
      marketValueCurrency: FO_CONFIG.BASE_CURRENCY,
      costBasis: costBasis,
      assetClass: assetClass,
      sector: sector,
      country: String(foGetVal_(row, headers, 'Country') || '').trim(),
      currency:
        String(foGetVal_(row, headers, 'Currency') || '').trim().toUpperCase() ||
        FO_CONFIG.BASE_CURRENCY,
      averageCost: 0,
      unrealizedGainLoss: 0,
      unrealizedReturnPct: 0,
      portfolioWeight: 0
    });
  }

  return positions;
}

function foBuildPortfolioPerformanceSummary_(positions, totalMarketValue, totalCostBasis) {
  const unrealizedGainLoss = totalMarketValue - totalCostBasis;
  const portfolioReturnPct = totalCostBasis > 0 ? unrealizedGainLoss / totalCostBasis : 0;

  const sortedByGain = positions.slice().sort(function(a, b) {
    return b.unrealizedGainLoss - a.unrealizedGainLoss;
  });

  const sortedByReturn = positions.slice().sort(function(a, b) {
    return b.unrealizedReturnPct - a.unrealizedReturnPct;
  });

  const sortedByWeight = positions.slice().sort(function(a, b) {
    return b.portfolioWeight - a.portfolioWeight;
  });

  const largestWinner = sortedByGain.length > 0 ? sortedByGain[0] : null;
  const largestLoser = sortedByGain.length > 0 ? sortedByGain[sortedByGain.length - 1] : null;
  const bestReturn = sortedByReturn.length > 0 ? sortedByReturn[0] : null;
  const largestPosition = sortedByWeight.length > 0 ? sortedByWeight[0] : null;

  return {
    totalMarketValue: totalMarketValue,
    totalCostBasis: totalCostBasis,
    unrealizedGainLoss: unrealizedGainLoss,
    portfolioReturnPct: portfolioReturnPct,
    positionCount: positions.length,
    largestWinner: largestWinner,
    largestLoser: largestLoser,
    bestReturn: bestReturn,
    largestPosition: largestPosition
  };
}

function foWritePortfolioPerformancePositions_(dashboard, positions) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Performance Positions', [
    'Timestamp',
    'Row',
    'Ticker',
    'Company',
    'Account',
    'Quantity',
    'Current Price',
    'Average Cost',
    'Market Value',
    'Cost Basis',
    'Unrealized Gain/Loss',
    'Unrealized Return %',
    'Portfolio Weight',
    'Asset Class',
    'Sector',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 17).setValues([[
    'Timestamp',
    'Row',
    'Ticker',
    'Company',
    'Account',
    'Quantity',
    'Current Price',
    'Average Cost',
    'Market Value',
    'Cost Basis',
    'Unrealized Gain/Loss',
    'Unrealized Return %',
    'Portfolio Weight',
    'Asset Class',
    'Sector',
    'Platform Version',
    'Baseline'
  ]]);

  const rows = positions.map(function(p) {
    return [
      new Date(),
      p.rowNumber,
      p.ticker,
      p.company,
      p.account,
      p.quantity,
      p.currentPrice,
      p.averageCost,
      p.marketValue,
      p.costBasis,
      p.unrealizedGainLoss,
      p.unrealizedReturnPct,
      p.portfolioWeight,
      p.assetClass,
      p.sector,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 17).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 17);
}

function foWritePortfolioPerformanceSummary_(dashboard, summary) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Performance Summary', [
    'Timestamp',
    'Metric',
    'Value',
    'Ticker',
    'Notes',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 7).setValues([[
    'Timestamp',
    'Metric',
    'Value',
    'Ticker',
    'Notes',
    'Platform Version',
    'Baseline'
  ]]);

  const rows = [
    [new Date(), 'Total Market Value', summary.totalMarketValue, '', '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Total Cost Basis', summary.totalCostBasis, '', '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Unrealized Gain/Loss', summary.unrealizedGainLoss, '', '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Portfolio Return %', summary.portfolioReturnPct, '', '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Position Count', summary.positionCount, '', '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Largest Winner', summary.largestWinner ? summary.largestWinner.unrealizedGainLoss : '', summary.largestWinner ? summary.largestWinner.ticker : '', 'By unrealized gain/loss dollars.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Largest Loser', summary.largestLoser ? summary.largestLoser.unrealizedGainLoss : '', summary.largestLoser ? summary.largestLoser.ticker : '', 'By unrealized gain/loss dollars.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Best Return %', summary.bestReturn ? summary.bestReturn.unrealizedReturnPct : '', summary.bestReturn ? summary.bestReturn.ticker : '', 'By unrealized return percentage.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Largest Position', summary.largestPosition ? summary.largestPosition.portfolioWeight : '', summary.largestPosition ? summary.largestPosition.ticker : '', 'By portfolio weight.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 7);
}

function foPerfNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  const n = Number(cleaned);

  return isNaN(n) ? 0 : n;
}

function foIsExcludedPerformanceRow_(account, quantity, marketValue, price) {
  const normalizedAccount = String(account || '').trim().toUpperCase();

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

  if (excludedAccounts.indexOf(normalizedAccount) >= 0 && quantity <= 0 && marketValue <= 0 && price <= 0) {
    return true;
  }

  return false;
}

function foRunPortfolioPerformanceSmokeTest() {
  const module = 'PortfolioPerformanceEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio Performance smoke test started.');

    const result = foRunPortfolioPerformance();

    foInfo_(module, 'Complete', 'Portfolio Performance smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
