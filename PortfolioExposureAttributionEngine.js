/************************************************************
 * PortfolioExposureAttributionEngine.gs
 * Wave 2.3.2 — Exposure & Attribution Engine
 ************************************************************/

function foRunPortfolioExposureAttribution() {
  const module = 'PortfolioExposureAttributionEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio exposure attribution started.');

    const dashboard = foDashboard_();
    const sheet = dashboard.getSheetByName('Portfolio Performance Positions');

    if (!sheet) {
      throw new Error('Portfolio Performance Positions sheet not found. Run Portfolio Performance first.');
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);

    const inputPositions = foBuildExposurePositions_(values, headers);
    const householdPortfolio = foCreateHouseholdPortfolioFromPositions(
      inputPositions,
      FO_CONFIG.BASE_CURRENCY
    );
    const aggregation = foAggregateHouseholdPortfolio(householdPortfolio);
    const accountExposure = foBuildExposureRowsFromAggregation_(
      aggregation.allocations.account
    );
    const sectorExposure = foBuildExposureRowsFromAggregation_(
      aggregation.allocations.sector
    );
    const assetClassExposure = foBuildExposureRowsFromAggregation_(
      aggregation.allocations.assetClass
    );
    const currencyExposure = foBuildExposureRowsFromAggregation_(
      aggregation.allocations.currency
    );
    const concentration = foBuildConcentrationMetricsFromAggregation_(aggregation);

    foWriteExposureSheet_(dashboard, 'Account Exposure', accountExposure);
    foWriteExposureSheet_(dashboard, 'Sector Exposure', sectorExposure);
    foWriteExposureSheet_(dashboard, 'Asset Class Exposure', assetClassExposure);
    foWriteExposureSheet_(dashboard, 'Currency Exposure', currencyExposure);
    foWriteConcentrationSheet_(dashboard, concentration);

    foInfo_(module, 'Complete', 'Portfolio exposure attribution completed.');

    return {
      status: 'SUCCESS',
      positions: aggregation.holdingCount,
      totalMarketValue: aggregation.totalMarketValue,
      accountGroups: accountExposure.length,
      sectorGroups: sectorExposure.length,
      assetClassGroups: assetClassExposure.length,
      currencyGroups: currencyExposure.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildExposurePositions_(values, headers) {
  const positions = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    if (!ticker) continue;

    const account = foGetVal_(row, headers, 'Account');
    const sector = String(foGetVal_(row, headers, 'Sector') || 'Unknown').trim() || 'Unknown';
    const assetClass = String(foGetVal_(row, headers, 'Asset Class') || 'Unknown').trim() || 'Unknown';
    const marketValue = foExposureNumber_(foGetVal_(row, headers, 'Market Value'));
    const costBasis = foExposureNumber_(foGetVal_(row, headers, 'Cost Basis'));

    if (marketValue <= 0) continue;

    positions.push({
      canonicalSecurityId: foGetVal_(row, headers, 'Canonical Security ID') || '',
      securityId: foGetVal_(row, headers, 'Security ID') || '',
      isin: foGetVal_(row, headers, 'ISIN') || '',
      cusip: foGetVal_(row, headers, 'CUSIP') || '',
      sedol: foGetVal_(row, headers, 'SEDOL') || '',
      ticker: ticker,
      account: account,
      sector: sector,
      assetClass: assetClass,
      currency:
        String(foGetVal_(row, headers, 'Currency') || '').trim().toUpperCase() ||
        foInferExposureCurrency_(ticker),
      marketValue: marketValue,
      marketValueCurrency: FO_CONFIG.BASE_CURRENCY,
      costBasis: costBasis,
      gainLoss: marketValue - costBasis
    });
  }

  return positions;
}

function foBuildExposureRowsFromAggregation_(allocation) {
  return allocation.map(function(group) {
    return {
      group: group.name,
      marketValue: group.marketValue,
      costBasis: group.costBasis,
      gainLoss: group.gainLoss,
      returnPct: group.returnPct,
      portfolioWeight: group.weight,
      positionCount: group.holdingCount,
      tickers: group.tickers.join(', ')
    };
  });
}

function foBuildConcentrationMetricsFromAggregation_(aggregation) {
  const top1 = aggregation.concentration.largestSecurity;
  const top1Weight = top1 ? top1.weight : 0;
  const top3Weight = aggregation.concentration.top3Weight;
  const top5Weight = aggregation.concentration.top5Weight;

  let concentrationRisk = 'LOW';

  if (top1Weight >= 0.35 || top3Weight >= 0.65) {
    concentrationRisk = 'HIGH';
  } else if (top1Weight >= 0.25 || top3Weight >= 0.5) {
    concentrationRisk = 'MEDIUM';
  }

  return {
    totalMarketValue: aggregation.totalMarketValue,
    largestPosition: top1 ? top1.ticker : '',
    largestPositionValue: top1 ? top1.marketValue : 0,
    largestPositionWeight: top1Weight,
    top3Weight: top3Weight,
    top5Weight: top5Weight,
    concentrationRisk: concentrationRisk,
    top3Tickers: aggregation.concentration.top3.map(function(p) {
      return p.ticker;
    }).join(', '),
    top5Tickers: aggregation.concentration.top5.map(function(p) {
      return p.ticker;
    }).join(', ')
  };
}

function foWriteExposureSheet_(dashboard, sheetName, exposureRows) {
  const sheet = foEnsureSheet_(dashboard, sheetName, [
    'Timestamp',
    'Group',
    'Market Value',
    'Cost Basis',
    'Gain/Loss',
    'Return %',
    'Portfolio Weight',
    'Position Count',
    'Tickers',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 11).setValues([[
    'Timestamp',
    'Group',
    'Market Value',
    'Cost Basis',
    'Gain/Loss',
    'Return %',
    'Portfolio Weight',
    'Position Count',
    'Tickers',
    'Platform Version',
    'Baseline'
  ]]);

  const rows = exposureRows.map(function(g) {
    return [
      new Date(),
      g.group,
      g.marketValue,
      g.costBasis,
      g.gainLoss,
      g.returnPct,
      g.portfolioWeight,
      g.positionCount,
      g.tickers,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 11).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 11);
}

function foWriteConcentrationSheet_(dashboard, c) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Concentration Summary', [
    'Timestamp',
    'Metric',
    'Value',
    'Notes',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 6).setValues([[
    'Timestamp',
    'Metric',
    'Value',
    'Notes',
    'Platform Version',
    'Baseline'
  ]]);

  const rows = [
    [new Date(), 'Total Market Value', c.totalMarketValue, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Largest Position', c.largestPositionValue, c.largestPosition, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Largest Position Weight', c.largestPositionWeight, c.largestPosition, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Top 3 Weight', c.top3Weight, c.top3Tickers, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Top 5 Weight', c.top5Weight, c.top5Tickers, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Concentration Risk', c.concentrationRisk, 'Based on largest position and top 3 concentration.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);
}

function foInferExposureCurrency_(ticker) {
  const t = String(ticker || '').trim().toUpperCase();

  if (['QBTS', 'RGTI', 'MU', 'AVGO', 'QCOM', 'NVDA', 'META', 'PLTR'].indexOf(t) >= 0) {
    return 'USD';
  }

  return 'CAD';
}

function foExposureNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  const n = Number(cleaned);

  return isNaN(n) ? 0 : n;
}

function foRunPortfolioExposureAttributionSmokeTest() {
  const module = 'PortfolioExposureAttributionEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio Exposure Attribution smoke test started.');

    const result = foRunPortfolioExposureAttribution();

    foInfo_(module, 'Complete', 'Portfolio Exposure Attribution smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
