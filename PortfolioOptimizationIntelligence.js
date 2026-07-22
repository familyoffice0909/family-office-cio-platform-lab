/**
 * PortfolioOptimizationIntelligence.js
 * Sprint 3.0.0 — Portfolio Optimization Intelligence
 *
 * Produces deterministic, weight-based allocation guidance. This module does
 * not calculate cash, trade quantities, recommendation scores, risk scores,
 * materiality, confidence, or deployment decisions. Existing upstream
 * decisions remain authoritative.
 */

function foRunPortfolioOptimizationIntelligence() {
  const module = 'PortfolioOptimizationIntelligence';

  try {
    foInfo_(module, 'Start', 'Portfolio optimization started.');

    const dashboard = foDashboard_();
    const policy = foReadPortfolioOptimizationPolicy_(dashboard);
    const positions = foReadPortfolioOptimizationPositions_(dashboard);
    const candidates = foReadPortfolioOptimizationCandidates_(dashboard);
    const optimization = foBuildPortfolioOptimization_(
      candidates,
      positions,
      policy
    );

    foWritePortfolioOptimization_(dashboard, optimization);

    foInfo_(
      module,
      'Complete',
      'Portfolio optimization completed. Candidates: ' +
        optimization.candidates.length +
        ', funded: ' + optimization.summary.fundedCandidateCount
    );

    return {
      status: optimization.summary.optimizationStatus,
      candidateCount: optimization.candidates.length,
      eligibleCandidateCount: optimization.summary.eligibleCandidateCount,
      fundedCandidateCount: optimization.summary.fundedCandidateCount,
      constrainedCandidateCount:
        optimization.summary.constrainedCandidateCount,
      optimizedIncrementalWeight:
        optimization.summary.optimizedIncrementalWeight,
      portfolioDirective: optimization.summary.portfolioDirective
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foReadPortfolioOptimizationPolicy_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_POLICY
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error(
      'Capital Deployment Policy contains no active policy rows.'
    );
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const policy = {};

  values.slice(1).forEach(function(row) {
    const key = String(
      foOptimizationVal_(row, headers, 'Policy Key') || ''
    ).trim();
    const activeValue = foOptimizationVal_(row, headers, 'Active');
    const active = activeValue === true ||
      String(activeValue).trim().toUpperCase() === 'TRUE';
    if (key && active) {
      policy[key] = foOptimizationVal_(row, headers, 'Policy Value');
    }
  });

  const maxPositionWeight = foOptimizationNormalizeWeight_(
    policy.MAX_POSITION_WEIGHT
  );

  if (!(maxPositionWeight > 0 && maxPositionWeight <= 1)) {
    throw new Error(
      'MAX_POSITION_WEIGHT must resolve to a value greater than 0 and at most 1.'
    );
  }

  return {
    maxPositionWeight: maxPositionWeight
  };
}

function foReadPortfolioOptimizationPositions_(dashboard) {
  const sheet = dashboard.getSheetByName('Portfolio Snapshot');

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error(
      'Portfolio Snapshot contains no positions. Run Portfolio Snapshot first.'
    );
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const positions = {};
  const tickerTotals = {};

  values.slice(1).forEach(function(row) {
    const ticker = String(
      foOptimizationVal_(row, headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foOptimizationVal_(row, headers, 'Account') || ''
    ).trim().toUpperCase();
    if (!ticker) return;

    const currentWeight = foOptimizationNormalizeWeight_(
      foOptimizationVal_(row, headers, 'Current Weight')
    );
    const safeWeight = currentWeight === null ? 0 : currentWeight;
    const key = ticker + '|' + account;

    positions[key] = (positions[key] || 0) + safeWeight;
    tickerTotals[ticker] = (tickerTotals[ticker] || 0) + safeWeight;
  });

  return {
    exact: positions,
    ticker: tickerTotals
  };
}

function foReadPortfolioOptimizationCandidates_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error(
      'Capital Deployment Priorities contains no results. Run capital deployment first.'
    );
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  return values.slice(1).map(function(row) {
    return {
      rank: foOptimizationNumber_(
        foOptimizationVal_(row, headers, 'Rank'),
        999999
      ),
      ticker: String(
        foOptimizationVal_(row, headers, 'Ticker') || ''
      ).trim().toUpperCase(),
      account: String(
        foOptimizationVal_(row, headers, 'Account') || ''
      ).trim(),
      deploymentDecision: String(
        foOptimizationVal_(row, headers, 'Deployment Decision') || ''
      ).trim().toUpperCase(),
      deploymentScore: foOptimizationNumber_(
        foOptimizationVal_(row, headers, 'Deployment Score'),
        0
      ),
      allocationBand: String(
        foOptimizationVal_(row, headers, 'Allocation Band') || ''
      ).trim(),
      blocked: String(
        foOptimizationVal_(row, headers, 'Blocked') || ''
      ).trim().toUpperCase(),
      blockers: String(
        foOptimizationVal_(row, headers, 'Blockers') || ''
      ).trim(),
      portfolioDirective: String(
        foOptimizationVal_(row, headers, 'Portfolio Directive') || ''
      ).trim()
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function foBuildPortfolioOptimization_(candidates, positions, policy) {
  const sorted = candidates.slice().sort(function(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.deploymentScore !== a.deploymentScore) {
      return b.deploymentScore - a.deploymentScore;
    }
    const aKey = a.ticker + '|' + String(a.account || '').toUpperCase();
    const bKey = b.ticker + '|' + String(b.account || '').toUpperCase();
    return aKey < bKey ? -1 : (aKey > bKey ? 1 : 0);
  });

  const results = sorted.map(function(candidate) {
    return foOptimizePortfolioCandidate_(candidate, positions, policy);
  });

  const eligible = results.filter(function(item) { return item.eligible; });
  const funded = results.filter(function(item) {
    return item.optimizedIncrementalWeight > 0;
  });
  const constrained = results.filter(function(item) {
    return item.constraintStatus !== 'PASS';
  });
  const totalIncrement = results.reduce(function(sum, item) {
    return sum + item.optimizedIncrementalWeight;
  }, 0);

  let directive = 'HOLD CURRENT ALLOCATION';
  if (funded.length > 0) directive = 'OPTIMIZE SELECTIVELY';
  else if (eligible.length > 0) directive = 'NO REMAINING POSITION CAPACITY';
  else if (results.length > 0) directive = 'NO ELIGIBLE DEPLOYMENT CANDIDATES';

  return {
    candidates: results,
    summary: {
      candidateCount: results.length,
      eligibleCandidateCount: eligible.length,
      fundedCandidateCount: funded.length,
      constrainedCandidateCount: constrained.length,
      optimizedIncrementalWeight: foOptimizationRound_(totalIncrement),
      optimizationStatus: results.length ? 'SUCCESS' : 'NO_DATA',
      portfolioDirective: directive,
      largestOptimizedTargetWeight: results.reduce(function(max, item) {
        return Math.max(max, item.optimizedTargetWeight);
      }, 0)
    }
  };
}

function foOptimizePortfolioCandidate_(candidate, positions, policy) {
  const accountKey = String(candidate.account || '').trim().toUpperCase();
  const exactKey = candidate.ticker + '|' + accountKey;
  let currentWeight = null;

  if (Object.prototype.hasOwnProperty.call(positions.exact, exactKey)) {
    currentWeight = positions.exact[exactKey];
  } else if (Object.prototype.hasOwnProperty.call(
    positions.ticker,
    candidate.ticker
  )) {
    currentWeight = positions.ticker[candidate.ticker];
  }

  const allocation = foParseOptimizationAllocationBand_(
    candidate.allocationBand
  );
  const isBlocked = candidate.blocked === 'YES' ||
    candidate.blocked === 'TRUE';
  const deployable = candidate.deploymentDecision === 'DEPLOY NOW' ||
    candidate.deploymentDecision === 'DEPLOY SOON';
  const eligible = !isBlocked && deployable;
  const reasons = [];

  if (isBlocked) reasons.push(candidate.blockers || 'UPSTREAM BLOCK');
  if (!deployable) reasons.push('DEPLOYMENT DECISION NOT ELIGIBLE');
  if (currentWeight === null) reasons.push('CURRENT WEIGHT UNAVAILABLE');
  if (!allocation.valid) reasons.push('INVALID ALLOCATION BAND');

  const safeCurrentWeight = currentWeight === null ? 0 : currentWeight;
  const remainingCapacity = Math.max(
    0,
    policy.maxPositionWeight - safeCurrentWeight
  );
  const requestedIncrement = allocation.valid ? allocation.midpoint : 0;
  let optimizedIncrement = 0;

  if (eligible && currentWeight !== null && allocation.valid) {
    optimizedIncrement = Math.min(requestedIncrement, remainingCapacity);
    if (remainingCapacity <= 0) reasons.push('MAXIMUM POSITION WEIGHT REACHED');
    else if (optimizedIncrement < requestedIncrement) {
      reasons.push('ALLOCATION CAPPED BY POSITION CAPACITY');
    }
  }

  const targetWeight = safeCurrentWeight + optimizedIncrement;
  const constraintStatus = reasons.length === 0
    ? 'PASS'
    : (optimizedIncrement > 0 ? 'CAPPED' : 'BLOCKED');

  return {
    rank: candidate.rank,
    ticker: candidate.ticker,
    account: candidate.account,
    deploymentDecision: candidate.deploymentDecision,
    deploymentScore: candidate.deploymentScore,
    allocationBand: candidate.allocationBand,
    currentPortfolioWeight: foOptimizationRound_(safeCurrentWeight),
    allocationBandMinimum: allocation.valid ? allocation.minimum : 0,
    allocationBandMaximum: allocation.valid ? allocation.maximum : 0,
    requestedIncrementalWeight: foOptimizationRound_(requestedIncrement),
    maximumPositionWeight: foOptimizationRound_(policy.maxPositionWeight),
    remainingCapacity: foOptimizationRound_(remainingCapacity),
    optimizedIncrementalWeight: foOptimizationRound_(optimizedIncrement),
    optimizedTargetWeight: foOptimizationRound_(targetWeight),
    eligible: eligible,
    constraintStatus: constraintStatus,
    constraintReason: reasons.length ? reasons.join('; ') : 'NONE',
    optimizationRationale: foBuildPortfolioOptimizationRationale_(
      candidate,
      safeCurrentWeight,
      requestedIncrement,
      optimizedIncrement,
      targetWeight,
      policy.maxPositionWeight,
      reasons
    )
  };
}

function foParseOptimizationAllocationBand_(value) {
  const text = String(value || '').trim();
  if (!text) return {valid: false, minimum: 0, maximum: 0, midpoint: 0};

  const matches = text.match(/\d+(?:\.\d+)?/g) || [];
  if (!matches.length) {
    return {valid: false, minimum: 0, maximum: 0, midpoint: 0};
  }

  let minimum = foOptimizationNormalizeWeight_(matches[0]);
  let maximum = matches.length > 1
    ? foOptimizationNormalizeWeight_(matches[1])
    : minimum;

  if (minimum === null || maximum === null || minimum < 0 || maximum < 0) {
    return {valid: false, minimum: 0, maximum: 0, midpoint: 0};
  }
  if (minimum > maximum) {
    const temporary = minimum;
    minimum = maximum;
    maximum = temporary;
  }
  if (maximum > 1) {
    return {valid: false, minimum: 0, maximum: 0, midpoint: 0};
  }

  return {
    valid: true,
    minimum: foOptimizationRound_(minimum),
    maximum: foOptimizationRound_(maximum),
    midpoint: foOptimizationRound_((minimum + maximum) / 2)
  };
}

function foBuildPortfolioOptimizationRationale_(
  candidate,
  currentWeight,
  requestedIncrement,
  optimizedIncrement,
  targetWeight,
  maximumWeight,
  reasons
) {
  if (optimizedIncrement <= 0) {
    return candidate.ticker + ': no incremental allocation. ' +
      (reasons.length ? reasons.join('; ') : 'No eligible capacity.');
  }

  return candidate.ticker + ': add ' +
    foOptimizationPercentText_(optimizedIncrement) +
    ' portfolio weight, moving from ' +
    foOptimizationPercentText_(currentWeight) + ' to ' +
    foOptimizationPercentText_(targetWeight) + '. Requested ' +
    foOptimizationPercentText_(requestedIncrement) +
    '; maximum position weight ' +
    foOptimizationPercentText_(maximumWeight) +
    (reasons.length ? '. Constraint: ' + reasons.join('; ') : '.');
}

function foWritePortfolioOptimization_(dashboard, optimization) {
  const headers = foPortfolioOptimizationHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PORTFOLIO_OPTIMIZATION,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const rows = optimization.candidates.map(function(item) {
    return [
      item.rank,
      item.ticker,
      item.account,
      item.deploymentDecision,
      item.deploymentScore,
      item.allocationBand,
      item.currentPortfolioWeight,
      item.allocationBandMinimum,
      item.allocationBandMaximum,
      item.requestedIncrementalWeight,
      item.maximumPositionWeight,
      item.remainingCapacity,
      item.optimizedIncrementalWeight,
      item.optimizedTargetWeight,
      item.constraintStatus,
      item.constraintReason,
      item.optimizationRationale,
      optimization.summary.portfolioDirective,
      now,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  const percentHeaders = [
    'Current Portfolio Weight',
    'Allocation Band Minimum',
    'Allocation Band Maximum',
    'Requested Incremental Weight',
    'Maximum Position Weight',
    'Remaining Capacity',
    'Optimized Incremental Weight',
    'Optimized Target Weight'
  ];
  percentHeaders.forEach(function(header) {
    sheet.getRange(
      2,
      headers.indexOf(header) + 1,
      Math.max(rows.length, 1),
      1
    ).setNumberFormat('0.00%');
  });

  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(headers.indexOf('Constraint Reason') + 1, 360);
  sheet.setColumnWidth(headers.indexOf('Optimization Rationale') + 1, 620);

  foWritePortfolioOptimizationSummary_(dashboard, optimization.summary);
}

function foWritePortfolioOptimizationSummary_(dashboard, summary) {
  const headers = [
    'Timestamp', 'Metric', 'Value', 'Platform Version', 'Baseline'
  ];
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PORTFOLIO_OPTIMIZATION_SUMMARY,
    headers
  );
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const rows = [
    [now, 'Optimization Status', summary.optimizationStatus, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Portfolio Directive', summary.portfolioDirective, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Candidate Count', summary.candidateCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Eligible Candidate Count', summary.eligibleCandidateCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Funded Candidate Count', summary.fundedCandidateCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Constrained Candidate Count', summary.constrainedCandidateCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Optimized Incremental Weight', summary.optimizedIncrementalWeight, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [now, 'Largest Optimized Target Weight', summary.largestOptimizedTargetWeight, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(8, 3, 2, 1).setNumberFormat('0.00%');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function foPortfolioOptimizationHeaders_() {
  return [
    'Rank', 'Ticker', 'Account', 'Deployment Decision', 'Deployment Score',
    'Allocation Band', 'Current Portfolio Weight', 'Allocation Band Minimum',
    'Allocation Band Maximum', 'Requested Incremental Weight',
    'Maximum Position Weight', 'Remaining Capacity',
    'Optimized Incremental Weight', 'Optimized Target Weight',
    'Constraint Status', 'Constraint Reason', 'Optimization Rationale',
    'Portfolio Directive', 'Timestamp', 'Platform Version', 'Baseline'
  ];
}

function foRunPortfolioOptimizationIntelligenceSmokeTest() {
  return foRunPortfolioOptimizationIntelligence();
}

function foOptimizationVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foOptimizationNumber_(value, fallback) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return fallback;
  }
  const number = Number(String(value).replace(/[$,%\s]/g, ''));
  return Number.isFinite(number) ? number : fallback;
}

function foOptimizationNormalizeWeight_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }
  const text = String(value).trim();
  const percentMarked = text.indexOf('%') >= 0;
  const number = Number(text.replace(/[,%\s]/g, ''));
  if (!Number.isFinite(number)) return null;
  if (percentMarked || Math.abs(number) > 1) return number / 100;
  return number;
}

function foOptimizationRound_(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

function foOptimizationPercentText_(value) {
  return (foOptimizationRound_(value) * 100).toFixed(2) + '%';
}
