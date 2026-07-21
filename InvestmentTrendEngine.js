/**
 * Investment Trend Intelligence Engine
 * Sprint 2.8.0 — Trend Detection Intelligence
 */

function foRunInvestmentTrendIntelligence() {
  const module = 'InvestmentTrendEngine';

  try {
    foInfo_(module, 'Start', 'Investment trend intelligence started.');

    const dashboard = foDashboard_();
    const trends = foBuildInvestmentTrends_(dashboard);

    foWriteInvestmentTrends_(dashboard, trends);
    foWriteTrendExecutiveSummary_(dashboard, trends);

    foInfo_(
      module,
      'Complete',
      'Investment trend intelligence completed. Trends: ' + trends.length
    );

    return {
      status: 'SUCCESS',
      trends: trends.length,
      improving: trends.filter(function(item) {
        return item.overallTrend === 'IMPROVING' ||
          item.overallTrend === 'STRONGLY IMPROVING';
      }).length,
      deteriorating: trends.filter(function(item) {
        return item.overallTrend === 'WEAKENING' ||
          item.overallTrend === 'DETERIORATING';
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildInvestmentTrends_(dashboard) {
  const seriesByKey = foLoadTrendSeries_(dashboard);

  return Object.keys(seriesByKey).map(function(key) {
    return foProjectInvestmentTrajectory_(seriesByKey[key], null);
  }).filter(function(item) {
    return item;
  }).sort(function(a, b) {
    return b.trendScore - a.trendScore;
  });
}

/**
 * Projects the newest multi-observation trajectory without writing workbook
 * state. Sprint 2.9.0 uses this before Decision Support persists the current
 * observation, keeping projected and persisted trend logic identical.
 */
function foProjectInvestmentTrajectory_(historicalSeries, currentObservation) {
  const series = (historicalSeries || []).slice();

  if (currentObservation) series.push(currentObservation);

  const normalized = foDeduplicateTrendSeriesByDay_(series).slice(
    -FO_TREND_MAX_OBSERVATIONS_
  );

  if (!normalized.length) return null;

  const current = normalized[normalized.length - 1];
  const previous = normalized.length > 1
    ? normalized[normalized.length - 2]
    : null;
  const pairwise = foBuildTrendRecord_(current, previous);

  return foEnhanceTrendRecord_(pairwise, normalized);
}

function foProjectInvestmentTrajectories_(seriesByKey, currentObservations) {
  const projected = {};
  const keys = {};

  Object.keys(seriesByKey || {}).forEach(function(key) { keys[key] = true; });
  Object.keys(currentObservations || {}).forEach(function(key) {
    keys[key] = true;
  });

  Object.keys(keys).forEach(function(key) {
    const result = foProjectInvestmentTrajectory_(
      (seriesByKey && seriesByKey[key]) || [],
      currentObservations && currentObservations[key]
    );
    if (result) projected[key] = result;
  });

  return projected;
}

function foLoadTrendSnapshots_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_HISTORY
  );

  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const groups = {};

  for (let row = values.length - 1; row >= 1; row--) {
    const record = foTrendHistoryRecord_(values[row], headers);
    if (!record.ticker) continue;

    const key = foDecisionKey_(record.ticker, record.account);

    if (!groups[key]) {
      groups[key] = {
        current: record,
        previous: null
      };
    } else if (!groups[key].previous) {
      groups[key].previous = record;
    }
  }

  return groups;
}

function foTrendHistoryRecord_(row, headers) {
  return {
    timestamp: foTrendVal_(row, headers, 'Timestamp'),
    ticker: String(
      foTrendVal_(row, headers, 'Ticker') || ''
    ).trim().toUpperCase(),
    account: foTrendVal_(row, headers, 'Account'),
    recommendation: foTrendVal_(row, headers, 'Recommendation'),
    zonePosition: foTrendVal_(row, headers, 'Zone Position'),
    conviction: foTrendNumber_(
      foTrendVal_(row, headers, 'Conviction')
    ),
    risk: foTrendNumber_(
      foTrendVal_(row, headers, 'Risk')
    ),
    confidence: foTrendNumber_(
      foTrendVal_(row, headers, 'Confidence')
    ),
    distancePct: foTrendNullableNumber_(
      foTrendVal_(row, headers, 'Distance to Entry %')
    ),
    materiality: foTrendNumber_(
      foTrendVal_(row, headers, 'Materiality Score')
    ),
    action: foTrendVal_(row, headers, 'Action'),
    allocationBand: foTrendVal_(row, headers, 'Allocation Band'),
    eventType: foTrendVal_(row, headers, 'Event Type'),
    recommendationQualityScore: foTrendNullableNumber_(
      foTrendVal_(row, headers, 'Recommendation Quality Score')
    ),
    recommendationQualityGrade: foTrendVal_(
      row,
      headers,
      'Recommendation Quality Grade'
    )
  };
}

function foBuildTrendRecord_(current, previous) {
  const previousRecommendation = previous
    ? previous.recommendation
    : current.recommendation;
  const previousConviction = previous
    ? previous.conviction
    : current.conviction;
  const previousRisk = previous
    ? previous.risk
    : current.risk;
  const previousConfidence = previous
    ? previous.confidence
    : current.confidence;
  const previousDistance = previous
    ? previous.distancePct
    : current.distancePct;
  const previousMateriality = previous
    ? previous.materiality
    : current.materiality;

  const convictionDelta = current.conviction - previousConviction;
  const riskDelta = current.risk - previousRisk;
  const confidenceDelta = current.confidence - previousConfidence;
  const materialityDelta = current.materiality - previousMateriality;
  const distanceDelta =
    current.distancePct !== null && previousDistance !== null
      ? current.distancePct - previousDistance
      : null;

  const recommendationTrend = foRecommendationTrend_(
    previousRecommendation,
    current.recommendation
  );
  const convictionTrend = foConvictionTrend_(convictionDelta);
  const riskTrend = foRiskTrend_(riskDelta);
  const confidenceTrend = foConfidenceTrend_(confidenceDelta);
  const materialityTrend = foMaterialityTrend_(materialityDelta);
  const entryTrend = foEntryDistanceTrend_(
    previous,
    current,
    distanceDelta
  );
  const trendScore = foOverallTrendScore_(
    recommendationTrend,
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta,
    current.zonePosition
  );
  const overallTrend = foOverallTrendLabel_(trendScore);

  return {
    timestamp: current.timestamp,
    ticker: current.ticker,
    account: current.account,
    previousRecommendation: previousRecommendation,
    currentRecommendation: current.recommendation,
    recommendationTrend: recommendationTrend,
    previousConviction: previousConviction,
    currentConviction: current.conviction,
    convictionDelta: convictionDelta,
    convictionTrend: convictionTrend,
    previousRisk: previousRisk,
    currentRisk: current.risk,
    riskDelta: riskDelta,
    riskTrend: riskTrend,
    previousConfidence: previousConfidence,
    currentConfidence: current.confidence,
    confidenceDelta: confidenceDelta,
    confidenceTrend: confidenceTrend,
    previousMateriality: previousMateriality,
    currentMateriality: current.materiality,
    materialityDelta: materialityDelta,
    materialityTrend: materialityTrend,
    previousDistancePct: previousDistance,
    currentDistancePct: current.distancePct,
    distanceDelta: distanceDelta,
    entryTrend: entryTrend,
    overallTrend: overallTrend,
    trendScore: trendScore,
    eventType: foNormalizeTrendEventType_(current, overallTrend),
    executiveComment: foTrendExecutiveComment_({
      ticker: current.ticker,
      recommendationTrend: recommendationTrend,
      convictionDelta: convictionDelta,
      riskDelta: riskDelta,
      confidenceDelta: confidenceDelta,
      distanceDelta: distanceDelta,
      entryTrend: entryTrend,
      overallTrend: overallTrend,
      hasPrevious: Boolean(previous)
    })
  };
}


function foNormalizeTrendEventType_(current, overallTrend) {
  const materiality = foTrendNumber_(current && current.materiality, 0);
  const eventType = String(current && current.eventType || '').trim().toUpperCase();
  const stable = String(overallTrend || '').trim().toUpperCase() === 'STABLE';

  if (materiality < 40 && stable) return 'DAILY SNAPSHOT';
  if (eventType === 'MATERIAL CHANGE' && materiality < 40) {
    return 'DAILY SNAPSHOT';
  }
  return eventType || (materiality >= 40 ? 'MATERIAL CHANGE' : 'DAILY SNAPSHOT');
}

function foRecommendationTrend_(previous, current) {
  const priority = {
    'STRONG BUY': 6,
    BUY: 5,
    ACCUMULATE: 4,
    WATCH: 3,
    HOLD: 2,
    AVOID: 1
  };

  const delta = (priority[current] || 0) - (priority[previous] || 0);

  if (delta >= 2) return 'STRONG UPGRADE';
  if (delta === 1) return 'UPGRADE';
  if (delta <= -2) return 'STRONG DOWNGRADE';
  if (delta === -1) return 'DOWNGRADE';
  return 'UNCHANGED';
}

function foConvictionTrend_(delta) {
  if (delta >= 10) return 'STRONGLY IMPROVING';
  if (delta >= 5) return 'IMPROVING';
  if (delta <= -10) return 'DETERIORATING';
  if (delta <= -5) return 'WEAKENING';
  return 'STABLE';
}

function foRiskTrend_(delta) {
  if (delta <= -10) return 'STRONGLY IMPROVING';
  if (delta <= -5) return 'IMPROVING';
  if (delta >= 10) return 'DETERIORATING';
  if (delta >= 5) return 'WEAKENING';
  return 'STABLE';
}

function foConfidenceTrend_(delta) {
  if (delta >= 10) return 'STRONGLY IMPROVING';
  if (delta >= 5) return 'IMPROVING';
  if (delta <= -10) return 'DETERIORATING';
  if (delta <= -5) return 'WEAKENING';
  return 'STABLE';
}

function foMaterialityTrend_(delta) {
  if (delta >= 20) return 'RISING MATERIALLY';
  if (delta >= 10) return 'RISING';
  if (delta <= -20) return 'FALLING MATERIALLY';
  if (delta <= -10) return 'FALLING';
  return 'STABLE';
}

function foEntryDistanceTrend_(previous, current, delta) {
  if (
    !previous ||
    previous.distancePct === null ||
    current.distancePct === null ||
    delta === null
  ) {
    return 'INSUFFICIENT DATA';
  }

  if (current.zonePosition === 'IN BUY ZONE') return 'IN BUY ZONE';
  if (current.zonePosition === 'BELOW ZONE') return 'BELOW BUY ZONE';

  if (
    previous &&
    previous.zonePosition === 'IN BUY ZONE' &&
    current.zonePosition !== 'IN BUY ZONE'
  ) {
    return 'EXITED BUY ZONE';
  }

  if (delta <= -0.05) return 'APPROACHING QUICKLY';
  if (delta <= -0.02) return 'APPROACHING';
  if (delta >= 0.05) return 'MOVING AWAY QUICKLY';
  if (delta >= 0.02) return 'MOVING AWAY';
  return 'STABLE';
}

function foOverallTrendScore_(
  recommendationTrend,
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta,
  zonePosition
) {
  let score = 0;

  if (recommendationTrend === 'STRONG UPGRADE') score += 4;
  if (recommendationTrend === 'UPGRADE') score += 2;
  if (recommendationTrend === 'STRONG DOWNGRADE') score -= 4;
  if (recommendationTrend === 'DOWNGRADE') score -= 2;

  score += foTrendDeltaPoints_(convictionDelta, false);
  score += foTrendDeltaPoints_(riskDelta, true);
  score += foTrendDeltaPoints_(confidenceDelta, false);
  score += foTrendDistancePoints_(distanceDelta);

  if (zonePosition === 'IN BUY ZONE') score += 2;
  if (zonePosition === 'BELOW ZONE') score += 1;

  return Math.max(-10, Math.min(10, score));
}

function foTrendDeltaPoints_(delta, inverse) {
  let points = 0;

  if (delta >= 10) points = 2;
  else if (delta >= 5) points = 1;
  else if (delta <= -10) points = -2;
  else if (delta <= -5) points = -1;

  return inverse ? -points : points;
}

function foTrendDistancePoints_(delta) {
  if (delta === null || delta === undefined || !isFinite(Number(delta))) {
    return 0;
  }

  if (delta <= -0.05) return 2;
  if (delta <= -0.02) return 1;
  if (delta >= 0.05) return -2;
  if (delta >= 0.02) return -1;
  return 0;
}

function foOverallTrendLabel_(score) {
  if (score >= 5) return 'STRONGLY IMPROVING';
  if (score >= 2) return 'IMPROVING';
  if (score <= -5) return 'DETERIORATING';
  if (score <= -2) return 'WEAKENING';
  return 'STABLE';
}

function foTrendExecutiveComment_(input) {
  if (!input.hasPrevious) {
    return input.ticker +
      ' established its initial trend baseline. Future runs will measure ' +
      'changes against this snapshot.';
  }

  const parts = [];

  if (
    input.recommendationTrend === 'UPGRADE' ||
    input.recommendationTrend === 'STRONG UPGRADE'
  ) {
    parts.push('Recommendation upgraded');
  } else if (
    input.recommendationTrend === 'DOWNGRADE' ||
    input.recommendationTrend === 'STRONG DOWNGRADE'
  ) {
    parts.push('Recommendation downgraded');
  }

  if (input.convictionDelta >= 5) {
    parts.push('conviction increased by ' + input.convictionDelta);
  } else if (input.convictionDelta <= -5) {
    parts.push('conviction decreased by ' + Math.abs(input.convictionDelta));
  }

  if (input.riskDelta <= -5) {
    parts.push('risk declined by ' + Math.abs(input.riskDelta));
  } else if (input.riskDelta >= 5) {
    parts.push('risk increased by ' + input.riskDelta);
  }

  if (input.confidenceDelta >= 5) {
    parts.push('confidence increased by ' + input.confidenceDelta);
  } else if (input.confidenceDelta <= -5) {
    parts.push('confidence decreased by ' + Math.abs(input.confidenceDelta));
  }

  if (
    input.entryTrend === 'APPROACHING' ||
    input.entryTrend === 'APPROACHING QUICKLY'
  ) {
    parts.push('the security is approaching its target entry');
  } else if (input.entryTrend === 'IN BUY ZONE') {
    parts.push('the security is inside the Buy Zone');
  } else if (
    input.entryTrend === 'MOVING AWAY' ||
    input.entryTrend === 'MOVING AWAY QUICKLY'
  ) {
    parts.push('the security is moving away from its target entry');
  }

  if (!parts.length) {
    return input.ticker +
      ' remains stable with no material trend change.';
  }

  return input.ticker + ': ' + parts.join('; ') + '.';
}

function foWriteInvestmentTrends_(dashboard, trends) {
  const headers = [
    'Timestamp',
    'Ticker',
    'Account',
    'Previous Recommendation',
    'Current Recommendation',
    'Recommendation Trend',
    'Previous Conviction',
    'Current Conviction',
    'Conviction Delta',
    'Conviction Trend',
    'Previous Risk',
    'Current Risk',
    'Risk Delta',
    'Risk Trend',
    'Previous Confidence',
    'Current Confidence',
    'Confidence Delta',
    'Confidence Trend',
    'Previous Materiality',
    'Current Materiality',
    'Materiality Delta',
    'Materiality Trend',
    'Previous Distance %',
    'Current Distance %',
    'Distance Delta',
    'Entry Trend',
    'Overall Trend',
    'Trend Score',
    'Event Type',
    'Executive Comment',
    'Platform Version',
    'Baseline',
    'Observation Count',
    'Recommendation Trajectory',
    'Conviction Trajectory',
    'Risk Trajectory',
    'Confidence Trajectory',
    'Previous Recommendation Quality',
    'Current Recommendation Quality',
    'Recommendation Quality Delta',
    'Recommendation Quality Trend',
    'Recommendation Quality Trajectory',
    'Reversal Status',
    'Trend Evidence Strength',
    'Overall Trajectory',
    'Trajectory Rationale'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_TRENDS,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const rows = trends.map(function(item) {
    return [
      item.timestamp,
      item.ticker,
      item.account,
      item.previousRecommendation,
      item.currentRecommendation,
      item.recommendationTrend,
      item.previousConviction,
      item.currentConviction,
      item.convictionDelta,
      item.convictionTrend,
      item.previousRisk,
      item.currentRisk,
      item.riskDelta,
      item.riskTrend,
      item.previousConfidence,
      item.currentConfidence,
      item.confidenceDelta,
      item.confidenceTrend,
      item.previousMateriality,
      item.currentMateriality,
      item.materialityDelta,
      item.materialityTrend,
      item.previousDistancePct === null ? '' : item.previousDistancePct,
      item.currentDistancePct === null ? '' : item.currentDistancePct,
      item.distanceDelta === null ? '' : item.distanceDelta,
      item.entryTrend,
      item.overallTrend,
      item.trendScore,
      item.eventType,
      item.executiveComment,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      item.observationCount,
      item.recommendationTrajectory,
      item.convictionTrajectory,
      item.riskTrajectory,
      item.confidenceTrajectory,
      item.previousRecommendationQuality === null
        ? '' : item.previousRecommendationQuality,
      item.currentRecommendationQuality === null
        ? '' : item.currentRecommendationQuality,
      item.recommendationQualityDelta,
      item.recommendationQualityTrend,
      item.recommendationQualityTrajectory,
      item.reversalStatus,
      item.trendEvidenceStrength,
      item.overallTrajectory,
      item.trajectoryRationale
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

  sheet.getRange(2, 23, Math.max(rows.length, 1), 3)
    .setNumberFormat('0.00%');

  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(30, 480);
}

function foWriteTrendExecutiveSummary_(dashboard, trends) {
  const headers = ['Metric', 'Value', 'Details', 'Timestamp'];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_TREND_SUMMARY,
    headers
  );

  const now = new Date();
  const improving = trends.filter(function(item) {
    return item.overallTrend === 'IMPROVING' ||
      item.overallTrend === 'STRONGLY IMPROVING';
  });
  const stable = trends.filter(function(item) {
    return item.overallTrend === 'STABLE';
  });
  const weakening = trends.filter(function(item) {
    return item.overallTrend === 'WEAKENING' ||
      item.overallTrend === 'DETERIORATING';
  });

  const mostImprovedCandidate = trends.length
    ? trends.slice().sort(function(a, b) {
        return b.trendScore - a.trendScore;
      })[0]
    : null;
  const biggestDeteriorationCandidate = trends.length
    ? trends.slice().sort(function(a, b) {
        return a.trendScore - b.trendScore;
      })[0]
    : null;
  const largestConvictionIncreaseCandidate = trends.length
    ? trends.slice().sort(function(a, b) {
        return b.convictionDelta - a.convictionDelta;
      })[0]
    : null;
  const largestRiskReductionCandidate = trends.length
    ? trends.slice().sort(function(a, b) {
        return a.riskDelta - b.riskDelta;
      })[0]
    : null;

  const mostImproved =
    mostImprovedCandidate && mostImprovedCandidate.trendScore > 0
      ? mostImprovedCandidate
      : null;
  const biggestDeterioration =
    biggestDeteriorationCandidate &&
    biggestDeteriorationCandidate.trendScore < 0
      ? biggestDeteriorationCandidate
      : null;
  const largestConvictionIncrease =
    largestConvictionIncreaseCandidate &&
    largestConvictionIncreaseCandidate.convictionDelta > 0
      ? largestConvictionIncreaseCandidate
      : null;
  const largestRiskReduction =
    largestRiskReductionCandidate &&
    largestRiskReductionCandidate.riskDelta < 0
      ? largestRiskReductionCandidate
      : null;

  const portfolioTrendStatus = foPortfolioTrendStatus_(
    improving.length,
    stable.length,
    weakening.length,
    trends.length
  );
  const portfolioTrendNarrative = foPortfolioTrendNarrative_(
    portfolioTrendStatus,
    improving.length,
    stable.length,
    weakening.length
  );

  const rows = [
    ['Metric', 'Value', 'Details', 'Timestamp'],
    ['Improving Securities', improving.length, '', now],
    ['Stable Securities', stable.length, '', now],
    ['Weakening Securities', weakening.length, '', now],
    [
      'Most Improved Security',
      mostImproved ? mostImproved.ticker : 'NONE',
      mostImproved
        ? 'Trend score ' + mostImproved.trendScore
        : 'No positive trend detected',
      now
    ],
    [
      'Biggest Deterioration',
      biggestDeterioration ? biggestDeterioration.ticker : 'NONE',
      biggestDeterioration
        ? 'Trend score ' + biggestDeterioration.trendScore
        : 'No deterioration detected',
      now
    ],
    [
      'Largest Conviction Increase',
      largestConvictionIncrease
        ? largestConvictionIncrease.ticker
        : 'NONE',
      largestConvictionIncrease
        ? 'Delta ' + largestConvictionIncrease.convictionDelta
        : 'No positive conviction change detected',
      now
    ],
    [
      'Largest Risk Reduction',
      largestRiskReduction ? largestRiskReduction.ticker : 'NONE',
      largestRiskReduction
        ? 'Delta ' + largestRiskReduction.riskDelta
        : 'No risk reduction detected',
      now
    ],
    [
      'Recommendation Upgrades',
      trends.filter(function(item) {
        return item.recommendationTrend === 'UPGRADE' ||
          item.recommendationTrend === 'STRONG UPGRADE';
      }).length,
      '',
      now
    ],
    [
      'Recommendation Downgrades',
      trends.filter(function(item) {
        return item.recommendationTrend === 'DOWNGRADE' ||
          item.recommendationTrend === 'STRONG DOWNGRADE';
      }).length,
      '',
      now
    ],
    [
      'Reversing Upward Securities',
      foCountTrendReversals_(trends, 'REVERSING UPWARD'),
      '',
      now
    ],
    [
      'Reversing Downward Securities',
      foCountTrendReversals_(trends, 'REVERSING DOWNWARD'),
      '',
      now
    ],
    [
      'Insufficient History Securities',
      trends.filter(function(item) {
        return item.overallTrajectory === 'INSUFFICIENT HISTORY';
      }).length,
      '',
      now
    ],
    [
      'Portfolio Trend Status',
      portfolioTrendStatus,
      portfolioTrendNarrative,
      now
    ]
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, 4);
}

function foPortfolioTrendStatus_(
  improvingCount,
  stableCount,
  weakeningCount,
  totalCount
) {
  if (!totalCount) return 'NO DATA';

  if (weakeningCount > improvingCount && weakeningCount >= totalCount / 2) {
    return 'PORTFOLIO DETERIORATING';
  }

  if (improvingCount > weakeningCount && improvingCount >= totalCount / 2) {
    return 'PORTFOLIO IMPROVING';
  }

  if (improvingCount > 0 && weakeningCount === 0) {
    return 'EARLY IMPROVEMENT';
  }

  if (weakeningCount > 0 && improvingCount > 0) {
    return 'HIGH VOLATILITY';
  }

  if (stableCount === totalCount) {
    return 'NO MATERIAL CHANGE';
  }

  return 'MIXED';
}

function foPortfolioTrendNarrative_(
  status,
  improvingCount,
  stableCount,
  weakeningCount
) {
  if (status === 'NO MATERIAL CHANGE') {
    return 'Portfolio trends remain stable. No material changes were ' +
      'detected since the previous evaluation.';
  }

  if (status === 'EARLY IMPROVEMENT') {
    return improvingCount +
      ' security or securities are improving with no deterioration detected.';
  }

  if (status === 'PORTFOLIO IMPROVING') {
    return 'Improving securities now represent the dominant portfolio trend.';
  }

  if (status === 'PORTFOLIO DETERIORATING') {
    return weakeningCount +
      ' security or securities are weakening and require review.';
  }

  if (status === 'HIGH VOLATILITY') {
    return 'The portfolio contains both improving and weakening signals.';
  }

  if (status === 'NO DATA') {
    return 'No trend history is currently available.';
  }

  return improvingCount + ' improving, ' +
    stableCount + ' stable, and ' +
    weakeningCount + ' weakening.';
}

function foTrendVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foTrendNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foTrendNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}


/** Sprint 2.8.0 bounded multi-observation trajectory layer. */
const FO_TREND_MAX_OBSERVATIONS_ = 5;

function foLoadTrendSeries_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_HISTORY
  );
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const groups = {};

  values.slice(1).forEach(function(row) {
    const record = foTrendHistoryRecord_(row, headers);
    if (!record.ticker) return;
    const key = foDecisionKey_(record.ticker, record.account);
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  });

  Object.keys(groups).forEach(function(key) {
    groups[key] = foDeduplicateTrendSeriesByDay_(
      groups[key].sort(function(a, b) {
        return foTrendTimestampValue_(a.timestamp) -
          foTrendTimestampValue_(b.timestamp);
      })
    ).slice(-FO_TREND_MAX_OBSERVATIONS_);
  });
  return groups;
}

function foEnhanceTrendRecord_(record, series) {
  const observationCount = series.length;
  const recommendationTrajectory = foRecommendationTrajectory_(series);
  const convictionTrajectory = foNumericTrajectory_(
    series.map(function(item) { return item.conviction; }),
    5,
    false
  );
  const riskTrajectory = foNumericTrajectory_(
    series.map(function(item) { return item.risk; }),
    5,
    true
  );
  const confidenceTrajectory = foNumericTrajectory_(
    series.map(function(item) { return item.confidence; }),
    5,
    false
  );
  const qualityValues = series.map(function(item) {
    return item.recommendationQualityScore;
  }).filter(function(value) { return value !== null; });
  const qualityTrajectory = foNumericTrajectory_(qualityValues, 5, false);
  const previousQuality = qualityValues.length > 1
    ? qualityValues[qualityValues.length - 2] : null;
  const currentQuality = qualityValues.length
    ? qualityValues[qualityValues.length - 1] : null;
  const qualityDelta = previousQuality !== null && currentQuality !== null
    ? currentQuality - previousQuality : 0;
  const componentTrajectories = [
    recommendationTrajectory,
    convictionTrajectory,
    riskTrajectory,
    confidenceTrajectory,
    qualityTrajectory
  ];
  let overallTrajectory = foOverallTrajectory_(series);
  const reversalStatus = foResolveReversalStatus_(
    overallTrajectory,
    componentTrajectories
  );

  if (
    reversalStatus !== 'NONE' &&
    overallTrajectory.indexOf('REVERSING') !== 0
  ) {
    overallTrajectory = reversalStatus;
  }

  const evidenceStrength = foTrendEvidenceStrength_(
    observationCount,
    overallTrajectory,
    componentTrajectories
  );

  record.observationCount = observationCount;
  record.recommendationTrajectory = recommendationTrajectory;
  record.convictionTrajectory = convictionTrajectory;
  record.riskTrajectory = riskTrajectory;
  record.confidenceTrajectory = confidenceTrajectory;
  record.previousRecommendationQuality = previousQuality;
  record.currentRecommendationQuality = currentQuality;
  record.recommendationQualityDelta = qualityDelta;
  record.recommendationQualityTrend = foConfidenceTrend_(qualityDelta);
  record.recommendationQualityTrajectory = qualityTrajectory;
  record.reversalStatus = reversalStatus;
  record.trendEvidenceStrength = evidenceStrength;
  record.overallTrajectory = overallTrajectory;
  record.trajectoryRationale = foTrajectoryRationale_(record);
  return record;
}


function foDeduplicateTrendSeriesByDay_(series) {
  const byDay = {};

  series.forEach(function(item) {
    const dayKey = foTrendDayKey_(item.timestamp);
    byDay[dayKey] = item;
  });

  return Object.keys(byDay).map(function(dayKey) {
    return byDay[dayKey];
  }).sort(function(a, b) {
    return foTrendTimestampValue_(a.timestamp) -
      foTrendTimestampValue_(b.timestamp);
  });
}

function foTrendDayKey_(value) {
  const timestamp = foTrendTimestampValue_(value);
  if (!timestamp) return String(value || '');
  return new Date(timestamp).toISOString().slice(0, 10);
}

function foResolveReversalStatus_(overallTrajectory, components) {
  if (overallTrajectory.indexOf('REVERSING') === 0) {
    return overallTrajectory;
  }

  const upward = components.filter(function(value) {
    return value === 'REVERSING UPWARD';
  }).length;
  const downward = components.filter(function(value) {
    return value === 'REVERSING DOWNWARD';
  }).length;

  if (upward > 0 && downward === 0) return 'REVERSING UPWARD';
  if (downward > 0 && upward === 0) return 'REVERSING DOWNWARD';
  return 'NONE';
}

function foCountTrendReversals_(trends, status) {
  return trends.filter(function(item) {
    return item.reversalStatus === status;
  }).length;
}

function foNumericTrajectory_(values, threshold, inverse) {
  const usable = values.filter(function(value) {
    return value !== null && value !== '' && isFinite(Number(value));
  }).map(Number);
  if (usable.length < 2) return 'INSUFFICIENT HISTORY';

  const deltas = [];
  for (let index = 1; index < usable.length; index += 1) {
    let delta = usable[index] - usable[index - 1];
    if (inverse) delta = -delta;
    deltas.push(delta);
  }
  const material = deltas.map(function(delta) {
    if (delta >= threshold) return 1;
    if (delta <= -threshold) return -1;
    return 0;
  });
  if (usable.length >= 3) {
    const prior = material.slice(0, -1).reduce(function(sum, value) {
      return sum + value;
    }, 0);
    const latest = material[material.length - 1];
    if (prior > 0 && latest < 0) return 'REVERSING DOWNWARD';
    if (prior < 0 && latest > 0) return 'REVERSING UPWARD';
  }
  const positive = material.filter(function(value) { return value > 0; }).length;
  const negative = material.filter(function(value) { return value < 0; }).length;
  if (positive > negative && positive >= Math.ceil(material.length / 2)) {
    return 'IMPROVING';
  }
  if (negative > positive && negative >= Math.ceil(material.length / 2)) {
    return 'WEAKENING';
  }
  return 'STABLE';
}

function foRecommendationTrajectory_(series) {
  const priority = {
    'STRONG BUY': 6,
    BUY: 5,
    ACCUMULATE: 4,
    WATCH: 3,
    HOLD: 2,
    AVOID: 1
  };
  return foNumericTrajectory_(series.map(function(item) {
    return priority[item.recommendation] || 0;
  }), 1, false);
}

function foOverallTrajectory_(series) {
  if (series.length < 2) return 'INSUFFICIENT HISTORY';
  const values = series.map(function(item) {
    const recommendation = {
      'STRONG BUY': 30,
      BUY: 25,
      ACCUMULATE: 20,
      WATCH: 15,
      HOLD: 10,
      AVOID: 5
    }[item.recommendation] || 0;
    const quality = item.recommendationQualityScore === null
      ? 0 : item.recommendationQualityScore / 5;
    const distance = item.distancePct === null ? 0 : -item.distancePct * 20;
    return recommendation + item.conviction / 5 - item.risk / 5 +
      item.confidence / 5 + quality + distance;
  });
  const trajectory = foNumericTrajectory_(values, 2, false);
  if (trajectory === 'IMPROVING') return 'IMPROVING';
  if (trajectory === 'WEAKENING') return 'WEAKENING';
  return trajectory;
}

function foTrendEvidenceStrength_(count, overall, components) {
  if (count < 2) return 'INSUFFICIENT';
  if (count === 2) return 'PRELIMINARY';
  const directional = components.filter(function(value) {
    return value === 'IMPROVING' || value === 'WEAKENING' ||
      value.indexOf('REVERSING') === 0;
  });
  if (overall.indexOf('REVERSING') === 0) return count >= 4 ? 'HIGH' : 'MODERATE';
  if (count >= 4 && directional.length >= 3) return 'HIGH';
  if (directional.length >= 2) return 'MODERATE';
  return 'LOW';
}

function foTrajectoryRationale_(record) {
  if (record.overallTrajectory === 'INSUFFICIENT HISTORY') {
    return record.ticker + ' has insufficient history for sustained trend detection.';
  }
  const drivers = [];
  [
    ['recommendation', record.recommendationTrajectory],
    ['conviction', record.convictionTrajectory],
    ['risk', record.riskTrajectory],
    ['confidence', record.confidenceTrajectory],
    ['recommendation quality', record.recommendationQualityTrajectory]
  ].forEach(function(item) {
    if (item[1] !== 'STABLE' && item[1] !== 'INSUFFICIENT HISTORY') {
      drivers.push(item[0] + ' ' + item[1].toLowerCase());
    }
  });
  return record.ticker + ' is ' + record.overallTrajectory.toLowerCase() +
    ' across ' + record.observationCount + ' observations' +
    (drivers.length ? ', supported by ' + drivers.join(', ') : '') +
    '. Evidence strength: ' + record.trendEvidenceStrength + '.';
}

function foTrendTimestampValue_(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return isFinite(parsed) ? parsed : 0;
}

function foRunInvestmentTrendSmokeTest() {
  const dashboard = foDashboard_();

  if (
    !dashboard.getSheetByName(FO_SHEETS.INVESTMENT_DECISION_HISTORY) ||
    dashboard.getSheetByName(
      FO_SHEETS.INVESTMENT_DECISION_HISTORY
    ).getLastRow() < 2
  ) {
    foRunInvestmentDecisionSupport();
  }

  const result = foRunInvestmentTrendIntelligence();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_TRENDS
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Investment Trends was not generated.');
  }

  const headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0];

  [
    'Conviction Delta',
    'Risk Delta',
    'Confidence Delta',
    'Entry Trend',
    'Overall Trend',
    'Executive Comment',
    'Observation Count',
    'Recommendation Quality Trajectory',
    'Reversal Status',
    'Trend Evidence Strength',
    'Overall Trajectory',
    'Trajectory Rationale'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing trend column: ' + name);
    }
  });

  return result;
}
