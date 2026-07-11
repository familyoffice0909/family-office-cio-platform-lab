/**
 * Buy Zone Intelligence Engine
 * Wave 2.4.1-B — Price and Entry Intelligence
 */

function foRunBuyZoneIntelligence() {
  const module = 'BuyZoneIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Buy Zone Intelligence started.');

    const dashboard = foDashboard_();
    const rules = foLoadBuyZoneRules_(dashboard);
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
    const results = foBuildBuyZoneResults_(values, headers, rules);

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
      'Set to 1 to prevent BUY or ACCUMULATE on stale prices', true]
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

function foBuildBuyZoneResults_(values, headers, rules) {
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

    const entry = foResolveTargetEntry_(row, headers);
    const targetEntryPrice = entry.value;

    const marketValue = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Market Value')
    );

    const portfolioWeight = foBuyZoneNumber_(
      foGetVal_(row, headers, 'Portfolio Weight')
    );

    const convictionScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Conviction Score')) ||
      rules.DEFAULT_CONVICTION_SCORE ||
      70;

    const riskScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Risk Score')) ||
      rules.DEFAULT_RISK_SCORE ||
      50;

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

    const recommendation = foDetermineBuyZoneRecommendation_({
      currentPrice: currentPrice,
      targetEntryPrice: targetEntryPrice,
      distancePct: distancePct,
      portfolioWeight: portfolioWeight,
      dataQualityScore: dataQualityScore,
      priceFreshness: priceFreshness,
      rules: rules
    });

    const confidence = foCalculateBuyZoneConfidence_(
      distancePct,
      convictionScore,
      riskScore,
      dataQualityScore,
      priceFreshness
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
      buyZoneFloor: buyZoneFloor,
      buyZoneCeiling: buyZoneCeiling,
      zonePosition: zonePosition,
      distancePct: distancePct,
      portfolioWeight: portfolioWeight,
      convictionScore: convictionScore,
      riskScore: riskScore,
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
    'Buy Zone Floor',
    'Buy Zone Ceiling',
    'Zone Position',
    'Distance to Entry %',
    'Portfolio Weight',
    'Conviction Score',
    'Risk Score',
    'Data Quality Score',
    'Buy Zone Confidence',
    'Recommendation',
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
      item.buyZoneFloor,
      item.buyZoneCeiling,
      item.zonePosition,
      item.distancePct,
      item.portfolioWeight,
      item.convictionScore,
      item.riskScore,
      item.dataQualityScore,
      item.confidence,
      item.recommendation,
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
