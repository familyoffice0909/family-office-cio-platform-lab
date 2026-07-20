/************************************************************
 * ExecutiveReportingEngine.gs
 * Sprint 2.6.0 — Governed Executive Reporting
 ************************************************************/

function foRunExecutiveReportEngine() {
  const module = 'ExecutiveReportingEngine';

  try {
    foInfo_(module, 'Start', 'Executive Report Engine started.');

    const dashboard = foDashboard_();
    const integrationA233 =
      typeof foRunExecutiveDecisionIntegrationA233 === 'function'
        ? foRunExecutiveDecisionIntegrationA233()
        : null;

    if (!integrationA233) {
      throw new Error(
        'Executive Decision Integration A233 is unavailable. Run A2.3.3 first.'
      );
    }

    const decisions = foReadGovernedExecutiveDecisions_(
      dashboard,
      integrationA233
    );

    if (!decisions.length) {
      throw new Error(
        'Investment Decision Support has no governed rows to report.'
      );
    }

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
      'Based on Portfolio Performance Positions market value data.',
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

    foAppendDecisionSectionA233_(rows, 'Deploy Capital', decisions, ['DEPLOY NOW'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Buy / Add', decisions, ['BUY'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Accumulate', decisions, ['ACCUMULATE'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Hold', decisions, ['HOLD'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'Watch / Review', decisions, ['WATCH', 'REFRESH DATA'], reportId, integrationA233);
    foAppendDecisionSectionA233_(rows, 'No Action', decisions, ['AVOID'], reportId, integrationA233);

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

function foReadGovernedExecutiveDecisions_(dashboard, integrationA233) {
  const decisionSheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );
  if (!decisionSheet || decisionSheet.getLastRow() < 2) return [];

  const values = decisionSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const marketValues = foExecutiveMarketValueMap_(dashboard);
  const cards = integrationA233 && integrationA233.actionCards
    ? integrationA233.actionCards : [];

  return values.slice(1).map(function(row) {
    const ticker = String(
      foGetVal_(row, headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foGetVal_(row, headers, 'Account') || ''
    ).trim();
    if (!ticker) return null;

    const card = typeof foA233FindCard_ === 'function'
      ? foA233FindCard_(cards, ticker, account)
      : null;
    const risk = foNum_(foGetVal_(row, headers, 'Risk'));
    const qualityScore = foNum_(
      foGetVal_(row, headers, 'Recommendation Quality Score')
    );
    const qualityGrade = String(
      foGetVal_(row, headers, 'Recommendation Quality Grade') ||
      'NOT ASSESSED'
    ).trim().toUpperCase();
    const contradictionStatus = String(
      foGetVal_(row, headers, 'Contradiction Status') ||
      'NOT ASSESSED'
    ).trim().toUpperCase();
    const materiality = foNum_(
      foGetVal_(row, headers, 'Materiality Score')
    );
    const action = String(
      foGetVal_(row, headers, 'Action') || ''
    ).trim().toUpperCase();
    const qualityRationale = String(
      foGetVal_(row, headers, 'Quality Rationale') || ''
    ).trim();
    const executiveReason = String(
      foGetVal_(row, headers, 'Executive Reason') || ''
    ).trim();

    return {
      ticker: ticker,
      company: marketValues.companies[ticker] || '',
      account: account,
      marketValue: foExecutiveMarketValue_(marketValues, ticker, account),
      buyZoneConfidence: foNum_(
        foGetVal_(row, headers, 'Confidence')
      ),
      convictionScore: foNum_(
        foGetVal_(row, headers, 'Conviction')
      ),
      materialityScore: materiality,
      riskRating: risk > 50 ? 'HIGH' : (risk > 35 ? 'MEDIUM' : 'LOW'),
      marketRecommendation: String(
        foGetVal_(row, headers, 'Recommendation') || ''
      ).trim(),
      cioReadiness: qualityScore,
      cioAction: action,
      priority: contradictionStatus === 'BLOCKED' || materiality >= 85
        ? 'CRITICAL'
        : (qualityGrade === 'LOW' || qualityGrade === 'INSUFFICIENT DATA'
          ? 'HIGH'
          : (materiality >= 70 ? 'HIGH' : 'NORMAL')),
      deploymentGuidance: card ? card.executionStatus : '',
      requiresReview:
        contradictionStatus !== 'CLEAR' ||
        qualityGrade === 'LOW' ||
        qualityGrade === 'INSUFFICIENT DATA' ||
        (card && String(card.executionStatus).indexOf('BLOCKED') === 0)
          ? 'YES' : 'NO',
      recommendationQualityScore: qualityScore,
      recommendationQualityGrade: qualityGrade,
      evidenceBalance: String(
        foGetVal_(row, headers, 'Evidence Balance') || 'NOT ASSESSED'
      ).trim(),
      contradictionStatus: contradictionStatus,
      rationale: [qualityRationale, executiveReason]
        .filter(function(value) { return value; })
        .join(' | ')
    };
  }).filter(function(item) {
    return item !== null;
  });
}

function foExecutiveMarketValueMap_(dashboard) {
  const sheet = dashboard.getSheetByName('Portfolio Performance Positions');
  const result = {exact: {}, ticker: {}, companies: {}};
  if (!sheet || sheet.getLastRow() < 2) return result;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  values.slice(1).forEach(function(row) {
    const ticker = String(
      foGetVal_(row, headers, 'Ticker') || ''
    ).trim().toUpperCase();
    const account = String(
      foGetVal_(row, headers, 'Account') || ''
    ).trim().toUpperCase();
    const marketValue = foNum_(
      foGetVal_(row, headers, 'Market Value')
    );
    if (!ticker) return;
    const key = ticker + '|' + account;
    result.exact[key] = (result.exact[key] || 0) + marketValue;
    result.ticker[ticker] = (result.ticker[ticker] || 0) + marketValue;
    result.companies[ticker] = String(
      foGetVal_(row, headers, 'Company') || result.companies[ticker] || ''
    ).trim();
  });
  return result;
}

function foExecutiveMarketValue_(marketValues, ticker, account) {
  const key = String(ticker || '').trim().toUpperCase() + '|' +
    String(account || '').trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(marketValues.exact, key)) {
    return marketValues.exact[key];
  }
  return marketValues.ticker[String(ticker || '').trim().toUpperCase()] || 0;
}

function foBuildExecutiveSummary_(decisions) {
  const totalMarketValue = decisions.reduce(function(sum, d) {
    return sum + (Number(d.marketValue) || 0);
  }, 0);

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