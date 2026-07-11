/**
 * Investment Trend Intelligence Engine
 * Wave 2.5.1 — Trend Intelligence
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
  const snapshots = foLoadTrendSnapshots_(dashboard);

  return Object.keys(snapshots).map(function(key) {
    const pair = snapshots[key];
    return foBuildTrendRecord_(pair.current, pair.previous);
  }).sort(function(a, b) {
    return b.trendScore - a.trendScore;
  });
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
    eventType: foTrendVal_(row, headers, 'Event Type')
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
      : 0;

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
    eventType: current.eventType,
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
    'Baseline'
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
      item.distanceDelta,
      item.entryTrend,
      item.overallTrend,
      item.trendScore,
      item.eventType,
      item.executiveComment,
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

  const mostImproved = trends.length
    ? trends.slice().sort(function(a, b) {
        return b.trendScore - a.trendScore;
      })[0]
    : null;
  const biggestDeterioration = trends.length
    ? trends.slice().sort(function(a, b) {
        return a.trendScore - b.trendScore;
      })[0]
    : null;
  const largestConvictionIncrease = trends.length
    ? trends.slice().sort(function(a, b) {
        return b.convictionDelta - a.convictionDelta;
      })[0]
    : null;
  const largestRiskReduction = trends.length
    ? trends.slice().sort(function(a, b) {
        return a.riskDelta - b.riskDelta;
      })[0]
    : null;

  const rows = [
    ['Metric', 'Value', 'Details', 'Timestamp'],
    ['Improving Securities', improving.length, '', now],
    ['Stable Securities', stable.length, '', now],
    ['Weakening Securities', weakening.length, '', now],
    [
      'Most Improved Security',
      mostImproved ? mostImproved.ticker : '',
      mostImproved ? 'Trend score ' + mostImproved.trendScore : '',
      now
    ],
    [
      'Biggest Deterioration',
      biggestDeterioration ? biggestDeterioration.ticker : '',
      biggestDeterioration
        ? 'Trend score ' + biggestDeterioration.trendScore
        : '',
      now
    ],
    [
      'Largest Conviction Increase',
      largestConvictionIncrease ? largestConvictionIncrease.ticker : '',
      largestConvictionIncrease
        ? 'Delta ' + largestConvictionIncrease.convictionDelta
        : '',
      now
    ],
    [
      'Largest Risk Reduction',
      largestRiskReduction ? largestRiskReduction.ticker : '',
      largestRiskReduction
        ? 'Delta ' + largestRiskReduction.riskDelta
        : '',
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
    'Executive Comment'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing trend column: ' + name);
    }
  });

  return result;
}
