/**
 * Investment Decision Support Engine
 * Wave 2.4.2 — Materiality, Trend and Allocation Guidance
 */

function foRunInvestmentDecisionSupport() {
  const module = 'InvestmentDecisionSupportEngine';

  try {
    foInfo_(module, 'Start', 'Investment decision support started.');

    const dashboard = foDashboard_();
    const results = foReadDecisionSupportInputs_(dashboard);
    const output = foBuildInvestmentDecisionSupport_(dashboard, results);

    foInfo_(
      module,
      'Complete',
      'Investment decision support completed. Decisions: ' +
        output.decisions.length
    );

    return {
      status: 'SUCCESS',
      decisions: output.decisions.length,
      materialDecisions: output.decisions.filter(function(item) {
        return item.materialityScore >= 60;
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foRunInvestmentDecisionSupportFromResults_(dashboard, results) {
  return foBuildInvestmentDecisionSupport_(dashboard, results);
}

function foReadDecisionSupportInputs_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_INTELLIGENCE
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error(
      'Buy Zone Intelligence contains no results. Run intelligence first.'
    );
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  return values.slice(1).map(function(row) {
    return {
      ticker: String(
        foDecisionVal_(row, headers, 'Ticker') || ''
      ).trim().toUpperCase(),
      account: foDecisionVal_(row, headers, 'Account'),
      currentPrice: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Current Price')
      ),
      targetEntryPrice: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Target Entry Price')
      ),
      distancePct: foDecisionNullableNumber_(
        foDecisionVal_(row, headers, 'Distance to Entry %')
      ),
      zonePosition: foDecisionVal_(row, headers, 'Zone Position'),
      priceFreshness: foDecisionVal_(
        row,
        headers,
        'Price Freshness'
      ),
      convictionScore: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Conviction Score')
      ),
      riskScore: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Risk Score')
      ),
      confidence: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Buy Zone Confidence')
      ),
      recommendation: foDecisionVal_(
        row,
        headers,
        'Recommendation'
      ),
      portfolioWeight: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Portfolio Weight')
      ),
      rationale:
        foDecisionVal_(row, headers, 'Recommendation Reason') ||
        foDecisionVal_(row, headers, 'Rationale')
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function foBuildInvestmentDecisionSupport_(dashboard, results) {
  const history = foLoadDecisionHistory_(dashboard);
  const decisions = results.map(function(item) {
    return foBuildDecisionRecord_(item, history);
  }).sort(function(a, b) {
    return b.priorityScore - a.priorityScore;
  });

  foWriteDecisionSupport_(dashboard, decisions);
  foAppendDecisionHistory_(dashboard, decisions);

  return {
    decisions: decisions
  };
}

function foBuildDecisionRecord_(item, history) {
  const key = foDecisionKey_(item.ticker, item.account);
  const previous = history[key] || null;

  const convictionDelta = previous
    ? item.convictionScore - previous.convictionScore
    : 0;
  const riskDelta = previous
    ? item.riskScore - previous.riskScore
    : 0;
  const confidenceDelta = previous
    ? item.confidence - previous.confidence
    : 0;
  const distanceDelta = previous &&
    previous.distancePct !== null &&
    item.distancePct !== null
    ? item.distancePct - previous.distancePct
    : 0;

  const trend = foDecisionTrend_(
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta
  );
  const materialityScore = foDecisionMateriality_(
    item,
    previous,
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta
  );
  const action = foDecisionAction_(item);
  const allocationBand = foDecisionAllocationBand_(item, action);
  const priorityScore = foDecisionPriority_(
    item,
    materialityScore,
    action
  );

  return {
    ticker: item.ticker,
    account: item.account,
    action: action,
    recommendation: item.recommendation,
    allocationBand: allocationBand,
    materialityScore: materialityScore,
    priorityScore: priorityScore,
    trend: trend,
    convictionScore: item.convictionScore,
    convictionDelta: convictionDelta,
    riskScore: item.riskScore,
    riskDelta: riskDelta,
    confidence: item.confidence,
    confidenceDelta: confidenceDelta,
    distancePct: item.distancePct,
    distanceDelta: distanceDelta,
    priceFreshness: item.priceFreshness,
    zonePosition: item.zonePosition,
    currentPrice: item.currentPrice,
    targetEntryPrice: item.targetEntryPrice,
    executiveReason: foDecisionExecutiveReason_(
      item,
      trend,
      materialityScore,
      allocationBand
    )
  };
}

function foDecisionAction_(item) {
  if (item.priceFreshness !== 'FRESH') return 'REFRESH DATA';

  if (item.recommendation === 'STRONG BUY') return 'DEPLOY NOW';
  if (item.recommendation === 'BUY') return 'BUY';
  if (item.recommendation === 'ACCUMULATE') return 'ACCUMULATE';
  if (item.recommendation === 'AVOID') return 'AVOID';
  if (item.recommendation === 'HOLD') return 'HOLD';

  return 'WATCH';
}

function foDecisionAllocationBand_(item, action) {
  if (
    action === 'REFRESH DATA' ||
    action === 'WATCH' ||
    action === 'HOLD' ||
    action === 'AVOID'
  ) {
    return '0%';
  }

  if (item.riskScore > 50 || item.confidence < 60) return '0-1%';
  if (item.convictionScore >= 90 && item.riskScore <= 25) return '3-5%';
  if (item.convictionScore >= 80 && item.riskScore <= 35) return '2-4%';

  return '1-2%';
}

function foDecisionMateriality_(
  item,
  previous,
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta
) {
  let score = 0;

  const recommendationWeight = {
    'STRONG BUY': 35,
    BUY: 30,
    ACCUMULATE: 22,
    WATCH: 12,
    HOLD: 8,
    AVOID: 30
  };

  score += recommendationWeight[item.recommendation] || 5;

  if (item.zonePosition === 'IN BUY ZONE') score += 20;
  if (item.zonePosition === 'BELOW ZONE') score += 15;
  if (item.priceFreshness !== 'FRESH') score -= 20;

  if (previous) {
    score += Math.min(15, Math.abs(convictionDelta));
    score += Math.min(10, Math.abs(riskDelta));
    score += Math.min(10, Math.abs(confidenceDelta));
    score += Math.min(10, Math.abs(distanceDelta) * 100);

    if (previous.recommendation !== item.recommendation) score += 20;
    if (previous.zonePosition !== item.zonePosition) score += 15;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

function foDecisionTrend_(
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta
) {
  let points = 0;

  if (convictionDelta >= 5) points += 1;
  if (convictionDelta <= -5) points -= 1;
  if (riskDelta <= -5) points += 1;
  if (riskDelta >= 5) points -= 1;
  if (confidenceDelta >= 5) points += 1;
  if (confidenceDelta <= -5) points -= 1;
  if (distanceDelta <= -0.02) points += 1;
  if (distanceDelta >= 0.02) points -= 1;

  if (points >= 2) return 'IMPROVING';
  if (points <= -2) return 'DETERIORATING';
  return 'STABLE';
}

function foDecisionPriority_(item, materialityScore, action) {
  const actionWeight = {
    'DEPLOY NOW': 100,
    BUY: 85,
    ACCUMULATE: 70,
    WATCH: 50,
    HOLD: 30,
    AVOID: 20,
    'REFRESH DATA': 10
  };

  return Math.round(
    (actionWeight[action] || 0) * 0.35 +
    item.convictionScore * 0.20 +
    (100 - item.riskScore) * 0.15 +
    item.confidence * 0.10 +
    materialityScore * 0.20
  );
}

function foDecisionExecutiveReason_(
  item,
  trend,
  materialityScore,
  allocationBand
) {
  const parts = [
    item.recommendation,
    'Trend ' + trend,
    'Materiality ' + materialityScore,
    'Conviction ' + item.convictionScore,
    'Risk ' + item.riskScore,
    'Allocation ' + allocationBand
  ];

  if (item.priceFreshness !== 'FRESH') {
    parts.push('Refresh price data');
  } else if (item.distancePct !== null) {
    parts.push(foDecisionPercent_(item.distancePct) + ' from target');
  }

  return parts.join(' | ');
}

function foLoadDecisionHistory_(dashboard) {
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_HISTORY,
    foDecisionHistoryHeaders_()
  );

  if (sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const history = {};

  for (let row = values.length - 1; row >= 1; row--) {
    const ticker = String(values[row][1] || '').trim().toUpperCase();
    const account = String(values[row][2] || '').trim();
    const key = foDecisionKey_(ticker, account);

    if (!ticker || history[key]) continue;

    history[key] = {
      recommendation: values[row][3],
      zonePosition: values[row][4],
      convictionScore: foDecisionNumber_(values[row][5]),
      riskScore: foDecisionNumber_(values[row][6]),
      confidence: foDecisionNumber_(values[row][7]),
      distancePct: foDecisionNullableNumber_(values[row][8])
    };
  }

  return history;
}

function foWriteDecisionSupport_(dashboard, decisions) {
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT,
    [
      'Rank',
      'Ticker',
      'Account',
      'Action',
      'Recommendation',
      'Allocation Band',
      'Materiality Score',
      'Priority Score',
      'Trend',
      'Conviction',
      'Conviction Delta',
      'Risk',
      'Risk Delta',
      'Confidence',
      'Confidence Delta',
      'Distance to Entry %',
      'Distance Delta',
      'Price Freshness',
      'Zone Position',
      'Current Price',
      'Target Entry Price',
      'Executive Reason',
      'Timestamp',
      'Platform Version',
      'Baseline'
    ]
  );

  sheet.clearContents();

  const headers = [
    'Rank',
    'Ticker',
    'Account',
    'Action',
    'Recommendation',
    'Allocation Band',
    'Materiality Score',
    'Priority Score',
    'Trend',
    'Conviction',
    'Conviction Delta',
    'Risk',
    'Risk Delta',
    'Confidence',
    'Confidence Delta',
    'Distance to Entry %',
    'Distance Delta',
    'Price Freshness',
    'Zone Position',
    'Current Price',
    'Target Entry Price',
    'Executive Reason',
    'Timestamp',
    'Platform Version',
    'Baseline'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const rows = decisions.map(function(item, index) {
    return [
      index + 1,
      item.ticker,
      item.account,
      item.action,
      item.recommendation,
      item.allocationBand,
      item.materialityScore,
      item.priorityScore,
      item.trend,
      item.convictionScore,
      item.convictionDelta,
      item.riskScore,
      item.riskDelta,
      item.confidence,
      item.confidenceDelta,
      item.distancePct === null ? '' : item.distancePct,
      item.distanceDelta,
      item.priceFreshness,
      item.zonePosition,
      item.currentPrice,
      item.targetEntryPrice,
      item.executiveReason,
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
  sheet.getRange(2, 16, Math.max(rows.length, 1), 2)
    .setNumberFormat('0.00%');
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(22, 420);
}

function foAppendDecisionHistory_(dashboard, decisions) {
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_HISTORY,
    foDecisionHistoryHeaders_()
  );

  const now = new Date();
  const rows = decisions.map(function(item) {
    return [
      now,
      item.ticker,
      item.account,
      item.recommendation,
      item.zonePosition,
      item.convictionScore,
      item.riskScore,
      item.confidence,
      item.distancePct === null ? '' : item.distancePct,
      item.materialityScore,
      item.priorityScore,
      item.action,
      item.allocationBand,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  if (rows.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      rows[0].length
    ).setValues(rows);
  }
}

function foDecisionHistoryHeaders_() {
  return [
    'Timestamp',
    'Ticker',
    'Account',
    'Recommendation',
    'Zone Position',
    'Conviction',
    'Risk',
    'Confidence',
    'Distance to Entry %',
    'Materiality Score',
    'Priority Score',
    'Action',
    'Allocation Band',
    'Platform Version',
    'Baseline'
  ];
}

function foDecisionKey_(ticker, account) {
  return String(ticker || '').trim().toUpperCase() +
    '|' +
    String(account || '').trim().toUpperCase();
}

function foDecisionVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foDecisionNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foDecisionNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function foDecisionPercent_(value) {
  return (Math.round((Number(value) || 0) * 10000) / 100) + '%';
}

function foRunInvestmentDecisionSupportSmokeTest() {
  const dashboard = foDashboard_();

  if (
    !dashboard.getSheetByName(FO_SHEETS.BUY_ZONE_INTELLIGENCE) ||
    dashboard.getSheetByName(
      FO_SHEETS.BUY_ZONE_INTELLIGENCE
    ).getLastRow() < 2
  ) {
    foRunBuyZoneIntelligence();
  }

  const result = foRunInvestmentDecisionSupport();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Investment Decision Support was not generated.');
  }

  const headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0];

  [
    'Materiality Score',
    'Trend',
    'Allocation Band',
    'Priority Score'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing decision-support column: ' + name);
    }
  });

  return result;
}
