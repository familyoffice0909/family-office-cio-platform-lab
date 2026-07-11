/**
 * Buy Zone Executive Dashboard Engine
 * Wave 2.4.1-E — Executive Buy Zone Dashboard
 */

function foRunBuyZoneExecutiveDashboard() {
  const module = 'BuyZoneExecutiveDashboardEngine';

  try {
    foInfo_(module, 'Start', 'Executive Buy Zone Dashboard started.');

    const dashboard = foDashboard_();
    const results = foReadBuyZoneIntelligenceResults_(dashboard);

    foWriteBuyZoneExecutiveDashboard_(dashboard, results);

    foInfo_(
      module,
      'Complete',
      'Executive Buy Zone Dashboard completed. Results: ' + results.length
    );

    return {
      status: 'SUCCESS',
      positionsEvaluated: results.length,
      actionableCandidates: results.filter(function(item) {
        return item.recommendation === 'STRONG BUY' ||
          item.recommendation === 'BUY' ||
          item.recommendation === 'ACCUMULATE';
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foReadBuyZoneIntelligenceResults_(dashboard) {
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
      ticker: foExecutiveVal_(row, headers, 'Ticker'),
      company: foExecutiveVal_(row, headers, 'Company'),
      account: foExecutiveVal_(row, headers, 'Account'),
      currentPrice: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Current Price')
      ),
      targetEntryPrice: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Target Entry Price')
      ),
      zonePosition: foExecutiveVal_(row, headers, 'Zone Position'),
      distancePct: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Distance to Entry %')
      ),
      priceFreshness: foExecutiveVal_(
        row,
        headers,
        'Price Freshness'
      ),
      convictionScore: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Conviction Score')
      ),
      riskScore: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Risk Score')
      ),
      confidence: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Buy Zone Confidence')
      ),
      recommendation: foExecutiveVal_(
        row,
        headers,
        'Recommendation'
      ),
      recommendationReason:
        foExecutiveVal_(row, headers, 'Recommendation Reason') ||
        foExecutiveVal_(row, headers, 'Rationale')
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function foWriteBuyZoneExecutiveDashboard_(dashboard, results) {
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY,
    ['Section', 'Metric', 'Value', 'Details', 'Timestamp']
  );

  sheet.clear();

  const rows = foBuildBuyZoneExecutiveRows_(results);

  sheet.getRange(
    1,
    1,
    rows.length,
    rows[0].length
  ).setValues(rows);

  foFormatBuyZoneExecutiveDashboard_(sheet, rows.length);
}

function foBuildBuyZoneExecutiveRows_(results) {
  const now = new Date();
  const counts = foBuyZoneRecommendationCounts_(results);
  const actionable = results.filter(function(item) {
    return item.recommendation === 'STRONG BUY' ||
      item.recommendation === 'BUY' ||
      item.recommendation === 'ACCUMULATE';
  });

  const ranked = results.slice().sort(function(a, b) {
    return foExecutiveOpportunityScore_(b) -
      foExecutiveOpportunityScore_(a);
  });

  const averageConviction = foExecutiveAverage_(
    results,
    'convictionScore'
  );
  const averageRisk = foExecutiveAverage_(results, 'riskScore');
  const averageConfidence = foExecutiveAverage_(
    results,
    'confidence'
  );

  const highestConviction = foExecutiveHighest_(
    results,
    'convictionScore'
  );
  const lowestRisk = foExecutiveLowest_(results, 'riskScore');
  const closestToEntry = foExecutiveClosestToEntry_(results);

  const rows = [
    [
      'EXECUTIVE SUMMARY',
      'Metric',
      'Value',
      'Details',
      'Timestamp'
    ],
    ['OVERVIEW', 'Positions Evaluated', results.length, '', now],
    [
      'OVERVIEW',
      'Actionable Candidates',
      actionable.length,
      'STRONG BUY + BUY + ACCUMULATE',
      now
    ],
    [
      'OVERVIEW',
      'Positions In Buy Zone',
      results.filter(function(item) {
        return item.zonePosition === 'IN BUY ZONE';
      }).length,
      '',
      now
    ],
    [
      'OVERVIEW',
      'Fresh Prices',
      results.filter(function(item) {
        return item.priceFreshness === 'FRESH';
      }).length,
      '',
      now
    ],
    [
      'OVERVIEW',
      'Stale Prices',
      results.filter(function(item) {
        return item.priceFreshness === 'STALE';
      }).length,
      '',
      now
    ],
    [
      'OVERVIEW',
      'Missing Prices',
      results.filter(function(item) {
        return item.priceFreshness === 'MISSING';
      }).length,
      '',
      now
    ],
    ['RECOMMENDATIONS', 'STRONG BUY', counts['STRONG BUY'], '', now],
    ['RECOMMENDATIONS', 'BUY', counts.BUY, '', now],
    ['RECOMMENDATIONS', 'ACCUMULATE', counts.ACCUMULATE, '', now],
    ['RECOMMENDATIONS', 'WATCH', counts.WATCH, '', now],
    ['RECOMMENDATIONS', 'HOLD', counts.HOLD, '', now],
    ['RECOMMENDATIONS', 'AVOID', counts.AVOID, '', now],
    [
      'SCORES',
      'Average Conviction',
      averageConviction,
      '0-100',
      now
    ],
    ['SCORES', 'Average Risk', averageRisk, '0-100', now],
    [
      'SCORES',
      'Average Buy Zone Confidence',
      averageConfidence,
      '0-100',
      now
    ],
    [
      'LEADERS',
      'Highest Conviction Candidate',
      highestConviction ? highestConviction.ticker : '',
      highestConviction
        ? 'Conviction ' + highestConviction.convictionScore
        : '',
      now
    ],
    [
      'LEADERS',
      'Lowest Risk Candidate',
      lowestRisk ? lowestRisk.ticker : '',
      lowestRisk ? 'Risk ' + lowestRisk.riskScore : '',
      now
    ],
    [
      'LEADERS',
      'Closest to Entry',
      closestToEntry ? closestToEntry.ticker : '',
      closestToEntry
        ? foExecutivePercent_(closestToEntry.distancePct)
        : '',
      now
    ],
    ['', '', '', '', ''],
    [
      'OPPORTUNITY RANKING',
      'Ticker',
      'Recommendation',
      'Conviction / Risk / Confidence',
      'Timestamp'
    ]
  ];

  ranked.slice(0, 10).forEach(function(item, index) {
    rows.push([
      'RANK ' + (index + 1),
      item.ticker,
      item.recommendation,
      item.convictionScore +
        ' / ' +
        item.riskScore +
        ' / ' +
        item.confidence,
      now
    ]);
  });

  rows.push(['', '', '', '', '']);
  rows.push([
    'CAPITAL DEPLOYMENT QUEUE',
    'Priority',
    'Ticker',
    'Recommendation',
    'Rationale'
  ]);

  foBuildCapitalDeploymentQueue_(ranked).forEach(function(item) {
    rows.push([
      'QUEUE',
      item.priority,
      item.ticker,
      item.recommendation,
      item.reason
    ]);
  });

  rows.push(['', '', '', '', '']);
  rows.push([
    'PLATFORM',
    'Platform Version',
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.RELEASE_NAME,
    now
  ]);
  rows.push([
    'PLATFORM',
    'Baseline',
    FO_CONFIG.BASELINE,
    FO_CONFIG.ENVIRONMENT,
    now
  ]);

  return rows;
}

function foBuyZoneRecommendationCounts_(results) {
  const counts = {
    'STRONG BUY': 0,
    BUY: 0,
    ACCUMULATE: 0,
    WATCH: 0,
    HOLD: 0,
    AVOID: 0
  };

  results.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(
      counts,
      item.recommendation
    )) {
      counts[item.recommendation] += 1;
    }
  });

  return counts;
}

function foExecutiveOpportunityScore_(item) {
  const recommendationPriority = {
    'STRONG BUY': 100,
    BUY: 85,
    ACCUMULATE: 70,
    WATCH: 50,
    HOLD: 25,
    AVOID: 0
  };

  return (
    (recommendationPriority[item.recommendation] || 0) * 0.35 +
    item.convictionScore * 0.30 +
    (100 - item.riskScore) * 0.20 +
    item.confidence * 0.15
  );
}

function foBuildCapitalDeploymentQueue_(ranked) {
  return ranked.slice(0, 10).map(function(item) {
    let priority = 'HOLD';

    if (item.recommendation === 'STRONG BUY') {
      priority = 'DEPLOY NOW';
    } else if (item.recommendation === 'BUY') {
      priority = 'BUY SOON';
    } else if (item.recommendation === 'ACCUMULATE') {
      priority = 'ACCUMULATE';
    } else if (item.recommendation === 'WATCH') {
      priority = 'WATCH';
    } else if (item.recommendation === 'AVOID') {
      priority = 'AVOID';
    }

    return {
      priority: priority,
      ticker: item.ticker,
      recommendation: item.recommendation,
      reason: item.recommendationReason ||
        ('Conviction ' + item.convictionScore +
          ', Risk ' + item.riskScore)
    };
  });
}

function foExecutiveAverage_(items, field) {
  if (!items.length) return 0;

  const total = items.reduce(function(sum, item) {
    return sum + (Number(item[field]) || 0);
  }, 0);

  return Math.round((total / items.length) * 100) / 100;
}

function foExecutiveHighest_(items, field) {
  if (!items.length) return null;

  return items.slice().sort(function(a, b) {
    return (Number(b[field]) || 0) - (Number(a[field]) || 0);
  })[0];
}

function foExecutiveLowest_(items, field) {
  if (!items.length) return null;

  return items.slice().sort(function(a, b) {
    return (Number(a[field]) || 0) - (Number(b[field]) || 0);
  })[0];
}

function foExecutiveClosestToEntry_(items) {
  const available = items.filter(function(item) {
    return item.distancePct !== '' &&
      item.targetEntryPrice > 0 &&
      item.currentPrice > 0;
  });

  if (!available.length) return null;

  return available.slice().sort(function(a, b) {
    return Math.abs(a.distancePct) - Math.abs(b.distancePct);
  })[0];
}

function foExecutiveVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foExecutiveNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foExecutivePercent_(value) {
  return (Math.round((Number(value) || 0) * 10000) / 100) + '%';
}

function foFormatBuyZoneExecutiveDashboard_(sheet, rowCount) {
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);

  sheet.getRange(1, 1, 1, 5)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  const values = sheet.getRange(1, 1, rowCount, 1).getValues();

  for (let row = 1; row <= rowCount; row++) {
    const section = String(values[row - 1][0] || '');

    if (
      section === 'OPPORTUNITY RANKING' ||
      section === 'CAPITAL DEPLOYMENT QUEUE'
    ) {
      sheet.getRange(row, 1, 1, 5)
        .setFontWeight('bold')
        .setBackground('#d9eaf7');
    }
  }
}

function foRunBuyZoneExecutiveDashboardSmokeTest() {
  const dashboard = foDashboard_();
  const intelligence = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_INTELLIGENCE
  );

  if (!intelligence || intelligence.getLastRow() < 2) {
    foRunBuyZoneIntelligence();
  }

  const result = foRunBuyZoneExecutiveDashboard();
  const summary = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_EXECUTIVE_SUMMARY
  );

  if (!summary || summary.getLastRow() < 10) {
    throw new Error(
      'Executive Buy Zone Dashboard was not generated correctly.'
    );
  }

  const values = summary.getDataRange().getValues();
  const text = values.map(function(row) {
    return row.join('|');
  }).join('\n');

  [
    'Actionable Candidates',
    'Average Conviction',
    'OPPORTUNITY RANKING',
    'CAPITAL DEPLOYMENT QUEUE'
  ].forEach(function(requiredText) {
    if (text.indexOf(requiredText) === -1) {
      throw new Error(
        'Missing executive dashboard section: ' + requiredText
      );
    }
  });

  return result;
}
