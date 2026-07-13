/**
 * Investment Decision Support Engine
 * Wave 2.5.3-A — Magnitude-Weighted Trend Scoring
 */

function foRunInvestmentDecisionSupport() {
  const module = 'InvestmentDecisionSupportEngine';

  try {
    foInfo_(module, 'Start', 'Investment decision support started.');

    const dashboard = foDashboard_();
    const results = foReadDecisionSupportInputs_(dashboard);
    const output = foBuildInvestmentDecisionSupport_(dashboard, results);

    foInfo_(
      module,
      'Complete',
      'Investment decision support completed. Decisions: ' +
        output.decisions.length
    );

    return {
      status: 'SUCCESS',
      decisions: output.decisions.length,
      materialDecisions: output.decisions.filter(function(item) {
        return item.materialityScore >= 60;
      }).length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foRunInvestmentDecisionSupportFromResults_(dashboard, results) {
  return foBuildInvestmentDecisionSupport_(dashboard, results);
}

function foReadDecisionSupportInputs_(dashboard) {
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
        foDecisionVal_(row, headers, 'Ticker') || ''
      ).trim().toUpperCase(),
      account: foDecisionVal_(row, headers, 'Account'),
      currentPrice: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Current Price')
      ),
      targetEntryPrice: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Target Entry Price')
      ),
      distancePct: foDecisionNullableNumber_(
        foDecisionVal_(row, headers, 'Distance to Entry %')
      ),
      zonePosition: foDecisionVal_(row, headers, 'Zone Position'),
      priceFreshness: foDecisionVal_(row, headers, 'Price Freshness'),
      convictionScore: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Conviction Score')
      ),
      riskScore: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Risk Score')
      ),
      confidence: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Buy Zone Confidence')
      ),
      recommendation: foDecisionVal_(
        row,
        headers,
        'Recommendation'
      ),
      portfolioWeight: foDecisionNumber_(
        foDecisionVal_(row, headers, 'Portfolio Weight')
      ),
      rationale:
        foDecisionVal_(row, headers, 'Recommendation Reason') ||
        foDecisionVal_(row, headers, 'Rationale')
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function foBuildInvestmentDecisionSupport_(dashboard, results) {
  const history = foLoadDecisionHistory_(dashboard);
  const materialityPolicy = foLoadMaterialityPolicy_(dashboard);

  const decisions = results.map(function(item) {
    return foBuildDecisionRecord_(
      item,
      history,
      materialityPolicy
    );
  }).sort(function(a, b) {
    return b.priorityScore - a.priorityScore;
  });

  // Producer order is intentional and regression-tested.
  foWriteDecisionSupport_(dashboard, decisions);
  foWriteMaterialityEvents_(dashboard, decisions);
  foAppendDecisionHistory_(dashboard, decisions);
  foRunInvestmentTrendIntelligence();

  return {
    decisions: decisions
  };
}

function foBuildDecisionRecord_(item, history, materialityPolicy) {
  const key = foDecisionKey_(item.ticker, item.account);
  const previous = history[key] || null;

  const convictionDelta = previous
    ? item.convictionScore - previous.convictionScore
    : 0;
  const riskDelta = previous
    ? item.riskScore - previous.riskScore
    : 0;
  const confidenceDelta = previous
    ? item.confidence - previous.confidence
    : 0;
  const distanceDelta = previous &&
    previous.distancePct !== null &&
    item.distancePct !== null
    ? item.distancePct - previous.distancePct
    : 0;

  const trend = foDecisionTrend_(
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta
  );
  const action = foDecisionAction_(item);
  const materialityAssessment = foCalculateMaterialityAssessment_(
    item,
    previous,
    convictionDelta,
    riskDelta,
    confidenceDelta,
    distanceDelta,
    action,
    materialityPolicy
  );
  const allocationBand = foDecisionAllocationBand_(item, action);
  const priorityScore = foDecisionPriority_(
    item,
    materialityAssessment.score,
    action
  );

  return {
    ticker: item.ticker,
    account: item.account,
    action: action,
    recommendation: item.recommendation,
    allocationBand: allocationBand,
    materialityScore: materialityAssessment.score,
    materialityLevel: materialityAssessment.level,
    materialityPrimaryDriver: materialityAssessment.primaryDriver,
    materialityDrivers: materialityAssessment.drivers.join(' | '),
    priorityScore: priorityScore,
    trend: trend,
    convictionScore: item.convictionScore,
    convictionDelta: convictionDelta,
    riskScore: item.riskScore,
    riskDelta: riskDelta,
    confidence: item.confidence,
    confidenceDelta: confidenceDelta,
    distancePct: item.distancePct,
    distanceDelta: distanceDelta,
    priceFreshness: item.priceFreshness,
    zonePosition: item.zonePosition,
    currentPrice: item.currentPrice,
    targetEntryPrice: item.targetEntryPrice,
    executiveReason: foDecisionExecutiveReason_(
      item,
      trend,
      materialityAssessment,
      allocationBand
    )
  };
}

function foDecisionAction_(item) {
  if (item.priceFreshness !== 'FRESH') return 'REFRESH DATA';
  if (item.recommendation === 'STRONG BUY') return 'DEPLOY NOW';
  if (item.recommendation === 'BUY') return 'BUY';
  if (item.recommendation === 'ACCUMULATE') return 'ACCUMULATE';
  if (item.recommendation === 'AVOID') return 'AVOID';
  if (item.recommendation === 'HOLD') return 'HOLD';
  return 'WATCH';
}

function foDecisionAllocationBand_(item, action) {
  if (
    action === 'REFRESH DATA' ||
    action === 'WATCH' ||
    action === 'HOLD' ||
    action === 'AVOID'
  ) {
    return '0%';
  }

  if (item.riskScore > 50 || item.confidence < 60) return '0-1%';
  if (item.convictionScore >= 90 && item.riskScore <= 25) return '3-5%';
  if (item.convictionScore >= 80 && item.riskScore <= 35) return '2-4%';
  return '1-2%';
}

function foDecisionTrend_(
  convictionDelta,
  riskDelta,
  confidenceDelta,
  distanceDelta
) {
  let points = 0;

  // Conviction magnitude.
  if (convictionDelta >= 20) {
    points += 3;
  } else if (convictionDelta >= 10) {
    points += 2;
  } else if (convictionDelta >= 5) {
    points += 1;
  } else if (convictionDelta <= -20) {
    points -= 3;
  } else if (convictionDelta <= -10) {
    points -= 2;
  } else if (convictionDelta <= -5) {
    points -= 1;
  }

  // Risk magnitude. Lower risk is positive; higher risk is negative.
  if (riskDelta <= -20) {
    points += 3;
  } else if (riskDelta <= -10) {
    points += 2;
  } else if (riskDelta <= -5) {
    points += 1;
  } else if (riskDelta >= 20) {
    points -= 3;
  } else if (riskDelta >= 10) {
    points -= 2;
  } else if (riskDelta >= 5) {
    points -= 1;
  }

  // Confidence magnitude.
  if (confidenceDelta >= 20) {
    points += 3;
  } else if (confidenceDelta >= 10) {
    points += 2;
  } else if (confidenceDelta >= 5) {
    points += 1;
  } else if (confidenceDelta <= -20) {
    points -= 3;
  } else if (confidenceDelta <= -10) {
    points -= 2;
  } else if (confidenceDelta <= -5) {
    points -= 1;
  }

  // Distance-to-entry magnitude. Moving closer is positive.
  if (distanceDelta <= -0.10) {
    points += 3;
  } else if (distanceDelta <= -0.05) {
    points += 2;
  } else if (distanceDelta <= -0.02) {
    points += 1;
  } else if (distanceDelta >= 0.10) {
    points -= 3;
  } else if (distanceDelta >= 0.05) {
    points -= 2;
  } else if (distanceDelta >= 0.02) {
    points -= 1;
  }

  if (points >= 2) return 'IMPROVING';
  if (points <= -2) return 'DETERIORATING';
  return 'STABLE';
}

function foDecisionPriority_(item, materialityScore, action) {
  const actionWeight = {
    'DEPLOY NOW': 100,
    BUY: 85,
    ACCUMULATE: 70,
    WATCH: 50,
    HOLD: 30,
    AVOID: 20,
    'REFRESH DATA': 10
  };

  return Math.round(
    (actionWeight[action] || 0) * 0.35 +
    item.convictionScore * 0.20 +
    (100 - item.riskScore) * 0.15 +
    item.confidence * 0.10 +
    materialityScore * 0.20
  );
}

function foDecisionExecutiveReason_(
  item,
  trend,
  materialityAssessment,
  allocationBand
) {
  const parts = [
    item.recommendation,
    'Trend ' + trend,
    'Materiality ' + materialityAssessment.score +
      ' (' + materialityAssessment.level + ')',
    'Driver ' + materialityAssessment.primaryDriver,
    'Conviction ' + item.convictionScore,
    'Risk ' + item.riskScore,
    'Allocation ' + allocationBand
  ];

  if (item.priceFreshness !== 'FRESH') {
    parts.push('Refresh price data');
  } else if (item.distancePct !== null) {
    parts.push(foDecisionPercent_(item.distancePct) + ' from target');
  }

  return parts.join(' | ');
}

function foLoadDecisionHistory_(dashboard) {
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_HISTORY,
    foDecisionHistoryHeaders_()
  );

  if (sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const history = {};

  for (let row = values.length - 1; row >= 1; row--) {
    const ticker = String(
      foDecisionVal_(values[row], headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foDecisionVal_(values[row], headers, 'Account') || ''
    ).trim();
    const key = foDecisionKey_(ticker, account);

    if (!ticker || history[key]) continue;

    const signature = String(
      foDecisionVal_(values[row], headers, 'State Signature') || ''
    );
    const signatureParts = signature.split('|');

    history[key] = {
      recommendation: foDecisionVal_(
        values[row],
        headers,
        'Recommendation'
      ),
      zonePosition: foDecisionVal_(
        values[row],
        headers,
        'Zone Position'
      ),
      convictionScore: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Conviction')
      ),
      riskScore: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Risk')
      ),
      confidence: foDecisionNumber_(
        foDecisionVal_(values[row], headers, 'Confidence')
      ),
      distancePct: foDecisionNullableNumber_(
        foDecisionVal_(values[row], headers, 'Distance to Entry %')
      ),
      action: foDecisionVal_(values[row], headers, 'Action'),
      priceFreshness: signatureParts.length
        ? signatureParts[signatureParts.length - 1]
        : ''
    };
  }

  return history;
}

function foDecisionSupportHeaders_() {
  return [
    'Rank',
    'Ticker',
    'Account',
    'Action',
    'Recommendation',
    'Allocation Band',
    'Materiality Score',
    'Materiality Level',
    'Materiality Primary Driver',
    'Materiality Drivers',
    'Priority Score',
    'Trend',
    'Conviction',
    'Conviction Delta',
    'Risk',
    'Risk Delta',
    'Confidence',
    'Confidence Delta',
    'Distance to Entry %',
    'Distance Delta',
    'Price Freshness',
    'Zone Position',
    'Current Price',
    'Target Entry Price',
    'Executive Reason',
    'Timestamp',
    'Platform Version',
    'Baseline'
  ];
}

function foWriteDecisionSupport_(dashboard, decisions) {
  const headers = foDecisionSupportHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const rows = decisions.map(function(item, index) {
    return [
      index + 1,
      item.ticker,
      item.account,
      item.action,
      item.recommendation,
      item.allocationBand,
      item.materialityScore,
      item.materialityLevel,
      item.materialityPrimaryDriver,
      item.materialityDrivers,
      item.priorityScore,
      item.trend,
      item.convictionScore,
      item.convictionDelta,
      item.riskScore,
      item.riskDelta,
      item.confidence,
      item.confidenceDelta,
      item.distancePct === null ? '' : item.distancePct,
      item.distanceDelta,
      item.priceFreshness,
      item.zonePosition,
      item.currentPrice,
      item.targetEntryPrice,
      item.executiveReason,
      now,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  const currentPriceColumn = headers.indexOf('Current Price') + 1;
  const targetEntryPriceColumn = headers.indexOf('Target Entry Price') + 1;

  if (currentPriceColumn < 1 || targetEntryPriceColumn < 1) {
    throw new Error(
      'Decision-support price columns are missing from the output contract.'
    );
  }

  // clearContents() preserves cell formatting. Earlier date formatting caused
  // valid numeric price serials to be returned as JavaScript Date objects.
  sheet.getRange(
    2,
    currentPriceColumn,
    Math.max(rows.length, 1),
    2
  ).setNumberFormat('#,##0.00');

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(
      2,
      currentPriceColumn,
      rows.length,
      2
    ).setNumberFormat('#,##0.00');
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');
  sheet.getRange(2, 19, Math.max(rows.length, 1), 2)
    .setNumberFormat('0.00%');
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(10, 440);
  sheet.setColumnWidth(25, 520);
}

function foAppendDecisionHistory_(dashboard, decisions) {
  const policy = foLoadDecisionHistoryPolicy_(dashboard);
  const sheet = foPrepareDecisionHistorySheet_(dashboard);
  const index = foLoadDecisionHistoryIndex_(sheet);
  const events = foSelectDecisionHistoryEvents_(
    decisions,
    index.latest,
    index.today,
    policy
  );

  const now = new Date();
  const rows = events.map(function(event) {
    const item = event.item;

    return [
      now,
      item.ticker,
      item.account,
      item.recommendation,
      item.zonePosition,
      item.convictionScore,
      item.riskScore,
      item.confidence,
      item.distancePct === null ? '' : item.distancePct,
      item.materialityScore,
      item.priorityScore,
      item.action,
      item.allocationBand,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      event.eventType,
      event.signature
    ];
  });

  if (rows.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      rows[0].length
    ).setValues(rows);
  }

  if (policy.maintainAfterAppend) {
    foMaintainDecisionHistory_(sheet, policy);
  }

  return {
    eligibleDecisions: decisions.length,
    appendedEvents: rows.length,
    skippedUnchanged: decisions.length - rows.length
  };
}

function foDecisionHistoryHeaders_() {
  return [
    'Timestamp',
    'Ticker',
    'Account',
    'Recommendation',
    'Zone Position',
    'Conviction',
    'Risk',
    'Confidence',
    'Distance to Entry %',
    'Materiality Score',
    'Priority Score',
    'Action',
    'Allocation Band',
    'Platform Version',
    'Baseline',
    'Event Type',
    'State Signature'
  ];
}

function foDecisionKey_(ticker, account) {
  return String(ticker || '').trim().toUpperCase() +
    '|' +
    String(account || '').trim().toUpperCase();
}

function foDecisionVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foDecisionNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foDecisionNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function foDecisionPercent_(value) {
  return (Math.round((Number(value) || 0) * 10000) / 100) + '%';
}

function foRunInvestmentDecisionSupportSmokeTest() {
  const dashboard = foDashboard_();
  const intelligence = dashboard.getSheetByName(
    FO_SHEETS.BUY_ZONE_INTELLIGENCE
  );

  if (!intelligence || intelligence.getLastRow() < 2) {
    foRunBuyZoneIntelligence();
  }

  const result = foRunInvestmentDecisionSupport();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );
  const events = dashboard.getSheetByName(
    FO_SHEETS.MATERIALITY_EVENTS
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Investment Decision Support was not generated.');
  }

  if (!events || events.getLastRow() < 2) {
    throw new Error('Materiality Events was not generated.');
  }

  const headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0];

  [
    'Materiality Score',
    'Materiality Level',
    'Materiality Primary Driver',
    'Materiality Drivers',
    'Trend',
    'Allocation Band',
    'Priority Score',
    'Current Price',
    'Target Entry Price'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing decision-support column: ' + name);
    }
  });

  foValidateDecisionSupportPriceIntegrityWave321_(sheet, headers);

  return result;
}

function foValidateDecisionSupportPriceIntegrityWave321_(sheet, headers) {
  const currentPriceColumn = headers.indexOf('Current Price') + 1;
  const targetEntryPriceColumn = headers.indexOf('Target Entry Price') + 1;
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);

  if (!rowCount) {
    throw new Error('Investment Decision Support contains no price rows.');
  }

  const priceRange = sheet.getRange(2, currentPriceColumn, rowCount, 2);
  const priceValues = priceRange.getValues();
  const numberFormats = priceRange.getNumberFormats();

  priceValues.forEach(function(row, rowIndex) {
    row.forEach(function(value, columnIndex) {
      const label = columnIndex === 0 ? 'Current Price' : 'Target Entry Price';
      const sheetRow = rowIndex + 2;

      if (value instanceof Date) {
        throw new Error(label + ' contains Date object at row ' + sheetRow);
      }

      if (value !== '' && value !== null && typeof value !== 'number') {
        throw new Error(
          label + ' is not numeric at row ' + sheetRow + ': ' + typeof value
        );
      }

      if (typeof value === 'number' && (!isFinite(value) || value < 0)) {
        throw new Error(label + ' contains invalid numeric value at row ' + sheetRow);
      }

      const format = String(numberFormats[rowIndex][columnIndex] || '').toLowerCase();
      if (format.indexOf('yy') >= 0 || format.indexOf('dd') >= 0) {
        throw new Error(
          label + ' retains date formatting at row ' + sheetRow + ': ' + format
        );
      }
    });
  });

  return {
    status: 'PASS',
    rowsValidated: rowCount,
    priceColumnsValidated: 2
  };
}
