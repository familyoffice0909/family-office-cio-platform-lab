/************************************************************
 * ExecutiveReportingEngine.gs
 * Wave 1C.7 — Executive Reporting Engine
 ************************************************************/

function foRunExecutiveReportEngine() {
  const module = 'ExecutiveReportingEngine';

  try {
    foInfo_(module, 'Start', 'Executive Report Engine started.');

    const dashboard = foDashboard_();
    const decisionSheet = dashboard.getSheetByName('CIO Decisions');

    if (!decisionSheet) {
      throw new Error('CIO Decisions sheet not found. Run CIO Decision Engine first.');
    }

    const values = decisionSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('CIO Decisions has no rows to report.');
    }

    const headers = values[0].map(String);
    const decisions = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const ticker = foGetVal_(row, headers, 'Ticker');

      if (!ticker) continue;

      decisions.push({
        ticker: ticker,
        company: foGetVal_(row, headers, 'Company'),
        account: foNormalizeAccountIdentity_(
          foGetVal_(row, headers, 'Account')
        ).name,
        marketValue: foNum_(foGetVal_(row, headers, 'Market Value')),
        buyZoneConfidence: foNum_(foGetVal_(row, headers, 'Buy Zone Confidence')),
        convictionScore: foNum_(foGetVal_(row, headers, 'Conviction Score')),
        materialityScore: foNum_(foGetVal_(row, headers, 'Materiality Score')),
        riskRating: foGetVal_(row, headers, 'Risk Rating'),
        marketRecommendation: foGetVal_(row, headers, 'Market Recommendation'),
        cioReadiness: foNum_(foGetVal_(row, headers, 'CIO Readiness')),
        cioAction: foGetVal_(row, headers, 'CIO Action'),
        priority: foGetVal_(row, headers, 'Priority'),
        deploymentGuidance: foGetVal_(row, headers, 'Deployment Guidance'),
        requiresReview: foGetVal_(row, headers, 'Requires Review'),
        rationale: foGetVal_(row, headers, 'Decision Rationale')
      });
    }

    const integrationA233 =
      typeof foRunExecutiveDecisionIntegrationA233 === 'function'
        ? foRunExecutiveDecisionIntegrationA233()
        : null;

    const reportId = foNowId_('EXEC-RPT');
    const summary = foBuildExecutiveSummary_(decisions);

    const output = foEnsureSheet_(dashboard, 'Executive CIO Report', [
      'Section',
      'Metric / Ticker',
      'Value / Action',
      'Priority',
      'Risk',
      'Notes',
      'Report ID',
      'Platform Version',
      'Baseline',
      'Timestamp'
    ]);

    if (output.getLastRow() > 1) {
      output.getRange(2, 1, output.getLastRow() - 1, 10).clearContent();
    }

    const rows = [];

    foAppendExecutiveDecisionStateRowsA233_(
      rows,
      integrationA233,
      reportId
    );

    rows.push([
      'Executive Summary',
      'Overall CIO Readiness',
      summary.averageReadiness,
      summary.overallPriority,
      summary.portfolioRisk,
      summary.executiveNarrative,
      reportId,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      new Date()
    ]);

    rows.push([
      'Executive Summary',
      'Total Market Value',
      summary.totalMarketValue,
      '',
      '',
      'Based on CIO Decisions market value data.',
      reportId,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      new Date()
    ]);

    rows.push([
      'Executive Summary',
      'Actions Requiring Review',
      summary.reviewCount,
      '',
      '',
      'Items where CIO review is required before execution.',
      reportId,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      new Date()
    ]);

    foAppendDecisionSectionA233_(rows, 'Deploy Capital', decisions, ['DEPLOY CAPITAL WITH LIMITS'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Buy / Add', decisions, ['BUY / ADD'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Accumulate', decisions, ['ACCUMULATE ON WEAKNESS'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Hold', decisions, ['HOLD'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Watch / Review', decisions, ['WATCH / REVIEW'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'No Action', decisions, ['NO ACTION'], reportId, integrationA233);

    if (rows.length > 0) {
      output.getRange(2, 1, rows.length, 10).setValues(rows);
    }

    foArchiveExecutiveReport_(dashboard, reportId, summary);

    foInfo_(module, 'Complete', 'Executive report generated: ' + reportId);

    return {
      status: 'SUCCESS',
      reportId: reportId,
      rowsWritten: rows.length,
      averageReadiness: summary.averageReadiness
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foBuildExecutiveSummary_(decisions) {
  const aggregation = foAggregateHouseholdPortfolio(
    foCreateHouseholdPortfolioFromPositions(decisions.map(function(decision) {
      return {
        ticker: decision.ticker,
        company: decision.company,
        account: decision.account,
        marketValue: Number(decision.marketValue) || 0,
        marketValueCurrency: FO_CONFIG.BASE_CURRENCY
      };
    }), FO_CONFIG.BASE_CURRENCY)
  );
  const totalMarketValue = aggregation.totalMarketValue;

  const readinessValues = decisions
    .map(function(d) { return Number(d.cioReadiness || 0); })
    .filter(function(v) { return v > 0; });

  const averageReadiness =
    readinessValues.length > 0
      ? Math.round(readinessValues.reduce(function(a, b) { return a + b; }, 0) / readinessValues.length)
      : 0;

  const reviewCount = decisions.filter(function(d) {
    return String(d.requiresReview || '').toUpperCase() === 'YES';
  }).length;

  const criticalCount = decisions.filter(function(d) {
    return String(d.priority || '').toUpperCase() === 'CRITICAL';
  }).length;

  const highRiskCount = decisions.filter(function(d) {
    return String(d.riskRating || '').toUpperCase() === 'HIGH';
  }).length;

  let portfolioRisk = 'Low';
  if (highRiskCount >= 3) portfolioRisk = 'High';
  else if (highRiskCount >= 1) portfolioRisk = 'Medium';

  let overallPriority = 'Normal';
  if (criticalCount > 0) overallPriority = 'Critical';
  else if (averageReadiness >= 85) overallPriority = 'High';

  let narrative = 'Portfolio remains stable. No urgent action required.';

  if (criticalCount > 0) {
    narrative = 'Critical opportunity detected. CIO review required before capital deployment.';
  } else if (averageReadiness >= 85) {
    narrative = 'Portfolio opportunity set is strong. Selective deployment is supported.';
  } else if (portfolioRisk === 'High') {
    narrative = 'Portfolio contains elevated risk exposures. Review before adding capital.';
  }

  return {
    totalMarketValue: totalMarketValue,
    averageReadiness: averageReadiness,
    reviewCount: reviewCount,
    criticalCount: criticalCount,
    highRiskCount: highRiskCount,
    portfolioRisk: portfolioRisk,
    overallPriority: overallPriority,
    executiveNarrative: narrative
  };
}

function foAppendDecisionSection_(rows, sectionName, decisions, actions, reportId) {
  const filtered = decisions.filter(function(d) {
    return actions.indexOf(String(d.cioAction || '').toUpperCase()) >= 0;
  });

  filtered.forEach(function(d) {
    rows.push([
      sectionName,
      d.ticker,
      d.cioAction,
      d.priority,
      d.riskRating,
      d.rationale || d.deploymentGuidance || '',
      reportId,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE,
      new Date()
    ]);
  });
}

function foArchiveExecutiveReport_(dashboard, reportId, summary) {
  const archive = foEnsureSheet_(dashboard, 'Executive Report Archive', [
    'Timestamp',
    'Report ID',
    'Average CIO Readiness',
    'Total Market Value',
    'Portfolio Risk',
    'Overall Priority',
    'Review Count',
    'Narrative',
    'Platform Version',
    'Baseline'
  ]);

  archive.appendRow([
    new Date(),
    reportId,
    summary.averageReadiness,
    summary.totalMarketValue,
    summary.portfolioRisk,
    summary.overallPriority,
    summary.reviewCount,
    summary.executiveNarrative,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ]);
}

function foRunExecutiveReportSmokeTest() {
  const module = 'ExecutiveReportingEngine';

  try {
    foInfo_(module, 'Start', 'Executive Report smoke test started.');

    const result = foRunExecutiveReportEngine();

    foInfo_(module, 'Complete', 'Executive Report smoke test completed: ' + result.reportId);

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
