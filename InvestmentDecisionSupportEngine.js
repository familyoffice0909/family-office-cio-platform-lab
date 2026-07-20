/**
 * Investment Decision Support Engine
 * Sprint 2.6.0 — Recommendation Quality Intelligence
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
      priceFreshness: foDecisionVal_(row, headers, 'Price Freshness'),
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
  const materialityPolicy = foLoadMaterialityPolicy_(dashboard);

  const decisions = results.map(function(item) {
    return foBuildDecisionRecord_(
      item,
      history,
      materialityPolicy
    );
  }).sort(function(a, b) {
    return b.priorityScore - a.priorityScore;
  });

  // Producer order is intentional and regression-tested.
  foWriteDecisionSupport_(dashboard, decisions);
  foWriteMaterialityEvents_(dashboard, decisions);
  foAppendDecisionHistory_(dashboard, decisions);
  foRunInvestmentTrendIntelligence();

  return {
    decisions: decisions
  };
}

function foBuildDecisionRecord_(item, history, materialityPolicy) {
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
  const action = foDecisionAction_(item);
  const materialityAssessment = foCalculateMaterialityAssessment_(
    item,
    previous,
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta,
    action,
    materialityPolicy
  );
  const allocationBand = foDecisionAllocationBand_(item, action);
  const quality = foAssessRecommendationQuality_(
    item,
    action,
    allocationBand,
    trend,
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta,
    materialityAssessment
  );
  const priorityScore = foDecisionPriority_(
    item,
    materialityAssessment.score,
    action
  );

  return {
    ticker: item.ticker,
    account: item.account,
    action: action,
    recommendation: item.recommendation,
    allocationBand: allocationBand,
    materialityScore: materialityAssessment.score,
    materialityLevel: materialityAssessment.level,
    materialityPrimaryDriver: materialityAssessment.primaryDriver,
    materialityDrivers: materialityAssessment.drivers.join(' | '),
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
    recommendationQualityScore: quality.score,
    recommendationQualityGrade: quality.grade,
    supportingEvidence: quality.supportingEvidence,
    opposingEvidence: quality.opposingEvidence,
    dataLimitations: quality.dataLimitations,
    evidenceBalance: quality.evidenceBalance,
    contradictionStatus: quality.contradictionStatus,
    contradictionReasons: quality.contradictionReasons,
    qualityRationale: quality.qualityRationale,
    executiveReason: foDecisionExecutiveReason_(
      item,
      trend,
      materialityAssessment,
      allocationBand,
      quality
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

function foAssessRecommendationQuality_(
  item,
  action,
  allocationBand,
  trend,
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta,
  materialityAssessment
) {
  const supporting = [];
  const opposing = [];
  const limitations = [];
  const reviewReasons = [];
  const blockedReasons = [];
  const freshness = String(item.priceFreshness || '').trim().toUpperCase();
  const recommendation = String(item.recommendation || '').trim().toUpperCase();
  const normalizedAction = String(action || '').trim().toUpperCase();
  const deployable = foDecisionIsDeployableAction_(normalizedAction);
  const currentPrice = Number(item.currentPrice) || 0;
  const targetPrice = Number(item.targetEntryPrice) || 0;
  const confidence = foDecisionClamp_(item.confidence, 0, 100);
  const conviction = foDecisionClamp_(item.convictionScore, 0, 100);
  const risk = foDecisionClamp_(item.riskScore, 0, 100);
  const materiality = foDecisionClamp_(
    materialityAssessment && materialityAssessment.score,
    0,
    100
  );

  let dataReadiness = 0;
  if (freshness === 'FRESH') {
    dataReadiness += 12;
    supporting.push('Fresh price data');
  } else if (freshness === 'STALE') {
    dataReadiness += 3;
    limitations.push('Stale current price');
    opposing.push('Price freshness prevents execution');
  } else {
    limitations.push('Missing current price');
    opposing.push('Essential market data is unavailable');
  }

  if (currentPrice > 0) {
    dataReadiness += 5;
  } else if (limitations.indexOf('Missing current price') < 0) {
    limitations.push('Current price is not positive');
  }

  if (targetPrice > 0) {
    dataReadiness += 4;
    supporting.push('Target entry is available');
  } else {
    limitations.push('Target entry is unavailable');
    if (deployable) {
      blockedReasons.push('Deployable action has no target entry');
    }
  }

  const zone = String(item.zonePosition || '').trim().toUpperCase();
  if (zone && zone !== 'UNAVAILABLE') {
    dataReadiness += 2;
    if (zone === 'IN BUY ZONE' || zone === 'BELOW ZONE') {
      supporting.push('Favourable zone position: ' + zone);
    } else if (zone === 'ABOVE ZONE') {
      opposing.push('Price is above the configured buy zone');
    }
  } else {
    limitations.push('Zone position is unavailable');
  }

  if (item.distancePct !== null && item.distancePct !== undefined) {
    dataReadiness += 2;
    if (Math.abs(Number(item.distancePct) || 0) <= 0.05) {
      supporting.push('Price is near the target entry');
    } else if ((Number(item.distancePct) || 0) > 0.10) {
      opposing.push('Price is materially above target entry');
    }
  } else {
    limitations.push('Distance to target is unavailable');
  }

  const signalStrength = Math.round(
    ((confidence + conviction) / 2) * 0.25
  );
  if (confidence >= 70) {
    supporting.push('Confidence ' + confidence);
  } else if (confidence < 60) {
    opposing.push('Confidence below deployment threshold: ' + confidence);
  }
  if (conviction >= 75) {
    supporting.push('Conviction ' + conviction);
  } else if (conviction < 60) {
    opposing.push('Conviction is weak: ' + conviction);
  }

  const riskAlignment = Math.round((100 - risk) * 0.20);
  if (risk <= 35) {
    supporting.push('Risk is controlled at ' + risk);
  } else if (risk > 50) {
    opposing.push('Risk exceeds deployment threshold: ' + risk);
  } else {
    opposing.push('Risk requires position-size discipline: ' + risk);
  }

  let signalConsistency = 12;
  if (foDecisionRecommendationActionAligned_(recommendation, normalizedAction)) {
    signalConsistency += 4;
    supporting.push('Recommendation and action are aligned');
  } else {
    signalConsistency -= 6;
    const mismatch = 'Recommendation ' + recommendation +
      ' conflicts with action ' + normalizedAction;
    opposing.push(mismatch);
    if (deployable || recommendation === 'AVOID') {
      blockedReasons.push(mismatch);
    } else {
      reviewReasons.push(mismatch);
    }
  }

  if (trend === 'IMPROVING') {
    signalConsistency += 2;
    supporting.push('Trend is improving');
  } else if (trend === 'DETERIORATING') {
    signalConsistency -= 2;
    opposing.push('Trend is deteriorating');
  }

  const netDelta =
    Number(convictionDelta || 0) -
    Number(riskDelta || 0) +
    Number(confidenceDelta || 0) -
    Number(distanceDelta || 0) * 100;
  if (netDelta >= 10) {
    signalConsistency += 2;
    supporting.push('Signal deltas are improving');
  } else if (netDelta <= -10) {
    signalConsistency -= 2;
    opposing.push('Signal deltas are deteriorating');
  }

  if (
    trend === 'IMPROVING' &&
    Number(riskDelta || 0) >= 10 &&
    Number(confidenceDelta || 0) <= -10
  ) {
    reviewReasons.push(
      'Improving classification conflicts with deteriorating risk and confidence'
    );
  }

  signalConsistency = foDecisionClamp_(signalConsistency, 0, 20);

  let decisionContext = Math.round(materiality * 0.06);
  if (
    zone === 'IN BUY ZONE' ||
    zone === 'BELOW ZONE' ||
    (item.distancePct !== null && Math.abs(Number(item.distancePct) || 0) <= 0.05)
  ) {
    decisionContext += 4;
  }
  decisionContext = foDecisionClamp_(decisionContext, 0, 10);
  if (materiality >= 70) {
    supporting.push('Materiality ' + materiality);
  }

  if (deployable && freshness !== 'FRESH') {
    blockedReasons.push('Deployable action requires fresh price data');
  }
  if (freshness !== 'FRESH' || currentPrice <= 0) {
    blockedReasons.push('Essential price data is missing or stale');
  }
  if (deployable && confidence < 60) {
    blockedReasons.push('Deployable action has confidence below 60');
  }
  if (deployable && risk > 50) {
    blockedReasons.push('Deployable action has risk above 50');
  }
  if (
    recommendation === 'AVOID' &&
    String(allocationBand || '').trim() !== '0%'
  ) {
    blockedReasons.push('AVOID recommendation has a positive allocation band');
  }

  let score = Math.round(
    dataReadiness +
    signalStrength +
    riskAlignment +
    signalConsistency +
    decisionContext
  );
  score = foDecisionClamp_(score, 0, 100);

  const essentialDataMissing =
    freshness !== 'FRESH' || currentPrice <= 0;
  let contradictionStatus = 'CLEAR';
  if (blockedReasons.length) {
    contradictionStatus = 'BLOCKED';
  } else if (reviewReasons.length) {
    contradictionStatus = 'REVIEW';
  }

  if (essentialDataMissing) {
    score = Math.min(score, 49);
  } else if (contradictionStatus === 'BLOCKED') {
    score = Math.min(score, 59);
  }

  let grade = 'LOW';
  if (essentialDataMissing) {
    grade = 'INSUFFICIENT DATA';
  } else if (score >= 80 && contradictionStatus === 'CLEAR') {
    grade = 'HIGH';
  } else if (score >= 60 && contradictionStatus !== 'BLOCKED') {
    grade = 'MEDIUM';
  }

  let evidenceBalance = 'MIXED';
  if (essentialDataMissing) {
    evidenceBalance = 'INSUFFICIENT';
  } else if (supporting.length >= opposing.length + 2) {
    evidenceBalance = 'POSITIVE';
  } else if (opposing.length >= supporting.length + 2) {
    evidenceBalance = 'NEGATIVE';
  }

  const contradictionReasons = blockedReasons.concat(reviewReasons);
  const principalConstraint = contradictionReasons[0] ||
    limitations[0] || opposing[0] || 'No material constraint';
  const qualityRationale =
    grade + ' quality (' + score + '/100)' +
    ' | Evidence ' + evidenceBalance +
    ' | Contradiction ' + contradictionStatus +
    ' | Principal constraint: ' + principalConstraint;

  return {
    score: score,
    grade: grade,
    supportingEvidence: supporting.join(' | ') || 'NONE',
    opposingEvidence: opposing.join(' | ') || 'NONE',
    dataLimitations: limitations.join(' | ') || 'NONE',
    evidenceBalance: evidenceBalance,
    contradictionStatus: contradictionStatus,
    contradictionReasons: contradictionReasons.join(' | ') || 'NONE',
    qualityRationale: qualityRationale
  };
}

function foDecisionIsDeployableAction_(action) {
  return [
    'DEPLOY NOW',
    'BUY',
    'ACCUMULATE'
  ].indexOf(String(action || '').trim().toUpperCase()) >= 0;
}

function foDecisionRecommendationActionAligned_(recommendation, action) {
  const allowed = {
    'STRONG BUY': ['DEPLOY NOW', 'BUY'],
    BUY: ['BUY', 'DEPLOY NOW'],
    ACCUMULATE: ['ACCUMULATE'],
    WATCH: ['WATCH'],
    HOLD: ['HOLD', 'REFRESH DATA'],
    AVOID: ['AVOID']
  };
  const actions = allowed[String(recommendation || '').toUpperCase()] || [];
  return actions.indexOf(String(action || '').toUpperCase()) >= 0;
}

function foDecisionClamp_(value, minimum, maximum) {
  const number = Number(value);
  if (!isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, number));
}

function foDecisionTrend_(
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta
) {
  let points = 0;

  if (convictionDelta >= 20) {
    points += 3;
  } else if (convictionDelta >= 10) {
    points += 2;
  } else if (convictionDelta >= 5) {
    points += 1;
  } else if (convictionDelta <= -20) {
    points -= 3;
  } else if (convictionDelta <= -10) {
    points -= 2;
  } else if (convictionDelta <= -5) {
    points -= 1;
  }

  if (riskDelta <= -20) {
    points += 3;
  } else if (riskDelta <= -10) {
    points += 2;
  } else if (riskDelta <= -5) {
    points += 1;
  } else if (riskDelta >= 20) {
    points -= 3;
  } else if (riskDelta >= 10) {
    points -= 2;
  } else if (riskDelta >= 5) {
    points -= 1;
  }

  if (confidenceDelta >= 20) {
    points += 3;
  } else if (confidenceDelta >= 10) {
    points += 2;
  } else if (confidenceDelta >= 5) {
    points += 1;
  } else if (confidenceDelta <= -20) {
    points -= 3;
  } else if (confidenceDelta <= -10) {
    points -= 2;
  } else if (confidenceDelta <= -5) {
    points -= 1;
  }

  if (distanceDelta <= -0.10) {
    points += 3;
  } else if (distanceDelta <= -0.05) {
    points += 2;
  } else if (distanceDelta <= -0.02) {
    points += 1;
  } else if (distanceDelta >= 0.10) {
    points -= 3;
  } else if (distanceDelta >= 0.05) {
    points -= 2;
  } else if (distanceDelta >= 0.02) {
    points -= 1;
  }

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
  materialityAssessment,
  allocationBand,
  quality
) {
  const parts = [
    item.recommendation,
    'Trend ' + trend,
    'Materiality ' + materialityAssessment.score +
      ' (' + materialityAssessment.level + ')',
    'Driver ' + materialityAssessment.primaryDriver,
    'Conviction ' + item.convictionScore,
    'Risk ' + item.riskScore,
    'Allocation ' + allocationBand,
    'Quality ' + quality.grade + ' (' + quality.score + ')',
    'Contradiction ' + quality.contradictionStatus
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
  const headers = values[0].map(String);
  const history = {};

  for (let row = values.length - 1; row >= 1; row--) {
    const ticker = String(
      foDecisionVal_(values[row], headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foDecisionVal_(values[row], headers, 'Account') || ''
    ).trim();
    const key = foDecisionKey_(ticker, account);

    if (!ticker || history[key]) continue;

    const signature = String(
      foDecisionVal_(values[row], headers, 'State Signature') || ''
    );
    const signatureParts = signature.split('|');

    history[key] = {
      recommendation: foDecisionVal_(
        values[row],
        headers,
        'Recommendation'
      ),
      zonePosition: foDecisionVal_(
        values[row],
        headers,
        'Zone Position'
      ),
      convictionScore: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Conviction')
      ),
      riskScore: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Risk')
      ),
      confidence: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Confidence')
      ),
      distancePct: foDecisionNullableNumber_(
        foDecisionVal_(values[row], headers, 'Distance to Entry %')
      ),
      action: foDecisionVal_(values[row], headers, 'Action'),
      priceFreshness: signatureParts.length > 8
        ? signatureParts[8]
        : ''
    };
  }

  return history;
}

function foDecisionSupportHeaders_() {
  return [
    'Rank',
    'Ticker',
    'Account',
    'Action',
    'Recommendation',
    'Allocation Band',
    'Materiality Score',
    'Materiality Level',
    'Materiality Primary Driver',
    'Materiality Drivers',
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
    'Baseline',
    'Recommendation Quality Score',
    'Recommendation Quality Grade',
    'Supporting Evidence',
    'Opposing Evidence',
    'Data Limitations',
    'Evidence Balance',
    'Contradiction Status',
    'Contradiction Reasons',
    'Quality Rationale'
  ];
}

function foWriteDecisionSupport_(dashboard, decisions) {
  const headers = foDecisionSupportHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT,
    headers
  );

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
      item.materialityLevel,
      item.materialityPrimaryDriver,
      item.materialityDrivers,
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
      FO_CONFIG.BASELINE,
      item.recommendationQualityScore,
      item.recommendationQualityGrade,
      item.supportingEvidence,
      item.opposingEvidence,
      item.dataLimitations,
      item.evidenceBalance,
      item.contradictionStatus,
      item.contradictionReasons,
      item.qualityRationale
    ];
  });

  const bodyRowCount = Math.max(rows.length, 1);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(
    2,
    1,
    bodyRowCount,
    headers.length
  ).setNumberFormat('General');

  if (rows.length) {
    sheet.getRange(
      2,
      1,
      rows.length,
      headers.length
    ).setValues(rows);
  }

  foApplyDecisionSupportNumberFormats_(
    sheet,
    headers,
    bodyRowCount
  );

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  sheet.autoResizeColumns(1, headers.length);

  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Materiality Drivers',
    440
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Executive Reason',
    520
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Supporting Evidence',
    520
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Opposing Evidence',
    520
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Data Limitations',
    420
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Contradiction Reasons',
    520
  );
  foSetDecisionSupportColumnWidth_(
    sheet,
    headers,
    'Quality Rationale',
    560
  );
}

function foApplyDecisionSupportNumberFormats_(sheet, headers, rowCount) {
  const formats = [
    { name: 'Rank', format: '0' },
    { name: 'Materiality Score', format: '0' },
    { name: 'Priority Score', format: '0' },
    { name: 'Conviction', format: '0' },
    { name: 'Conviction Delta', format: '0' },
    { name: 'Risk', format: '0' },
    { name: 'Risk Delta', format: '0' },
    { name: 'Confidence', format: '0' },
    { name: 'Confidence Delta', format: '0' },
    { name: 'Recommendation Quality Score', format: '0' },
    { name: 'Distance to Entry %', format: '0.00%' },
    { name: 'Distance Delta', format: '0.00%' },
    { name: 'Current Price', format: '#,##0.00' },
    { name: 'Target Entry Price', format: '#,##0.00' },
    { name: 'Timestamp', format: 'yyyy-mm-dd hh:mm:ss' }
  ];

  formats.forEach(function(definition) {
    const column = foDecisionSupportColumn_(
      headers,
      definition.name
    );

    sheet.getRange(
      2,
      column,
      rowCount,
      1
    ).setNumberFormat(definition.format);
  });
}

function foDecisionSupportColumn_(headers, name) {
  const index = headers.indexOf(name);

  if (index < 0) {
    throw new Error(
      'Missing decision-support output column: ' + name
    );
  }

  return index + 1;
}

function foSetDecisionSupportColumnWidth_(
  sheet,
  headers,
  name,
  width
) {
  const column = foDecisionSupportColumn_(headers, name);
  sheet.setColumnWidth(column, width);
}

function foAppendDecisionHistory_(dashboard, decisions) {
  const policy = foLoadDecisionHistoryPolicy_(dashboard);
  const sheet = foPrepareDecisionHistorySheet_(dashboard);
  const index = foLoadDecisionHistoryIndex_(sheet);
  const events = foSelectDecisionHistoryEvents_(
    decisions,
    index.latest,
    index.today,
    policy
  );

  const now = new Date();
  const rows = events.map(function(event) {
    const item = event.item;

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
      FO_CONFIG.BASELINE,
      event.eventType,
      event.signature,
      item.recommendationQualityScore,
      item.recommendationQualityGrade,
      item.supportingEvidence,
      item.opposingEvidence,
      item.dataLimitations,
      item.evidenceBalance,
      item.contradictionStatus,
      item.contradictionReasons,
      item.qualityRationale
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

  if (policy.maintainAfterAppend) {
    foMaintainDecisionHistory_(sheet, policy);
  }

  return {
    eligibleDecisions: decisions.length,
    appendedEvents: rows.length,
    skippedUnchanged: decisions.length - rows.length
  };
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
    'Baseline',
    'Event Type',
    'State Signature',
    'Recommendation Quality Score',
    'Recommendation Quality Grade',
    'Supporting Evidence',
    'Opposing Evidence',
    'Data Limitations',
    'Evidence Balance',
    'Contradiction Status',
    'Contradiction Reasons',
    'Quality Rationale'
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
  const intelligence = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_INTELLIGENCE
  );

  if (!intelligence || intelligence.getLastRow() < 2) {
    foRunBuyZoneIntelligence();
  }

  const result = foRunInvestmentDecisionSupport();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );
  const events = dashboard.getSheetByName(
    FO_SHEETS.MATERIALITY_EVENTS
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Investment Decision Support was not generated.');
  }

  if (!events || events.getLastRow() < 2) {
    throw new Error('Materiality Events was not generated.');
  }

  const headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0];

  [
    'Materiality Score',
    'Materiality Level',
    'Materiality Primary Driver',
    'Materiality Drivers',
    'Trend',
    'Allocation Band',
    'Priority Score',
    'Current Price',
    'Target Entry Price',
    'Recommendation Quality Score',
    'Recommendation Quality Grade',
    'Supporting Evidence',
    'Opposing Evidence',
    'Data Limitations',
    'Evidence Balance',
    'Contradiction Status',
    'Contradiction Reasons',
    'Quality Rationale'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing decision-support column: ' + name);
    }
  });

  foValidateDecisionSupportPriceIntegrityWave321_(sheet, headers);
  foValidateDecisionSupportNumberFormats_(sheet, headers);

  return result;
}

function foValidateDecisionSupportPriceIntegrityWave321_(sheet, headers) {
  const currentPriceColumn = headers.indexOf('Current Price') + 1;
  const targetEntryPriceColumn = headers.indexOf('Target Entry Price') + 1;
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);

  if (!rowCount) {
    throw new Error('Investment Decision Support contains no price rows.');
  }

  const priceRange = sheet.getRange(2, currentPriceColumn, rowCount, 2);
  const priceValues = priceRange.getValues();
  const numberFormats = priceRange.getNumberFormats();

  priceValues.forEach(function(row, rowIndex) {
    row.forEach(function(value, columnIndex) {
      const label = columnIndex === 0 ? 'Current Price' : 'Target Entry Price';
      const sheetRow = rowIndex + 2;

      if (value instanceof Date) {
        throw new Error(label + ' contains Date object at row ' + sheetRow);
      }

      if (value !== '' && value !== null && typeof value !== 'number') {
        throw new Error(
          label + ' is not numeric at row ' + sheetRow + ': ' + typeof value
        );
      }

      if (typeof value === 'number' && (!isFinite(value) || value < 0)) {
        throw new Error(
          label + ' contains invalid numeric value at row ' + sheetRow
        );
      }

      const format = String(
        numberFormats[rowIndex][columnIndex] || ''
      ).toLowerCase();

      if (format.indexOf('yy') >= 0 || format.indexOf('dd') >= 0) {
        throw new Error(
          label + ' retains date formatting at row ' +
          sheetRow + ': ' + format
        );
      }
    });
  });

  return {
    status: 'PASS',
    rowsValidated: rowCount,
    priceColumnsValidated: 2
  };
}

function foValidateDecisionSupportNumberFormats_(sheet, headers) {
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);

  if (!rowCount) {
    throw new Error(
      'Investment Decision Support contains no rows for format validation.'
    );
  }

  const numericColumns = [
    'Rank',
    'Materiality Score',
    'Priority Score',
    'Conviction',
    'Conviction Delta',
    'Risk',
    'Risk Delta',
    'Confidence',
    'Confidence Delta',
    'Recommendation Quality Score'
  ];

  numericColumns.forEach(function(name) {
    const column = foDecisionSupportColumn_(headers, name);
    const formats = sheet.getRange(
      2,
      column,
      rowCount,
      1
    ).getNumberFormats();

    formats.forEach(function(row, rowIndex) {
      const format = String(row[0] || '').toLowerCase();

      if (format.indexOf('%') >= 0) {
        throw new Error(
          name +
          ' incorrectly retains percentage formatting at row ' +
          (rowIndex + 2) +
          ': ' +
          format
        );
      }

      if (
        format.indexOf('yy') >= 0 ||
        format.indexOf('dd') >= 0 ||
        format.indexOf('hh') >= 0
      ) {
        throw new Error(
          name +
          ' incorrectly retains date formatting at row ' +
          (rowIndex + 2) +
          ': ' +
          format
        );
      }
    });
  });

  const percentageColumns = [
    'Distance to Entry %',
    'Distance Delta'
  ];

  percentageColumns.forEach(function(name) {
    const column = foDecisionSupportColumn_(headers, name);
    const formats = sheet.getRange(
      2,
      column,
      rowCount,
      1
    ).getNumberFormats();

    formats.forEach(function(row, rowIndex) {
      const format = String(row[0] || '');

      if (format.indexOf('%') < 0) {
        throw new Error(
          name +
          ' is missing percentage formatting at row ' +
          (rowIndex + 2) +
          ': ' +
          format
        );
      }
    });
  });

  const confidenceColumn = foDecisionSupportColumn_(
    headers,
    'Confidence'
  );

  const confidenceValues = sheet.getRange(
    2,
    confidenceColumn,
    rowCount,
    1
  ).getValues();

  confidenceValues.forEach(function(row, rowIndex) {
    const value = row[0];

    if (
      value !== '' &&
      value !== null &&
      (
        typeof value !== 'number' ||
        !isFinite(value) ||
        value < 0 ||
        value > 100
      )
    ) {
      throw new Error(
        'Confidence must be a numeric 0-100 score at row ' +
        (rowIndex + 2) +
        ': ' +
        value
      );
    }
  });

  return {
    status: 'PASS',
    rowsValidated: rowCount,
    numericColumnsValidated: numericColumns.length,
    percentageColumnsValidated: percentageColumns.length
  };
}
