/**
 * Materiality Intelligence Engine
 * Wave 2.5.2 — Materiality Refinement
 */

function foLoadMaterialityPolicy_(dashboard) {
  const headers = ['Rule', 'Value', 'Description', 'Active'];
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.MATERIALITY_POLICY,
    headers
  );

  const defaults = [
    ['RECOMMENDATION_CHANGE_WEIGHT', 25,
      'Weight when recommendation changes', true],
    ['ZONE_CHANGE_WEIGHT', 20,
      'Weight when Buy Zone position changes', true],
    ['ACTION_CHANGE_WEIGHT', 15,
      'Weight when decision action changes', true],
    ['CONVICTION_POINT_WEIGHT', 1,
      'Points per conviction-score change', true],
    ['RISK_POINT_WEIGHT', 1,
      'Points per risk-score change', true],
    ['CONFIDENCE_POINT_WEIGHT', 1,
      'Points per confidence-score change', true],
    ['DISTANCE_PERCENT_WEIGHT', 2,
      'Points per percentage-point movement toward or away from entry', true],
    ['FRESHNESS_CHANGE_WEIGHT', 15,
      'Weight when price freshness changes', true],
    ['LOW_THRESHOLD', 20,
      'Minimum score for LOW materiality', true],
    ['MEDIUM_THRESHOLD', 40,
      'Minimum score for MEDIUM materiality', true],
    ['HIGH_THRESHOLD', 65,
      'Minimum score for HIGH materiality', true],
    ['CRITICAL_THRESHOLD', 85,
      'Minimum score for CRITICAL materiality', true]
  ];

  foEnsureMaterialityPolicyDefaults_(sheet, defaults);

  const values = sheet.getDataRange().getValues();
  const raw = {};

  for (let row = 1; row < values.length; row++) {
    const key = String(values[row][0] || '').trim();
    if (!key || values[row][3] === false) continue;
    raw[key] = values[row][1];
  }

  return {
    recommendationChangeWeight: foDecisionNumber_(
      raw.RECOMMENDATION_CHANGE_WEIGHT || 25
    ),
    zoneChangeWeight: foDecisionNumber_(
      raw.ZONE_CHANGE_WEIGHT || 20
    ),
    actionChangeWeight: foDecisionNumber_(
      raw.ACTION_CHANGE_WEIGHT || 15
    ),
    convictionPointWeight: foDecisionNumber_(
      raw.CONVICTION_POINT_WEIGHT || 1
    ),
    riskPointWeight: foDecisionNumber_(
      raw.RISK_POINT_WEIGHT || 1
    ),
    confidencePointWeight: foDecisionNumber_(
      raw.CONFIDENCE_POINT_WEIGHT || 1
    ),
    distancePercentWeight: foDecisionNumber_(
      raw.DISTANCE_PERCENT_WEIGHT || 2
    ),
    freshnessChangeWeight: foDecisionNumber_(
      raw.FRESHNESS_CHANGE_WEIGHT || 15
    ),
    lowThreshold: foDecisionNumber_(raw.LOW_THRESHOLD || 20),
    mediumThreshold: foDecisionNumber_(raw.MEDIUM_THRESHOLD || 40),
    highThreshold: foDecisionNumber_(raw.HIGH_THRESHOLD || 65),
    criticalThreshold: foDecisionNumber_(raw.CRITICAL_THRESHOLD || 85)
  };
}

function foEnsureMaterialityPolicyDefaults_(sheet, defaults) {
  const values = sheet.getDataRange().getValues();
  const existing = {};

  for (let row = 1; row < values.length; row++) {
    const key = String(values[row][0] || '').trim();
    if (key) existing[key] = true;
  }

  const missing = defaults.filter(function(rule) {
    return !existing[rule[0]];
  });

  if (missing.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      missing.length,
      missing[0].length
    ).setValues(missing);
  }
}

function foCalculateMaterialityAssessment_(
  item,
  previous,
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta,
  action,
  policy
) {
  if (!previous) {
    return {
      score: 0,
      level: 'BASELINE',
      primaryDriver: 'Initial baseline',
      drivers: ['Initial baseline established']
    };
  }

  const drivers = [];
  let score = 0;

  if (previous.recommendation !== item.recommendation) {
    score += policy.recommendationChangeWeight;
    drivers.push(
      'Recommendation ' + previous.recommendation +
      ' → ' + item.recommendation
    );
  }

  if (previous.zonePosition !== item.zonePosition) {
    score += policy.zoneChangeWeight;
    drivers.push(
      'Zone ' + previous.zonePosition + ' → ' + item.zonePosition
    );
  }

  const previousAction = previous.action || '';
  if (previousAction && previousAction !== action) {
    score += policy.actionChangeWeight;
    drivers.push('Action ' + previousAction + ' → ' + action);
  }

  const convictionImpact = Math.min(
    20,
    Math.abs(convictionDelta) * policy.convictionPointWeight
  );
  if (convictionImpact > 0) {
    score += convictionImpact;
    drivers.push('Conviction Δ ' + foMaterialitySigned_(convictionDelta));
  }

  const riskImpact = Math.min(
    20,
    Math.abs(riskDelta) * policy.riskPointWeight
  );
  if (riskImpact > 0) {
    score += riskImpact;
    drivers.push('Risk Δ ' + foMaterialitySigned_(riskDelta));
  }

  const confidenceImpact = Math.min(
    20,
    Math.abs(confidenceDelta) * policy.confidencePointWeight
  );
  if (confidenceImpact > 0) {
    score += confidenceImpact;
    drivers.push('Confidence Δ ' + foMaterialitySigned_(confidenceDelta));
  }

  const distancePoints = Math.abs(distanceDelta) * 100;
  const distanceImpact = Math.min(
    20,
    distancePoints * policy.distancePercentWeight
  );
  if (distanceImpact > 0.01) {
    score += distanceImpact;
    drivers.push(
      'Distance Δ ' +
      foMaterialitySigned_(Math.round(distancePoints * 100) / 100) +
      ' pp'
    );
  }

  const previousFreshness = previous.priceFreshness || '';
  if (
    previousFreshness &&
    previousFreshness !== item.priceFreshness
  ) {
    score += policy.freshnessChangeWeight;
    drivers.push(
      'Freshness ' + previousFreshness + ' → ' + item.priceFreshness
    );
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score: score,
    level: foMaterialityLevel_(score, policy),
    primaryDriver: drivers.length ? drivers[0] : 'No material change',
    drivers: drivers.length ? drivers : ['No material change']
  };
}

function foMaterialityLevel_(score, policy) {
  if (score >= policy.criticalThreshold) return 'CRITICAL';
  if (score >= policy.highThreshold) return 'HIGH';
  if (score >= policy.mediumThreshold) return 'MEDIUM';
  if (score >= policy.lowThreshold) return 'LOW';
  return 'IMMATERIAL';
}

function foMaterialitySigned_(value) {
  const number = Number(value) || 0;
  return number > 0 ? '+' + number : String(number);
}

function foWriteMaterialityEvents_(dashboard, decisions) {
  const headers = [
    'Rank',
    'Ticker',
    'Account',
    'Materiality Score',
    'Materiality Level',
    'Primary Driver',
    'All Drivers',
    'Recommendation',
    'Action',
    'Trend',
    'Price Freshness',
    'Timestamp',
    'Platform Version',
    'Baseline'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.MATERIALITY_EVENTS,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const ranked = decisions.slice().sort(function(a, b) {
    return b.materialityScore - a.materialityScore;
  });

  const rows = ranked.map(function(item, index) {
    return [
      index + 1,
      item.ticker,
      item.account,
      item.materialityScore,
      item.materialityLevel,
      item.materialityPrimaryDriver,
      item.materialityDrivers,
      item.recommendation,
      item.action,
      item.trend,
      item.priceFreshness,
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
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(7, 480);
}

function foRunMaterialityEngineSmokeTest() {
  const dashboard = foDashboard_();
  const policy = foLoadMaterialityPolicy_(dashboard);

  if (
    policy.lowThreshold >= policy.mediumThreshold ||
    policy.mediumThreshold >= policy.highThreshold ||
    policy.highThreshold >= policy.criticalThreshold
  ) {
    throw new Error('Materiality thresholds are not strictly increasing.');
  }

  const intelligence = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_INTELLIGENCE
  );

  if (!intelligence || intelligence.getLastRow() < 2) {
    foRunBuyZoneIntelligence();
  }

  // Enterprise fix: always execute the producer before testing its output.
  const decisionResult = foRunInvestmentDecisionSupport();
  const events = dashboard.getSheetByName(
    FO_SHEETS.MATERIALITY_EVENTS
  );

  if (!events || events.getLastRow() < 2) {
    throw new Error(
      'Materiality Events was not generated after Decision Support execution.'
    );
  }

  const headers = events.getRange(
    1,
    1,
    1,
    events.getLastColumn()
  ).getValues()[0];

  [
    'Materiality Score',
    'Materiality Level',
    'Primary Driver',
    'All Drivers'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing Materiality Events column: ' + name);
    }
  });

  return {
    status: 'PASS',
    decisions: decisionResult.decisions,
    eventRows: events.getLastRow() - 1,
    lowThreshold: policy.lowThreshold,
    mediumThreshold: policy.mediumThreshold,
    highThreshold: policy.highThreshold,
    criticalThreshold: policy.criticalThreshold
  };
}
