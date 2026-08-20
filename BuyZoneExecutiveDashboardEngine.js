/**
 * Buy Zone Executive Dashboard Engine
 * Wave 2.4.1-F — Executive Dashboard Refinement
 */

function foRunBuyZoneExecutiveDashboard() {
  const module = 'BuyZoneExecutiveDashboardEngine';

  try {
    foInfo_(module, 'Start', 'Executive Buy Zone Dashboard started.');

    const dashboard = foDashboard_();
    const rawResults = foReadBuyZoneIntelligenceResults_(dashboard);
    const results = foConsolidateExecutiveResults_(rawResults);

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
        return foIsExecutiveActionable_(item.recommendation);
      }).length,
      deploymentReadiness: foExecutiveDeploymentReadiness_(results)
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
      ticker: String(
        foExecutiveVal_(row, headers, 'Ticker') || ''
      ).trim().toUpperCase(),
      company: foExecutiveVal_(row, headers, 'Company'),
      account: foExecutiveVal_(row, headers, 'Account'),
      currentPrice: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Current Price')
      ),
      targetEntryPrice: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Target Entry Price')
      ),
      targetDiscountPct: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Target Discount %')
      ),
      zonePosition: foExecutiveVal_(row, headers, 'Zone Position'),
      distancePct: foExecutiveNullableNumber_(
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
      dataQualityScore: foExecutiveNumber_(
        foExecutiveVal_(row, headers, 'Data Quality Score')
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

function foConsolidateExecutiveResults_(results) {
  const groups = {};

  results.forEach(function(item) {
    if (!groups[item.ticker]) groups[item.ticker] = [];
    groups[item.ticker].push(item);
  });

  return Object.keys(groups).map(function(ticker) {
    const items = groups[ticker];
    const representative = items.slice().sort(function(a, b) {
      return foExecutiveOpportunityScore_(b) -
        foExecutiveOpportunityScore_(a);
    })[0];

    return {
      ticker: ticker,
      company: representative.company,
      account: foExecutiveAccounts_(items),
      currentPrice: representative.currentPrice,
      targetEntryPrice: representative.targetEntryPrice,
      targetDiscountPct: foExecutiveAverageNullable_(
        items,
        'targetDiscountPct'
      ),
      zonePosition: representative.zonePosition,
      distancePct: foExecutiveClosestDistance_(items),
      priceFreshness: foExecutiveWorstFreshness_(items),
      convictionScore: foExecutiveAverage_(items, 'convictionScore'),
      riskScore: foExecutiveAverage_(items, 'riskScore'),
      dataQualityScore: foExecutiveAverage_(items, 'dataQualityScore'),
      confidence: foExecutiveAverage_(items, 'confidence'),
      recommendation: foExecutiveBestRecommendation_(items),
      recommendationReason: foExecutiveShortReason_(representative),
      accountCount: items.length
    };
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

  foFormatBuyZoneExecutiveDashboard_(sheet, rows);
}

function foBuildBuyZoneExecutiveRows_(results) {
  const now = new Date();
  const counts = foBuyZoneRecommendationCounts_(results);
  const actionable = results.filter(function(item) {
    return foIsExecutiveActionable_(item.recommendation);
  });

  const ranked = results.slice().sort(function(a, b) {
    return foExecutiveOpportunityScore_(b) -
      foExecutiveOpportunityScore_(a);
  });

  const fresh = results.filter(function(item) {
    return item.priceFreshness === 'FRESH';
  }).length;
  const stale = results.filter(function(item) {
    return item.priceFreshness === 'STALE';
  }).length;
  const missing = results.filter(function(item) {
    return item.priceFreshness === 'MISSING';
  }).length;
  const validPricing = results.length - missing;
  const priceCoverage = results.length
    ? validPricing / results.length
    : 0;
  const freshnessCoverage = results.length
    ? fresh / results.length
    : 0;

  const averageConviction = foExecutiveAverage_(
    results,
    'convictionScore'
  );
  const averageRisk = foExecutiveAverage_(results, 'riskScore');
  const averageConfidence = foExecutiveAverage_(
    results,
    'confidence'
  );
  const averageDistance = foExecutiveAverageNullable_(
    results,
    'distancePct'
  );
  const averageTargetDiscount = foExecutiveAverageNullable_(
    results,
    'targetDiscountPct'
  );
  const averageDataQuality = foExecutiveAverage_(
    results,
    'dataQualityScore'
  );

  const highestConviction = foExecutiveHighest_(
    results,
    'convictionScore'
  );
  const lowestRisk = foExecutiveLowest_(results, 'riskScore');
  const closestToEntry = foExecutiveClosestToEntry_(results);
  const readiness = foExecutiveDeploymentReadiness_(results);
  const dataQualityStatus = foExecutiveDataQualityStatus_(
    averageDataQuality
  );
  const freshnessStatus = foExecutiveFreshnessStatus_(
    fresh,
    stale,
    missing,
    results.length
  );
  const executiveMessage = foExecutiveDeploymentMessage_(
    results,
    actionable.length,
    readiness
  );

  const rows = [
    [
      'EXECUTIVE SUMMARY',
      'Metric',
      'Value',
      'Details',
      'Timestamp'
    ],
    [
      'STATUS',
      'Capital Deployment Readiness',
      readiness,
      executiveMessage,
      now
    ],
    [
      'STATUS',
      'Price Freshness Status',
      freshnessStatus,
      fresh + ' fresh / ' + stale + ' stale / ' + missing + ' missing',
      now
    ],
    [
      'STATUS',
      'Data Quality Status',
      dataQualityStatus,
      'Average score ' + averageDataQuality,
      now
    ],
    ['OVERVIEW', 'Unique Securities Evaluated', results.length, '', now],
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
      'Buy Zone Coverage',
      priceCoverage,
      'Securities with usable current prices',
      now
    ],
    [
      'OVERVIEW',
      'Fresh Price Coverage',
      freshnessCoverage,
      'Fresh prices divided by unique securities',
      now
    ],
    ['OVERVIEW', 'Stale Prices', stale, '', now],
    ['OVERVIEW', 'Missing Prices', missing, '', now],
    ['RECOMMENDATIONS', 'STRONG BUY', counts['STRONG BUY'], '', now],
    ['RECOMMENDATIONS', 'BUY', counts.BUY, '', now],
    ['RECOMMENDATIONS', 'ACCUMULATE', counts.ACCUMULATE, '', now],
    ['RECOMMENDATIONS', 'WATCH', counts.WATCH, '', now],
    ['RECOMMENDATIONS', 'HOLD', counts.HOLD, '', now],
    ['RECOMMENDATIONS', 'AVOID', counts.AVOID, '', now],
    ['RECOMMENDATIONS', 'DO NOT ADD', counts['DO NOT ADD'], '', now],
    ['SCORES', 'Average Conviction', averageConviction, '0-100', now],
    ['SCORES', 'Average Risk', averageRisk, '0-100', now],
    [
      'SCORES',
      'Average Buy Zone Confidence',
      averageConfidence,
      '0-100',
      now
    ],
    [
      'SCORES',
      'Average Distance to Entry',
      averageDistance,
      'Negative means below target',
      now
    ],
    [
      'SCORES',
      'Average Target Discount',
      averageTargetDiscount,
      'Configured target discount',
      now
    ],
    [
      'LEADERS',
      'Highest Conviction Candidate',
      foExecutiveLabel_(highestConviction),
      highestConviction
        ? 'Conviction ' + highestConviction.convictionScore
        : '',
      now
    ],
    [
      'LEADERS',
      'Lowest Risk Candidate',
      foExecutiveLabel_(lowestRisk),
      lowestRisk ? 'Risk ' + lowestRisk.riskScore : '',
      now
    ],
    [
      'LEADERS',
      'Closest to Entry',
      foExecutiveLabel_(closestToEntry),
      closestToEntry
        ? foExecutivePercent_(closestToEntry.distancePct)
        : '',
      now
    ],
    ['', '', '', '', ''],
    [
      'OPPORTUNITY RANKING',
      'Security / Account',
      'Recommendation',
      'Conviction / Risk / Confidence',
      'Executive Rationale'
    ]
  ];

  ranked.slice(0, 10).forEach(function(item, index) {
    rows.push([
      'RANK ' + (index + 1),
      foExecutiveLabel_(item),
      item.recommendation,
      item.convictionScore +
        ' / ' +
        item.riskScore +
        ' / ' +
        item.confidence,
      foExecutiveShortReason_(item)
    ]);
  });

  rows.push(['', '', '', '', '']);
  rows.push([
    'CAPITAL DEPLOYMENT QUEUE',
    'Priority',
    'Security / Account',
    'Recommendation',
    'Executive Rationale'
  ]);

  const queue = foBuildCapitalDeploymentQueue_(ranked);

  if (!queue.length) {
    rows.push([
      'QUEUE',
      'NO DEPLOYMENT',
      '',
      'HOLD',
      executiveMessage
    ]);
  } else {
    queue.forEach(function(item) {
      rows.push([
        'QUEUE',
        item.priority,
        item.label,
        item.recommendation,
        item.reason
      ]);
    });
  }

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
    AVOID: 0,
    'DO NOT ADD': 0
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
  return ranked.filter(function(item) {
    return foIsExecutiveActionable_(item.recommendation) &&
      item.priceFreshness === 'FRESH';
  }).slice(0, 10).map(function(item) {
    let priority = 'ACCUMULATE';

    if (item.recommendation === 'STRONG BUY') {
      priority = 'DEPLOY NOW';
    } else if (item.recommendation === 'BUY') {
      priority = 'BUY SOON';
    }

    return {
      priority: priority,
      label: foExecutiveLabel_(item),
      recommendation: item.recommendation,
      reason: foExecutiveShortReason_(item)
    };
  });
}

function foExecutiveDeploymentReadiness_(results) {
  const actionableFresh = results.filter(function(item) {
    return foIsExecutiveActionable_(item.recommendation) &&
      item.priceFreshness === 'FRESH';
  }).length;

  const missingOrStale = results.filter(function(item) {
    return item.priceFreshness === 'MISSING' ||
      item.priceFreshness === 'STALE';
  }).length;

  if (actionableFresh > 0) return 'READY';
  if (missingOrStale > 0) return 'NOT READY';
  return 'MONITOR';
}

function foExecutiveDeploymentMessage_(
  results,
  actionableCount,
  readiness
) {
  if (readiness === 'READY') {
    return actionableCount +
      ' actionable candidate(s) supported by fresh pricing.';
  }

  const staleOrMissing = results.filter(function(item) {
    return item.priceFreshness === 'STALE' ||
      item.priceFreshness === 'MISSING';
  }).length;

  if (staleOrMissing > 0) {
    return 'No capital deployment recommended. Refresh market prices ' +
      'before evaluating new positions.';
  }

  return 'No actionable deployment candidate. Continue monitoring.';
}

function foExecutiveFreshnessStatus_(
  fresh,
  stale,
  missing,
  total
) {
  if (!total || missing === total) return 'POOR';
  if (fresh === total) return 'EXCELLENT';
  if (fresh / total >= 0.75 && missing === 0) return 'GOOD';
  if (stale + missing <= total / 2) return 'FAIR';
  return 'POOR';
}

function foExecutiveDataQualityStatus_(score) {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GOOD';
  if (score >= 70) return 'FAIR';
  return 'POOR';
}

function foExecutiveShortReason_(item) {
  if (!item) return '';

  const parts = [];

  if (item.priceFreshness !== 'FRESH') {
    parts.push('Price ' + String(item.priceFreshness).toLowerCase());
  }

  if (item.distancePct !== null) {
    parts.push(
      foExecutivePercent_(item.distancePct) + ' from target'
    );
  }

  parts.push('Conviction ' + item.convictionScore);
  parts.push('Risk ' + item.riskScore);

  return parts.join(' | ');
}

function foExecutiveAccounts_(items) {
  const unique = {};

  items.forEach(function(item) {
    const account = String(item.account || 'N/A').trim() || 'N/A';
    unique[account] = true;
  });

  return Object.keys(unique).join(', ');
}

function foExecutiveLabel_(item) {
  if (!item) return '';

  const account = String(item.account || '').trim();
  return account
    ? item.ticker + ' — ' + account
    : item.ticker;
}

function foExecutiveWorstFreshness_(items) {
  const priority = {
    FRESH: 0,
    UNKNOWN: 1,
    STALE: 2,
    MISSING: 3
  };

  return items.slice().sort(function(a, b) {
    return (priority[b.priceFreshness] || 0) -
      (priority[a.priceFreshness] || 0);
  })[0].priceFreshness;
}

function foExecutiveBestRecommendation_(items) {
  const priority = {
    'STRONG BUY': 6,
    BUY: 5,
    ACCUMULATE: 4,
    WATCH: 3,
    HOLD: 2,
    AVOID: 1
  };

  return items.slice().sort(function(a, b) {
    return (priority[b.recommendation] || 0) -
      (priority[a.recommendation] || 0);
  })[0].recommendation;
}

function foIsExecutiveActionable_(recommendation) {
  return recommendation === 'STRONG BUY' ||
    recommendation === 'BUY' ||
    recommendation === 'ACCUMULATE';
}

function foExecutiveAverage_(items, field) {
  if (!items.length) return 0;

  const total = items.reduce(function(sum, item) {
    return sum + (Number(item[field]) || 0);
  }, 0);

  return Math.round((total / items.length) * 100) / 100;
}

function foExecutiveAverageNullable_(items, field) {
  const values = items.map(function(item) {
    return item[field];
  }).filter(function(value) {
    return value !== null && value !== '' && isFinite(Number(value));
  });

  if (!values.length) return 0;

  const total = values.reduce(function(sum, value) {
    return sum + Number(value);
  }, 0);

  return Math.round((total / values.length) * 1000000) / 1000000;
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

function foExecutiveClosestDistance_(items) {
  const values = items.map(function(item) {
    return item.distancePct;
  }).filter(function(value) {
    return value !== null && isFinite(Number(value));
  });

  if (!values.length) return null;

  return values.slice().sort(function(a, b) {
    return Math.abs(a) - Math.abs(b);
  })[0];
}

function foExecutiveClosestToEntry_(items) {
  const available = items.filter(function(item) {
    return item.distancePct !== null &&
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

function foExecutiveNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function foExecutivePercent_(value) {
  return (Math.round((Number(value) || 0) * 10000) / 100) + '%';
}

function foFormatBuyZoneExecutiveDashboard_(sheet, rows) {
  const rowCount = rows.length;

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 280);
  sheet.setColumnWidth(5, 360);

  sheet.getRange(1, 1, 1, 5)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  sheet.getRange(1, 1, rowCount, 5)
    .setVerticalAlignment('middle');

  const firstColumn = sheet.getRange(1, 1, rowCount, 1).getValues();

  for (let row = 1; row <= rowCount; row++) {
    const section = String(firstColumn[row - 1][0] || '');

    if (
      section === 'OPPORTUNITY RANKING' ||
      section === 'CAPITAL DEPLOYMENT QUEUE'
    ) {
      sheet.getRange(row, 1, 1, 5)
        .setFontWeight('bold')
        .setBackground('#d9eaf7');
    }

    if (section === 'STATUS') {
      sheet.getRange(row, 1, 1, 5)
        .setFontWeight('bold')
        .setBackground('#fff2cc');
    }
  }

  const statusRange = sheet.getRange(2, 3, 3, 1);
  const statusRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('READY')
      .setBackground('#d9ead3')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('NOT READY')
      .setBackground('#f4cccc')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('MONITOR')
      .setBackground('#fff2cc')
      .setRanges([statusRange])
      .build()
  ];

  sheet.setConditionalFormatRules(statusRules);

  for (let row = 1; row <= rowCount; row++) {
    const metric = String(rows[row - 1][1] || '');

    if (
      metric === 'Buy Zone Coverage' ||
      metric === 'Fresh Price Coverage' ||
      metric === 'Average Distance to Entry' ||
      metric === 'Average Target Discount'
    ) {
      sheet.getRange(row, 3).setNumberFormat('0.00%');
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

  if (!summary || summary.getLastRow() < 15) {
    throw new Error(
      'Refined Executive Buy Zone Dashboard was not generated correctly.'
    );
  }

  const values = summary.getDataRange().getValues();
  const text = values.map(function(row) {
    return row.join('|');
  }).join('\n');

  [
    'Capital Deployment Readiness',
    'Price Freshness Status',
    'Buy Zone Coverage',
    'OPPORTUNITY RANKING',
    'CAPITAL DEPLOYMENT QUEUE'
  ].forEach(function(requiredText) {
    if (text.indexOf(requiredText) === -1) {
      throw new Error(
        'Missing refined dashboard section: ' + requiredText
      );
    }
  });

  return result;
}
