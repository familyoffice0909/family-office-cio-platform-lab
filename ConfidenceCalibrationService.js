/**
 * Confidence Calibration Service
 * Sprint 2.7.0 — Confidence Calibration Engine
 */
function foBuildConfidenceCalibrationIndex_(dashboard) {
  const empty = { byBand: {}, byKeyAndBand: {}, totalComparablePairs: 0 };
  const sheet = dashboard.getSheetByName(FO_SHEETS.INVESTMENT_DECISION_HISTORY);
  if (!sheet || sheet.getLastRow() < 3) return empty;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  ['Timestamp','Ticker','Account','Recommendation','Confidence'].forEach(function(name) {
    if (headers.indexOf(name) < 0) throw new Error('Confidence Calibration requires history column: ' + name);
  });

  const grouped = {};
  values.slice(1).forEach(function(row) {
    const ticker = String(foDecisionVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
    const account = String(foDecisionVal_(row, headers, 'Account') || '').trim().toUpperCase();
    const confidence = foCalibrationNullableNumber_(foDecisionVal_(row, headers, 'Confidence'));
    const timestamp = foDecisionVal_(row, headers, 'Timestamp');
    if (!ticker || confidence === null || !(timestamp instanceof Date)) return;
    const key = foDecisionKey_(ticker, account);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      key: key,
      timestamp: timestamp,
      confidence: foCalibrationClamp_(confidence, 0, 100),
      recommendation: String(foDecisionVal_(row, headers, 'Recommendation') || '').trim().toUpperCase(),
      action: String(foDecisionVal_(row, headers, 'Action') || '').trim().toUpperCase()
    });
  });

  Object.keys(grouped).forEach(function(key) {
    const observations = grouped[key].sort(function(a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); });
    for (let i = 0; i < observations.length - 1; i += 1) {
      const current = observations[i];
      const next = observations[i + 1];
      const band = foConfidenceCalibrationBand_(current.confidence);
      const outcome = foConfidenceCalibrationProxyOutcome_(current, next);
      foAccumulateConfidenceCalibration_(empty.byBand, band, outcome);
      foAccumulateConfidenceCalibration_(empty.byKeyAndBand, key + '|' + band, outcome);
      empty.totalComparablePairs += 1;
    }
  });
  return empty;
}

function foAssessConfidenceCalibration_(item, index) {
  const confidence = foCalibrationClamp_(item.confidence, 0, 100);
  const band = foConfidenceCalibrationBand_(confidence);
  const key = foDecisionKey_(item.ticker, item.account);
  const specific = index && index.byKeyAndBand && index.byKeyAndBand[key + '|' + band];
  const global = index && index.byBand && index.byBand[band];
  const sample = specific && specific.sampleSize >= 5 ? specific : global;
  const scope = specific && specific.sampleSize >= 5 ? 'SECURITY + ACCOUNT' : 'GLOBAL CONFIDENCE BAND';

  if (!sample || sample.sampleSize < 5) {
    return {
      score: '', reliability: 'INSUFFICIENT DATA', sampleSize: sample ? sample.sampleSize : 0,
      status: 'INSUFFICIENT DATA', scope: scope, band: band,
      rationale: 'Insufficient comparable history for confidence band ' + band + '. No reliability conclusion was produced.'
    };
  }

  const adjustedRate = ((sample.positive + 2.5) / (sample.sampleSize + 5)) * 100;
  const score = Math.round(adjustedRate);
  const status = sample.sampleSize >= 12 ? 'CALIBRATED' : 'PROVISIONAL';
  const reliability = score >= 75 ? 'HIGH' : score >= 60 ? 'MODERATE' : 'LOW';
  return {
    score: score, reliability: reliability, sampleSize: sample.sampleSize,
    status: status, scope: scope, band: band,
    rationale: reliability + ' decision-consistency proxy (' + score + '/100) from ' + sample.sampleSize +
      ' comparable historical transitions in ' + scope + '. This is not realized-return performance calibration.'
  };
}

function foConfidenceCalibrationBand_(confidence) {
  const value = foCalibrationClamp_(confidence, 0, 100);
  if (value >= 90) return '90-100';
  if (value >= 80) return '80-89';
  if (value >= 70) return '70-79';
  if (value >= 60) return '60-69';
  return '0-59';
}

function foConfidenceCalibrationProxyOutcome_(current, next) {
  const currentDirection = foCalibrationRecommendationDirection_(current.recommendation, current.action);
  const nextDirection = foCalibrationRecommendationDirection_(next.recommendation, next.action);
  const confidenceDrop = current.confidence - next.confidence;
  const directionPreserved = currentDirection === 0 || nextDirection === 0 || currentDirection === nextDirection;
  return directionPreserved && confidenceDrop <= 15 ? 1 : 0;
}

function foCalibrationRecommendationDirection_(recommendation, action) {
  const combined = String(recommendation || '').toUpperCase() + '|' + String(action || '').toUpperCase();
  if (combined.indexOf('STRONG BUY') >= 0 || combined.indexOf('BUY') >= 0 ||
      combined.indexOf('ACCUMULATE') >= 0 || combined.indexOf('DEPLOY') >= 0) return 1;
  if (combined.indexOf('AVOID') >= 0 || combined.indexOf('SELL') >= 0 || combined.indexOf('REDUCE') >= 0) return -1;
  return 0;
}

function foAccumulateConfidenceCalibration_(target, key, outcome) {
  if (!target[key]) target[key] = { sampleSize: 0, positive: 0 };
  target[key].sampleSize += 1;
  target[key].positive += outcome ? 1 : 0;
}

function foCalibrationNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function foCalibrationClamp_(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function foRunConfidenceCalibrationSmokeTest() {
  const dashboard = foDashboard_();
  const index = foBuildConfidenceCalibrationIndex_(dashboard);
  const result = foRunInvestmentDecisionSupport();
  const sheet = dashboard.getSheetByName(FO_SHEETS.INVESTMENT_DECISION_SUPPORT);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('Investment Decision Support was not generated.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  ['Confidence Calibration Score','Confidence Reliability','Calibration Sample Size','Calibration Status',
   'Calibration Scope','Confidence Band','Calibration Rationale'].forEach(function(name) {
    if (headers.indexOf(name) < 0) throw new Error('Missing Confidence Calibration column: ' + name);
  });
  return { status: 'SUCCESS', comparablePairs: index.totalComparablePairs, decisions: result.decisions };
}
