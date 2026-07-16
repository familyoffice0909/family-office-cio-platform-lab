/**
 * Wave A2.3.1.1 — Cost Basis Coverage and Attribution Eligibility
 *
 * Prevents missing cost basis from being treated as a full unrealized gain.
 */
const FO_A2311_MIN_COVERAGE_FOR_PORTFOLIO_RETURN = 0.80;

function foRunPortfolioAttributionCoverageA2311() {
  const dashboard = foDashboard_();
  const run = foCreateRunMetadataA230('ATTR-COVERAGE');
  const source = dashboard.getSheetByName('Portfolio Performance Positions');

  if (!source || source.getLastRow() < 2) {
    throw new Error(
      'Portfolio Performance Positions is missing or empty. ' +
      'Run foRunPortfolioPerformance() first.'
    );
  }

  const values = source.getDataRange().getValues();
  const headers = values[0].map(String);
  const positions = foA2311ReadPositions_(values, headers);

  if (!positions.length) {
    throw new Error('A2.3.1.1 found no eligible portfolio rows.');
  }

  const coverage = foA2311Coverage_(positions);
  const positionRows = foA2311PositionRows_(positions, coverage, run);
  const accountRows = foA2311GroupRows_(positions, 'account', coverage, run);
  const sectorRows = foA2311GroupRows_(positions, 'sector', coverage, run);
  const executiveRows = foA2311ExecutiveRows_(
    positions,
    coverage,
    accountRows,
    sectorRows,
    run
  );

  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'POSITION_ATTRIBUTION_COVERAGE_A2311'),
    positionRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'ACCOUNT_ATTRIBUTION_COVERAGE_A2311'),
    accountRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'SECTOR_ATTRIBUTION_COVERAGE_A2311'),
    sectorRows
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'ATTRIBUTION_COVERAGE_SUMMARY_A2311'),
    executiveRows
  );

  const validation = foRunPortfolioAttributionCoverageValidationA2311(
    run.runId
  );

  return {
    status: validation.failedControls ? 'FAIL' : (
      coverage.coveragePct < FO_A2311_MIN_COVERAGE_FOR_PORTFOLIO_RETURN
        ? 'PASS WITH OBSERVATIONS'
        : 'PASS'
    ),
    runId: run.runId,
    totalMarketValue: coverage.totalMarketValue,
    attributedMarketValue: coverage.attributedMarketValue,
    unattributedMarketValue: coverage.unattributedMarketValue,
    coveragePct: coverage.coveragePct,
    attributedCostBasis: coverage.attributedCostBasis,
    attributedGainLoss: coverage.attributedGainLoss,
    attributedReturnPct: coverage.attributedReturnPct,
    portfolioReturnAvailable:
      coverage.coveragePct >= FO_A2311_MIN_COVERAGE_FOR_PORTFOLIO_RETURN,
    validation: validation,
    releaseTarget: 'v1.2.0'
  };
}

function foA2311ReadPositions_(values, headers) {
  const positions = [];

  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    const ticker = foA2311Text_(foGetVal_(row, headers, 'Ticker')).toUpperCase();
    if (!ticker) continue;

    const marketValue = foA2311Number_(
      foGetVal_(row, headers, 'Market Value')
    );
    const costBasis = foA2311Number_(
      foGetVal_(row, headers, 'Cost Basis')
    );

    if (marketValue <= 0 && costBasis <= 0) continue;

    const eligible = marketValue > 0 && costBasis > 0;
    const gainLoss = eligible ? marketValue - costBasis : null;
    const returnPct = eligible ? gainLoss / costBasis : null;

    positions.push({
      ticker: ticker,
      company: foA2311Text_(foGetVal_(row, headers, 'Company')),
      account:
        foA2311Text_(foGetVal_(row, headers, 'Account')) || 'Unknown',
      sector:
        foA2311Text_(foGetVal_(row, headers, 'Sector')) || 'Unknown',
      assetClass:
        foA2311Text_(foGetVal_(row, headers, 'Asset Class')) || 'Unknown',
      marketValue: marketValue,
      costBasis: costBasis,
      eligible: eligible,
      gainLoss: gainLoss,
      returnPct: returnPct,
      eligibilityReason: eligible
        ? 'ELIGIBLE'
        : 'EXCLUDED — MISSING COST BASIS'
    });
  }

  return positions;
}

function foA2311Coverage_(positions) {
  const result = positions.reduce(function(summary, position) {
    summary.totalMarketValue += position.marketValue;

    if (position.eligible) {
      summary.eligiblePositions++;
      summary.attributedMarketValue += position.marketValue;
      summary.attributedCostBasis += position.costBasis;
      summary.attributedGainLoss += position.gainLoss;
    } else {
      summary.ineligiblePositions++;
      summary.unattributedMarketValue += position.marketValue;
    }

    return summary;
  }, {
    totalMarketValue: 0,
    attributedMarketValue: 0,
    unattributedMarketValue: 0,
    attributedCostBasis: 0,
    attributedGainLoss: 0,
    eligiblePositions: 0,
    ineligiblePositions: 0
  });

  result.coveragePct = result.totalMarketValue > 0
    ? result.attributedMarketValue / result.totalMarketValue
    : 0;

  result.attributedReturnPct = result.attributedCostBasis > 0
    ? result.attributedGainLoss / result.attributedCostBasis
    : null;

  return result;
}

function foA2311PositionRows_(positions, coverage, run) {
  const ranked = positions.slice().sort(function(a, b) {
    const aImpact = a.eligible ? Math.abs(a.gainLoss) : a.marketValue;
    const bImpact = b.eligible ? Math.abs(b.gainLoss) : b.marketValue;
    return bImpact - aImpact;
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
      position.eligible ? position.gainLoss : '',
      position.eligible ? position.returnPct : '',
      coverage.totalMarketValue > 0
        ? position.marketValue / coverage.totalMarketValue
        : 0,
      position.eligible && coverage.attributedCostBasis > 0
        ? position.gainLoss / coverage.attributedCostBasis
        : '',
      position.eligible,
      position.eligibilityReason,
      run.platformVersion,
      run.baseline
    ];
  });
}

function foA2311GroupRows_(positions, field, coverage, run) {
  const groups = {};

  positions.forEach(function(position) {
    const key = position[field] || 'Unknown';

    if (!groups[key]) {
      groups[key] = {
        name: key,
        totalMarketValue: 0,
        attributedMarketValue: 0,
        unattributedMarketValue: 0,
        attributedCostBasis: 0,
        attributedGainLoss: 0,
        eligiblePositions: 0,
        ineligiblePositions: 0,
        tickers: []
      };
    }

    const group = groups[key];
    group.totalMarketValue += position.marketValue;
    group.tickers.push(position.ticker);

    if (position.eligible) {
      group.eligiblePositions++;
      group.attributedMarketValue += position.marketValue;
      group.attributedCostBasis += position.costBasis;
      group.attributedGainLoss += position.gainLoss;
    } else {
      group.ineligiblePositions++;
      group.unattributedMarketValue += position.marketValue;
    }
  });

  return Object.keys(groups).map(function(key) {
    const group = groups[key];
    const groupCoverage = group.totalMarketValue > 0
      ? group.attributedMarketValue / group.totalMarketValue
      : 0;

    return [
      run.runId,
      run.timestamp,
      group.name,
      group.totalMarketValue,
      group.attributedMarketValue,
      group.unattributedMarketValue,
      groupCoverage,
      group.attributedCostBasis,
      group.attributedGainLoss,
      group.attributedCostBasis > 0
        ? group.attributedGainLoss / group.attributedCostBasis
        : '',
      coverage.totalMarketValue > 0
        ? group.totalMarketValue / coverage.totalMarketValue
        : 0,
      group.eligiblePositions,
      group.ineligiblePositions,
      group.tickers.join(', '),
      run.platformVersion,
      run.baseline
    ];
  }).sort(function(a, b) {
    return b[3] - a[3];
  });
}

function foA2311ExecutiveRows_(
  positions,
  coverage,
  accountRows,
  sectorRows,
  run
) {
  const eligible = positions.filter(function(position) {
    return position.eligible;
  });

  const contributors = eligible.slice().sort(function(a, b) {
    return b.gainLoss - a.gainLoss;
  });

  const topContributor = contributors[0] || null;
  const topDetractor = contributors[contributors.length - 1] || null;
  const bestAccount = accountRows.slice().sort(function(a, b) {
    return b[8] - a[8];
  })[0] || null;
  const bestSector = sectorRows.slice().sort(function(a, b) {
    return b[8] - a[8];
  })[0] || null;

  const returnAvailable =
    coverage.coveragePct >= FO_A2311_MIN_COVERAGE_FOR_PORTFOLIO_RETURN;

  return [
    [
      run.runId,
      run.timestamp,
      'COVERAGE',
      'Total Portfolio Market Value',
      coverage.totalMarketValue,
      'INFORMATIONAL',
      'Total market value across all portfolio positions.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'COVERAGE',
      'Attributed Market Value',
      coverage.attributedMarketValue,
      coverage.coveragePct >= 0.80 ? 'STRONG' : 'LIMITED',
      'Market value with valid positive cost basis.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'COVERAGE',
      'Unattributed Market Value',
      coverage.unattributedMarketValue,
      coverage.unattributedMarketValue > 0 ? 'OBSERVATION' : 'NONE',
      'Market value excluded because cost basis is missing or non-positive.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'COVERAGE',
      'Cost-Basis Coverage %',
      coverage.coveragePct,
      coverage.coveragePct >= 0.80
        ? 'STRONG'
        : (coverage.coveragePct >= 0.50 ? 'PARTIAL' : 'INSUFFICIENT'),
      'Attributed market value divided by total portfolio market value.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'ATTRIBUTION',
      'Attributed Cost Basis',
      coverage.attributedCostBasis,
      'INFORMATIONAL',
      'Cost basis for attribution-eligible positions only.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'ATTRIBUTION',
      'Attributed Gain/Loss',
      coverage.attributedGainLoss,
      coverage.attributedGainLoss >= 0 ? 'POSITIVE' : 'NEGATIVE',
      'Gain/loss for attribution-eligible positions only.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'ATTRIBUTION',
      'Attributed Return %',
      coverage.attributedReturnPct === null
        ? 'UNAVAILABLE'
        : coverage.attributedReturnPct,
      coverage.attributedReturnPct === null
        ? 'UNAVAILABLE'
        : (coverage.attributedReturnPct >= 0 ? 'POSITIVE' : 'NEGATIVE'),
      'Return across attribution-eligible positions only.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'PORTFOLIO',
      'Portfolio-Wide Return %',
      returnAvailable ? coverage.attributedReturnPct : 'UNAVAILABLE',
      returnAvailable ? 'AVAILABLE' : 'SUPPRESSED',
      returnAvailable
        ? 'Coverage threshold satisfied.'
        : 'Suppressed because cost-basis coverage is below 80%.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'POSITION',
      'Top Eligible Contributor',
      topContributor ? topContributor.gainLoss : 'UNAVAILABLE',
      topContributor ? topContributor.ticker : 'N/A',
      'Largest positive gain/loss among eligible positions.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'POSITION',
      'Top Eligible Detractor',
      topDetractor ? topDetractor.gainLoss : 'UNAVAILABLE',
      topDetractor ? topDetractor.ticker : 'N/A',
      'Largest negative gain/loss among eligible positions.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'ACCOUNT',
      'Largest Account Driver',
      bestAccount ? bestAccount[8] : 'UNAVAILABLE',
      bestAccount ? bestAccount[2] : 'N/A',
      'Largest account-level eligible gain/loss.',
      run.platformVersion,
      run.baseline
    ],
    [
      run.runId,
      run.timestamp,
      'SECTOR',
      'Largest Sector Driver',
      bestSector ? bestSector[8] : 'UNAVAILABLE',
      bestSector ? bestSector[2] : 'N/A',
      'Largest sector-level eligible gain/loss.',
      run.platformVersion,
      run.baseline
    ]
  ];
}

function foRunPortfolioAttributionCoverageValidationA2311(expectedRunId) {
  const dashboard = foDashboard_();
  const suite = foCreateValidationSuiteA230(
    'A2.3.1.1 Cost Basis Coverage'
  );

  const positionSheet = dashboard.getSheetByName(
    'Position Attribution Coverage A2311'
  );
  const summarySheet = dashboard.getSheetByName(
    'Attribution Coverage Summary A2311'
  );

  suite.add(
    'SCHEMA',
    'Position coverage schema valid',
    function() {
      return foA2311SchemaMatches_(
        positionSheet,
        foGetHeadersA230('POSITION_ATTRIBUTION_COVERAGE_A2311')
      );
    },
    'CRITICAL'
  );

  suite.add(
    'OUTPUT',
    'Position coverage populated',
    function() {
      return positionSheet && positionSheet.getLastRow() > 1;
    },
    'CRITICAL'
  );

  suite.add(
    'CONTROL',
    'Missing cost basis excluded from gain/loss',
    function() {
      if (!positionSheet || positionSheet.getLastRow() < 2) return false;
      const values = positionSheet.getDataRange().getValues();
      const headers = values[0].map(String);
      const costIndex = headers.indexOf('Cost Basis');
      const gainIndex = headers.indexOf('Gain/Loss');
      const eligibleIndex = headers.indexOf('Attribution Eligible');
      if (costIndex < 0 || gainIndex < 0 || eligibleIndex < 0) return false;

      return values.slice(1).every(function(row) {
        const costBasis = foA2311Number_(row[costIndex]);
        const eligible = row[eligibleIndex] === true ||
          String(row[eligibleIndex]).toUpperCase() === 'TRUE';
        const gainLoss = row[gainIndex];

        if (costBasis <= 0) {
          return !eligible && (gainLoss === '' || gainLoss === null);
        }
        return eligible;
      });
    },
    'CRITICAL'
  );

  suite.add(
    'RECONCILIATION',
    'Attributed plus unattributed market value reconciles',
    function() {
      if (!summarySheet || summarySheet.getLastRow() < 2) return false;
      const values = summarySheet.getDataRange().getValues();
      const headers = values[0].map(String);
      const metricIndex = headers.indexOf('Metric');
      const valueIndex = headers.indexOf('Value');
      const map = {};

      values.slice(1).forEach(function(row) {
        map[String(row[metricIndex])] = row[valueIndex];
      });

      const total = foA2311Number_(map['Total Portfolio Market Value']);
      const attributed = foA2311Number_(map['Attributed Market Value']);
      const unattributed = foA2311Number_(map['Unattributed Market Value']);

      return Math.abs(total - attributed - unattributed) <= 0.01;
    },
    'CRITICAL'
  );

  suite.add(
    'POLICY',
    'Portfolio-wide return suppressed below threshold',
    function() {
      if (!summarySheet || summarySheet.getLastRow() < 2) return false;
      const values = summarySheet.getDataRange().getValues();
      const headers = values[0].map(String);
      const metricIndex = headers.indexOf('Metric');
      const valueIndex = headers.indexOf('Value');
      const statusIndex = headers.indexOf('Status');
      const map = {};

      values.slice(1).forEach(function(row) {
        map[String(row[metricIndex])] = {
          value: row[valueIndex],
          status: String(row[statusIndex])
        };
      });

      const coverage = foA2311Number_(map['Cost-Basis Coverage %'].value);
      const portfolioReturn = map['Portfolio-Wide Return %'];

      if (coverage < FO_A2311_MIN_COVERAGE_FOR_PORTFOLIO_RETURN) {
        return String(portfolioReturn.value) === 'UNAVAILABLE' &&
          portfolioReturn.status === 'SUPPRESSED';
      }
      return portfolioReturn.status === 'AVAILABLE';
    },
    'CRITICAL'
  );

  suite.add(
    'LINEAGE',
    'Coverage summary run lineage valid',
    function() {
      return Boolean(
        expectedRunId &&
        summarySheet &&
        summarySheet.getLastRow() > 1 &&
        String(summarySheet.getRange(2, 1).getValue()) ===
          String(expectedRunId)
      );
    },
    'HIGH'
  );

  const result = suite.run();
  const validationRun = foCreateRunMetadataA230('ATTR-COVERAGE-VAL');
  const validationSheet = foEnsureSheetA230(
    dashboard,
    'ATTRIBUTION_COVERAGE_VALIDATION_A2311'
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

function foRunPortfolioAttributionCoverageSmokeTestA2311() {
  const result = foRunPortfolioAttributionCoverageA2311();

  if (result.validation.failedControls > 0) {
    throw new Error(
      'A2.3.1.1 coverage smoke test failed: ' +
      JSON.stringify(result.validation)
    );
  }

  return {
    status: 'PASS',
    wave: 'A2.3.1.1',
    runId: result.runId,
    coveragePct: result.coveragePct,
    attributedMarketValue: result.attributedMarketValue,
    unattributedMarketValue: result.unattributedMarketValue,
    attributedGainLoss: result.attributedGainLoss,
    portfolioReturnAvailable: result.portfolioReturnAvailable
  };
}

function foA2311SchemaMatches_(sheet, expectedHeaders) {
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

function foA2311Number_(value) {
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

function foA2311Text_(value) {
  return String(
    value === null || value === undefined ? '' : value
  ).trim();
}
