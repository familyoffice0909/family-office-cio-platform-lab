/**
 * Portfolio Materiality Engine
 * Wave 2.6.0-A — Portfolio-Level Materiality Intelligence
 */

function foRunPortfolioMaterialityEngine() {
  const module = 'PortfolioMaterialityEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio materiality calculation started.');

    const dashboard = foDashboard_();
    const securityEvents = foReadPortfolioMaterialityEvents_(dashboard);
    const decisionSupport = foReadPortfolioPriorityDecisions_(dashboard);
    const assessment = foCalculatePortfolioMateriality_(
      securityEvents,
      decisionSupport
    );

    foWritePortfolioMateriality_(dashboard, assessment);
    foAppendPortfolioMaterialityHistory_(dashboard, assessment);

    foInfo_(
      module,
      'Complete',
      'Portfolio materiality completed. Score: ' +
        assessment.score + ' (' + assessment.level + ')'
    );

    return {
      status: 'SUCCESS',
      score: assessment.score,
      level: assessment.level,
      materialSecurities: assessment.materialSecurities,
      primaryDriver: assessment.primaryDriver
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foReadPortfolioMaterialityEvents_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.MATERIALITY_EVENTS);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  return values.slice(1).map(function(row) {
    return {
      ticker: String(
        foPortfolioMaterialityVal_(row, headers, 'Ticker') || ''
      ).trim().toUpperCase(),
      account: String(
        foPortfolioMaterialityVal_(row, headers, 'Account') || ''
      ).trim(),
      score: foPortfolioMaterialityNumber_(
        foPortfolioMaterialityVal_(row, headers, 'Materiality Score')
      ),
      level: String(
        foPortfolioMaterialityVal_(row, headers, 'Materiality Level') || ''
      ).trim(),
      primaryDriver: String(
        foPortfolioMaterialityVal_(row, headers, 'Primary Driver') || ''
      ).trim(),
      allDrivers: String(
        foPortfolioMaterialityVal_(row, headers, 'All Drivers') || ''
      ).trim(),
      recommendation: String(
        foPortfolioMaterialityVal_(row, headers, 'Recommendation') || ''
      ).trim(),
      action: String(
        foPortfolioMaterialityVal_(row, headers, 'Action') || ''
      ).trim(),
      trend: String(
        foPortfolioMaterialityVal_(row, headers, 'Trend') || ''
      ).trim(),
      priceFreshness: String(
        foPortfolioMaterialityVal_(row, headers, 'Price Freshness') || ''
      ).trim()
    };
  }).filter(function(item) {
    return item.ticker;
  });
}


function foReadPortfolioPriorityDecisions_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(function(row) {
    return {
      ticker: String(foPortfolioMaterialityVal_(row, headers, 'Ticker') || '').trim().toUpperCase(),
      account: String(foPortfolioMaterialityVal_(row, headers, 'Account') || '').trim(),
      priorityScore: foPortfolioMaterialityNumber_(foPortfolioMaterialityVal_(row, headers, 'Priority Score')),
      priorityLevel: String(foPortfolioMaterialityVal_(row, headers, 'Priority Level') || '').trim().toUpperCase(),
      significantChange: String(foPortfolioMaterialityVal_(row, headers, 'Significant Change') || '').trim().toUpperCase(),
      attentionType: String(foPortfolioMaterialityVal_(row, headers, 'Attention Type') || '').trim().toUpperCase(),
      overallTrajectory: String(foPortfolioMaterialityVal_(row, headers, 'Overall Trajectory') || '').trim().toUpperCase(),
      reversalStatus: String(foPortfolioMaterialityVal_(row, headers, 'Reversal Status') || '').trim().toUpperCase(),
      evidenceStrength: String(foPortfolioMaterialityVal_(row, headers, 'Trend Evidence Strength') || '').trim().toUpperCase()
    };
  }).filter(function(item) { return item.ticker; });
}

function foCalculatePortfolioMateriality_(events, decisions) {
  const sorted = events.slice().sort(function(a, b) {
    return b.score - a.score;
  });

  const materialEvents = sorted.filter(function(item) {
    return item.score >= 20;
  });
  const significantEvents = sorted.filter(function(item) {
    return item.score >= 40;
  });
  const criticalEvents = sorted.filter(function(item) {
    return item.score >= 70;
  });
  const staleCount = sorted.filter(function(item) {
    return item.priceFreshness === 'STALE' ||
      item.priceFreshness === 'MISSING';
  }).length;
  const deterioratingCount = sorted.filter(function(item) {
    return item.trend === 'DETERIORATING';
  }).length;
  const improvingCount = sorted.filter(function(item) {
    return item.trend === 'IMPROVING';
  }).length;

  const topScores = sorted.slice(0, 3).map(function(item) {
    return item.score;
  });

  const maxScore = topScores.length ? topScores[0] : 0;
  const secondScore = topScores.length > 1 ? topScores[1] : 0;
  const thirdScore = topScores.length > 2 ? topScores[2] : 0;

  let score =
    maxScore * 0.60 +
    secondScore * 0.25 +
    thirdScore * 0.15;

  score += Math.min(15, Math.max(0, materialEvents.length - 1) * 3);
  score += Math.min(10, deterioratingCount * 2);
  score += Math.min(5, criticalEvents.length * 2);

  score = Math.round(Math.max(0, Math.min(100, score)));

  const level = foPortfolioMaterialityLevel_(score);
  const primary = sorted.length && sorted[0].score > 0
    ? sorted[0]
    : null;
  const topContributors = sorted.filter(function(item) {
    return item.score > 0;
  }).slice(0, 5);

  const priorityDecisions = decisions || [];
  const priorityReviewSecurities = priorityDecisions.filter(function(item) {
    return item.priorityLevel === 'HIGH' || item.priorityLevel === 'CRITICAL';
  }).length;
  const suppressedSecurities = priorityDecisions.filter(function(item) {
    return item.priorityLevel === 'SUPPRESSED';
  }).length;
  const downwardReversals = priorityDecisions.filter(function(item) {
    return item.reversalStatus === 'REVERSING DOWNWARD';
  }).length;
  const opportunitySignals = priorityDecisions.filter(function(item) {
    return item.attentionType === 'OPPORTUNITY';
  }).length;
  const topExecutivePriority = priorityDecisions.reduce(function(maximum, item) {
    return Math.max(maximum, item.priorityScore || 0);
  }, 0);
  const attentionCounts = {};
  priorityDecisions.forEach(function(item) {
    if (!item.attentionType || item.attentionType === 'NONE') return;
    attentionCounts[item.attentionType] = (attentionCounts[item.attentionType] || 0) + 1;
  });
  const primaryAttentionType = Object.keys(attentionCounts).sort(function(a, b) {
    return attentionCounts[b] - attentionCounts[a];
  })[0] || 'NONE';

  return {
    score: score,
    level: level,
    primaryDriver: primary
      ? primary.ticker + ' / ' + primary.account + ': ' +
        primary.primaryDriver
      : 'No material portfolio change',
    topContributors: topContributors,
    totalSecurities: sorted.length,
    materialSecurities: materialEvents.length,
    significantSecurities: significantEvents.length,
    criticalSecurities: criticalEvents.length,
    improvingSecurities: improvingCount,
    deterioratingSecurities: deterioratingCount,
    staleOrMissingPrices: staleCount,
    priorityReviewSecurities: priorityReviewSecurities,
    suppressedSecurities: suppressedSecurities,
    downwardReversals: downwardReversals,
    opportunitySignals: opportunitySignals,
    topExecutivePriority: topExecutivePriority,
    primaryAttentionType: primaryAttentionType,
    recommendedResponse: foPortfolioMaterialityResponse_(
      score,
      staleCount,
      deterioratingCount,
      criticalEvents.length
    ),
    executiveSummary: foPortfolioMaterialitySummary_(
      score,
      level,
      primary,
      materialEvents.length,
      staleCount,
      deterioratingCount
    )
  };
}

function foPortfolioMaterialityLevel_(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  if (score >= 1) return 'LOW';
  return 'NONE';
}

function foPortfolioMaterialityResponse_(
  score,
  staleCount,
  deterioratingCount,
  criticalCount
) {
  if (criticalCount > 0 || score >= 80) {
    return 'IMMEDIATE CIO REVIEW';
  }

  if (score >= 60 || deterioratingCount >= 2) {
    return 'CIO REVIEW REQUIRED';
  }

  if (staleCount > 0) {
    return score >= 30
      ? 'REFRESH DATA AND REVIEW'
      : 'REFRESH MARKET DATA';
  }

  if (score >= 30) return 'REVIEW PORTFOLIO CHANGES';
  if (score > 0) return 'MONITOR';
  return 'NO ACTION REQUIRED';
}

function foPortfolioMaterialitySummary_(
  score,
  level,
  primary,
  materialCount,
  staleCount,
  deterioratingCount
) {
  const parts = [
    'Portfolio materiality ' + score + ' (' + level + ')',
    materialCount + ' material securities',
    deterioratingCount + ' deteriorating securities',
    staleCount + ' stale or missing prices'
  ];

  if (primary) {
    parts.push(
      'Primary driver: ' + primary.ticker + ' / ' +
        primary.account + ' — ' + primary.primaryDriver
    );
  } else {
    parts.push('No material portfolio change');
  }

  return parts.join(' | ');
}

function foPortfolioMaterialityHeaders_() {
  return [
    'Timestamp',
    'Portfolio Materiality Score',
    'Portfolio Materiality Level',
    'Primary Portfolio Driver',
    'Top Contributing Securities',
    'Material Securities',
    'Significant Securities',
    'Critical Securities',
    'Improving Securities',
    'Deteriorating Securities',
    'Stale or Missing Prices',
    'Priority Review Securities',
    'Suppressed Securities',
    'Downward Reversals',
    'Opportunity Signals',
    'Top Executive Priority',
    'Primary Attention Type',
    'Recommended CIO Response',
    'Executive Summary',
    'Platform Version',
    'Baseline'
  ];
}

function foWritePortfolioMateriality_(dashboard, assessment) {
  const headers = foPortfolioMaterialityHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PORTFOLIO_MATERIALITY,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const contributors = assessment.topContributors.map(function(item) {
    return item.ticker + ' / ' + item.account +
      ' (' + item.score + ': ' + item.primaryDriver + ')';
  }).join(' | ');

  sheet.getRange(2, 1, 1, headers.length).setValues([[
    new Date(),
    assessment.score,
    assessment.level,
    assessment.primaryDriver,
    contributors || 'NONE',
    assessment.materialSecurities,
    assessment.significantSecurities,
    assessment.criticalSecurities,
    assessment.improvingSecurities,
    assessment.deterioratingSecurities,
    assessment.staleOrMissingPrices,
    assessment.priorityReviewSecurities,
    assessment.suppressedSecurities,
    assessment.downwardReversals,
    assessment.opportunitySignals,
    assessment.topExecutivePriority,
    assessment.primaryAttentionType,
    assessment.recommendedResponse,
    assessment.executiveSummary,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ]]);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  sheet.getRange(2, 2).setFontWeight('bold').setFontSize(14);
  sheet.getRange(2, 3).setFontWeight('bold');
  sheet.setColumnWidth(4, 420);
  sheet.setColumnWidth(5, 620);
  sheet.setColumnWidth(12, 260);
  sheet.setColumnWidth(13, 620);
  sheet.autoResizeColumns(1, 3);
  sheet.autoResizeColumns(6, 7);
}

function foAppendPortfolioMaterialityHistory_(dashboard, assessment) {
  const headers = foPortfolioMaterialityHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PORTFOLIO_MATERIALITY_HISTORY,
    headers
  );

  const contributors = assessment.topContributors.map(function(item) {
    return item.ticker + ' / ' + item.account +
      ' (' + item.score + ': ' + item.primaryDriver + ')';
  }).join(' | ');

  const signature = [
    assessment.score,
    assessment.level,
    assessment.primaryDriver,
    assessment.materialSecurities,
    assessment.significantSecurities,
    assessment.criticalSecurities,
    assessment.improvingSecurities,
    assessment.deterioratingSecurities,
    assessment.staleOrMissingPrices,
    assessment.priorityReviewSecurities,
    assessment.suppressedSecurities,
    assessment.downwardReversals,
    assessment.opportunitySignals,
    assessment.topExecutivePriority,
    assessment.primaryAttentionType,
    assessment.recommendedResponse
  ].join('|');

  if (sheet.getLastRow() >= 2) {
    const lastRow = sheet.getRange(
      sheet.getLastRow(),
      1,
      1,
      headers.length + 1
    ).getValues()[0];
    const lastSignature = String(lastRow[headers.length] || '');

    if (lastSignature === signature) {
      return {
        appended: false,
        reason: 'UNCHANGED'
      };
    }
  }

  if (sheet.getLastColumn() < headers.length + 1) {
    sheet.insertColumnAfter(headers.length);
  }
  sheet.getRange(1, headers.length + 1).setValue('State Signature');

  sheet.appendRow([
    new Date(),
    assessment.score,
    assessment.level,
    assessment.primaryDriver,
    contributors || 'NONE',
    assessment.materialSecurities,
    assessment.significantSecurities,
    assessment.criticalSecurities,
    assessment.improvingSecurities,
    assessment.deterioratingSecurities,
    assessment.staleOrMissingPrices,
    assessment.priorityReviewSecurities,
    assessment.suppressedSecurities,
    assessment.downwardReversals,
    assessment.opportunitySignals,
    assessment.topExecutivePriority,
    assessment.primaryAttentionType,
    assessment.recommendedResponse,
    assessment.executiveSummary,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    signature
  ]);

  return {
    appended: true,
    signature: signature
  };
}

function foPortfolioMaterialityVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foPortfolioMaterialityNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return isFinite(number) ? number : 0;
}

function foRunPortfolioMaterialityEngineSmokeTest() {
  const dashboard = foDashboard_();

  const events = dashboard.getSheetByName(FO_SHEETS.MATERIALITY_EVENTS);
  if (!events || events.getLastRow() < 2) {
    foRunBuyZoneIntelligence();
  }

  const result = foRunPortfolioMaterialityEngine();
  const output = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MATERIALITY);
  const history = dashboard.getSheetByName(
    FO_SHEETS.PORTFOLIO_MATERIALITY_HISTORY
  );

  if (!output || output.getLastRow() < 2) {
    throw new Error('Portfolio Materiality output was not generated.');
  }

  if (!history || history.getLastRow() < 2) {
    throw new Error('Portfolio Materiality History was not generated.');
  }

  if (result.score < 0 || result.score > 100) {
    throw new Error('Portfolio materiality score is outside 0-100.');
  }

  return result;
}
