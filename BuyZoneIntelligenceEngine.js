/**
 * Buy Zone Intelligence Engine
 * Wave 2.4.1-D — Dynamic Conviction Engine
 */

function foRunBuyZoneIntelligence() {
  const module = 'BuyZoneIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Buy Zone Intelligence started.');

    const dashboard = foDashboard_();
    const rules = foLoadBuyZoneRules_(dashboard);
    const convictionRules = foLoadConvictionRules_(dashboard);
    const portfolioSheet = dashboard.getSheetByName(
      FO_SHEETS.PORTFOLIO_MASTER
    );

    if (!portfolioSheet) {
      throw new Error('Portfolio Master sheet not found.');
    }

    const values = portfolioSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Portfolio Master has no holdings.');
    }

    const headers = values[0].map(String);
    const targets = foLoadBuyZoneTargets_(dashboard, values, headers, rules);
    const results = foBuildBuyZoneResults_(
      values,
      headers,
      rules,
      targets,
      convictionRules
    );

    foWriteBuyZoneIntelligence_(dashboard, results);
    foWriteBuyZoneExecutiveSummary_(dashboard, results);

    foInfo_(
      module,
      'Complete',
      'Buy Zone Intelligence completed. Results: ' + results.length
    );

    return {
      status: 'SUCCESS',
      results: results.length,
      actionableCandidates: results.filter(function(item) {
        return item.recommendation === 'BUY' ||
          item.recommendation === 'ACCUMULATE';
      }).length,
      stalePrices: results.filter(function(item) {
        return item.priceFreshness === 'STALE';
      }).length,
      missingPrices: results.filter(function(item) {
        return item.priceFreshness === 'MISSING';
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foLoadBuyZoneRules_(dashboard) {
  const sheet = foEnsureSheet_(dashboard, FO_SHEETS.BUY_ZONE_RULES, [
    'Rule',
    'Value',
    'Description',
    'Active'
  ]);

  const defaultRules = [
    ['BUY_MAX_DISTANCE_PCT', 0.02,
      'Maximum distance above target entry for BUY', true],
    ['ACCUMULATE_MAX_DISTANCE_PCT', 0.08,
      'Maximum distance above target entry for ACCUMULATE', true],
    ['WATCH_MAX_DISTANCE_PCT', 0.15,
      'Maximum distance above target entry for WATCH', true],
    ['BUY_ZONE_FLOOR_PCT', 0.05,
      'Percentage below target entry defining the buy-zone floor', true],
    ['BUY_ZONE_CEILING_PCT', 0.02,
      'Percentage above target entry defining the buy-zone ceiling', true],
    ['MAX_POSITION_WEIGHT', 0.15,
      'Position weight above which no additional capital is recommended',
      true],
    ['MIN_DATA_QUALITY_SCORE', 70,
      'Minimum data-quality score for actionable recommendations', true],
    ['DEFAULT_CONVICTION_SCORE', 70,
      'Default conviction score when no score is supplied', true],
    ['DEFAULT_RISK_SCORE', 50,
      'Default risk score when no score is supplied', true],
    ['STALE_PRICE_HOURS', 24,
      'Price age after which the result is marked stale', true],
    ['BLOCK_ACTION_ON_STALE_PRICE', 1,
      'Set to 1 to prevent BUY or ACCUMULATE on stale prices', true],
    ['DEFAULT_TARGET_DISCOUNT_PCT', 0.08,
      'Default discount used for provisional policy-derived targets', true]
  ];

  foEnsureBuyZoneDefaultRules_(sheet, defaultRules);

  const values = sheet.getDataRange().getValues();
  const rules = {};

  for (let row = 1; row < values.length; row++) {
    const name = String(values[row][0] || '').trim();
    const active = values[row][3];

    if (!name || active === false) continue;
    rules[name] = foBuyZoneNumber_(values[row][1]);
  }

  return rules;
}

function foEnsureBuyZoneDefaultRules_(sheet, defaults) {
  const values = sheet.getDataRange().getValues();
  const existing = {};

  for (let row = 1; row < values.length; row++) {
    const ruleName = String(values[row][0] || '').trim();
    if (ruleName) existing[ruleName] = true;
  }

  const missing = defaults.filter(function(rule) {
    return !existing[rule[0]];
  });

  if (missing.length > 0) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      missing.length,
      4
    ).setValues(missing);
  }
}


function foLoadBuyZoneTargets_(dashboard, values, headers, rules) {
  const targetHeaders = [
    'Ticker', 'Account', 'Target Entry Price', 'Entry Method',
    'Discount %', 'Conviction Score', 'Risk Score', 'Active',
    'Notes', 'Updated At'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.BUY_ZONE_TARGETS,
    targetHeaders
  );

  foSeedBuyZoneTargets_(sheet, values, headers, rules);

  const targetValues = sheet.getDataRange().getValues();
  const targets = {};

  for (let row = 1; row < targetValues.length; row++) {
    const ticker = String(targetValues[row][0] || '').trim().toUpperCase();
    const account = String(targetValues[row][1] || '').trim();
    const active = targetValues[row][7];

    if (!ticker || active === false) continue;

    const target = {
      ticker: ticker,
      account: account,
      manualTarget: foBuyZoneNumber_(targetValues[row][2]),
      method: String(
        targetValues[row][3] || 'CURRENT_PRICE_DISCOUNT'
      ).trim().toUpperCase(),
      discountPct: foBuyZonePercent_(targetValues[row][4]),
      convictionScore: foBuyZoneNumber_(targetValues[row][5]),
      riskScore: foBuyZoneNumber_(targetValues[row][6]),
      notes: String(targetValues[row][8] || '').trim()
    };

    targets[foBuyZoneTargetKey_(ticker, account)] = target;

    if (!targets[foBuyZoneTargetKey_(ticker, '')]) {
      targets[foBuyZoneTargetKey_(ticker, '')] = target;
    }
  }

  return targets;
}

function foSeedBuyZoneTargets_(sheet, values, headers, rules) {
  const existingValues = sheet.getDataRange().getValues();
  const existing = {};

  for (let row = 1; row < existingValues.length; row++) {
    const ticker = String(existingValues[row][0] || '').trim().toUpperCase();
    const account = String(existingValues[row][1] || '').trim();

    if (ticker) {
      existing[foBuyZoneTargetKey_(ticker, account)] = true;
    }
  }

  const rows = [];
  const defaultDiscount = rules.DEFAULT_TARGET_DISCOUNT_PCT || 0.08;

  for (let row = 1; row < values.length; row++) {
    const ticker = String(
      foGetVal_(values[row], headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foGetVal_(values[row], headers, 'Account') || ''
    ).trim();

    if (!ticker) continue;

    const key = foBuyZoneTargetKey_(ticker, account);
    if (existing[key]) continue;

    rows.push([
      ticker,
      account,
      '',
      'CURRENT_PRICE_DISCOUNT',
      defaultDiscount,
      rules.DEFAULT_CONVICTION_SCORE || 70,
      rules.DEFAULT_RISK_SCORE || 50,
      true,
      'Provisional policy-derived target; review before deployment',
      new Date()
    ]);

    existing[key] = true;
  }

  if (rows.length > 0) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      rows[0].length
    ).setValues(rows);
  }
}

function foBuyZoneTargetKey_(ticker, account) {
  return String(ticker || '').trim().toUpperCase() +
    '|' +
    String(account || '').trim().toUpperCase();
}

function foBuyZonePercent_(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return value > 1 ? value / 100 : value;
  }

  const text = String(value).trim();
  const parsed = foBuyZoneNumber_(text);

  if (!parsed) return 0;
  return text.indexOf('%') >= 0 || parsed > 1 ? parsed / 100 : parsed;
}

function foResolvePolicyTargetEntry_(
  row,
  headers,
  ticker,
  account,
  currentPrice,
  targets
) {
  const direct = foResolveTargetEntry_(row, headers);

  if (direct.value > 0 && direct.source !== 'AVERAGE COST FALLBACK') {
    return {
      value: direct.value,
      source: direct.source,
      method: 'DIRECT',
      discountPct: ''
    };
  }

  const policy =
    targets[foBuyZoneTargetKey_(ticker, account)] ||
    targets[foBuyZoneTargetKey_(ticker, '')];

  if (!policy) return direct;

  if (policy.manualTarget > 0) {
    return {
      value: policy.manualTarget,
      source: 'BUY ZONE TARGETS',
      method: 'MANUAL',
      discountPct: policy.discountPct
    };
  }

  const averageCost = foBuyZoneNumber_(
    foGetVal_(row, headers, 'Average Cost')
  );
  const discount = policy.discountPct || 0;
  const discountedPrice = currentPrice > 0
    ? currentPrice * (1 - discount)
    : 0;

  if (
    policy.method === 'CURRENT_PRICE_DISCOUNT' &&
    discountedPrice > 0
  ) {
    return {
      value: discountedPrice,
      source: 'BUY ZONE TARGETS',
      method: policy.method,
      discountPct: discount
    };
  }

  if (policy.method === 'AVERAGE_COST' && averageCost > 0) {
    return {
      value: averageCost,
      source: 'BUY ZONE TARGETS',
      method: policy.method,
      discountPct: discount
    };
  }

  if (policy.method === 'LOWER_OF_COST_AND_DISCOUNT') {
    const candidates = [averageCost, discountedPrice].filter(function(value) {
      return value > 0;
    });

    if (candidates.length > 0) {
      return {
        value: Math.min.apply(null, candidates),
        source: 'BUY ZONE TARGETS',
        method: policy.method,
        discountPct: discount
      };
    }
  }

  return direct;
}

function foBuildBuyZoneResults_(
  values,
  headers,
  rules,
  targets,
  convictionRules
) {

  const results = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];

    const ticker = String(
      foGetVal_(row, headers, 'Ticker') || ''
    ).trim().toUpperCase();

    if (!ticker) continue;

    const account = String(
      foGetVal_(row, headers, 'Account') || ''
    ).trim();

    const company =
      foGetVal_(row, headers, 'Company') ||
      foGetVal_(row, headers, 'Company / Fund') ||
      '';

    const quantity = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Quantity')
    );

    const currentPrice = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Current Price')
    );

    const entry = foResolvePolicyTargetEntry_(
      row, headers, ticker, account, currentPrice, targets
    );
    const targetEntryPrice = entry.value;

    const marketValue = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Market Value')
    );

    const portfolioWeight = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Portfolio Weight')
    );

    const dataQualityScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Data Quality Score')) ||
      100;

    if (quantity <= 0 && marketValue <= 0 && targetEntryPrice <= 0) {
      continue;
    }

    const priceTimestamp = foResolvePriceTimestamp_(row, headers);
    const priceAgeHours = foPriceAgeHours_(priceTimestamp);
    const priceFreshness = foPriceFreshness_(
      currentPrice,
      priceTimestamp,
      priceAgeHours,
      rules.STALE_PRICE_HOURS || 24
    );

    const buyZoneFloor = targetEntryPrice > 0
      ? targetEntryPrice * (1 - (rules.BUY_ZONE_FLOOR_PCT || 0.05))
      : 0;

    const buyZoneCeiling = targetEntryPrice > 0
      ? targetEntryPrice * (1 + (rules.BUY_ZONE_CEILING_PCT || 0.02))
      : 0;

    const distancePct =
      currentPrice > 0 && targetEntryPrice > 0
        ? (currentPrice - targetEntryPrice) / targetEntryPrice
        : '';

    const zonePosition = foBuyZonePosition_(
      currentPrice,
      buyZoneFloor,
      buyZoneCeiling
    );

    const scoringInput = {
      distancePct: distancePct,
      zonePosition: zonePosition,
      priceFreshness: priceFreshness,
      dataQualityScore: dataQualityScore,
      portfolioWeight: portfolioWeight,
      maxPositionWeight: rules.MAX_POSITION_WEIGHT || 0.15,
      targetEntrySource: entry.source,
      targetEntryMethod: entry.method || ''
    };

    const conviction = foCalculateDynamicConviction_(
      scoringInput,
      convictionRules
    );

    const risk = foCalculateDynamicRisk_(
      scoringInput,
      convictionRules
    );

    const convictionScore = conviction.score;
    const riskScore = risk.score;

    const recommendation = foDetermineDynamicRecommendation_(
      convictionScore,
      riskScore,
      priceFreshness,
      convictionRules
    );

    const confidence = foCalculateBuyZoneConfidence_(
      distancePct,
      convictionScore,
      riskScore,
      dataQualityScore,
      priceFreshness
    );

    const recommendationReason =
      foBuildDynamicRecommendationReason_(
        conviction,
        risk,
        recommendation
      );

    results.push({
      ticker: ticker,
      company: company,
      account: account,
      currentPrice: currentPrice,
      priceTimestamp: priceTimestamp,
      priceAgeHours: priceAgeHours,
      priceFreshness: priceFreshness,
      targetEntryPrice: targetEntryPrice,
      targetEntrySource: entry.source,
      targetEntryMethod: entry.method || '',
      targetDiscountPct: entry.discountPct,
      buyZoneFloor: buyZoneFloor,
      buyZoneCeiling: buyZoneCeiling,
      zonePosition: zonePosition,
      distancePct: distancePct,
      portfolioWeight: portfolioWeight,
      convictionScore: convictionScore,
      convictionSource: conviction.source,
      riskScore: riskScore,
      riskSource: risk.source,
      recommendationReason: recommendationReason,
      dataQualityScore: dataQualityScore,
      confidence: confidence,
      recommendation: recommendation,
      rationale: foBuildBuyZoneRationale_({
        recommendation: recommendation,
        distancePct: distancePct,
        portfolioWeight: portfolioWeight,
        dataQualityScore: dataQualityScore,
        priceFreshness: priceFreshness,
        priceAgeHours: priceAgeHours,
        targetEntrySource: entry.source,
        targetEntryMethod: entry.method || '',
        targetDiscountPct: entry.discountPct,
        zonePosition: zonePosition,
        rules: rules
      })
    });
  }

  return results;
}

function foResolveTargetEntry_(row, headers) {
  const candidates = [
    ['Target Entry Price', 'TARGET ENTRY PRICE'],
    ['Buy Zone Price', 'BUY ZONE PRICE'],
    ['Recommended Entry Price', 'RECOMMENDED ENTRY PRICE'],
    ['Average Cost', 'AVERAGE COST FALLBACK']
  ];

  for (let index = 0; index < candidates.length; index++) {
    const value = foBuyZoneNumber_(
      foGetVal_(row, headers, candidates[index][0])
    );

    if (value > 0) {
      return {
        value: value,
        source: candidates[index][1]
      };
    }
  }

  return {
    value: 0,
    source: 'MISSING'
  };
}

function foResolvePriceTimestamp_(row, headers) {
  const candidates = [
    'Price Timestamp',
    'Current Price Timestamp',
    'Market Data Timestamp',
    'Last Price Update',
    'Last Updated',
    'Timestamp'
  ];

  for (let index = 0; index < candidates.length; index++) {
    const rawValue = foGetVal_(row, headers, candidates[index]);
    const parsed = foBuyZoneDate_(rawValue);

    if (parsed) return parsed;
  }

  return '';
}

function foBuyZoneDate_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? '' : value;
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? '' : parsed;
}

function foPriceAgeHours_(priceTimestamp) {
  if (!priceTimestamp) return '';

  const milliseconds = new Date().getTime() - priceTimestamp.getTime();
  return Math.max(0, Math.round(milliseconds / 36000) / 100);
}

function foPriceFreshness_(
  currentPrice,
  priceTimestamp,
  priceAgeHours,
  stalePriceHours
) {
  if (!currentPrice) return 'MISSING';
  if (!priceTimestamp || priceAgeHours === '') return 'UNKNOWN';
  if (priceAgeHours > stalePriceHours) return 'STALE';
  return 'FRESH';
}

function foBuyZonePosition_(currentPrice, floor, ceiling) {
  if (!currentPrice || !floor || !ceiling) return 'UNAVAILABLE';
  if (currentPrice < floor) return 'BELOW ZONE';
  if (currentPrice <= ceiling) return 'IN BUY ZONE';
  return 'ABOVE ZONE';
}

function foDetermineBuyZoneRecommendation_(input) {
  if (!input.currentPrice || !input.targetEntryPrice) return 'HOLD';

  if (
    input.dataQualityScore <
    (input.rules.MIN_DATA_QUALITY_SCORE || 70)
  ) {
    return 'HOLD';
  }

  if (
    input.priceFreshness === 'STALE' &&
    (input.rules.BLOCK_ACTION_ON_STALE_PRICE || 0) === 1
  ) {
    return 'WATCH';
  }

  if (input.priceFreshness === 'MISSING') return 'HOLD';

  if (
    input.portfolioWeight >=
    (input.rules.MAX_POSITION_WEIGHT || 0.15)
  ) {
    return 'DO NOT ADD';
  }

  if (
    input.distancePct <=
    (input.rules.BUY_MAX_DISTANCE_PCT || 0.02)
  ) {
    return 'BUY';
  }

  if (
    input.distancePct <=
    (input.rules.ACCUMULATE_MAX_DISTANCE_PCT || 0.08)
  ) {
    return 'ACCUMULATE';
  }

  if (
    input.distancePct <=
    (input.rules.WATCH_MAX_DISTANCE_PCT || 0.15)
  ) {
    return 'WATCH';
  }

  return 'HOLD';
}

function foCalculateBuyZoneConfidence_(
  distancePct,
  convictionScore,
  riskScore,
  dataQualityScore,
  priceFreshness
) {
  const distanceScore =
    distancePct === ''
      ? 0
      : Math.max(
          0,
          Math.min(100, 100 - Math.max(0, distancePct) * 400)
        );

  let freshnessMultiplier = 1;

  if (priceFreshness === 'STALE') freshnessMultiplier = 0.65;
  if (priceFreshness === 'UNKNOWN') freshnessMultiplier = 0.8;
  if (priceFreshness === 'MISSING') freshnessMultiplier = 0;

  const score = (
    distanceScore * 0.35 +
    convictionScore * 0.35 +
    (100 - riskScore) * 0.15 +
    dataQualityScore * 0.15
  ) * freshnessMultiplier;

  return Math.round(Math.max(0, Math.min(100, score)));
}

function foBuildBuyZoneRationale_(input) {
  const reasons = ['Recommendation: ' + input.recommendation];

  if (input.distancePct !== '') {
    reasons.push(
      'Distance to target: ' +
      (Math.round(input.distancePct * 10000) / 100) +
      '%'
    );
  }

  reasons.push('Zone position: ' + input.zonePosition);
  reasons.push('Entry source: ' + input.targetEntrySource);
  if (input.targetEntryMethod) {
    reasons.push('Entry method: ' + input.targetEntryMethod);
  }
  if (input.targetDiscountPct !== '') {
    reasons.push('Target discount: ' + (Math.round(input.targetDiscountPct * 10000) / 100) + '%');
  }
  reasons.push('Price freshness: ' + input.priceFreshness);

  if (input.priceAgeHours !== '') {
    reasons.push('Price age: ' + input.priceAgeHours + ' hours');
  }

  if (
    input.portfolioWeight >=
    (input.rules.MAX_POSITION_WEIGHT || 0.15)
  ) {
    reasons.push('Position concentration blocks additional capital');
  }

  if (
    input.dataQualityScore <
    (input.rules.MIN_DATA_QUALITY_SCORE || 70)
  ) {
    reasons.push('Data quality below actionable threshold');
  }

  return reasons.join(' | ');
}

function foWriteBuyZoneIntelligence_(dashboard, results) {
  const headers = [
    'Timestamp',
    'Ticker',
    'Company',
    'Account',
    'Current Price',
    'Price Timestamp',
    'Price Age Hours',
    'Price Freshness',
    'Target Entry Price',
    'Target Entry Source',
    'Target Entry Method',
    'Target Discount %',
    'Buy Zone Floor',
    'Buy Zone Ceiling',
    'Zone Position',
    'Distance to Entry %',
    'Portfolio Weight',
    'Conviction Score',
    'Conviction Source',
    'Risk Score',
    'Risk Source',
    'Data Quality Score',
    'Buy Zone Confidence',
    'Recommendation',
    'Recommendation Reason',
    'Rationale',
    'Platform Version',
    'Baseline'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.BUY_ZONE_INTELLIGENCE,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!results.length) return;

  const rows = results.map(function(item) {
    return [
      new Date(),
      item.ticker,
      item.company,
      item.account,
      item.currentPrice,
      item.priceTimestamp,
      item.priceAgeHours,
      item.priceFreshness,
      item.targetEntryPrice,
      item.targetEntrySource,
      item.targetEntryMethod,
      item.targetDiscountPct,
      item.buyZoneFloor,
      item.buyZoneCeiling,
      item.zonePosition,
      item.distancePct,
      item.portfolioWeight,
      item.convictionScore,
      item.convictionSource,
      item.riskScore,
      item.riskSource,
      item.dataQualityScore,
      item.confidence,
      item.recommendation,
      item.recommendationReason,
      item.rationale,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  sheet.getRange(
    2,
    1,
    rows.length,
    headers.length
  ).setValues(rows);
}

function foWriteBuyZoneExecutiveSummary_(dashboard, results) {
  const headers = [
    'Timestamp',
    'Metric',
    'Value',
    'Platform Version',
    'Baseline'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const actionable = results.filter(function(item) {
    return item.recommendation === 'BUY' ||
      item.recommendation === 'ACCUMULATE';
  });

  const blocked = results.filter(function(item) {
    return item.recommendation === 'DO NOT ADD';
  });

  const stale = results.filter(function(item) {
    return item.priceFreshness === 'STALE';
  });

  const missing = results.filter(function(item) {
    return item.priceFreshness === 'MISSING';
  });

  const inZone = results.filter(function(item) {
    return item.zonePosition === 'IN BUY ZONE';
  });

  const highestConfidence =
    actionable.length > 0
      ? actionable.slice().sort(function(a, b) {
          return b.confidence - a.confidence;
        })[0].ticker
      : '';

  const rows = [
    [new Date(), 'Positions Evaluated', results.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Actionable Buy Candidates', actionable.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Positions In Buy Zone', inZone.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Concentration Blocked', blocked.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Stale Prices', stale.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Missing Prices', missing.length,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Highest Confidence Candidate', highestConfidence,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(
    2,
    1,
    rows.length,
    headers.length
  ).setValues(rows);
}

function foBuyZoneNumber_(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }

  const cleaned = String(value)
    .replace(/[$,%\s]/g, '')
    .replace(/,/g, '');

  const parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

function foRunBuyZoneIntelligenceSmokeTest() {
  const module = 'BuyZoneIntelligenceEngine';

  try {
    foInfo_(
      module,
      'Start',
      'Buy Zone Intelligence smoke test started.'
    );

    const result = foRunBuyZoneIntelligence();
    const dashboard = foDashboard_();

    const intelligence = dashboard.getSheetByName(
      FO_SHEETS.BUY_ZONE_INTELLIGENCE
    );

    const summary = dashboard.getSheetByName(
      FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY
    );

    if (!intelligence || intelligence.getLastRow() < 1) {
      throw new Error(
        'Buy Zone Intelligence output was not created.'
      );
    }

    if (!summary || summary.getLastRow() < 2) {
      throw new Error(
        'Buy Zone Executive Summary output is empty.'
      );
    }

    const requiredHeaders = [
      'Price Timestamp',
      'Price Freshness',
      'Target Entry Source',
      'Target Entry Method',
      'Target Discount %',
      'Conviction Source',
      'Risk Source',
      'Recommendation Reason',
      'Buy Zone Floor',
      'Buy Zone Ceiling',
      'Zone Position',
      'Distance to Entry %'
    ];

    const actualHeaders = intelligence
      .getRange(1, 1, 1, intelligence.getLastColumn())
      .getValues()[0]
      .map(String);

    requiredHeaders.forEach(function(header) {
      if (actualHeaders.indexOf(header) === -1) {
        throw new Error(
          'Required Buy Zone output header is missing: ' + header
        );
      }
    });

    foInfo_(
      module,
      'Complete',
      'Buy Zone Intelligence smoke test passed.'
    );

    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
