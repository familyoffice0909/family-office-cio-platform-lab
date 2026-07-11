/**
 * Dynamic Conviction Engine
 * Wave 2.4.1-D — Dynamic Conviction and Risk Scoring
 */

function foLoadConvictionRules_(dashboard) {
  const headers = ['Rule', 'Value', 'Description', 'Active'];
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.CONVICTION_RULES,
    headers
  );

  const defaults = [
    ['WEIGHT_DISTANCE', 0.25,
      'Conviction weight for distance to target entry', true],
    ['WEIGHT_ZONE_POSITION', 0.20,
      'Conviction weight for buy-zone position', true],
    ['WEIGHT_PRICE_FRESHNESS', 0.15,
      'Conviction weight for price freshness', true],
    ['WEIGHT_DATA_QUALITY', 0.15,
      'Conviction weight for data quality', true],
    ['WEIGHT_PORTFOLIO_CAPACITY', 0.10,
      'Conviction weight for available portfolio capacity', true],
    ['WEIGHT_ENTRY_POLICY', 0.15,
      'Conviction weight for target-entry policy quality', true],
    ['RISK_WEIGHT_PRICE', 0.30,
      'Risk weight for stale or missing prices', true],
    ['RISK_WEIGHT_CONCENTRATION', 0.25,
      'Risk weight for portfolio concentration', true],
    ['RISK_WEIGHT_DATA_QUALITY', 0.20,
      'Risk weight for data quality', true],
    ['RISK_WEIGHT_DISTANCE', 0.15,
      'Risk weight for distance above target', true],
    ['RISK_WEIGHT_POLICY', 0.10,
      'Risk weight for provisional or missing entry policy', true],
    ['STRONG_BUY_MIN_CONVICTION', 90,
      'Minimum conviction for STRONG BUY', true],
    ['STRONG_BUY_MAX_RISK', 25,
      'Maximum risk for STRONG BUY', true],
    ['BUY_MIN_CONVICTION', 80,
      'Minimum conviction for BUY', true],
    ['BUY_MAX_RISK', 35,
      'Maximum risk for BUY', true],
    ['ACCUMULATE_MIN_CONVICTION', 65,
      'Minimum conviction for ACCUMULATE', true],
    ['ACCUMULATE_MAX_RISK', 50,
      'Maximum risk for ACCUMULATE', true],
    ['WATCH_MIN_CONVICTION', 45,
      'Minimum conviction for WATCH', true],
    ['AVOID_MAX_CONVICTION', 30,
      'Maximum conviction for AVOID', true],
    ['AVOID_MIN_RISK', 80,
      'Minimum risk for AVOID', true]
  ];

  foEnsureConvictionDefaults_(sheet, defaults);

  const values = sheet.getDataRange().getValues();
  const rules = {};

  for (let row = 1; row < values.length; row++) {
    const name = String(values[row][0] || '').trim();
    const active = values[row][3];

    if (!name || active === false) continue;
    rules[name] = foConvictionNumber_(values[row][1]);
  }

  return rules;
}

function foEnsureConvictionDefaults_(sheet, defaults) {
  const values = sheet.getDataRange().getValues();
  const existing = {};

  for (let row = 1; row < values.length; row++) {
    const name = String(values[row][0] || '').trim();
    if (name) existing[name] = true;
  }

  const missing = defaults.filter(function(rule) {
    return !existing[rule[0]];
  });

  if (missing.length > 0) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      missing.length,
      missing[0].length
    ).setValues(missing);
  }
}

function foCalculateDynamicConviction_(input, rules) {
  const components = {
    distance: foConvictionDistanceScore_(input.distancePct),
    zone: foConvictionZoneScore_(input.zonePosition),
    freshness: foConvictionFreshnessScore_(input.priceFreshness),
    dataQuality: foClampScore_(input.dataQualityScore),
    capacity: foConvictionCapacityScore_(
      input.portfolioWeight,
      input.maxPositionWeight
    ),
    policy: foConvictionPolicyScore_(
      input.targetEntrySource,
      input.targetEntryMethod
    )
  };

  const score =
    components.distance * (rules.WEIGHT_DISTANCE || 0.25) +
    components.zone * (rules.WEIGHT_ZONE_POSITION || 0.20) +
    components.freshness * (rules.WEIGHT_PRICE_FRESHNESS || 0.15) +
    components.dataQuality * (rules.WEIGHT_DATA_QUALITY || 0.15) +
    components.capacity * (rules.WEIGHT_PORTFOLIO_CAPACITY || 0.10) +
    components.policy * (rules.WEIGHT_ENTRY_POLICY || 0.15);

  return {
    score: Math.round(foClampScore_(score)),
    source: 'DYNAMIC',
    components: components
  };
}

function foCalculateDynamicRisk_(input, rules) {
  const components = {
    price: foRiskPriceScore_(input.priceFreshness),
    concentration: foRiskConcentrationScore_(
      input.portfolioWeight,
      input.maxPositionWeight
    ),
    dataQuality: 100 - foClampScore_(input.dataQualityScore),
    distance: foRiskDistanceScore_(input.distancePct),
    policy: foRiskPolicyScore_(
      input.targetEntrySource,
      input.targetEntryMethod
    )
  };

  const score =
    components.price * (rules.RISK_WEIGHT_PRICE || 0.30) +
    components.concentration *
      (rules.RISK_WEIGHT_CONCENTRATION || 0.25) +
    components.dataQuality *
      (rules.RISK_WEIGHT_DATA_QUALITY || 0.20) +
    components.distance * (rules.RISK_WEIGHT_DISTANCE || 0.15) +
    components.policy * (rules.RISK_WEIGHT_POLICY || 0.10);

  return {
    score: Math.round(foClampScore_(score)),
    source: 'DYNAMIC',
    components: components
  };
}

function foDetermineDynamicRecommendation_(
  convictionScore,
  riskScore,
  priceFreshness,
  rules
) {
  if (priceFreshness === 'MISSING') return 'HOLD';

  if (
    convictionScore <= (rules.AVOID_MAX_CONVICTION || 30) &&
    riskScore >= (rules.AVOID_MIN_RISK || 80)
  ) return 'AVOID';

  if (
    convictionScore >= (rules.STRONG_BUY_MIN_CONVICTION || 90) &&
    riskScore <= (rules.STRONG_BUY_MAX_RISK || 25)
  ) return 'STRONG BUY';

  if (
    convictionScore >= (rules.BUY_MIN_CONVICTION || 80) &&
    riskScore <= (rules.BUY_MAX_RISK || 35)
  ) return 'BUY';

  if (
    convictionScore >= (rules.ACCUMULATE_MIN_CONVICTION || 65) &&
    riskScore <= (rules.ACCUMULATE_MAX_RISK || 50)
  ) return 'ACCUMULATE';

  if (convictionScore >= (rules.WATCH_MIN_CONVICTION || 45)) {
    return 'WATCH';
  }

  return 'HOLD';
}

function foBuildDynamicRecommendationReason_(
  conviction,
  risk,
  recommendation
) {
  return [
    'Recommendation: ' + recommendation,
    'Dynamic conviction: ' + conviction.score,
    'Dynamic risk: ' + risk.score,
    'Distance factor: ' + conviction.components.distance,
    'Zone factor: ' + conviction.components.zone,
    'Freshness factor: ' + conviction.components.freshness,
    'Data quality factor: ' + conviction.components.dataQuality,
    'Capacity factor: ' + conviction.components.capacity,
    'Policy factor: ' + conviction.components.policy
  ].join(' | ');
}

function foConvictionDistanceScore_(distancePct) {
  if (distancePct === '' || distancePct === null) return 0;
  if (distancePct <= 0) return 100;
  if (distancePct <= 0.02) return 95;
  if (distancePct <= 0.05) return 80;
  if (distancePct <= 0.08) return 65;
  if (distancePct <= 0.15) return 45;
  return 20;
}

function foConvictionZoneScore_(zonePosition) {
  if (zonePosition === 'BELOW ZONE') return 95;
  if (zonePosition === 'IN BUY ZONE') return 100;
  if (zonePosition === 'ABOVE ZONE') return 50;
  return 0;
}

function foConvictionFreshnessScore_(priceFreshness) {
  if (priceFreshness === 'FRESH') return 100;
  if (priceFreshness === 'UNKNOWN') return 60;
  if (priceFreshness === 'STALE') return 35;
  return 0;
}

function foConvictionCapacityScore_(weight, maxWeight) {
  const limit = maxWeight || 0.15;
  const positionWeight = Number(weight) || 0;

  if (positionWeight <= 0) return 100;
  if (positionWeight >= limit) return 0;

  return foClampScore_((1 - positionWeight / limit) * 100);
}

function foConvictionPolicyScore_(source, method) {
  if (source === 'MISSING') return 0;
  if (method === 'MANUAL') return 100;
  if (method === 'DIRECT') return 95;
  if (method === 'LOWER_OF_COST_AND_DISCOUNT') return 90;
  if (method === 'AVERAGE_COST') return 75;
  if (method === 'CURRENT_PRICE_DISCOUNT') return 65;
  return 50;
}

function foRiskPriceScore_(priceFreshness) {
  if (priceFreshness === 'FRESH') return 5;
  if (priceFreshness === 'UNKNOWN') return 45;
  if (priceFreshness === 'STALE') return 75;
  return 100;
}

function foRiskConcentrationScore_(weight, maxWeight) {
  const limit = maxWeight || 0.15;
  const positionWeight = Number(weight) || 0;

  if (positionWeight <= 0) return 5;
  return foClampScore_((positionWeight / limit) * 100);
}

function foRiskDistanceScore_(distancePct) {
  if (distancePct === '' || distancePct === null) return 100;
  if (distancePct <= 0) return 10;
  if (distancePct <= 0.02) return 15;
  if (distancePct <= 0.05) return 30;
  if (distancePct <= 0.08) return 45;
  if (distancePct <= 0.15) return 65;
  return 90;
}

function foRiskPolicyScore_(source, method) {
  if (source === 'MISSING') return 100;
  if (method === 'MANUAL') return 5;
  if (method === 'DIRECT') return 10;
  if (method === 'LOWER_OF_COST_AND_DISCOUNT') return 15;
  if (method === 'AVERAGE_COST') return 30;
  if (method === 'CURRENT_PRICE_DISCOUNT') return 45;
  return 60;
}

function foClampScore_(value) {
  const number = Number(value);
  if (!isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function foConvictionNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foRunConvictionEngineSmokeTest() {
  const rules = {
    WEIGHT_DISTANCE: 0.25,
    WEIGHT_ZONE_POSITION: 0.20,
    WEIGHT_PRICE_FRESHNESS: 0.15,
    WEIGHT_DATA_QUALITY: 0.15,
    WEIGHT_PORTFOLIO_CAPACITY: 0.10,
    WEIGHT_ENTRY_POLICY: 0.15,
    RISK_WEIGHT_PRICE: 0.30,
    RISK_WEIGHT_CONCENTRATION: 0.25,
    RISK_WEIGHT_DATA_QUALITY: 0.20,
    RISK_WEIGHT_DISTANCE: 0.15,
    RISK_WEIGHT_POLICY: 0.10
  };

  const input = {
    distancePct: 0.02,
    zonePosition: 'IN BUY ZONE',
    priceFreshness: 'FRESH',
    dataQualityScore: 100,
    portfolioWeight: 0.05,
    maxPositionWeight: 0.15,
    targetEntrySource: 'BUY ZONE TARGETS',
    targetEntryMethod: 'MANUAL'
  };

  const conviction = foCalculateDynamicConviction_(input, rules);
  const risk = foCalculateDynamicRisk_(input, rules);

  if (conviction.score < 0 || conviction.score > 100) {
    throw new Error('Dynamic conviction is outside 0-100.');
  }

  if (risk.score < 0 || risk.score > 100) {
    throw new Error('Dynamic risk is outside 0-100.');
  }

  return {
    status: 'PASS',
    conviction: conviction.score,
    risk: risk.score
  };
}
