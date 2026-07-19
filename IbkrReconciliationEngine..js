/************************************************************
 * IbkrReconciliationEngine.gs
 * Wave 2.3.3.3 — IBKR Reconciliation Executive Hardening
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
      [new Date(), 'QBTS', 47.5, 21.19000055, 1006.52502613, 'USD', 17.63271368, 168.97112613, 26.12502613, 'STK', 'IBKR Live Connector Snapshot', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
      [new Date(), 'RGTI', 80, 17.01000025, 1360.80002, 'USD', 16.23447125, 62.04232, 7.20002, 'STK', 'IBKR Live Connector Snapshot', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
    ];

    sheet.getRange(2, 1, rows.length, 13).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 13);

    return { status: 'SUCCESS', positionsSeeded: rows.length };

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

    if (!portfolioSheet) throw new Error('Portfolio Master sheet not found.');
    if (!ibkrSheet) throw new Error('IBKR Position Snapshot sheet not found. Run foSeedIbkrPositionSnapshot first.');

    const portfolioValues = portfolioSheet.getDataRange().getValues();
    const portfolioHeaders = portfolioValues[0].map(String);

    const ibkrValues = ibkrSheet.getDataRange().getValues();
    const ibkrHeaders = ibkrValues[0].map(String);

    const portfolioMap = foBuildIbkrPortfolioMap_(portfolioValues, portfolioHeaders);
    const ibkrMap = foBuildIbkrSnapshotMap_(ibkrValues, ibkrHeaders);

    const tickers = {};

    Object.keys(portfolioMap).forEach(function(ticker) {
      tickers[ticker] = true;
    });

    Object.keys(ibkrMap).forEach(function(ticker) {
      tickers[ticker] = true;
    });

    const rows = Object.keys(tickers).sort().map(function(ticker) {
      return foBuildConsolidatedIbkrReconRow_(ticker, portfolioMap[ticker], ibkrMap[ticker]);
    });

    const summary = foBuildIbkrReconciliationSummary_(rows);

    foWriteIbkrReconciliationReport_(dashboard, rows, summary);
    foWriteIbkrReconciliationSummary_(dashboard, summary);
    foAppendIbkrReconciliationHistory_(dashboard, summary);

    foInfo_(module, 'Complete', 'IBKR reconciliation completed. Tickers reconciled: ' + rows.length);

    return {
      status: 'SUCCESS',
      tickersReconciled: rows.length,
      averageDataQualityScore: summary.averageDataQualityScore,
      overallStatus: summary.overallStatus
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildConsolidatedIbkrReconRow_(ticker, local, broker) {
  const now = new Date();

  if (!local && broker) {
    return [
      now, ticker, 'MISSING_IN_PORTFOLIO', 'HIGH', 25,
      '', broker.quantity, '', broker.marketPrice, '', broker.averagePrice, '', broker.marketValue,
      '', broker.unrealizedPnl, broker.dailyPnl,
      '❌', '❌', '❌', '❌',
      'IBKR position exists but Portfolio Master has no matching Interactive Brokers row.',
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
    ];
  }

  if (local && !broker) {
    return [
      now, ticker, 'MISSING_IN_IBKR', 'HIGH', 25,
      local.quantity, '', local.currentPrice, '', local.averageCost, '', local.marketValue, '',
      local.costBasis, '', '',
      '❌', '❌', '❌', '❌',
      'Portfolio Master shows Interactive Brokers position but IBKR snapshot does not.',
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
    ];
  }

  const quantityMatch = Math.abs(broker.quantity - local.quantity) < 0.0001;
  const priceMatch = Math.abs(broker.marketPrice - local.currentPrice) <= 0.25;
  const marketValueMatch = Math.abs(broker.marketValue - local.marketValue) <= 5;

  const localAvgCostMissing = local.averageCost <= 0;
  const avgCostMatch = !localAvgCostMissing && Math.abs(broker.averagePrice - local.averageCost) <= 0.05;

  let score = 100;
  const notes = [];

  if (!quantityMatch) {
    score -= 35;
    notes.push('Quantity mismatch.');
  }

  if (!priceMatch) {
    score -= 10;
    notes.push('Price differs beyond tolerance; may be timing/provider delay.');
  }

  if (localAvgCostMissing) {
    score -= 15;
    notes.push('Local average cost missing; broker average cost available.');
  } else if (!avgCostMatch) {
    score -= 20;
    notes.push('Average cost mismatch.');
  }

  if (!marketValueMatch) {
    score -= 15;
    notes.push('Market value mismatch.');
  }

  if (notes.length === 0) {
    notes.push('All IBKR reconciliation checks passed.');
  }

  let status = 'MATCH';
  let severity = 'INFO';

  if (!quantityMatch) {
    status = 'QUANTITY_MISMATCH';
    severity = 'HIGH';
  } else if (localAvgCostMissing) {
    status = 'LOCAL_AVG_COST_MISSING';
    severity = 'MEDIUM';
  } else if (!avgCostMatch) {
    status = 'AVG_COST_MISMATCH';
    severity = 'MEDIUM';
  } else if (!marketValueMatch) {
    status = 'MARKET_VALUE_MISMATCH';
    severity = 'MEDIUM';
  } else if (!priceMatch) {
    status = 'PRICE_STALE_OR_MISMATCH';
    severity = 'LOW';
  }

  return [
    now,
    ticker,
    status,
    severity,
    Math.max(score, 0),
    local.quantity,
    broker.quantity,
    local.currentPrice,
    broker.marketPrice,
    local.averageCost,
    broker.averagePrice,
    local.marketValue,
    broker.marketValue,
    local.costBasis,
    broker.unrealizedPnl,
    broker.dailyPnl,
    quantityMatch ? '✅' : '❌',
    priceMatch ? '✅' : '❌',
    avgCostMatch ? '✅' : localAvgCostMissing ? '⚠️ Missing Local' : '❌',
    marketValueMatch ? '✅' : '❌',
    notes.join(' '),
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ];
}

function foBuildIbkrReconciliationSummary_(rows) {
  const total = rows.length;

  const avgScore = total > 0
    ? rows.reduce(function(sum, row) { return sum + foIbkrNumber_(row[4]); }, 0) / total
    : 0;

  const high = rows.filter(function(row) { return row[3] === 'HIGH'; }).length;
  const medium = rows.filter(function(row) { return row[3] === 'MEDIUM'; }).length;
  const low = rows.filter(function(row) { return row[3] === 'LOW'; }).length;
  const info = rows.filter(function(row) { return row[3] === 'INFO'; }).length;
  const warnings = medium + low;

  let overallStatus = 'PASS';

  if (high > 0) {
    overallStatus = 'FAIL';
  } else if (warnings > 0) {
    overallStatus = 'PASS_WITH_WARNINGS';
  }

  return {
    timestamp: new Date(),
    totalPositions: total,
    averageDataQualityScore: avgScore,
    highSeverityIssues: high,
    mediumSeverityIssues: medium,
    lowSeverityIssues: low,
    warnings: warnings,
    cleanMatches: info,
    overallStatus: overallStatus
  };
}

function foWriteIbkrReconciliationReport_(dashboard, rows, summary) {
  const sheet = foEnsureSheet_(dashboard, 'IBKR Reconciliation Report', [
    'Metric',
    'Value',
    'Notes'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 4).setValues([[
    'IBKR Reconciliation Executive Summary',
    '',
    '',
    ''
  ]]);

  sheet.getRange(2, 1, 6, 4).setValues([
    ['Overall Status', summary.overallStatus, '', ''],
    ['Average Data Quality Score', summary.averageDataQualityScore, '100 is best.', ''],
    ['Securities Reconciled', summary.totalPositions, '', ''],
    ['Critical Issues', summary.highSeverityIssues, '', ''],
    ['Warnings', summary.warnings, 'Medium + Low severity issues.', ''],
    ['Fully Matched', summary.cleanMatches, '', '']
  ]);

  const startRow = 9;

  sheet.getRange(startRow, 1, 1, 23).setValues([[
    'Timestamp',
    'Ticker',
    'Overall Status',
    'Severity',
    'Data Quality Score',
    'Local Quantity',
    'IBKR Quantity',
    'Local Price',
    'IBKR Price',
    'Local Avg Cost',
    'IBKR Avg Cost',
    'Local Market Value',
    'IBKR Market Value',
    'Local Cost Basis',
    'IBKR Unrealized P&L',
    'IBKR Daily P&L',
    'Quantity Check',
    'Price Check',
    'Average Cost Check',
    'Market Value Check',
    'Notes',
    'Platform Version',
    'Baseline'
  ]]);

  if (rows.length > 0) {
    sheet.getRange(startRow + 1, 1, rows.length, 23).setValues(rows);
  }

  sheet.setFrozenRows(startRow);
  sheet.autoResizeColumns(1, 23);
  foApplyIbkrReconciliationFormatting_(sheet, startRow, rows.length);
}

function foApplyIbkrReconciliationFormatting_(sheet, startRow, rowCount) {
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();

  sheet.getRange(1, 1, maxRows, maxCols).setFontFamily('Arial');
  sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 1, 6, 2).setFontWeight('bold');

  sheet.getRange(startRow, 1, 1, 23)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  if (rowCount <= 0) return;

  const detailRange = sheet.getRange(startRow + 1, 1, rowCount, 23);
  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('MATCH')
      .setBackground('#d9ead3')
      .setRanges([sheet.getRange(startRow + 1, 3, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('MISSING')
      .setBackground('#fff2cc')
      .setRanges([sheet.getRange(startRow + 1, 3, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('MISMATCH')
      .setBackground('#f4cccc')
      .setRanges([sheet.getRange(startRow + 1, 3, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(95)
      .setBackground('#d9ead3')
      .setRanges([sheet.getRange(startRow + 1, 5, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(80, 94)
      .setBackground('#fff2cc')
      .setRanges([sheet.getRange(startRow + 1, 5, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(80)
      .setBackground('#f4cccc')
      .setRanges([sheet.getRange(startRow + 1, 5, rowCount, 1)])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
  detailRange.setVerticalAlignment('middle');
}

function foWriteIbkrReconciliationSummary_(dashboard, summary) {
  const sheet = foEnsureSheet_(dashboard, 'IBKR Reconciliation Summary', [
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
    [new Date(), 'Overall Status', summary.overallStatus, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'IBKR Positions Reconciled', summary.totalPositions, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Average Data Quality Score', summary.averageDataQualityScore, '100 is best.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'High Severity Issues', summary.highSeverityIssues, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Medium Severity Issues', summary.mediumSeverityIssues, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Low Severity Issues', summary.lowSeverityIssues, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Warnings', summary.warnings, 'Medium + Low severity issues.', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Clean Matches', summary.cleanMatches, '', FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);
}

function foAppendIbkrReconciliationHistory_(dashboard, summary) {
  const sheet = foEnsureSheet_(dashboard, 'IBKR Reconciliation History', [
    'Timestamp',
    'Overall Status',
    'Average Data Quality Score',
    'Positions Reconciled',
    'High Severity Issues',
    'Medium Severity Issues',
    'Low Severity Issues',
    'Warnings',
    'Clean Matches',
    'Platform Version',
    'Baseline'
  ]);

  sheet.appendRow([
    new Date(),
    summary.overallStatus,
    summary.averageDataQualityScore,
    summary.totalPositions,
    summary.highSeverityIssues,
    summary.mediumSeverityIssues,
    summary.lowSeverityIssues,
    summary.warnings,
    summary.cleanMatches,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ]);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 11);
}

function foBuildIbkrPortfolioMap_(values, headers) {
  const map = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    const account = foNormalizeAccountIdentity_(
      foGetVal_(row, headers, 'Account')
    ).name.toUpperCase();

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
