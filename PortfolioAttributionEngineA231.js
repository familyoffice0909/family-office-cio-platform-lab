/**
 * Wave A2.3.1 — Portfolio Attribution Engine
 *
 * Attribution basis: current unrealized gain/loss against cost basis.
 * Dependency: foRunPortfolioPerformance() must populate
 * "Portfolio Performance Positions" before execution.
 */
const FO_A231_RELEASE_TARGET = 'v1.2.0';

function foRunPortfolioAttributionA231() {
  const dashboard = foDashboard_();
  const run = foCreateRunMetadataA230('ATTRIBUTION');
  const source = dashboard.getSheetByName('Portfolio Performance Positions');

  if (!source || source.getLastRow() < 2) {
    throw new Error(
      'Portfolio Performance Positions is missing or empty. ' +
      'Run foRunPortfolioPerformance() first.'
    );
  }

  const values = source.getDataRange().getValues();
  const headers = values[0].map(String);
  const positions = foA231ReadPositions_(values, headers);

  if (!positions.length) {
    throw new Error('A2.3.1 found no eligible performance positions.');
  }

  const totals = foA231Totals_(positions);
  const positionRows = foA231PositionRows_(positions, totals, run);
  const accountRows = foA231GroupRows_(positions, 'account', totals, run);
  const sectorRows = foA231GroupRows_(positions, 'sector', totals, run);
  const executiveRows = foA231ExecutiveRows_(
    positions,
    positionRows,
    accountRows,
    sectorRows,
    totals,
    run
  );

  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'POSITION_ATTRIBUTION_A231'),
    positionRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'ACCOUNT_ATTRIBUTION_A231'),
    accountRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'SECTOR_ATTRIBUTION_A231'),
    sectorRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'ATTRIBUTION_EXECUTIVE_SUMMARY_A231'),
    executiveRows
  );

  const validation = foRunPortfolioAttributionValidationA231(run.runId);

  return {
    status: validation.failedControls ? 'FAIL' : 'PASS',
    runId: run.runId,
    positions: positionRows.length,
    accounts: accountRows.length,
    sectors: sectorRows.length,
    portfolioValue: totals.marketValue,
    portfolioCostBasis: totals.costBasis,
    portfolioGainLoss: totals.gainLoss,
    portfolioReturnPct: totals.returnPct,
    validation: validation,
    releaseTarget: FO_A231_RELEASE_TARGET
  };
}

function foA231ReadPositions_(values, headers) {
  const positions = [];

  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    const ticker = foA231Text_(foGetVal_(row, headers, 'Ticker')).toUpperCase();
    if (!ticker) continue;

    const marketValue = foA231Number_(
      foGetVal_(row, headers, 'Market Value')
    );
    const costBasis = foA231Number_(
      foGetVal_(row, headers, 'Cost Basis')
    );

    if (marketValue <= 0 && costBasis <= 0) continue;

    const reportedGainLoss = foGetVal_(
      row,
      headers,
      'Unrealized Gain/Loss'
    );
    const gainLoss =
      reportedGainLoss === '' || reportedGainLoss === null
        ? marketValue - costBasis
        : foA231Number_(reportedGainLoss);

    positions.push({
      ticker: ticker,
      company: foA231Text_(foGetVal_(row, headers, 'Company')),
      account:
        foA231Text_(foGetVal_(row, headers, 'Account')) || 'Unknown',
      sector:
        foA231Text_(foGetVal_(row, headers, 'Sector')) || 'Unknown',
      assetClass:
        foA231Text_(foGetVal_(row, headers, 'Asset Class')) || 'Unknown',
      marketValue: marketValue,
      costBasis: costBasis,
      gainLoss: gainLoss,
      returnPct: costBasis > 0 ? gainLoss / costBasis : 0
    });
  }

  return positions;
}

function foA231Totals_(positions) {
  const totals = positions.reduce(function(result, position) {
    result.marketValue += position.marketValue;
    result.costBasis += position.costBasis;
    result.gainLoss += position.gainLoss;
    return result;
  }, {
    marketValue: 0,
    costBasis: 0,
    gainLoss: 0
  });

  totals.returnPct =
    totals.costBasis > 0 ? totals.gainLoss / totals.costBasis : 0;
  return totals;
}

function foA231PositionRows_(positions, totals, run) {
  const ranked = positions.slice().sort(function(a, b) {
    return Math.abs(b.gainLoss) - Math.abs(a.gainLoss);
  });

  return ranked.map(function(position, index) {
    return [
      run.runId,
      run.timestamp,
      index + 1,
      position.ticker,
      position.company,
      position.account,
      position.sector,
      position.assetClass,
      position.marketValue,
      position.costBasis,
      position.gainLoss,
      position.returnPct,
      totals.marketValue > 0
        ? position.marketValue / totals.marketValue
        : 0,
      totals.costBasis > 0
        ? position.gainLoss / totals.costBasis
        : 0,
      totals.gainLoss !== 0
        ? position.gainLoss / Math.abs(totals.gainLoss)
        : 0,
      position.gainLoss >= 0 ? 'CONTRIBUTOR' : 'DETRACTOR',
      run.platformVersion,
      run.baseline
    ];
  });
}

function foA231GroupRows_(positions, field, totals, run) {
  const groups = {};

  positions.forEach(function(position) {
    const key = position[field] || 'Unknown';

    if (!groups[key]) {
      groups[key] = {
        name: key,
        marketValue: 0,
        costBasis: 0,
        gainLoss: 0,
        positionCount: 0,
        tickers: []
      };
    }

    groups[key].marketValue += position.marketValue;
    groups[key].costBasis += position.costBasis;
    groups[key].gainLoss += position.gainLoss;
    groups[key].positionCount++;
    groups[key].tickers.push(position.ticker);
  });

  return Object.keys(groups).map(function(key) {
    const group = groups[key];

    return [
      run.runId,
      run.timestamp,
      group.name,
      group.marketValue,
      group.costBasis,
      group.gainLoss,
      group.costBasis > 0 ? group.gainLoss / group.costBasis : 0,
      totals.marketValue > 0
        ? group.marketValue / totals.marketValue
        : 0,
      totals.costBasis > 0
        ? group.gainLoss / totals.costBasis
        : 0,
      group.positionCount,
      group.tickers.join(', '),
      run.platformVersion,
      run.baseline
    ];
  }).sort(function(a, b) {
    return Math.abs(b[5]) - Math.abs(a[5]);
  });
}

function foA231ExecutiveRows_(
  positions,
  positionRows,
  accountRows,
  sectorRows,
  totals,
  run
) {
  const byGainLoss = positions.slice().sort(function(a, b) {
    return b.gainLoss - a.gainLoss;
  });

  const contributor = byGainLoss[0] || null;
  const detractor = byGainLoss[byGainLoss.length - 1] || null;
  const bestAccount = accountRows[0] || null;
  const bestSector = sectorRows[0] || null;

  const topThreeAbsoluteGainLoss = positionRows
    .slice(0, 3)
    .reduce(function(sum, row) {
      return sum + Math.abs(row[10]);
    }, 0);

  return [
    [
      run.runId,
      run.timestamp,
      'EXECUTIVE',
      'Portfolio Market Value',
      totals.marketValue,
      'INFORMATIONAL',
      'Current market value represented in attribution.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'EXECUTIVE',
      'Portfolio Gain/Loss',
      totals.gainLoss,
      totals.gainLoss >= 0 ? 'POSITIVE' : 'NEGATIVE',
      'Aggregate unrealized gain or loss.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'EXECUTIVE',
      'Portfolio Return %',
      totals.returnPct,
      totals.returnPct >= 0 ? 'POSITIVE' : 'NEGATIVE',
      'Aggregate unrealized return against cost basis.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'POSITION',
      'Top Contributor',
      contributor ? contributor.gainLoss : 0,
      contributor ? contributor.ticker : 'N/A',
      'Largest positive gain/loss contribution.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'POSITION',
      'Top Detractor',
      detractor ? detractor.gainLoss : 0,
      detractor ? detractor.ticker : 'N/A',
      'Largest negative gain/loss contribution.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'ACCOUNT',
      'Largest Account Driver',
      bestAccount ? bestAccount[5] : 0,
      bestAccount ? bestAccount[2] : 'N/A',
      'Account with the largest absolute gain/loss attribution.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'SECTOR',
      'Largest Sector Driver',
      bestSector ? bestSector[5] : 0,
      bestSector ? bestSector[2] : 'N/A',
      'Sector with the largest absolute gain/loss attribution.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'CONCENTRATION',
      'Top 3 Absolute Gain/Loss',
      topThreeAbsoluteGainLoss,
      topThreeAbsoluteGainLoss > Math.abs(totals.gainLoss) * 0.75
        ? 'CONCENTRATED'
        : 'BALANCED',
      'Absolute gain/loss represented by the top three attribution drivers.',
      run.platformVersion,
      run.baseline
    ]
  ];
}

function foRunPortfolioAttributionValidationA231(expectedRunId) {
  const dashboard = foDashboard_();
  const suite = foCreateValidationSuiteA230(
    'A2.3.1 Portfolio Attribution'
  );

  const positionSheet = dashboard.getSheetByName('Position Attribution A231');
  const accountSheet = dashboard.getSheetByName('Account Attribution A231');
  const sectorSheet = dashboard.getSheetByName('Sector Attribution A231');
  const executiveSheet = dashboard.getSheetByName(
    'Attribution Executive Summary A231'
  );

  suite.add(
    'SCHEMA',
    'Position Attribution schema valid',
    function() {
      return foA231SchemaMatches_(
        positionSheet,
        foGetHeadersA230('POSITION_ATTRIBUTION_A231')
      );
    },
    'CRITICAL'
  );

  suite.add(
    'SCHEMA',
    'Account Attribution schema valid',
    function() {
      return foA231SchemaMatches_(
        accountSheet,
        foGetHeadersA230('ACCOUNT_ATTRIBUTION_A231')
      );
    },
    'HIGH'
  );

  suite.add(
    'SCHEMA',
    'Sector Attribution schema valid',
    function() {
      return foA231SchemaMatches_(
        sectorSheet,
        foGetHeadersA230('SECTOR_ATTRIBUTION_A231')
      );
    },
    'HIGH'
  );

  suite.add(
    'OUTPUT',
    'Position Attribution populated',
    function() {
      return positionSheet && positionSheet.getLastRow() > 1;
    },
    'CRITICAL'
  );

  suite.add(
    'RECONCILIATION',
    'Position market value reconciles',
    function() {
      return foA231Reconcile_(
        positionSheet,
        'Market Value',
        dashboard.getSheetByName('Portfolio Performance Positions'),
        'Market Value',
        0.01
      );
    },
    'CRITICAL'
  );

  suite.add(
    'RECONCILIATION',
    'Position gain/loss reconciles',
    function() {
      return foA231Reconcile_(
        positionSheet,
        'Gain/Loss',
        dashboard.getSheetByName('Portfolio Performance Positions'),
        'Unrealized Gain/Loss',
        0.01
      );
    },
    'CRITICAL'
  );

  suite.add(
    'LINEAGE',
    'Executive attribution run lineage valid',
    function() {
      return Boolean(
        expectedRunId &&
        executiveSheet &&
        executiveSheet.getLastRow() > 1 &&
        String(executiveSheet.getRange(2, 1).getValue()) ===
          String(expectedRunId)
      );
    },
    'HIGH'
  );

  const result = suite.run();
  const validationRun = foCreateRunMetadataA230('ATTRIBUTION-VAL');
  const validationSheet = foEnsureSheetA230(
    dashboard,
    'ATTRIBUTION_VALIDATION_A231'
  );

  foAppendRowsA230(
    validationSheet,
    result.controls.map(function(control) {
      return [
        validationRun.runId,
        validationRun.timestamp,
        control.category,
        control.control,
        control.status,
        control.severity,
        control.details,
        validationRun.platformVersion,
        validationRun.baseline
      ];
    })
  );

  return {
    status: result.status,
    validationRunId: validationRun.runId,
    failedControls: result.failedControls,
    passedControls: result.passedControls,
    totalControls: result.totalControls,
    blocking: result.blocking
  };
}

function foRunPortfolioAttributionSmokeTestA231() {
  const result = foRunPortfolioAttributionA231();

  if (result.validation.failedControls > 0) {
    throw new Error(
      'A2.3.1 attribution smoke test failed: ' +
      JSON.stringify(result.validation)
    );
  }

  return {
    status: 'PASS',
    wave: 'A2.3.1',
    releaseTarget: FO_A231_RELEASE_TARGET,
    runId: result.runId,
    positions: result.positions,
    accounts: result.accounts,
    sectors: result.sectors,
    portfolioGainLoss: result.portfolioGainLoss
  };
}

function foA231SchemaMatches_(sheet, expectedHeaders) {
  if (!sheet || sheet.getLastColumn() !== expectedHeaders.length) return false;

  const actual = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0];

  return expectedHeaders.every(function(header, index) {
    return String(actual[index] || '').trim() === header;
  });
}

function foA231Reconcile_(
  targetSheet,
  targetHeader,
  sourceSheet,
  sourceHeader,
  tolerance
) {
  if (
    !targetSheet ||
    targetSheet.getLastRow() < 2 ||
    !sourceSheet ||
    sourceSheet.getLastRow() < 2
  ) {
    return false;
  }

  const target = targetSheet.getDataRange().getValues();
  const source = sourceSheet.getDataRange().getValues();
  const targetHeaders = target[0].map(String);
  const sourceHeaders = source[0].map(String);
  const targetIndex = targetHeaders.indexOf(targetHeader);
  const sourceIndex = sourceHeaders.indexOf(sourceHeader);

  if (targetIndex < 0 || sourceIndex < 0) return false;

  const targetTotal = target.slice(1).reduce(function(sum, row) {
    return sum + foA231Number_(row[targetIndex]);
  }, 0);

  const sourceTotal = source.slice(1).reduce(function(sum, row) {
    return sum + foA231Number_(row[sourceIndex]);
  }, 0);

  return Math.abs(targetTotal - sourceTotal) <= tolerance;
}

function foA231Number_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const number = Number(
    String(value)
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/%/g, '')
      .trim()
  );

  return Number.isFinite(number) ? number : 0;
}

function foA231Text_(value) {
  return String(
    value === null || value === undefined ? '' : value
  ).trim();
}
