/**
 * Buy Zone Intelligence Engine
 * Wave 2.4.1-A — Configurable Rules Foundation
 */

function foRunBuyZoneIntelligence() {
  const module = 'BuyZoneIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Buy Zone Intelligence started.');

    const dashboard = foDashboard_();
    const rules = foLoadBuyZoneRules_(dashboard);
    const portfolioSheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!portfolioSheet) throw new Error('Portfolio Master sheet not found.');

    const values = portfolioSheet.getDataRange().getValues();
    if (values.length < 2) throw new Error('Portfolio Master has no holdings.');

    const headers = values[0].map(String);
    const results = foBuildBuyZoneResults_(values, headers, rules);

    foWriteBuyZoneIntelligence_(dashboard, results);
    foWriteBuyZoneExecutiveSummary_(dashboard, results);

    foInfo_(module, 'Complete',
      'Buy Zone Intelligence completed. Results: ' + results.length);

    return {
      status: 'SUCCESS',
      results: results.length,
      actionableCandidates: results.filter(function(item) {
        return item.recommendation === 'BUY' ||
          item.recommendation === 'ACCUMULATE';
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foLoadBuyZoneRules_(dashboard) {
  const sheet = foEnsureSheet_(dashboard, FO_SHEETS.BUY_ZONE_RULES, [
    'Rule', 'Value', 'Description', 'Active'
  ]);

  if (sheet.getLastRow() === 1) {
    sheet.getRange(2, 1, 8, 4).setValues([
      ['BUY_MAX_DISTANCE_PCT', 0.02, 'Maximum distance above target entry for BUY', true],
      ['ACCUMULATE_MAX_DISTANCE_PCT', 0.08, 'Maximum distance above target entry for ACCUMULATE', true],
      ['WATCH_MAX_DISTANCE_PCT', 0.15, 'Maximum distance above target entry for WATCH', true],
      ['MAX_POSITION_WEIGHT', 0.15, 'Position weight above which no additional capital is recommended', true],
      ['MIN_DATA_QUALITY_SCORE', 70, 'Minimum data-quality score for actionable recommendations', true],
      ['DEFAULT_CONVICTION_SCORE', 70, 'Default conviction score when no score is supplied', true],
      ['DEFAULT_RISK_SCORE', 50, 'Default risk score when no score is supplied', true],
      ['STALE_PRICE_HOURS', 24, 'Price age after which the result is marked stale', true]
    ]);
  }

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

function foBuildBuyZoneResults_(values, headers, rules) {
  const results = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    if (!ticker) continue;

    const account = String(foGetVal_(row, headers, 'Account') || '').trim();
    const company =
      foGetVal_(row, headers, 'Company') ||
      foGetVal_(row, headers, 'Company / Fund') || '';

    const quantity = foBuyZoneNumber_(foGetVal_(row, headers, 'Quantity'));
    const currentPrice = foBuyZoneNumber_(foGetVal_(row, headers, 'Current Price'));
    const targetEntryPrice =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Target Entry Price')) ||
      foBuyZoneNumber_(foGetVal_(row, headers, 'Buy Zone Price')) ||
      foBuyZoneNumber_(foGetVal_(row, headers, 'Average Cost'));
    const marketValue = foBuyZoneNumber_(foGetVal_(row, headers, 'Market Value'));
    const portfolioWeight = foBuyZoneNumber_(foGetVal_(row, headers, 'Portfolio Weight'));
    const convictionScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Conviction Score')) ||
      rules.DEFAULT_CONVICTION_SCORE || 70;
    const riskScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Risk Score')) ||
      rules.DEFAULT_RISK_SCORE || 50;
    const dataQualityScore =
      foBuyZoneNumber_(foGetVal_(row, headers, 'Data Quality Score')) || 100;

    if (quantity <= 0 && marketValue <= 0 && targetEntryPrice <= 0) continue;

    const distancePct =
      currentPrice > 0 && targetEntryPrice > 0
        ? (currentPrice - targetEntryPrice) / targetEntryPrice
        : '';

    const recommendation = foDetermineBuyZoneRecommendation_({
      currentPrice, targetEntryPrice, distancePct,
      portfolioWeight, dataQualityScore, rules
    });

    const confidence = foCalculateBuyZoneConfidence_(
      distancePct, convictionScore, riskScore, dataQualityScore
    );

    results.push({
      ticker, company, account, currentPrice, targetEntryPrice,
      distancePct, portfolioWeight, convictionScore, riskScore,
      dataQualityScore, confidence, recommendation,
      rationale: foBuildBuyZoneRationale_(
        recommendation, distancePct, portfolioWeight, dataQualityScore, rules
      )
    });
  }

  return results;
}

function foDetermineBuyZoneRecommendation_(input) {
  if (!input.currentPrice || !input.targetEntryPrice) return 'HOLD';
  if (input.dataQualityScore < (input.rules.MIN_DATA_QUALITY_SCORE || 70)) return 'HOLD';
  if (input.portfolioWeight >= (input.rules.MAX_POSITION_WEIGHT || 0.15)) return 'DO NOT ADD';
  if (input.distancePct <= (input.rules.BUY_MAX_DISTANCE_PCT || 0.02)) return 'BUY';
  if (input.distancePct <= (input.rules.ACCUMULATE_MAX_DISTANCE_PCT || 0.08)) return 'ACCUMULATE';
  if (input.distancePct <= (input.rules.WATCH_MAX_DISTANCE_PCT || 0.15)) return 'WATCH';
  return 'HOLD';
}

function foCalculateBuyZoneConfidence_(distancePct, convictionScore, riskScore, dataQualityScore) {
  const distanceScore = distancePct === ''
    ? 0
    : Math.max(0, Math.min(100, 100 - Math.max(0, distancePct) * 400));

  const score =
    distanceScore * 0.35 +
    convictionScore * 0.35 +
    (100 - riskScore) * 0.15 +
    dataQualityScore * 0.15;

  return Math.round(Math.max(0, Math.min(100, score)));
}

function foBuildBuyZoneRationale_(recommendation, distancePct, portfolioWeight, dataQualityScore, rules) {
  const reasons = ['Recommendation: ' + recommendation];

  if (distancePct !== '') {
    reasons.push('Distance to target: ' + (Math.round(distancePct * 10000) / 100) + '%');
  }
  if (portfolioWeight >= (rules.MAX_POSITION_WEIGHT || 0.15)) {
    reasons.push('Position concentration blocks additional capital');
  }
  if (dataQualityScore < (rules.MIN_DATA_QUALITY_SCORE || 70)) {
    reasons.push('Data quality below actionable threshold');
  }

  return reasons.join(' | ');
}

function foWriteBuyZoneIntelligence_(dashboard, results) {
  const headers = [
    'Timestamp', 'Ticker', 'Company', 'Account', 'Current Price',
    'Target Entry Price', 'Distance to Entry %', 'Portfolio Weight',
    'Conviction Score', 'Risk Score', 'Data Quality Score',
    'Buy Zone Confidence', 'Recommendation', 'Rationale',
    'Platform Version', 'Baseline'
  ];

  const sheet = foEnsureSheet_(dashboard, FO_SHEETS.BUY_ZONE_INTELLIGENCE, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!results.length) return;

  const rows = results.map(function(item) {
    return [
      new Date(), item.ticker, item.company, item.account,
      item.currentPrice, item.targetEntryPrice, item.distancePct,
      item.portfolioWeight, item.convictionScore, item.riskScore,
      item.dataQualityScore, item.confidence, item.recommendation,
      item.rationale, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function foWriteBuyZoneExecutiveSummary_(dashboard, results) {
  const headers = ['Timestamp', 'Metric', 'Value', 'Platform Version', 'Baseline'];
  const sheet = foEnsureSheet_(dashboard, FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY, headers);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const actionable = results.filter(function(item) {
    return item.recommendation === 'BUY' || item.recommendation === 'ACCUMULATE';
  });
  const blocked = results.filter(function(item) {
    return item.recommendation === 'DO NOT ADD';
  });
  const highestConfidence = actionable.length
    ? actionable.slice().sort(function(a, b) {
        return b.confidence - a.confidence;
      })[0].ticker
    : '';

  const rows = [
    [new Date(), 'Positions Evaluated', results.length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Actionable Buy Candidates', actionable.length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Concentration Blocked', blocked.length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), 'Highest Confidence Candidate', highestConfidence, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function foBuyZoneNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;

  const cleaned = String(value).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

function foRunBuyZoneIntelligenceSmokeTest() {
  const module = 'BuyZoneIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Buy Zone Intelligence smoke test started.');

    const result = foRunBuyZoneIntelligence();
    const dashboard = foDashboard_();

    const intelligence = dashboard.getSheetByName(FO_SHEETS.BUY_ZONE_INTELLIGENCE);
    const summary = dashboard.getSheetByName(FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY);

    if (!intelligence || intelligence.getLastRow() < 1) {
      throw new Error('Buy Zone Intelligence output was not created.');
    }
    if (!summary || summary.getLastRow() < 2) {
      throw new Error('Buy Zone Executive Summary output is empty.');
    }

    foInfo_(module, 'Complete', 'Buy Zone Intelligence smoke test passed.');
    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
