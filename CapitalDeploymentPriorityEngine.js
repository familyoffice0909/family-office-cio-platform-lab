/**
 * Capital Deployment Priority Engine
 * Wave 2.6.0-B — Ranked Capital Deployment Intelligence
 */

function foRunCapitalDeploymentPriorityEngine() {
  const module = 'CapitalDeploymentPriorityEngine';

  try {
    foInfo_(module, 'Start', 'Capital deployment prioritization started.');

    const dashboard = foDashboard_();
    const policy = foLoadCapitalDeploymentPolicy_(dashboard);
    const candidates = foReadCapitalDeploymentInputs_(dashboard);
    const portfolioMateriality = foReadCurrentPortfolioMateriality_(dashboard);

    const assessment = foBuildCapitalDeploymentPriorities_(
      candidates,
      policy,
      portfolioMateriality
    );

    foWriteCapitalDeploymentPriorities_(dashboard, assessment);
    foAppendCapitalDeploymentHistory_(dashboard, assessment);

    foInfo_(
      module,
      'Complete',
      'Capital deployment prioritization completed. Candidates: ' +
        assessment.priorities.length
    );

    return {
      status: 'SUCCESS',
      candidates: assessment.priorities.length,
      deployNow: assessment.priorities.filter(function(item) {
        return item.deploymentDecision === 'DEPLOY NOW';
      }).length,
      deploySoon: assessment.priorities.filter(function(item) {
        return item.deploymentDecision === 'DEPLOY SOON';
      }).length,
      holdCash: assessment.portfolioDirective === 'HOLD CASH'
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foLoadCapitalDeploymentPolicy_(dashboard) {
  const headers = ['Policy Key', 'Policy Value', 'Description', 'Active'];
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.CAPITAL_DEPLOYMENT_POLICY,
    headers
  );

  if (sheet.getLastRow() < 2) {
    const defaults = [
      ['MIN_DEPLOY_SCORE', 70, 'Minimum score for DEPLOY SOON', true],
      ['MIN_DEPLOY_NOW_SCORE', 85, 'Minimum score for DEPLOY NOW', true],
      ['MAX_RISK_FOR_DEPLOYMENT', 45, 'Maximum risk score for capital deployment', true],
      ['MIN_CONFIDENCE_FOR_DEPLOYMENT', 55, 'Minimum confidence for capital deployment', true],
      ['MAX_POSITION_WEIGHT', 0.15, 'Maximum allowed portfolio weight', true],
      ['STALE_PRICE_BLOCKS_DEPLOYMENT', true, 'Require fresh prices before deployment', true],
      ['MISSING_PRICE_BLOCKS_DEPLOYMENT', true, 'Block deployment when price is missing', true],
      ['HIGH_PORTFOLIO_MATERIALITY_BLOCK', 80, 'Hold cash at or above this portfolio materiality score', true]
    ];

    sheet.getRange(2, 1, defaults.length, headers.length).setValues(defaults);
  }

  const values = sheet.getDataRange().getValues();
  const result = {};

  values.slice(1).forEach(function(row) {
    const active = row[3] === true || String(row[3]).toUpperCase() === 'TRUE';
    if (!active) return;
    result[String(row[0]).trim()] = row[1];
  });

  return {
    minDeployScore: foCapitalNumber_(result.MIN_DEPLOY_SCORE, 70),
    minDeployNowScore: foCapitalNumber_(result.MIN_DEPLOY_NOW_SCORE, 85),
    maxRisk: foCapitalNumber_(result.MAX_RISK_FOR_DEPLOYMENT, 45),
    minConfidence: foCapitalNumber_(result.MIN_CONFIDENCE_FOR_DEPLOYMENT, 55),
    maxPositionWeight: foCapitalNumber_(result.MAX_POSITION_WEIGHT, 0.15),
    staleBlocks: foCapitalBoolean_(result.STALE_PRICE_BLOCKS_DEPLOYMENT, true),
    missingBlocks: foCapitalBoolean_(result.MISSING_PRICE_BLOCKS_DEPLOYMENT, true),
    highPortfolioMaterialityBlock: foCapitalNumber_(
      result.HIGH_PORTFOLIO_MATERIALITY_BLOCK,
      80
    )
  };
}

function foReadCapitalDeploymentInputs_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error(
      'Investment Decision Support contains no results. Run decision support first.'
    );
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  return values.slice(1).map(function(row) {
    return {
      ticker: String(foCapitalVal_(row, headers, 'Ticker') || '').trim().toUpperCase(),
      account: String(foCapitalVal_(row, headers, 'Account') || '').trim(),
      action: String(foCapitalVal_(row, headers, 'Action') || '').trim(),
      recommendation: String(foCapitalVal_(row, headers, 'Recommendation') || '').trim(),
      allocationBand: String(foCapitalVal_(row, headers, 'Allocation Band') || '').trim(),
      materialityScore: foCapitalNumber_(foCapitalVal_(row, headers, 'Materiality Score'), 0),
      priorityScore: foCapitalNumber_(foCapitalVal_(row, headers, 'Priority Score'), 0),
      trend: String(foCapitalVal_(row, headers, 'Trend') || '').trim(),
      conviction: foCapitalNumber_(foCapitalVal_(row, headers, 'Conviction'), 0),
      risk: foCapitalNumber_(foCapitalVal_(row, headers, 'Risk'), 100),
      confidence: foCapitalNumber_(foCapitalVal_(row, headers, 'Confidence'), 0),
      distancePct: foCapitalNullableNumber_(foCapitalVal_(row, headers, 'Distance to Entry %')),
      priceFreshness: String(foCapitalVal_(row, headers, 'Price Freshness') || '').trim(),
      zonePosition: String(foCapitalVal_(row, headers, 'Zone Position') || '').trim(),
      currentPrice: foCapitalNumber_(foCapitalVal_(row, headers, 'Current Price'), 0),
      targetEntryPrice: foCapitalNumber_(foCapitalVal_(row, headers, 'Target Entry Price'), 0),
      executiveReason: String(foCapitalVal_(row, headers, 'Executive Reason') || '').trim()
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function foReadCurrentPortfolioMateriality_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MATERIALITY);

  if (!sheet || sheet.getLastRow() < 2) {
    return { score: 0, level: 'NONE', response: 'NO ACTION REQUIRED' };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const row = values[1];

  return {
    score: foCapitalNumber_(foCapitalVal_(row, headers, 'Portfolio Materiality Score'), 0),
    level: String(foCapitalVal_(row, headers, 'Portfolio Materiality Level') || 'NONE'),
    response: String(foCapitalVal_(row, headers, 'Recommended CIO Response') || 'NO ACTION REQUIRED')
  };
}

function foBuildCapitalDeploymentPriorities_(candidates, policy, portfolioMateriality) {
  const priorities = candidates.map(function(item) {
    return foBuildCapitalDeploymentRecord_(item, policy, portfolioMateriality);
  }).sort(function(a, b) {
    return b.deploymentScore - a.deploymentScore;
  });

  priorities.forEach(function(item, index) {
    item.rank = index + 1;
  });

  const deployable = priorities.filter(function(item) {
    return item.deploymentDecision === 'DEPLOY NOW' ||
      item.deploymentDecision === 'DEPLOY SOON';
  });

  const blocked = priorities.filter(function(item) {
    return item.isBlocked;
  });

  const portfolioDirective = foCapitalPortfolioDirective_(
    priorities,
    deployable,
    blocked,
    portfolioMateriality
  );

  return {
    priorities: priorities,
    deployable: deployable,
    blocked: blocked,
    portfolioDirective: portfolioDirective,
    topPriority: priorities.length ? priorities[0] : null,
    portfolioMateriality: portfolioMateriality
  };
}

function foBuildCapitalDeploymentRecord_(item, policy, portfolioMateriality) {
  const recommendationScore = {
    'STRONG BUY': 100,
    BUY: 85,
    ACCUMULATE: 70,
    WATCH: 45,
    HOLD: 25,
    AVOID: 0
  }[item.recommendation] || 0;

  const trendScore = {
    IMPROVING: 100,
    STABLE: 60,
    DETERIORATING: 10
  }[item.trend] || 40;

  const zoneScore = {
    'IN BUY ZONE': 100,
    'BELOW ZONE': 85,
    'ABOVE ZONE': 45,
    UNAVAILABLE: 0
  }[item.zonePosition] || 0;

  const distanceScore = foCapitalDistanceScore_(item.distancePct);
  const freshnessScore = {
    FRESH: 100,
    STALE: 25,
    MISSING: 0
  }[item.priceFreshness] || 0;

  let deploymentScore = Math.round(
    recommendationScore * 0.20 +
    item.conviction * 0.20 +
    (100 - item.risk) * 0.15 +
    item.confidence * 0.15 +
    zoneScore * 0.10 +
    distanceScore * 0.10 +
    trendScore * 0.05 +
    freshnessScore * 0.05
  );

  deploymentScore = Math.max(0, Math.min(100, deploymentScore));

  const blockers = [];

  if (policy.missingBlocks && item.priceFreshness === 'MISSING') {
    blockers.push('Missing price');
  }
  if (policy.staleBlocks && item.priceFreshness === 'STALE') {
    blockers.push('Stale price');
  }
  if (item.risk > policy.maxRisk) {
    blockers.push('Risk above policy');
  }
  if (item.confidence < policy.minConfidence) {
    blockers.push('Confidence below policy');
  }
  if (portfolioMateriality.score >= policy.highPortfolioMaterialityBlock) {
    blockers.push('Portfolio materiality block');
  }
  if (item.recommendation === 'HOLD' || item.recommendation === 'AVOID') {
    blockers.push('Recommendation not deployable');
  }

  const isBlocked = blockers.length > 0;
  const deploymentDecision = foCapitalDeploymentDecision_(
    deploymentScore,
    isBlocked,
    item,
    policy
  );

  return {
    ticker: item.ticker,
    account: item.account,
    deploymentScore: deploymentScore,
    deploymentDecision: deploymentDecision,
    recommendation: item.recommendation,
    action: item.action,
    allocationBand: item.allocationBand,
    trend: item.trend,
    conviction: item.conviction,
    risk: item.risk,
    confidence: item.confidence,
    materialityScore: item.materialityScore,
    priorityScore: item.priorityScore,
    priceFreshness: item.priceFreshness,
    zonePosition: item.zonePosition,
    distancePct: item.distancePct,
    currentPrice: item.currentPrice,
    targetEntryPrice: item.targetEntryPrice,
    isBlocked: isBlocked,
    blockers: blockers.join(' | ') || 'NONE',
    executiveReason: foCapitalExecutiveReason_(
      item,
      deploymentScore,
      deploymentDecision,
      blockers
    )
  };
}

function foCapitalDistanceScore_(distancePct) {
  if (distancePct === null) return 0;
  const distance = Math.abs(distancePct);
  if (distance <= 0.01) return 100;
  if (distance <= 0.03) return 90;
  if (distance <= 0.05) return 75;
  if (distance <= 0.08) return 55;
  if (distance <= 0.15) return 35;
  return 10;
}

function foCapitalDeploymentDecision_(score, isBlocked, item, policy) {
  if (isBlocked) return 'BLOCKED';
  if (
    score >= policy.minDeployNowScore &&
    (item.recommendation === 'STRONG BUY' || item.recommendation === 'BUY')
  ) {
    return 'DEPLOY NOW';
  }
  if (score >= policy.minDeployScore) return 'DEPLOY SOON';
  if (score >= 50) return 'WATCHLIST';
  return 'HOLD CASH';
}

function foCapitalPortfolioDirective_(priorities, deployable, blocked, portfolioMateriality) {
  if (portfolioMateriality.score >= 80) return 'HOLD CASH';
  if (deployable.length > 0) return 'DEPLOY SELECTIVELY';
  if (blocked.length === priorities.length && priorities.length > 0) {
    return 'REFRESH DATA / HOLD CASH';
  }
  return 'HOLD CASH';
}

function foCapitalExecutiveReason_(item, score, decision, blockers) {
  const parts = [
    'Decision ' + decision,
    'Score ' + score,
    'Recommendation ' + item.recommendation,
    'Conviction ' + item.conviction,
    'Risk ' + item.risk,
    'Confidence ' + item.confidence,
    'Trend ' + item.trend,
    'Zone ' + item.zonePosition
  ];
  if (blockers.length) parts.push('Blockers ' + blockers.join(', '));
  return parts.join(' | ');
}

function foCapitalDeploymentHeaders_() {
  return [
    'Rank', 'Ticker', 'Account', 'Deployment Decision', 'Deployment Score',
    'Recommendation', 'Action', 'Allocation Band', 'Trend', 'Conviction',
    'Risk', 'Confidence', 'Materiality Score', 'Priority Score',
    'Price Freshness', 'Zone Position', 'Distance to Entry %', 'Current Price',
    'Target Entry Price', 'Blocked', 'Blockers', 'Executive Reason',
    'Portfolio Directive', 'Portfolio Materiality Score', 'Timestamp',
    'Platform Version', 'Baseline'
  ];
}

function foWriteCapitalDeploymentPriorities_(dashboard, assessment) {
  const headers = foCapitalDeploymentHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES,
    headers
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const now = new Date();
  const rows = assessment.priorities.map(function(item) {
    return [
      item.rank, item.ticker, item.account, item.deploymentDecision,
      item.deploymentScore, item.recommendation, item.action,
      item.allocationBand, item.trend, item.conviction, item.risk,
      item.confidence, item.materialityScore, item.priorityScore,
      item.priceFreshness, item.zonePosition,
      item.distancePct === null ? '' : item.distancePct,
      item.currentPrice, item.targetEntryPrice,
      item.isBlocked ? 'YES' : 'NO', item.blockers,
      item.executiveReason, assessment.portfolioDirective,
      assessment.portfolioMateriality.score, now,
      FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
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
  sheet.getRange(2, 17, Math.max(rows.length, 1), 1).setNumberFormat('0.00%');
  sheet.getRange(2, 18, Math.max(rows.length, 1), 2).setNumberFormat('0.00');
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(21, 320);
  sheet.setColumnWidth(22, 560);
}

function foAppendCapitalDeploymentHistory_(dashboard, assessment) {
  const headers = [
    'Timestamp', 'Portfolio Directive', 'Top Ticker', 'Top Account',
    'Top Decision', 'Top Deployment Score', 'Deployable Candidates',
    'Blocked Candidates', 'Portfolio Materiality Score', 'Platform Version',
    'Baseline', 'State Signature'
  ];

  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY,
    headers
  );

  const top = assessment.topPriority;
  const signature = [
    assessment.portfolioDirective,
    top ? top.ticker : 'NONE',
    top ? top.account : 'NONE',
    top ? top.deploymentDecision : 'NONE',
    top ? top.deploymentScore : 0,
    assessment.deployable.length,
    assessment.blocked.length,
    assessment.portfolioMateriality.score
  ].join('|');

  if (sheet.getLastRow() >= 2) {
    const lastSignature = String(
      sheet.getRange(sheet.getLastRow(), headers.length).getValue() || ''
    );
    if (lastSignature === signature) {
      return { appended: false, reason: 'UNCHANGED' };
    }
  }

  sheet.appendRow([
    new Date(), assessment.portfolioDirective,
    top ? top.ticker : 'NONE', top ? top.account : 'NONE',
    top ? top.deploymentDecision : 'NONE', top ? top.deploymentScore : 0,
    assessment.deployable.length, assessment.blocked.length,
    assessment.portfolioMateriality.score,
    FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE, signature
  ]);

  return { appended: true, signature: signature };
}

function foCapitalVal_(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? row[index] : '';
}

function foCapitalNumber_(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return isFinite(number) ? number : fallback;
}

function foCapitalNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function foCapitalBoolean_(value, fallback) {
  if (value === true || value === false) return value;
  if (String(value).toUpperCase() === 'TRUE') return true;
  if (String(value).toUpperCase() === 'FALSE') return false;
  return fallback;
}

function foRunCapitalDeploymentPriorityEngineSmokeTest() {
  const dashboard = foDashboard_();
  const decisionSupport = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );

  if (!decisionSupport || decisionSupport.getLastRow() < 2) {
    foRunInvestmentDecisionSupport();
  }

  const result = foRunCapitalDeploymentPriorityEngine();
  const output = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES
  );
  const history = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY
  );

  if (!output || output.getLastRow() < 2) {
    throw new Error('Capital Deployment Priorities was not generated.');
  }
  if (!history || history.getLastRow() < 2) {
    throw new Error('Capital Deployment History was not generated.');
  }

  const values = output.getDataRange().getValues();
  const headers = values[0].map(String);
  const scoreIndex = headers.indexOf('Deployment Score');

  values.slice(1).forEach(function(row) {
    const score = Number(row[scoreIndex]);
    if (!isFinite(score) || score < 0 || score > 100) {
      throw new Error('Deployment score outside 0-100.');
    }
  });

  return result;
}
