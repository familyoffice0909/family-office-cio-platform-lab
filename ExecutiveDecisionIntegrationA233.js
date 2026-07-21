/**
 * Wave A2.3.3 — Executive Decision Integration
 *
 * Creates one governed decision state for executive reports by reconciling
 * portfolio risk, price freshness, attribution coverage, materiality,
 * confidence trends and current holdings.
 */
const FO_A233_RELEASE_TARGET = 'v1.3.0';
const FO_A233_FRESHNESS_THRESHOLD = 0.80;
const FO_A233_COST_BASIS_THRESHOLD = 0.80;

function foRunExecutiveDecisionIntegrationA233() {
  const dashboard = foDashboard_();
  const run = foCreateRunMetadataA230('EXEC-DECISION');
  const risk = foA233ReadRiskState_(dashboard);
  const readiness = foA233ReadDataReadiness_(dashboard);
  const decisions = foA233ReadDecisionSupport_(dashboard);
  const holdings = foA233ReadCurrentHoldings_(dashboard);
  const policy = foA233ResolvePolicy_(risk, readiness, decisions);
  const actionCards = foA233BuildActionCards_(
    decisions,
    holdings,
    policy,
    risk,
    run
  );
  const conflicts = foA233BuildConflicts_(
    actionCards,
    policy,
    risk,
    readiness,
    run
  );
  const state = foA233BuildState_(
    risk,
    readiness,
    decisions,
    policy,
    conflicts,
    run
  );

  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'EXECUTIVE_DECISION_STATE_A233'),
    [foA233StateRow_(state)]
  );
  foReplaceRowsA230(
    foA233EnsureAdditiveSchema_(dashboard, 'REPORT_ACTION_CARDS_A233'),
    actionCards.map(foA233ActionCardRow_)
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'REPORT_CONFLICTS_A233'),
    conflicts.map(foA233ConflictRow_)
  );
  foReplaceRowsA230(
    foEnsureSheetA230(dashboard, 'REPORT_DATA_READINESS_A233'),
    foA233ReadinessRows_(readiness, risk, policy, run)
  );

  const validation = foRunExecutiveDecisionIntegrationValidationA233(
    run.runId
  );

  return {
    status: validation.failedControls
      ? 'FAIL'
      : (conflicts.length ? 'PASS WITH OBSERVATIONS' : 'PASS'),
    runId: run.runId,
    portfolioPosture: state.portfolioPosture,
    executionStatus: state.executionStatus,
    primaryAction: state.primaryAction,
    secondaryAction: state.secondaryAction,
    overallMateriality: state.overallMateriality,
    conflictCount: conflicts.length,
    actionCards: actionCards,
    validation: validation,
    releaseTarget: FO_A233_RELEASE_TARGET
  };
}

function foA233ReadRiskState_(dashboard) {
  const portfolio = foA233LatestRows_(
    dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_RISK)
  );
  const positions = foA233LatestRows_(
    dashboard.getSheetByName(FO_SHEETS.POSITION_RISK)
  );
  const portfolioRow = portfolio.rows[0] || {};
  const ranked = positions.rows.slice().sort(function(a, b) {
    return foA233Number_(a.Rank) - foA233Number_(b.Rank);
  });
  const largest = ranked[0] || {};
  const riskScore = foA233Number_(portfolioRow['Risk Score']);
  const largestPct = foA233Number_(
    portfolioRow['Largest Position %']
  );
  const topFivePct = foA233Number_(portfolioRow['Top 5 %']);
  const riskLevel = foA233Text_(
    portfolioRow['Overall Risk'] || 'UNKNOWN'
  ).toUpperCase();

  return {
    riskRunId: portfolio.runId || positions.runId || '',
    riskScore: riskScore,
    riskLevel: riskLevel,
    largestPositionTicker: foA233Text_(largest.Ticker).toUpperCase(),
    largestPositionPct: largestPct,
    topFivePct: topFivePct,
    largestPositionRecommendation:
      foA233Text_(largest.Recommendation) ||
      foA233Text_(portfolioRow.Recommendation),
    critical:
      riskLevel === 'CRITICAL' ||
      riskScore >= 80 ||
      largestPct >= 30 ||
      topFivePct >= 85
  };
}

function foA233ReadDataReadiness_(dashboard) {
  const performanceRows = foA233SheetRows_(
    dashboard.getSheetByName('Portfolio Performance Positions')
  );
  let directPriceCount = 0;
  let derivedPriceCount = 0;
  let missingMarketValueCount = 0;

  performanceRows.forEach(function(row) {
    const quantity = foA233Number_(row.Quantity);
    const price = foA233Number_(row['Current Price']);
    const marketValue = foA233Number_(row['Market Value']);

    if (price > 0) {
      directPriceCount++;
    } else if (quantity > 0 && marketValue > 0) {
      derivedPriceCount++;
    }
    if (marketValue <= 0) {
      missingMarketValueCount++;
    }
  });

  const decisionRows = foA233SheetRows_(
    dashboard.getSheetByName(FO_SHEETS.INVESTMENT_DECISION_SUPPORT)
  );
  const freshDecisionCount = decisionRows.filter(function(row) {
    return foA233Text_(row['Price Freshness']).toUpperCase() === 'FRESH';
  }).length;

  const coverage = foA233LatestMetricMap_(
    dashboard.getSheetByName(
      FO_SHEETS.ATTRIBUTION_COVERAGE_SUMMARY_A2311
    )
  );
  const returns = foA233LatestMetricMap_(
    dashboard.getSheetByName(
      FO_SHEETS.RETURN_ATTRIBUTION_SUMMARY_A232
    )
  );

  return {
    positionCount: performanceRows.length,
    directPriceCount: directPriceCount,
    derivedPriceCount: derivedPriceCount,
    missingMarketValueCount: missingMarketValueCount,
    decisionCount: decisionRows.length,
    freshDecisionCount: freshDecisionCount,
    priceFreshnessCoveragePct: decisionRows.length
      ? freshDecisionCount / decisionRows.length
      : 0,
    costBasisCoveragePct: foA233Number_(
      foA233MetricValue_(coverage, 'Cost-Basis Coverage %')
    ),
    portfolioReturnStatus: foA233Text_(
      foA233MetricStatus_(coverage, 'Portfolio-Wide Return %')
    ).toUpperCase(),
    returnAttributionCoveragePct: foA233Number_(
      foA233MetricValue_(returns, 'Return Attribution Coverage %')
    ),
    portfolioPriceReturnPct: foA233NullableNumber_(
      foA233MetricValue_(returns, 'Portfolio Price Return %')
    ),
    coverageRunId: coverage.runId,
    returnRunId: returns.runId
  };
}

function foA233ReadDecisionSupport_(dashboard) {
  return foA233SheetRows_(
    dashboard.getSheetByName(FO_SHEETS.INVESTMENT_DECISION_SUPPORT)
  ).map(function(row) {
    return {
      rank: foA233Number_(row.Rank),
      ticker: foA233Text_(row.Ticker).toUpperCase(),
      account: foA233Text_(row.Account),
      action: foA233Text_(row.Action).toUpperCase(),
      recommendation: foA233Text_(row.Recommendation),
      allocationBand: foA233Text_(row['Allocation Band']),
      materialityScore: foA233Number_(row['Materiality Score']),
      materialityLevel: foA233Text_(row['Materiality Level']),
      basePriorityScore: foA233Number_(row['Base Priority Score']),
      priorityScore: foA233Number_(row['Priority Score']),
      priorityLevel: foA233Text_(row['Priority Level']).toUpperCase(),
      significantChange: foA233Text_(row['Significant Change']).toUpperCase(),
      attentionType: foA233Text_(row['Attention Type']).toUpperCase(),
      priorityDriver: foA233Text_(row['Priority Driver']),
      suppressionReason: foA233Text_(row['Suppression Reason']),
      overallTrajectory: foA233Text_(row['Overall Trajectory']).toUpperCase(),
      reversalStatus: foA233Text_(row['Reversal Status']).toUpperCase(),
      trendEvidenceStrength: foA233Text_(row['Trend Evidence Strength']).toUpperCase(),
      trend: foA233Text_(row.Trend).toUpperCase(),
      confidence: foA233Number_(row.Confidence),
      confidenceDelta: foA233Number_(row['Confidence Delta']),
      riskScore: foA233Number_(row.Risk),
      portfolioWeight: foA233Number_(row['Portfolio Weight']),
      priceFreshness:
        foA233Text_(row['Price Freshness']).toUpperCase(),
      zonePosition: foA233Text_(row['Zone Position']),
      currentPrice: foA233Number_(row['Current Price']),
      targetEntryPrice: foA233Number_(row['Target Entry Price']),
      executiveReason: foA233Text_(row['Executive Reason']),
      recommendationQualityScore: foA233Number_(
        row['Recommendation Quality Score']
      ),
      recommendationQualityGrade: foA233Text_(
        row['Recommendation Quality Grade'] || 'NOT ASSESSED'
      ).toUpperCase(),
      supportingEvidence: foA233Text_(row['Supporting Evidence']),
      opposingEvidence: foA233Text_(row['Opposing Evidence']),
      dataLimitations: foA233Text_(row['Data Limitations']),
      evidenceBalance: foA233Text_(
        row['Evidence Balance'] || 'NOT ASSESSED'
      ).toUpperCase(),
      contradictionStatus: foA233Text_(
        row['Contradiction Status'] || 'NOT ASSESSED'
      ).toUpperCase(),
      contradictionReasons: foA233Text_(row['Contradiction Reasons']),
      qualityRationale: foA233Text_(row['Quality Rationale'])
    };
  }).filter(function(item) {
    return item.ticker;
  }).sort(function(a, b) {
    return (a.rank || 999) - (b.rank || 999);
  });
}

function foA233ReadCurrentHoldings_(dashboard) {
  const exact = {};
  const tickers = {};
  foA233SheetRows_(
    dashboard.getSheetByName('Portfolio Performance Positions')
  ).forEach(function(row) {
    const ticker = foA233Text_(row.Ticker).toUpperCase();
    const account = foA233Text_(row.Account);
    if (!ticker) return;
    exact[foA233DecisionKey_(ticker, account)] = true;
    tickers[ticker] = true;
  });
  return {exact: exact, tickers: tickers};
}

function foA233ResolvePolicy_(risk, readiness, decisions) {
  const actionable = decisions.filter(function(item) {
    return foA233IsDeploymentAction_(item.action);
  });
  const staleActionable = actionable.filter(function(item) {
    return item.priceFreshness !== 'FRESH';
  });
  const qualityBlockedActionable = actionable.filter(function(item) {
    return foA233QualityBlocksExecution_(item);
  });
  const qualityReviewActionable = actionable.filter(function(item) {
    return item.contradictionStatus === 'REVIEW';
  });

  let portfolioPosture = 'HOLD / MONITOR';
  if (risk.critical) {
    portfolioPosture = 'RISK REDUCTION FIRST';
  } else if (actionable.length) {
    portfolioPosture = 'SELECTIVE ACCUMULATION';
  }

  let executionStatus = 'INFORMATIONAL ONLY';
  if (staleActionable.length) {
    executionStatus = 'BLOCKED — STALE DATA';
  } else if (qualityBlockedActionable.length) {
    executionStatus = 'BLOCKED — RECOMMENDATION QUALITY';
  } else if (risk.critical && actionable.length) {
    executionStatus = 'BLOCKED — RISK CAPACITY';
  } else if (qualityReviewActionable.length) {
    executionStatus = 'CONDITIONAL';
  } else if (actionable.length) {
    executionStatus =
      readiness.priceFreshnessCoveragePct >= FO_A233_FRESHNESS_THRESHOLD
        ? 'EXECUTABLE'
        : 'CONDITIONAL';
  } else if (risk.critical) {
    executionStatus = 'RISK REDUCTION REQUIRED';
  }

  return {
    portfolioPosture: portfolioPosture,
    executionStatus: executionStatus,
    actionableCount: actionable.length,
    staleActionableCount: staleActionable.length,
    qualityBlockedActionableCount: qualityBlockedActionable.length,
    qualityReviewActionableCount: qualityReviewActionable.length,
    priceReady:
      readiness.priceFreshnessCoveragePct >= FO_A233_FRESHNESS_THRESHOLD,
    costBasisReady:
      readiness.costBasisCoveragePct >= FO_A233_COST_BASIS_THRESHOLD
  };
}

function foA233BuildActionCards_(decisions, holdings, policy, risk, run) {
  return decisions.map(function(item, index) {
    const currentHolding = Boolean(
      holdings.exact[foA233DecisionKey_(item.ticker, item.account)] ||
      holdings.tickers[item.ticker]
    );
    const securityType = currentHolding
      ? 'CURRENT HOLDING'
      : 'EXTERNAL OPPORTUNITY';
    const actionable = foA233IsDeploymentAction_(item.action);

    let executionStatus = 'INFORMATIONAL ONLY';
    if (actionable && item.priceFreshness !== 'FRESH') {
      executionStatus = 'BLOCKED — STALE DATA';
    } else if (actionable && foA233QualityBlocksExecution_(item)) {
      executionStatus = 'BLOCKED — RECOMMENDATION QUALITY';
    } else if (actionable && risk.critical) {
      executionStatus = 'BLOCKED — RISK CAPACITY';
    } else if (actionable && item.contradictionStatus === 'REVIEW') {
      executionStatus = 'CONDITIONAL';
    } else if (actionable) {
      executionStatus = policy.priceReady ? 'EXECUTABLE' : 'CONDITIONAL';
    } else if (item.action === 'WATCH') {
      executionStatus = 'CONDITIONAL';
    }

    return {
      runId: run.runId,
      timestamp: run.timestamp,
      rank: index + 1,
      ticker: item.ticker,
      securityType: securityType,
      account: item.account,
      action: item.action,
      recommendation: item.recommendation,
      executionStatus: executionStatus,
      trigger: foA233ActionTrigger_(item, executionStatus),
      invalidationCondition:
        foA233Invalidation_(item, executionStatus, risk),
      confidence: item.confidence,
      priorConfidence: item.confidence - item.confidenceDelta,
      confidenceDelta: item.confidenceDelta,
      trend: item.trend,
      materialityScore: item.materialityScore,
      basePriorityScore: item.basePriorityScore,
      executivePriorityScore: item.priorityScore,
      priorityLevel: item.priorityLevel,
      significantChange: item.significantChange,
      attentionType: item.attentionType,
      priorityDriver: item.priorityDriver,
      suppressionReason: item.suppressionReason,
      overallTrajectory: item.overallTrajectory,
      reversalStatus: item.reversalStatus,
      trendEvidenceStrength: item.trendEvidenceStrength,
      portfolioWeight: item.portfolioWeight,
      priceFreshness: item.priceFreshness,
      currentPrice: item.currentPrice,
      targetEntryPrice: item.targetEntryPrice,
      riskImpact: actionable && risk.critical
        ? 'INCREASES EXPOSURE WHILE PORTFOLIO RISK IS CRITICAL'
        : 'NEUTRAL / MONITOR',
      recommendationQualityScore: item.recommendationQualityScore,
      recommendationQualityGrade: item.recommendationQualityGrade,
      evidenceBalance: item.evidenceBalance,
      contradictionStatus: item.contradictionStatus,
      qualityRationale: item.qualityRationale,
      commentary:
        item.executiveReason ||
        item.recommendation ||
        item.allocationBand,
      platformVersion: run.platformVersion,
      baseline: run.baseline
    };
  });
}

function foA233BuildConflicts_(actionCards, policy, risk, readiness, run) {
  const conflicts = [];
  const deploymentCards = actionCards.filter(function(card) {
    return foA233IsDeploymentAction_(card.action);
  });
  const qualityBlockedCards = deploymentCards.filter(function(card) {
    return (
      card.contradictionStatus === 'BLOCKED' ||
      card.recommendationQualityGrade === 'LOW' ||
      card.recommendationQualityGrade === 'INSUFFICIENT DATA'
    );
  });
  const qualityReviewCards = deploymentCards.filter(function(card) {
    return card.contradictionStatus === 'REVIEW';
  });

  if (risk.critical && deploymentCards.length) {
    conflicts.push({
      runId: run.runId,
      timestamp: run.timestamp,
      conflictCode: 'CRITICAL_RISK_WITH_ACCUMULATION',
      severity: 'CRITICAL',
      status: 'CONTROLLED — ACTIONS BLOCKED',
      description:
        'Deployment recommendations coexist with critical portfolio risk.',
      evidence:
        'Risk ' + risk.riskScore +
        ' | Largest position ' + risk.largestPositionPct +
        '% | Deployment cards ' + deploymentCards.length,
      requiredResolution:
        'Reduce concentration or explicitly approve risk capacity.',
      platformVersion: run.platformVersion,
      baseline: run.baseline
    });
  }

  if (policy.staleActionableCount > 0) {
    conflicts.push({
      runId: run.runId,
      timestamp: run.timestamp,
      conflictCode: 'STALE_PRICE_WITH_ACCUMULATION',
      severity: 'CRITICAL',
      status: 'CONTROLLED — ACTIONS BLOCKED',
      description:
        'Actionable deployment recommendations use stale price inputs.',
      evidence:
        policy.staleActionableCount +
        ' actionable decisions are not price-fresh.',
      requiredResolution:
        'Refresh prices and Buy Zones before authorizing capital.',
      platformVersion: run.platformVersion,
      baseline: run.baseline
    });
  }

  if (qualityBlockedCards.length > 0) {
    conflicts.push({
      runId: run.runId,
      timestamp: run.timestamp,
      conflictCode: 'RECOMMENDATION_QUALITY_BLOCK_WITH_DEPLOYMENT_ACTION',
      severity: 'CRITICAL',
      status: 'CONTROLLED — ACTIONS BLOCKED',
      description:
        'Deployment actions coexist with blocked or insufficient recommendation quality.',
      evidence: qualityBlockedCards.map(function(card) {
        return card.ticker + ' ' + card.recommendationQualityGrade +
          '/' + card.contradictionStatus;
      }).join(' | '),
      requiredResolution:
        'Resolve recommendation-quality limitations or contradictions before execution.',
      platformVersion: run.platformVersion,
      baseline: run.baseline
    });
  }

  if (qualityReviewCards.length > 0) {
    conflicts.push({
      runId: run.runId,
      timestamp: run.timestamp,
      conflictCode: 'RECOMMENDATION_QUALITY_REVIEW_REQUIRED',
      severity: 'HIGH',
      status: 'OPEN — CONDITIONAL',
      description:
        'Deployment actions contain recommendation-quality contradictions requiring review.',
      evidence: qualityReviewCards.map(function(card) {
        return card.ticker + ' ' + card.qualityRationale;
      }).join(' | '),
      requiredResolution:
        'Complete executive review before authorizing the affected actions.',
      platformVersion: run.platformVersion,
      baseline: run.baseline
    });
  }

  if (
    readiness.costBasisCoveragePct < FO_A233_COST_BASIS_THRESHOLD &&
    readiness.portfolioReturnStatus !== 'SUPPRESSED'
  ) {
    conflicts.push({
      runId: run.runId,
      timestamp: run.timestamp,
      conflictCode: 'INSUFFICIENT_COST_BASIS_WITH_RETURN_AVAILABLE',
      severity: 'HIGH',
      status: 'OPEN',
      description:
        'Portfolio-wide return is not suppressed despite insufficient cost basis.',
      evidence:
        'Cost-basis coverage ' +
        foA233PercentText_(readiness.costBasisCoveragePct) +
        ' | Return status ' +
        (readiness.portfolioReturnStatus || 'UNAVAILABLE'),
      requiredResolution:
        'Suppress portfolio-wide return until coverage is sufficient.',
      platformVersion: run.platformVersion,
      baseline: run.baseline
    });
  }
  return conflicts;
}

function foA233BuildState_(risk, readiness, decisions, policy, conflicts, run) {
  const marketMateriality = decisions.reduce(function(maximum, item) {
    return Math.max(maximum, item.materialityScore || 0);
  }, 0);
  const portfolioMateriality = Math.max(
    risk.riskScore,
    risk.critical ? 95 : 0
  );
  let actionability = 10;
  if (policy.executionStatus === 'EXECUTABLE') {
    actionability = 90;
  } else if (policy.executionStatus === 'CONDITIONAL') {
    actionability = 60;
  } else if (
    policy.executionStatus.indexOf('BLOCKED') === 0 ||
    policy.executionStatus === 'RISK REDUCTION REQUIRED'
  ) {
    actionability = 25;
  }

  let overallMateriality = Math.round(
    marketMateriality * 0.30 +
    portfolioMateriality * 0.45 +
    actionability * 0.25
  );
  if (risk.critical) {
    overallMateriality = Math.max(overallMateriality, 85);
  }

  return {
    runId: run.runId,
    timestamp: run.timestamp,
    portfolioPosture: policy.portfolioPosture,
    executionStatus: policy.executionStatus,
    primaryAction: risk.critical
      ? (
        'Reduce / review ' +
        (risk.largestPositionTicker || 'largest position') +
        ' before adding material exposure.'
      )
      : 'Maintain monitoring discipline.',
    secondaryAction: policy.staleActionableCount
      ? 'Refresh market prices and Buy Zones.'
      : (
        policy.qualityBlockedActionableCount
          ? 'Resolve recommendation-quality blockers before deployment.'
          : (!policy.costBasisReady
          ? 'Improve cost-basis coverage; keep return suppressed.'
          : 'Refresh decision inputs before the next report.')
      ),
    marketMateriality: marketMateriality,
    portfolioMateriality: portfolioMateriality,
    actionability: actionability,
    overallMateriality: overallMateriality,
    portfolioRiskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    largestPositionTicker: risk.largestPositionTicker,
    largestPositionPct: risk.largestPositionPct,
    priceFreshnessCoveragePct: readiness.priceFreshnessCoveragePct,
    costBasisCoveragePct: readiness.costBasisCoveragePct,
    returnAttributionCoveragePct: readiness.returnAttributionCoveragePct,
    conflictCount: conflicts.length,
    platformVersion: run.platformVersion,
    baseline: run.baseline
  };
}

function foA233ReadinessRows_(readiness, risk, policy, run) {
  const total = readiness.positionCount;
  return [
    [run.runId, run.timestamp, 'Recognized Positions', total,
      total ? 'AVAILABLE' : 'UNAVAILABLE',
      'Positions found in Portfolio Performance Positions.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Direct Price Coverage %',
      total ? readiness.directPriceCount / total : 0,
      total && readiness.directPriceCount / total >= 0.80
        ? 'STRONG' : 'PARTIAL',
      readiness.directPriceCount + ' direct prices; ' +
        readiness.derivedPriceCount + ' derived effective prices.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Market Value Coverage %',
      total ? (total - readiness.missingMarketValueCount) / total : 0,
      readiness.missingMarketValueCount ? 'PARTIAL' : 'COMPLETE',
      readiness.missingMarketValueCount +
        ' positions lack positive market value.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Decision Price Freshness Coverage %',
      readiness.priceFreshnessCoveragePct,
      policy.priceReady ? 'READY' : 'BLOCKED',
      readiness.freshDecisionCount + ' of ' +
        readiness.decisionCount + ' decision inputs are fresh.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Cost-Basis Coverage %',
      readiness.costBasisCoveragePct,
      policy.costBasisReady ? 'READY' : 'INSUFFICIENT',
      'Portfolio-wide return must remain suppressed below 80%.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Return Attribution Coverage %',
      readiness.returnAttributionCoveragePct,
      readiness.returnAttributionCoveragePct >= 0.80
        ? 'READY' : 'PARTIAL',
      'Coverage for period-over-period return attribution.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Portfolio Risk Capacity', risk.riskScore,
      risk.critical ? 'BLOCKED' : 'AVAILABLE',
      risk.critical
        ? 'Critical risk blocks material new deployment.'
        : 'Portfolio risk does not block deployment.',
      run.platformVersion, run.baseline],
    [run.runId, run.timestamp, 'Unified Execution Status',
      policy.executionStatus,
      (
        policy.executionStatus.indexOf('BLOCKED') === 0 ||
        policy.executionStatus === 'RISK REDUCTION REQUIRED'
      )
        ? 'BLOCKED'
        : (
          policy.executionStatus === 'CONDITIONAL'
            ? 'CONDITIONAL'
            : (
              policy.executionStatus === 'EXECUTABLE'
                ? 'AVAILABLE'
                : 'INFORMATIONAL'
            )
        ),
      'Authoritative execution state for executive reports.',
      run.platformVersion, run.baseline]
  ];
}

function foRunExecutiveDecisionIntegrationValidationA233(expectedRunId) {
  const dashboard = foDashboard_();
  const suite = foCreateValidationSuiteA230(
    'A2.3.3 Executive Decision Integration'
  );
  const stateSheet = dashboard.getSheetByName(
    FO_SHEETS.EXECUTIVE_DECISION_STATE_A233
  );
  const actionSheet = dashboard.getSheetByName(
    FO_SHEETS.REPORT_ACTION_CARDS_A233
  );
  const conflictSheet = dashboard.getSheetByName(
    FO_SHEETS.REPORT_CONFLICTS_A233
  );
  const readinessSheet = dashboard.getSheetByName(
    FO_SHEETS.REPORT_DATA_READINESS_A233
  );

  suite.add('SCHEMA', 'Decision state schema valid', function() {
    return foA233SchemaMatches_(
      stateSheet,
      foGetHeadersA230('EXECUTIVE_DECISION_STATE_A233')
    );
  }, 'CRITICAL');
  suite.add('SCHEMA', 'Action card schema valid', function() {
    return foA233SchemaMatches_(
      actionSheet,
      foGetHeadersA230('REPORT_ACTION_CARDS_A233')
    );
  }, 'CRITICAL');
  suite.add('SCHEMA', 'Conflict schema valid', function() {
    return foA233SchemaMatches_(
      conflictSheet,
      foGetHeadersA230('REPORT_CONFLICTS_A233')
    );
  }, 'HIGH');
  suite.add('SCHEMA', 'Readiness schema valid', function() {
    return foA233SchemaMatches_(
      readinessSheet,
      foGetHeadersA230('REPORT_DATA_READINESS_A233')
    );
  }, 'HIGH');
  suite.add('LINEAGE', 'Decision state run lineage valid', function() {
    return Boolean(
      expectedRunId &&
      stateSheet &&
      stateSheet.getLastRow() > 1 &&
      String(stateSheet.getRange(2, 1).getValue()) ===
        String(expectedRunId)
    );
  }, 'CRITICAL');
  suite.add('POLICY', 'No executable deployment under critical risk',
    function() {
      const state = foA233SheetRows_(stateSheet)[0] || {};
      if (
        foA233Text_(state['Portfolio Risk Level']).toUpperCase() !==
        'CRITICAL'
      ) {
        return true;
      }
      return foA233SheetRows_(actionSheet).every(function(card) {
        return !(
          foA233IsDeploymentAction_(card.Action) &&
          foA233Text_(card['Execution Status']).toUpperCase() ===
            'EXECUTABLE'
        );
      });
    }, 'CRITICAL');
  suite.add('POLICY', 'No executable deployment with stale price',
    function() {
      return foA233SheetRows_(actionSheet).every(function(card) {
        const stale =
          foA233Text_(card['Price Freshness']).toUpperCase() !==
          'FRESH';
        const executable =
          foA233Text_(card['Execution Status']).toUpperCase() ===
          'EXECUTABLE';
        return !(stale && executable);
      });
    }, 'CRITICAL');
  suite.add('POLICY', 'No executable deployment with blocked quality',
    function() {
      return foA233SheetRows_(actionSheet).every(function(card) {
        const qualityBlocked =
          foA233Text_(card['Contradiction Status']).toUpperCase() ===
            'BLOCKED' ||
          [
            'LOW',
            'INSUFFICIENT DATA'
          ].indexOf(
            foA233Text_(
              card['Recommendation Quality Grade']
            ).toUpperCase()
          ) >= 0;
        const executable =
          foA233Text_(card['Execution Status']).toUpperCase() ===
          'EXECUTABLE';
        return !(qualityBlocked && executable);
      });
    }, 'CRITICAL');
  suite.add('LINEAGE', 'Action-card recommendation quality is inherited',
    function() {
      return foA233SheetRows_(actionSheet).every(function(card) {
        const grade = foA233Text_(
          card['Recommendation Quality Grade']
        ).toUpperCase();
        const contradiction = foA233Text_(
          card['Contradiction Status']
        ).toUpperCase();
        return (
          ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT DATA', 'NOT ASSESSED']
            .indexOf(grade) >= 0 &&
          ['CLEAR', 'REVIEW', 'BLOCKED', 'NOT ASSESSED']
            .indexOf(contradiction) >= 0
        );
      });
    }, 'HIGH');
  suite.add('CLASSIFICATION',
    'Current holdings and opportunities are separated', function() {
      return foA233SheetRows_(actionSheet).every(function(card) {
        const type = foA233Text_(
          card['Security Type']
        ).toUpperCase();
        return (
          type === 'CURRENT HOLDING' ||
          type === 'EXTERNAL OPPORTUNITY'
        );
      });
    }, 'HIGH');
  suite.add('RECONCILIATION', 'Conflict count reconciles', function() {
    const state = foA233SheetRows_(stateSheet)[0] || {};
    const expected = foA233Number_(state['Conflict Count']);
    const actual = conflictSheet && conflictSheet.getLastRow() > 1
      ? conflictSheet.getLastRow() - 1 : 0;
    return expected === actual;
  }, 'HIGH');
  suite.add(
    'CONTROL',
    'Unified execution status classification is valid',
    function() {
      const rows = foA233SheetRows_(readinessSheet);
      const row = rows.filter(function(item) {
        return foA233Text_(item.Control) ===
          'Unified Execution Status';
      })[0] || {};
      const value = foA233Text_(row.Value).toUpperCase();
      const status = foA233Text_(row.Status).toUpperCase();

      if (
        value.indexOf('BLOCKED') === 0 ||
        value === 'RISK REDUCTION REQUIRED'
      ) {
        return status === 'BLOCKED';
      }
      if (value === 'CONDITIONAL') {
        return status === 'CONDITIONAL';
      }
      if (value === 'EXECUTABLE') {
        return status === 'AVAILABLE';
      }
      return status === 'INFORMATIONAL';
    },
    'CRITICAL'
  );

  suite.add('CONTROL', 'Coverage values are in range', function() {
    const state = foA233SheetRows_(stateSheet)[0] || {};
    return [
      state['Price Freshness Coverage %'],
      state['Cost Basis Coverage %'],
      state['Return Attribution Coverage %']
    ].every(function(value) {
      const number = foA233Number_(value);
      return number >= 0 && number <= 1;
    });
  }, 'HIGH');

  const result = suite.run();
  const validationRun = foCreateRunMetadataA230('EXEC-DECISION-VAL');
  const validationSheet = foEnsureSheetA230(
    dashboard,
    'REPORT_INTEGRATION_VALIDATION_A233'
  );
  foAppendRowsA230(
    validationSheet,
    result.controls.map(function(control) {
      return [
        validationRun.runId,
        validationRun.timestamp,
        control.category,
        control.control,
        control.status,
        control.severity,
        control.details,
        validationRun.platformVersion,
        validationRun.baseline
      ];
    })
  );

  return {
    status: result.status,
    validationRunId: validationRun.runId,
    failedControls: result.failedControls,
    passedControls: result.passedControls,
    totalControls: result.totalControls,
    blocking: result.blocking
  };
}

function foRunExecutiveDecisionIntegrationLatestValidationA233() {
  const dashboard = foDashboard_();
  const stateSheet = dashboard.getSheetByName(
    FO_SHEETS.EXECUTIVE_DECISION_STATE_A233
  );
  if (!stateSheet || stateSheet.getLastRow() < 2) {
    throw new Error(
      'Executive Decision State A233 is empty. Run A2.3.3 first.'
    );
  }
  const latestRunId = String(
    stateSheet.getRange(2, 1).getValue() || ''
  ).trim();
  if (!latestRunId) {
    throw new Error('A2.3.3 latest decision-state Run ID is unavailable.');
  }
  return foRunExecutiveDecisionIntegrationValidationA233(latestRunId);
}

function foRunExecutiveDecisionIntegrationSmokeTestA233() {
  const result = foRunExecutiveDecisionIntegrationA233();
  if (result.validation.failedControls > 0) {
    throw new Error(
      'A2.3.3 smoke test failed: ' +
      JSON.stringify(result.validation)
    );
  }
  return {
    status: 'PASS',
    wave: 'A2.3.3',
    releaseTarget: FO_A233_RELEASE_TARGET,
    runId: result.runId,
    portfolioPosture: result.portfolioPosture,
    executionStatus: result.executionStatus,
    conflictCount: result.conflictCount
  };
}

function foAppendExecutiveDecisionStateRowsA233_(rows, integration, reportId) {
  if (!integration) return;
  rows.push([
    'Executive Decision State',
    'Portfolio Posture',
    integration.portfolioPosture,
    integration.overallMateriality >= 85 ? 'Critical' : 'High',
    '',
    'Primary: ' + integration.primaryAction +
      ' Secondary: ' + integration.secondaryAction,
    reportId,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    new Date()
  ]);
  rows.push([
    'Executive Decision State',
    'Execution Status',
    integration.executionStatus,
    integration.executionStatus.indexOf('BLOCKED') === 0
      ? 'Critical' : 'High',
    '',
    'Conflict count: ' + integration.conflictCount,
    reportId,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    new Date()
  ]);
  rows.push([
    'Executive Decision State',
    'Overall Materiality',
    integration.overallMateriality,
    integration.overallMateriality >= 85 ? 'Critical' : 'High',
    '',
    'Market, portfolio and actionability materiality combined.',
    reportId,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    new Date()
  ]);
}

function foAppendDecisionSectionA233_(
  rows,
  sectionName,
  decisions,
  actions,
  reportId,
  integration
) {
  const cards = integration && integration.actionCards
    ? integration.actionCards : [];
  decisions.filter(function(decision) {
    return actions.indexOf(
      foA233Text_(decision.cioAction).toUpperCase()
    ) >= 0;
  }).forEach(function(decision) {
    const card = foA233FindCard_(
      cards,
      decision.ticker,
      decision.account
    );
    rows.push([
      sectionName,
      decision.ticker,
      card
        ? card.executionStatus + ' | ' + card.action
        : decision.cioAction,
      decision.priority,
      decision.riskRating,
      card
        ? (
          card.securityType +
          ' | Trigger: ' + card.trigger +
          ' | Invalidation: ' + card.invalidationCondition +
          ' | Recommendation ' + card.recommendation +
          ' | Confidence ' + card.confidence +
          ' (' + foA233SignedNumber_(card.confidenceDelta) + ')' +
          ' | Quality ' + card.recommendationQualityGrade +
          ' (' + card.recommendationQualityScore + ')' +
          ' | Contradiction ' + card.contradictionStatus +
          ' | ' + card.qualityRationale +
          ' | ' + card.commentary
        )
        : (
          decision.rationale ||
          decision.deploymentGuidance ||
          ''
        ),
      reportId,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      new Date()
    ]);
  });
}

function foA233FindCard_(cards, ticker, account) {
  const exactKey = foA233DecisionKey_(ticker, account);
  let tickerMatch = null;
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];
    if (foA233DecisionKey_(card.ticker, card.account) === exactKey) {
      return card;
    }
    if (
      !tickerMatch &&
      foA233Text_(card.ticker).toUpperCase() ===
        foA233Text_(ticker).toUpperCase()
    ) {
      tickerMatch = card;
    }
  }
  return tickerMatch;
}

function foA233ActionTrigger_(item, executionStatus) {
  if (item.priceFreshness !== 'FRESH') {
    return 'Price data is ' + (item.priceFreshness || 'UNAVAILABLE') +
      '. Refresh market data before evaluating the entry target.';
  }
  if (executionStatus === 'BLOCKED — STALE DATA') {
    return 'Fresh market price and refreshed Buy Zone required.';
  }
  if (executionStatus === 'BLOCKED — RISK CAPACITY') {
    return 'Portfolio risk must fall below CRITICAL.';
  }
  if (executionStatus === 'BLOCKED — RECOMMENDATION QUALITY') {
    return 'Recommendation quality must be MEDIUM or HIGH with no blocked contradiction.';
  }
  if (item.targetEntryPrice > 0) {
    return 'Price at or below target ' +
      item.targetEntryPrice + ' with fresh data.';
  }
  return 'Recommendation remains valid with fresh data.';
}

function foA233Invalidation_(item, executionStatus, risk) {
  if (executionStatus === 'BLOCKED — STALE DATA') {
    return 'Do not execute until price freshness is FRESH.';
  }
  if (executionStatus === 'BLOCKED — RISK CAPACITY') {
    return 'Do not add exposure while risk is ' +
      risk.riskLevel + '.';
  }
  if (executionStatus === 'BLOCKED — RECOMMENDATION QUALITY') {
    return item.qualityRationale ||
      'Do not execute until recommendation-quality blockers are resolved.';
  }
  if (item.targetEntryPrice > 0) {
    return 'Invalidate if price moves materially above target.';
  }
  return 'Invalidate on recommendation deterioration or rising risk.';
}

function foA233IsDeploymentAction_(action) {
  return [
    'BUY',
    'BUY / ADD',
    'ACCUMULATE',
    'ACCUMULATE ON WEAKNESS',
    'DEPLOY',
    'DEPLOY CAPITAL',
    'DEPLOY CAPITAL WITH LIMITS',
    'SELECTIVE ACCUMULATION'
  ].indexOf(foA233Text_(action).toUpperCase()) >= 0;
}

function foA233QualityBlocksExecution_(item) {
  const grade = foA233Text_(
    item && item.recommendationQualityGrade
  ).toUpperCase();
  const contradiction = foA233Text_(
    item && item.contradictionStatus
  ).toUpperCase();
  return (
    contradiction === 'BLOCKED' ||
    grade === 'LOW' ||
    grade === 'INSUFFICIENT DATA'
  );
}

function foA233LatestRows_(sheet) {
  const rows = foA233SheetRows_(sheet);
  if (!rows.length) return {runId: '', rows: []};
  const runHeader = foA233FindHeader_(
    Object.keys(rows[0]),
    ['Run ID', 'Snapshot Run ID', 'Validation Run ID']
  );
  if (!runHeader) return {runId: '', rows: rows};
  const latestRunId = foA233Text_(rows[rows.length - 1][runHeader]);
  return {
    runId: latestRunId,
    rows: rows.filter(function(row) {
      return foA233Text_(row[runHeader]) === latestRunId;
    })
  };
}

function foA233LatestMetricMap_(sheet) {
  const latest = foA233LatestRows_(sheet);
  const map = {runId: latest.runId, metrics: {}};
  latest.rows.forEach(function(row) {
    const metric = foA233Text_(row.Metric);
    if (!metric) return;
    map.metrics[metric] = {
      value: row.Value,
      status: row.Status,
      commentary: row.Commentary
    };
  });
  return map;
}

function foA233MetricValue_(map, metric) {
  return map && map.metrics && map.metrics[metric]
    ? map.metrics[metric].value : '';
}

function foA233MetricStatus_(map, metric) {
  return map && map.metrics && map.metrics[metric]
    ? map.metrics[metric].status : '';
}

function foA233SheetRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) {
      object[header] = row[index];
    });
    return object;
  });
}

function foA233FindHeader_(headers, candidates) {
  for (let index = 0; index < candidates.length; index++) {
    if (headers.indexOf(candidates[index]) >= 0) {
      return candidates[index];
    }
  }
  return '';
}

function foA233StateRow_(state) {
  return [
    state.runId, state.timestamp, state.portfolioPosture,
    state.executionStatus, state.primaryAction, state.secondaryAction,
    state.marketMateriality, state.portfolioMateriality,
    state.actionability, state.overallMateriality,
    state.portfolioRiskLevel, state.riskScore,
    state.largestPositionTicker, state.largestPositionPct,
    state.priceFreshnessCoveragePct, state.costBasisCoveragePct,
    state.returnAttributionCoveragePct, state.conflictCount,
    state.platformVersion, state.baseline
  ];
}

function foA233ActionCardRow_(card) {
  return [
    card.runId, card.timestamp, card.rank, card.ticker,
    card.securityType, card.account, card.action,
    card.executionStatus, card.trigger, card.invalidationCondition,
    card.confidence, card.priorConfidence, card.confidenceDelta,
    card.trend, card.materialityScore, card.portfolioWeight,
    card.priceFreshness, card.currentPrice, card.targetEntryPrice,
    card.riskImpact, card.commentary, card.platformVersion,
    card.baseline, card.recommendation,
    card.recommendationQualityScore,
    card.recommendationQualityGrade,
    card.evidenceBalance,
    card.contradictionStatus,
    card.qualityRationale,
    card.basePriorityScore,
    card.executivePriorityScore,
    card.priorityLevel,
    card.significantChange,
    card.attentionType,
    card.overallTrajectory,
    card.reversalStatus,
    card.trendEvidenceStrength,
    card.priorityDriver,
    card.suppressionReason
  ];
}

function foA233EnsureAdditiveSchema_(dashboard, key) {
  const schema = foGetSchemaA230(key);
  let sheet = dashboard.getSheetByName(schema.sheetName);
  if (!sheet || sheet.getLastRow() === 0) {
    return foEnsureSheetA230(dashboard, key);
  }

  const expected = schema.headers.slice();
  const actual = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0].map(foA233Text_);

  if (actual.length > expected.length) {
    throw new Error(
      'A2.6.0 additive schema migration found unexpected columns: ' +
      schema.sheetName
    );
  }
  for (let index = 0; index < actual.length; index++) {
    if (actual[index] !== expected[index]) {
      throw new Error(
        'A2.6.0 additive schema migration found incompatible header at ' +
        schema.sheetName + ' column ' + (index + 1)
      );
    }
  }

  if (actual.length < expected.length) {
    if (sheet.getMaxColumns() < expected.length) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        expected.length - sheet.getMaxColumns()
      );
    }
    sheet.getRange(
      1,
      actual.length + 1,
      1,
      expected.length - actual.length
    ).setValues([expected.slice(actual.length)]);
  }

  return foEnsureSheetA230(dashboard, key);
}

function foA233ConflictRow_(conflict) {
  return [
    conflict.runId, conflict.timestamp, conflict.conflictCode,
    conflict.severity, conflict.status, conflict.description,
    conflict.evidence, conflict.requiredResolution,
    conflict.platformVersion, conflict.baseline
  ];
}

function foA233SchemaMatches_(sheet, expectedHeaders) {
  if (!sheet || sheet.getLastColumn() !== expectedHeaders.length) {
    return false;
  }
  const actual = sheet.getRange(
    1, 1, 1, sheet.getLastColumn()
  ).getDisplayValues()[0];
  return expectedHeaders.every(function(header, index) {
    return foA233Text_(actual[index]) === header;
  });
}

function foA233DecisionKey_(ticker, account) {
  return foA233Text_(ticker).toUpperCase() + '|' +
    foA233Text_(account).toUpperCase();
}

function foA233Number_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(
    String(value).replace(/\$/g, '').replace(/,/g, '')
      .replace(/%/g, '').trim()
  );
  return Number.isFinite(number) ? number : 0;
}

function foA233NullableNumber_(value) {
  if (
    value === null || value === undefined || value === '' ||
    foA233Text_(value).toUpperCase() === 'UNAVAILABLE'
  ) {
    return null;
  }
  return foA233Number_(value);
}

function foA233Text_(value) {
  return String(
    value === null || value === undefined ? '' : value
  ).trim();
}

function foA233PercentText_(value) {
  return (foA233Number_(value) * 100).toFixed(2) + '%';
}

function foA233SignedNumber_(value) {
  const number = foA233Number_(value);
  return (number > 0 ? '+' : '') + number;
}
