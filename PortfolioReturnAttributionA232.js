/**
 * Wave A2.3.2 — Portfolio Return Attribution
 *
 * Uses consecutive portfolio snapshots. Positions with quantity changes are
 * excluded because transaction cash-flow data is not yet available.
 */
const FO_A232_RELEASE_TARGET = 'v1.3.0';
const FO_A232_QUANTITY_TOLERANCE = 0.000001;

function foRunPortfolioReturnAttributionA232() {
  const dashboard = foDashboard_();
  const run = foCreateRunMetadataA230('RETURN-ATTR');
  const source = dashboard.getSheetByName('Portfolio Performance Positions');
  if (!source || source.getLastRow() < 2) {
    throw new Error('Portfolio Performance Positions is missing or empty. Run foRunPortfolioPerformance() first.');
  }

  const values = source.getDataRange().getValues();
  const headers = values[0].map(String);
  const current = foA232ReadCurrent_(values, headers);
  if (!current.length) throw new Error('A2.3.2 found no current positions.');

  const snapshotSheet = foEnsureSheetA230(dashboard, 'PERFORMANCE_SNAPSHOT_A232');
  const previous = foA232LatestSnapshot_(snapshotSheet);

  if (!previous.rows.length) {
    foAppendRowsA230(snapshotSheet, foA232SnapshotRows_(current, run));
    foA232WriteBaseline_(dashboard, current, run);
    const validation = foRunPortfolioReturnAttributionValidationA232(run.runId, true);
    return {
      status: 'BASELINE CREATED', runId: run.runId, previousRunId: '',
      positions: current.length, eligiblePositions: 0,
      excludedPositions: current.length, eligibleCoveragePct: 0,
      portfolioReturnPct: null, validation: validation,
      releaseTarget: FO_A232_RELEASE_TARGET
    };
  }

  const comparison = foA232Compare_(previous.rows, current);
  const totalBeginningValue = comparison.reduce(function(sum, item) {
    return sum + item.beginningMarketValue;
  }, 0);
  const eligibleBeginningValue = comparison.reduce(function(sum, item) {
    return sum + (item.eligible ? item.beginningMarketValue : 0);
  }, 0);

  comparison.forEach(function(item) {
    item.beginningWeight = item.eligible && eligibleBeginningValue > 0
      ? item.beginningMarketValue / eligibleBeginningValue : null;
    item.contributionPct = item.eligible
      ? item.beginningWeight * item.priceReturnPct : null;
  });

  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'POSITION_RETURN_ATTRIBUTION_A232'),
    foA232PositionRows_(comparison, previous.runId, run)
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'ACCOUNT_RETURN_ATTRIBUTION_A232'),
    foA232GroupRows_(comparison, 'account', previous.runId, run)
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'SECTOR_RETURN_ATTRIBUTION_A232'),
    foA232GroupRows_(comparison, 'sector', previous.runId, run)
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'RETURN_ATTRIBUTION_SUMMARY_A232'),
    foA232SummaryRows_(comparison, previous.runId, totalBeginningValue, eligibleBeginningValue, run)
  );
  foAppendRowsA230(snapshotSheet, foA232SnapshotRows_(current, run));

  const validation = foRunPortfolioReturnAttributionValidationA232(run.runId, false);
  const portfolioReturnPct = comparison.reduce(function(sum, item) {
    return sum + (item.contributionPct || 0);
  }, 0);
  const eligibleCount = comparison.filter(function(item) { return item.eligible; }).length;

  return {
    status: validation.failedControls ? 'FAIL' :
      (eligibleBeginningValue < totalBeginningValue ? 'PASS WITH OBSERVATIONS' : 'PASS'),
    runId: run.runId, previousRunId: previous.runId,
    positions: comparison.length, eligiblePositions: eligibleCount,
    excludedPositions: comparison.length - eligibleCount,
    eligibleCoveragePct: totalBeginningValue > 0 ? eligibleBeginningValue / totalBeginningValue : 0,
    portfolioReturnPct: portfolioReturnPct, validation: validation,
    releaseTarget: FO_A232_RELEASE_TARGET
  };
}

function foA232ReadCurrent_(values, headers) {
  const rows = [];
  values.slice(1).forEach(function(row) {
    const ticker = foA232Text_(foGetVal_(row, headers, 'Ticker')).toUpperCase();
    const account = foNormalizeAccountIdentity_(
      foGetVal_(row, headers, 'Account')
    ).name;
    if (!ticker) return;
    const quantity = foA232Number_(foGetVal_(row, headers, 'Quantity'));
    const marketValue = foA232Number_(foGetVal_(row, headers, 'Market Value'));
    const reportedPrice = foA232Number_(foGetVal_(row, headers, 'Current Price'));
    const effectivePrice = reportedPrice > 0 ? reportedPrice :
      (quantity > 0 && marketValue > 0 ? marketValue / quantity : 0);
    if (quantity <= 0 && marketValue <= 0) return;
    rows.push({
      key: account.toUpperCase() + '|' + ticker,
      ticker: ticker,
      company: foA232Text_(foGetVal_(row, headers, 'Company')),
      account: account,
      sector: foA232Text_(foGetVal_(row, headers, 'Sector')) || 'Unknown',
      assetClass: foA232Text_(foGetVal_(row, headers, 'Asset Class')) || 'Unknown',
      quantity: quantity, price: effectivePrice, marketValue: marketValue
    });
  });
  return rows;
}

function foA232LatestSnapshot_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return {runId: '', rows: []};
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const runIndex = headers.indexOf('Snapshot Run ID');
  if (runIndex < 0) return {runId: '', rows: []};
  const data = values.slice(1);
  const latestRunId = String(data[data.length - 1][runIndex] || '');
  const rows = data.filter(function(row) {
    return String(row[runIndex] || '') === latestRunId;
  }).map(function(row) {
    const account = foNormalizeAccountIdentity_(
      row[headers.indexOf('Account')]
    ).name;
    const ticker = foA232Text_(row[headers.indexOf('Ticker')]).toUpperCase();
    return {
      key: account.toUpperCase() + '|' + ticker,
      ticker: ticker,
      company: foA232Text_(row[headers.indexOf('Company')]),
      account: account,
      sector: foA232Text_(row[headers.indexOf('Sector')]) || 'Unknown',
      assetClass: foA232Text_(row[headers.indexOf('Asset Class')]) || 'Unknown',
      quantity: foA232Number_(row[headers.indexOf('Quantity')]),
      price: foA232Number_(row[headers.indexOf('Effective Price')]),
      marketValue: foA232Number_(row[headers.indexOf('Market Value')])
    };
  });
  return {runId: latestRunId, rows: rows};
}

function foA232Compare_(previousRows, currentRows) {
  const beforeMap = {}, afterMap = {}, keys = {};
  previousRows.forEach(function(row) { beforeMap[row.key] = row; keys[row.key] = true; });
  currentRows.forEach(function(row) { afterMap[row.key] = row; keys[row.key] = true; });
  return Object.keys(keys).map(function(key) {
    const before = beforeMap[key] || null;
    const after = afterMap[key] || null;
    let eligible = true, reason = 'ELIGIBLE';
    if (!before) { eligible = false; reason = 'EXCLUDED — NO PRIOR SNAPSHOT'; }
    else if (!after) { eligible = false; reason = 'EXCLUDED — POSITION CLOSED'; }
    else if (Math.abs(before.quantity - after.quantity) > FO_A232_QUANTITY_TOLERANCE) {
      eligible = false; reason = 'EXCLUDED — QUANTITY CHANGED / FLOW DATA REQUIRED';
    } else if (before.price <= 0 || after.price <= 0) {
      eligible = false; reason = 'EXCLUDED — INVALID PRICE';
    }
    const base = after || before;
    const beginningMarketValue = before ? before.marketValue : 0;
    const endingMarketValue = after ? after.marketValue : 0;
    return {
      ticker: base.ticker, company: base.company, account: base.account,
      sector: base.sector, assetClass: base.assetClass,
      beginningQuantity: before ? before.quantity : 0,
      endingQuantity: after ? after.quantity : 0,
      beginningPrice: before ? before.price : 0,
      endingPrice: after ? after.price : 0,
      beginningMarketValue: beginningMarketValue,
      endingMarketValue: endingMarketValue,
      observedValueChange: endingMarketValue - beginningMarketValue,
      priceReturnPct: eligible ? after.price / before.price - 1 : null,
      beginningWeight: null, contributionPct: null,
      eligible: eligible, eligibilityReason: reason
    };
  }).sort(function(a, b) {
    return Math.abs(b.observedValueChange) - Math.abs(a.observedValueChange);
  });
}

function foA232SnapshotRows_(positions, run) {
  return positions.map(function(p) {
    return [run.runId, run.timestamp, p.ticker, p.company, p.account, p.sector,
      p.assetClass, p.quantity, p.price, p.marketValue,
      run.platformVersion, run.baseline];
  });
}

function foA232PositionRows_(comparison, previousRunId, run) {
  return comparison.map(function(p, index) {
    return [run.runId, previousRunId, run.timestamp, index + 1, p.ticker,
      p.company, p.account, p.sector, p.assetClass, p.beginningQuantity,
      p.endingQuantity, p.beginningPrice, p.endingPrice,
      p.beginningMarketValue, p.endingMarketValue, p.observedValueChange,
      p.eligible ? p.priceReturnPct : '', p.eligible ? p.beginningWeight : '',
      p.eligible ? p.contributionPct : '', p.eligible, p.eligibilityReason,
      run.platformVersion, run.baseline];
  });
}

function foA232GroupRows_(comparison, field, previousRunId, run) {
  const groups = {};
  comparison.forEach(function(p) {
    const key = p[field] || 'Unknown';
    if (!groups[key]) groups[key] = {
      name: key, beginning: 0, ending: 0, change: 0, eligibleBeginning: 0,
      weightedReturnNumerator: 0, contribution: 0,
      eligiblePositions: 0, excludedPositions: 0, tickers: []
    };
    const g = groups[key];
    g.beginning += p.beginningMarketValue;
    g.ending += p.endingMarketValue;
    g.change += p.observedValueChange;
    g.tickers.push(p.ticker);
    if (p.eligible) {
      g.eligibleBeginning += p.beginningMarketValue;
      g.weightedReturnNumerator += p.beginningMarketValue * p.priceReturnPct;
      g.contribution += p.contributionPct || 0;
      g.eligiblePositions++;
    } else g.excludedPositions++;
  });
  return Object.keys(groups).map(function(key) {
    const g = groups[key];
    return [run.runId, previousRunId, run.timestamp, g.name, g.beginning,
      g.ending, g.change, g.eligibleBeginning,
      g.eligibleBeginning > 0 ? g.weightedReturnNumerator / g.eligibleBeginning : '',
      g.contribution, g.eligiblePositions, g.excludedPositions,
      g.tickers.join(', '), run.platformVersion, run.baseline];
  }).sort(function(a, b) { return Math.abs(b[9]) - Math.abs(a[9]); });
}

function foA232SummaryRows_(comparison, previousRunId, totalBeginning, eligibleBeginning, run) {
  const portfolioReturn = comparison.reduce(function(sum, p) {
    return sum + (p.contributionPct || 0);
  }, 0);
  const coverage = totalBeginning > 0 ? eligibleBeginning / totalBeginning : 0;
  const eligible = comparison.filter(function(p) { return p.eligible; });
  const ranked = eligible.slice().sort(function(a, b) {
    return (b.contributionPct || 0) - (a.contributionPct || 0);
  });
  const top = ranked[0] || null;
  const bottom = ranked[ranked.length - 1] || null;
  return [
    [run.runId, previousRunId, run.timestamp, 'PERIOD', 'Prior Snapshot Run ID', previousRunId, 'INFORMATIONAL', 'Comparison baseline snapshot.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'COVERAGE', 'Beginning Portfolio Market Value', totalBeginning, 'INFORMATIONAL', 'Beginning market value across the prior snapshot.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'COVERAGE', 'Eligible Beginning Market Value', eligibleBeginning, coverage >= 0.8 ? 'STRONG' : 'LIMITED', 'Beginning value eligible for return attribution.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'COVERAGE', 'Excluded Beginning Market Value', totalBeginning - eligibleBeginning, totalBeginning > eligibleBeginning ? 'OBSERVATION' : 'NONE', 'Excluded because of quantity changes, missing prior data or invalid prices.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'COVERAGE', 'Return Attribution Coverage %', coverage, coverage >= 0.8 ? 'STRONG' : (coverage >= 0.5 ? 'PARTIAL' : 'INSUFFICIENT'), 'Eligible beginning value divided by total beginning value.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'RETURN', 'Portfolio Price Return %', portfolioReturn, coverage >= 0.8 ? 'AVAILABLE' : 'PARTIAL', 'Sum of eligible beginning-weighted position returns.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'POSITIONS', 'Eligible Positions', eligible.length, 'INFORMATIONAL', 'Stable quantity and valid beginning/ending prices.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'POSITIONS', 'Excluded Positions', comparison.length - eligible.length, comparison.length > eligible.length ? 'OBSERVATION' : 'NONE', 'Excluded where cash-flow-neutral return cannot be established.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'POSITION', 'Top Return Contributor', top ? top.contributionPct : 'UNAVAILABLE', top ? top.ticker : 'N/A', 'Largest eligible weighted return contribution.', run.platformVersion, run.baseline],
    [run.runId, previousRunId, run.timestamp, 'POSITION', 'Top Return Detractor', bottom ? bottom.contributionPct : 'UNAVAILABLE', bottom ? bottom.ticker : 'N/A', 'Smallest eligible weighted return contribution.', run.platformVersion, run.baseline]
  ];
}

function foA232WriteBaseline_(dashboard, current, run) {
  foReplaceRowsA230(foEnsureSheetA230(dashboard, 'RETURN_ATTRIBUTION_SUMMARY_A232'), [
    [run.runId, '', run.timestamp, 'PERIOD', 'Baseline Status', 'BASELINE CREATED', 'INFORMATIONAL', 'Run A2.3.2 again after values change.', run.platformVersion, run.baseline],
    [run.runId, '', run.timestamp, 'POSITIONS', 'Snapshot Position Count', current.length, 'INFORMATIONAL', 'Positions captured in the first snapshot.', run.platformVersion, run.baseline],
    [run.runId, '', run.timestamp, 'RETURN', 'Portfolio Price Return %', 'UNAVAILABLE', 'BASELINE REQUIRED', 'No prior snapshot was available.', run.platformVersion, run.baseline]
  ]);
  foReplaceRowsA230(foEnsureSheetA230(dashboard, 'POSITION_RETURN_ATTRIBUTION_A232'), []);
  foReplaceRowsA230(foEnsureSheetA230(dashboard, 'ACCOUNT_RETURN_ATTRIBUTION_A232'), []);
  foReplaceRowsA230(foEnsureSheetA230(dashboard, 'SECTOR_RETURN_ATTRIBUTION_A232'), []);
}

function foRunPortfolioReturnAttributionValidationA232(expectedRunId, baselineOnly) {
  const dashboard = foDashboard_();
  const suite = foCreateValidationSuiteA230('A2.3.2 Portfolio Return Attribution');
  const snapshot = dashboard.getSheetByName('Performance Snapshot A232');
  const positions = dashboard.getSheetByName('Position Return Attribution A232');
  const summary = dashboard.getSheetByName('Return Attribution Summary A232');

  suite.add('SCHEMA', 'Snapshot schema valid', function() {
    return foA232SchemaMatches_(snapshot, foGetHeadersA230('PERFORMANCE_SNAPSHOT_A232'));
  }, 'CRITICAL');
  suite.add('SCHEMA', 'Position return schema valid', function() {
    return foA232SchemaMatches_(positions, foGetHeadersA230('POSITION_RETURN_ATTRIBUTION_A232'));
  }, 'CRITICAL');
  suite.add('SCHEMA', 'Return summary schema valid', function() {
    return foA232SchemaMatches_(summary, foGetHeadersA230('RETURN_ATTRIBUTION_SUMMARY_A232'));
  }, 'CRITICAL');
  suite.add('LINEAGE', 'Summary run lineage valid', function() {
    return Boolean(expectedRunId && summary && summary.getLastRow() > 1 &&
      String(summary.getRange(2, 1).getValue()) === String(expectedRunId));
  }, 'HIGH');
  suite.add('POLICY', 'Quantity changes are excluded', function() {
    if (baselineOnly) return true;
    if (!positions || positions.getLastRow() < 2) return false;
    const v = positions.getDataRange().getValues(), h = v[0].map(String);
    const bi = h.indexOf('Beginning Quantity'), ei = h.indexOf('Ending Quantity'),
      ai = h.indexOf('Return Eligible');
    return v.slice(1).every(function(row) {
      const changed = Math.abs(foA232Number_(row[bi]) - foA232Number_(row[ei])) > FO_A232_QUANTITY_TOLERANCE;
      const eligible = row[ai] === true || String(row[ai]).toUpperCase() === 'TRUE';
      return !changed || !eligible;
    });
  }, 'CRITICAL');
  suite.add('RECONCILIATION', 'Position contributions reconcile', function() {
    if (baselineOnly) return true;
    if (!positions || positions.getLastRow() < 2) return false;
    const pv = positions.getDataRange().getValues(), ph = pv[0].map(String), ci = ph.indexOf('Contribution %');
    const total = pv.slice(1).reduce(function(sum, row) { return sum + foA232Number_(row[ci]); }, 0);
    const sv = summary.getDataRange().getValues(), sh = sv[0].map(String), mi = sh.indexOf('Metric'), vi = sh.indexOf('Value');
    let reported = null;
    sv.slice(1).forEach(function(row) { if (String(row[mi]) === 'Portfolio Price Return %') reported = foA232Number_(row[vi]); });
    return reported !== null && Math.abs(total - reported) <= 0.0000001;
  }, 'CRITICAL');

  const result = suite.run();
  const validationRun = foCreateRunMetadataA230('RETURN-ATTR-VAL');
  const validationSheet = foEnsureSheetA230(dashboard, 'RETURN_ATTRIBUTION_VALIDATION_A232');
  foAppendRowsA230(validationSheet, result.controls.map(function(c) {
    return [validationRun.runId, validationRun.timestamp, c.category, c.control,
      c.status, c.severity, c.details, validationRun.platformVersion, validationRun.baseline];
  }));
  return {status: result.status, validationRunId: validationRun.runId,
    failedControls: result.failedControls, passedControls: result.passedControls,
    totalControls: result.totalControls, blocking: result.blocking};
}

function foRunPortfolioReturnAttributionSmokeTestA232() {
  let result = foRunPortfolioReturnAttributionA232();
  if (result.status === 'BASELINE CREATED') result = foRunPortfolioReturnAttributionA232();
  if (result.validation.failedControls > 0) throw new Error('A2.3.2 smoke test failed: ' + JSON.stringify(result.validation));
  return {status: 'PASS', wave: 'A2.3.2', releaseTarget: FO_A232_RELEASE_TARGET,
    runId: result.runId, previousRunId: result.previousRunId,
    eligiblePositions: result.eligiblePositions, excludedPositions: result.excludedPositions,
    eligibleCoveragePct: result.eligibleCoveragePct, portfolioReturnPct: result.portfolioReturnPct};
}

function foA232SchemaMatches_(sheet, expectedHeaders) {
  if (!sheet || sheet.getLastColumn() !== expectedHeaders.length) return false;
  const actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  return expectedHeaders.every(function(header, index) { return String(actual[index] || '').trim() === header; });
}
function foA232Number_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}
function foA232Text_(value) { return String(value === null || value === undefined ? '' : value).trim(); }
