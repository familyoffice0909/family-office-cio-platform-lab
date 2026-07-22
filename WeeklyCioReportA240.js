/**
 * Wave A2.4.0 — Unified Weekly CIO Report
 *
 * Produces a governed weekly report sourced from A2.3.3 Executive Decision
 * Integration. The report does not create an independent posture or execution
 * recommendation.
 */
const FO_A240_RELEASE_TARGET = 'v1.3.0';
const FO_A240_RETURN_COVERAGE_THRESHOLD = 0.80;
const FO_A2401_ZERO_TOLERANCE = 0.0000001;

function foRunWeeklyCioReportA240(options) {
  return foWithRuntimeLock_(
    'Run Weekly CIO Report A240 archive workflow',
    function() {
      return foRunWeeklyCioReportA240Protected_(options);
    }
  );
}

function foRunWeeklyCioReportA240Protected_(options) {
  foAssertRuntimeLockHeld_(
    'Run Weekly CIO Report A240 archive workflow'
  );
  const settings = options || {};
  const dashboard = foDashboard_();

  if (
    settings.refreshDecisionState !== false &&
    typeof foRunExecutiveDecisionIntegrationA233 === 'function'
  ) {
    foRunExecutiveDecisionIntegrationA233();
  }

  const stateSheet = dashboard.getSheetByName(
    FO_SHEETS.EXECUTIVE_DECISION_STATE_A233
  );
  const stateRows = foA240LatestRows_(stateSheet, 'Run ID');
  const state = stateRows.rows[0] || null;

  if (!state || !stateRows.runId) {
    throw new Error(
      'Executive Decision State A233 is unavailable. Run A2.3.3 first.'
    );
  }

  const run = foCreateRunMetadataA230('WEEKLY-CIO');
  const reportId = run.runId;
  const decisionRunId = stateRows.runId;
  const weekEnding = foA240ResolveWeekEnding_(
    settings.weekEnding || run.timestamp
  );

  const actionCards = foA240RowsForRun_(
    dashboard.getSheetByName(FO_SHEETS.REPORT_ACTION_CARDS_A233),
    'Run ID',
    decisionRunId
  );
  const conflicts = foA240RowsForRun_(
    dashboard.getSheetByName(FO_SHEETS.REPORT_CONFLICTS_A233),
    'Run ID',
    decisionRunId
  );
  const readiness = foA240RowsForRun_(
    dashboard.getSheetByName(FO_SHEETS.REPORT_DATA_READINESS_A233),
    'Run ID',
    decisionRunId
  );
  const returnMetrics = foA240LatestMetricMap_(
    dashboard.getSheetByName(FO_SHEETS.RETURN_ATTRIBUTION_SUMMARY_A232)
  );
  const coverageMetrics = foA240LatestMetricMap_(
    dashboard.getSheetByName(
      FO_SHEETS.ATTRIBUTION_COVERAGE_SUMMARY_A2311
    )
  );
  const certification = foA240LatestCertification_(dashboard);
  const positionRisk = foA240PositionRiskMap_(dashboard);

  const reportSheet = foEnsureSheetA230(
    dashboard,
    'WEEKLY_CIO_REPORT_A240'
  );
  const archiveSheet = foA240EnsureAdditiveSchema_(
    dashboard,
    'WEEKLY_CIO_REPORT_ARCHIVE_A240'
  );
  const priorArchive = foA240LatestArchive_(archiveSheet);

  const model = foA240BuildModel_(
    state,
    actionCards,
    conflicts,
    readiness,
    returnMetrics,
    coverageMetrics,
    certification,
    positionRisk,
    priorArchive,
    reportId,
    decisionRunId,
    weekEnding,
    run
  );

  foReplaceRowsA230(reportSheet, model.rows);
  foA240FormatReportSheet_(reportSheet);
  SpreadsheetApp.flush();

  const validation = foRunWeeklyCioReportValidationA240(
    reportId,
    decisionRunId
  );

  foAppendRowsA230(archiveSheet, [
    foA240ArchiveRow_(model, validation, run)
  ]);

  return {
    status: validation.failedControls ? 'FAIL' : 'PASS',
    reportId: reportId,
    decisionRunId: decisionRunId,
    weekEnding: weekEnding,
    portfolioPosture: model.portfolioPosture,
    executionStatus: model.executionStatus,
    capitalDeploymentAuthorization:
      model.capitalDeploymentAuthorization,
    actionCardCount: actionCards.length,
    conflictCount: conflicts.length,
    validation: validation,
    releaseTarget: FO_A240_RELEASE_TARGET
  };
}

function foA240BuildModel_(
  state,
  actionCards,
  conflicts,
  readiness,
  returnMetrics,
  coverageMetrics,
  certification,
  positionRisk,
  priorArchive,
  reportId,
  decisionRunId,
  weekEnding,
  run
) {
  const portfolioPosture = foA240Text_(state['Portfolio Posture']);
  const executionStatus = foA240Text_(state['Execution Status']);
  const riskLevel = foA240Text_(state['Portfolio Risk Level']);
  const riskScore = foA240Number_(state['Risk Score']);
  const overallMateriality = foA240Number_(
    state['Overall Materiality']
  );
  const priceFreshness = foA240Number_(
    state['Price Freshness Coverage %']
  );
  const costBasisCoverage = foA240Number_(
    state['Cost Basis Coverage %']
  );
  const returnCoverage = foA240Number_(
    state['Return Attribution Coverage %']
  );
  const capitalDeploymentAuthorization =
    executionStatus === 'EXECUTABLE' ? 'AUTHORIZED' : 'NOT AUTHORIZED';
  const reportMode = executionStatus === 'EXECUTABLE'
    ? 'EXECUTABLE'
    : (executionStatus === 'CONDITIONAL'
      ? 'CONDITIONAL'
      : 'INFORMATIONAL ONLY');
  const priority = foA240PortfolioPriority_(
    riskLevel,
    riskScore,
    overallMateriality,
    executionStatus
  );

  const context = {
    reportId: reportId,
    decisionRunId: decisionRunId,
    reportTimestamp: run.timestamp,
    weekEnding: weekEnding,
    platformVersion: run.platformVersion,
    baseline: run.baseline
  };
  const rows = [];
  const add = function(
    section,
    rowPriority,
    metric,
    current,
    prior,
    delta,
    status,
    evidence,
    source
  ) {
    rows.push(foA240ReportRow_(
      context,
      section,
      rowPriority,
      metric,
      current,
      prior,
      delta,
      status,
      evidence,
      source
    ));
  };

  add(
    'REPORT GOVERNANCE',
    priority,
    'Report Mode',
    reportMode,
    '',
    '',
    reportMode === 'EXECUTABLE' ? 'AVAILABLE' : 'CONTROLLED',
    'The report inherits the A2.3.3 authoritative execution state.',
    'Executive Decision State A233'
  );
  add(
    'REPORT GOVERNANCE',
    priority,
    'Capital Deployment Authorization',
    capitalDeploymentAuthorization,
    priorArchive['Capital Deployment Authorization'] || '',
    '',
    capitalDeploymentAuthorization === 'AUTHORIZED'
      ? 'AVAILABLE'
      : 'BLOCKED',
    capitalDeploymentAuthorization === 'AUTHORIZED'
      ? 'A2.3.3 permits deployment subject to the position action cards.'
      : 'Do not add material exposure while the unified execution state is not EXECUTABLE.',
    'Executive Decision State A233'
  );
  add(
    'EXECUTIVE SUMMARY',
    priority,
    '30-Second CIO Summary',
    foA240ExecutiveSummary_(state, capitalDeploymentAuthorization),
    '',
    '',
    priority,
    'Evidence-based summary generated from the governed decision state.',
    'Executive Decision State A233'
  );
  const whatsNew = foA240WhatsNew_(
    state,
    actionCards,
    conflicts,
    priorArchive,
    capitalDeploymentAuthorization
  );
  add(
    "WHAT'S NEW",
    whatsNew.priority,
    'Material Changes Since Previous Report',
    whatsNew.summary,
    priorArchive['Report ID'] || 'NOT AVAILABLE',
    whatsNew.changeCount,
    whatsNew.status,
    whatsNew.evidence,
    'Weekly CIO Report Archive A240 | Executive Decision State A233 | Report Action Cards A233'
  );
  add(
    'EXECUTIVE DECISION',
    priority,
    'Portfolio Posture',
    portfolioPosture,
    priorArchive['Portfolio Posture'] || '',
    foA240ChangeText_(
      priorArchive['Portfolio Posture'],
      portfolioPosture
    ),
    priority,
    'Authoritative portfolio posture. The Weekly Report does not calculate a separate posture.',
    'Executive Decision State A233'
  );
  add(
    'EXECUTIVE DECISION',
    priority,
    'Execution Status',
    executionStatus,
    priorArchive['Execution Status'] || '',
    foA240ChangeText_(
      priorArchive['Execution Status'],
      executionStatus
    ),
    foA240ExecutionControlStatus_(executionStatus),
    'Authoritative execution status for all report recommendations.',
    'Executive Decision State A233'
  );
  add(
    'EXECUTIVE DECISION',
    priority,
    'Primary Action',
    foA240Text_(state['Primary Action']),
    '',
    '',
    priority,
    'Highest-priority portfolio action from A2.3.3.',
    'Executive Decision State A233'
  );
  add(
    'EXECUTIVE DECISION',
    'HIGH',
    'Secondary Action',
    foA240Text_(state['Secondary Action']),
    '',
    '',
    'OPEN',
    'Secondary prerequisite or follow-up action from A2.3.3.',
    'Executive Decision State A233'
  );
  add(
    'EXECUTIVE DECISION',
    priority,
    'Overall Materiality',
    overallMateriality,
    priorArchive['Overall Materiality'] || '',
    foA240NumericDelta_(
      priorArchive['Overall Materiality'],
      overallMateriality
    ),
    overallMateriality >= 85 ? 'CRITICAL' :
      (overallMateriality >= 70 ? 'HIGH' : 'NORMAL'),
    'Combined market, portfolio and actionability materiality.',
    'Executive Decision State A233'
  );
  add(
    'RISK',
    priority,
    'Portfolio Risk',
    riskLevel,
    priorArchive['Portfolio Risk Level'] || '',
    foA240ChangeText_(
      priorArchive['Portfolio Risk Level'],
      riskLevel
    ),
    riskLevel || 'UNKNOWN',
    'Portfolio-level risk classification.',
    'Executive Decision State A233'
  );
  add(
    'RISK',
    priority,
    'Risk Score',
    riskScore,
    priorArchive['Risk Score'] || '',
    foA240NumericDelta_(priorArchive['Risk Score'], riskScore),
    riskScore >= 80 ? 'CRITICAL' : (riskScore >= 60 ? 'HIGH' : 'NORMAL'),
    'Higher values indicate reduced capacity for additional portfolio risk.',
    'Executive Decision State A233'
  );
  const largestTicker = foA240Text_(state['Largest Position Ticker']);
  const largestPct = foA240Number_(state['Largest Position %']);
  add(
    'RISK',
    priority,
    'Largest Position',
    largestTicker + ' — ' + foA240PercentPointsText_(largestPct),
    priorArchive['Largest Position Ticker'] || '',
    '',
    largestPct >= 30 ? 'CRITICAL' : (largestPct >= 20 ? 'HIGH' : 'NORMAL'),
    largestTicker + ' represents ' + foA240PercentPointsText_(largestPct) +
      ' of portfolio value.',
    'Executive Decision State A233'
  );

  const readinessHandledSeparately = {
    'Decision Price Freshness Coverage %': true,
    'Cost-Basis Coverage %': true,
    'Return Attribution Coverage %': true,
    'Unified Execution Status': true
  };
  readiness.forEach(function(item) {
    const control = foA240Text_(item.Control);
    if (readinessHandledSeparately[control]) return;
    add(
      'DATA READINESS',
      foA240ReadinessPriority_(item.Status),
      control,
      control.indexOf('%') >= 0
        ? foA240PercentText_(item.Value)
        : item.Value,
      '',
      '',
      foA240Text_(item.Status),
      foA240Text_(item.Commentary),
      'Report Data Readiness A233'
    );
  });

  add(
    'DATA READINESS',
    foA240ExecutionControlStatus_(executionStatus) === 'BLOCKED'
      ? 'CRITICAL' : 'NORMAL',
    'Unified Execution Status',
    executionStatus,
    priorArchive['Execution Status'] || '',
    foA240ChangeText_(priorArchive['Execution Status'], executionStatus),
    foA240ExecutionControlStatus_(executionStatus),
    'Authoritative execution state for all executive reports.',
    'Report Data Readiness A233'
  );

  const rawReturn = foA240MetricValue_(
    returnMetrics,
    'Portfolio Price Return %'
  );
  const returnStatus = foA240MetricStatus_(
    returnMetrics,
    'Portfolio Price Return %'
  );
  const reportableReturn =
    returnCoverage >= FO_A240_RETURN_COVERAGE_THRESHOLD &&
    foA240IsNumeric_(rawReturn);

  add(
    'PERIOD PERFORMANCE',
    'HIGH',
    'Measurement Period',
    'SNAPSHOT-TO-SNAPSHOT',
    '',
    '',
    'NOT A CALENDAR-WEEK RETURN',
    'The latest A2.3.2 comparison may not span the full weekly reporting period.',
    foA240MetricSource_('Return Attribution Summary A232', returnMetrics)
  );
  add(
    'PERIOD PERFORMANCE',
    reportableReturn ? 'NORMAL' : 'HIGH',
    'Portfolio Price Return %',
    reportableReturn ? foA240PercentText_(rawReturn) : 'SUPPRESSED',
    '',
    '',
    reportableReturn ? (returnStatus || 'AVAILABLE') : 'INSUFFICIENT COVERAGE',
    reportableReturn
      ? 'Latest consecutive-snapshot price return. This is not assumed to equal a full calendar-week return.'
      : 'Return is suppressed because eligible return-attribution coverage is below 80% or the metric is unavailable.',
    foA240MetricSource_(
      'Return Attribution Summary A232',
      returnMetrics
    )
  );
  add(
    'PERIOD PERFORMANCE',
    returnCoverage >= FO_A240_RETURN_COVERAGE_THRESHOLD ? 'NORMAL' : 'HIGH',
    'Return Attribution Coverage %',
    foA240PercentText_(returnCoverage),
    priorArchive['Return Attribution Coverage %'] || '',
    foA240NumericDelta_(
      priorArchive['Return Attribution Coverage %'],
      returnCoverage
    ),
    returnCoverage >= FO_A240_RETURN_COVERAGE_THRESHOLD
      ? 'READY'
      : 'PARTIAL',
    'Eligible beginning market value divided by total beginning market value.',
    foA240MetricSource_(
      'Return Attribution Summary A232',
      returnMetrics
    )
  );
  foA240AppendMetricIfPresent_(
    add,
    returnMetrics,
    'Beginning Portfolio Market Value',
    'PERIOD PERFORMANCE'
  );
  foA240AppendMetricIfPresent_(
    add,
    returnMetrics,
    'Eligible Beginning Market Value',
    'PERIOD PERFORMANCE'
  );
  foA240AppendReturnDriver_(
    add,
    returnMetrics,
    'Top Return Contributor'
  );
  foA240AppendReturnDriver_(
    add,
    returnMetrics,
    'Top Return Detractor'
  );

  add(
    'DATA READINESS',
    costBasisCoverage >= FO_A240_RETURN_COVERAGE_THRESHOLD ? 'NORMAL' : 'HIGH',
    'Cost-Basis Coverage %',
    foA240PercentText_(costBasisCoverage),
    priorArchive['Cost Basis Coverage %'] || '',
    foA240NumericDelta_(
      priorArchive['Cost Basis Coverage %'],
      costBasisCoverage
    ),
    costBasisCoverage >= FO_A240_RETURN_COVERAGE_THRESHOLD
      ? 'READY'
      : 'INSUFFICIENT',
    foA240MetricCommentary_(
      coverageMetrics,
      'Cost-Basis Coverage %',
      'Portfolio-wide unrealized return remains suppressed below 80% coverage.'
    ),
    foA240MetricSource_(
      'Attribution Coverage Summary A2311',
      coverageMetrics
    )
  );
  add(
    'DATA READINESS',
    priceFreshness >= 0.80 ? 'NORMAL' : 'CRITICAL',
    'Decision Price Freshness Coverage %',
    foA240PercentText_(priceFreshness),
    priorArchive['Price Freshness Coverage %'] || '',
    foA240NumericDelta_(
      priorArchive['Price Freshness Coverage %'],
      priceFreshness
    ),
    priceFreshness >= 0.80 ? 'READY' : 'BLOCKED',
    'Fresh decision inputs are required before an investment action can become executable.',
    'Executive Decision State A233'
  );

  const sortedCards = actionCards.slice().sort(function(a, b) {
    return foA240Number_(a.Rank) - foA240Number_(b.Rank);
  });
  sortedCards.forEach(function(card) {
    const securityType = foA240Text_(card['Security Type']).toUpperCase();
    const section = securityType === 'CURRENT HOLDING'
      ? 'CURRENT HOLDING ACTION'
      : 'EXTERNAL OPPORTUNITY';
    const actionPriority = foA240ActionPriority_(card);
    const ticker = foA240Text_(card.Ticker).toUpperCase();
    const account = foA240Text_(card.Account);
    const positionWeight = foA240ResolvePositionWeight_(
      positionRisk, ticker, account, card['Portfolio Weight']
    );
    const isPrimaryRiskDriver =
      riskLevel.toUpperCase() === 'CRITICAL' &&
      ticker === largestTicker.toUpperCase();
    const controlledAction = isPrimaryRiskDriver
      ? 'REVIEW / REDUCE CONCENTRATION'
      : foA240Text_(card.Action);
    const riskImpact = isPrimaryRiskDriver
      ? 'PRIMARY PORTFOLIO RISK DRIVER'
      : foA240Text_(card['Risk Impact']);
    const trigger = isPrimaryRiskDriver
      ? 'Confirm current price, quantity and account exposure before risk reduction.'
      : foA240CleanNumericText_(foA240Text_(card.Trigger));
    const invalidation = isPrimaryRiskDriver
      ? 'Risk-reduction requirement ends when concentration falls below policy limits.'
      : foA240CleanNumericText_(foA240Text_(card['Invalidation Condition']));
    const hasPriorReport = Boolean(priorArchive && priorArchive['Report ID']);
    add(
      section,
      isPrimaryRiskDriver ? 'CRITICAL' : actionPriority,
      foA240ActionLabel_(card),
      foA240Text_(card['Execution Status']) + ' | ' + controlledAction,
      hasPriorReport
        ? 'Confidence ' + foA240Number_(card['Prior Confidence'])
        : 'NOT AVAILABLE',
      hasPriorReport
        ? foA240Number_(card['Confidence Delta'])
        : 'BASELINE CREATED',
      foA240Text_(card['Price Freshness']) + ' | ' +
        foA240Text_(card.Trend),
      'Trigger: ' + trigger +
        ' | Invalidation: ' + invalidation +
        ' | Risk impact: ' + riskImpact +
        ' | Portfolio weight: ' + foA240PercentPointsText_(positionWeight) +
        ' | Confidence: ' + foA240Number_(card.Confidence) +
        ' | Materiality: ' + foA240Number_(card['Materiality Score']) +
        ' | Recommendation: ' + foA240Text_(card.Recommendation) +
        ' | Quality: ' +
          foA240Text_(card['Recommendation Quality Grade']) +
          ' (' +
          foA240Number_(card['Recommendation Quality Score']) + ')' +
        ' | Evidence balance: ' +
          foA240Text_(card['Evidence Balance']) +
        ' | Contradiction: ' +
          foA240Text_(card['Contradiction Status']) +
        ' | ' + foA240Text_(card['Quality Rationale']) +
        ' | ' + foA240Text_(card.Commentary),
      'Report Action Cards A233 | Position Risk'
    );
  });

  add(
    'CONFLICT CONTROL',
    conflicts.length ? 'CRITICAL' : 'NORMAL',
    'Report Conflict Count',
    conflicts.length,
    priorArchive['Conflict Count'] || '',
    foA240NumericDelta_(
      priorArchive['Conflict Count'],
      conflicts.length
    ),
    conflicts.length ? 'OPEN' : 'CLEAR',
    conflicts.length
      ? 'Open conflicts are listed below and must remain controlled.'
      : 'No A2.3.3 report conflicts were detected.',
    'Report Conflicts A233'
  );
  conflicts.forEach(function(conflict) {
    add(
      'CONFLICT CONTROL',
      foA240Text_(conflict.Severity) || 'HIGH',
      foA240Text_(conflict['Conflict Code']),
      foA240Text_(conflict.Status),
      '',
      '',
      foA240Text_(conflict.Severity),
      foA240Text_(conflict.Description) +
        ' | Evidence: ' + foA240Text_(conflict.Evidence) +
        ' | Required resolution: ' +
        foA240Text_(conflict['Required Resolution']),
      'Report Conflicts A233'
    );
  });

  add(
    'PLATFORM',
    certification.status === 'CERTIFIED' ? 'NORMAL' : 'HIGH',
    'Production Certification',
    certification.status || 'NOT AVAILABLE',
    '',
    '',
    certification.controlStatus || '',
    certification.commentary ||
      'Latest production certification status available to the report.',
    certification.source
  );
  add(
    'PLATFORM',
    'NORMAL',
    'Platform Release',
    FO_CONFIG.PLATFORM_VERSION + ' — ' + FO_CONFIG.RELEASE_NAME,
    '',
    '',
    FO_CONFIG.ENVIRONMENT,
    'Weekly report generated from the controlled platform configuration.',
    'Config.js'
  );

  return {
    rows: rows,
    reportId: reportId,
    decisionRunId: decisionRunId,
    weekEnding: weekEnding,
    portfolioPosture: portfolioPosture,
    executionStatus: executionStatus,
    capitalDeploymentAuthorization: capitalDeploymentAuthorization,
    overallMateriality: overallMateriality,
    riskLevel: riskLevel,
    riskScore: riskScore,
    largestPositionTicker: foA240Text_(
      state['Largest Position Ticker']
    ),
    largestPositionPct: foA240Number_(state['Largest Position %']),
    priceFreshnessCoveragePct: priceFreshness,
    costBasisCoveragePct: costBasisCoverage,
    returnAttributionCoveragePct: returnCoverage,
    actionCardCount: actionCards.length,
    conflictCount: conflicts.length,
    actionQualitySignature: foA240ActionQualitySignature_(actionCards)
  };
}

function foRunWeeklyCioReportValidationA240(
  expectedReportId,
  expectedDecisionRunId
) {
  const dashboard = foDashboard_();
  const suite = foCreateValidationSuiteA230(
    'A2.4.0.2 Percentage Unit Normalization'
  );
  const reportSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_A240
  );
  const archiveSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_ARCHIVE_A240
  );
  const stateSheet = dashboard.getSheetByName(
    FO_SHEETS.EXECUTIVE_DECISION_STATE_A233
  );
  const conflictSheet = dashboard.getSheetByName(
    FO_SHEETS.REPORT_CONFLICTS_A233
  );
  const actionSheet = dashboard.getSheetByName(
    FO_SHEETS.REPORT_ACTION_CARDS_A233
  );

  suite.add('SCHEMA', 'Weekly report schema valid', function() {
    return foA240SchemaMatches_(
      reportSheet,
      foGetHeadersA230('WEEKLY_CIO_REPORT_A240')
    );
  }, 'CRITICAL');

  suite.add('SCHEMA', 'Weekly report archive schema valid', function() {
    return foA240SchemaMatches_(
      archiveSheet,
      foGetHeadersA230('WEEKLY_CIO_REPORT_ARCHIVE_A240')
    );
  }, 'HIGH');

  suite.add('OUTPUT', 'Weekly report populated', function() {
    return Boolean(reportSheet && reportSheet.getLastRow() > 1);
  }, 'CRITICAL');

  suite.add('LINEAGE', 'Report and decision lineage valid', function() {
    if (!reportSheet || reportSheet.getLastRow() < 2) return false;
    return foA240SheetRows_(reportSheet).every(function(row) {
      return (
        foA240Text_(row['Report ID']) ===
          foA240Text_(expectedReportId) &&
        foA240Text_(row['Decision Run ID']) ===
          foA240Text_(expectedDecisionRunId)
      );
    });
  }, 'CRITICAL');

  suite.add('GOVERNANCE', 'Portfolio posture matches A2.3.3', function() {
    const source = foA240RowsForRun_(
      stateSheet,
      'Run ID',
      expectedDecisionRunId
    )[0] || {};
    const reported = foA240FindReportMetric_(
      reportSheet,
      'Portfolio Posture'
    );
    return foA240Text_(reported['Current Value / Action']) ===
      foA240Text_(source['Portfolio Posture']);
  }, 'CRITICAL');

  suite.add('GOVERNANCE', 'Execution status matches A2.3.3', function() {
    const source = foA240RowsForRun_(
      stateSheet,
      'Run ID',
      expectedDecisionRunId
    )[0] || {};
    const reported = foA240FindReportMetric_(
      reportSheet,
      'Execution Status'
    );
    return foA240Text_(reported['Current Value / Action']) ===
      foA240Text_(source['Execution Status']);
  }, 'CRITICAL');

  suite.add('QUALITY', 'Recommendation quality is inherited from A2.3.3',
    function() {
      const cards = foA240RowsForRun_(
        actionSheet,
        'Run ID',
        expectedDecisionRunId
      );
      return cards.every(function(card) {
        const reported = foA240FindReportMetric_(
          reportSheet,
          foA240ActionLabel_(card)
        );
        const evidence = foA240Text_(
          reported['Evidence / Commentary']
        );
        const grade = foA240Text_(
          card['Recommendation Quality Grade']
        );
        const contradiction = foA240Text_(
          card['Contradiction Status']
        );
        return Boolean(
          reported['Metric / Ticker'] &&
          evidence.indexOf('Quality: ' + grade) >= 0 &&
          evidence.indexOf('Contradiction: ' + contradiction) >= 0
        );
      });
    }, 'HIGH');

  suite.add('POLICY', 'Capital deployment authorization is controlled',
    function() {
      const execution = foA240FindReportMetric_(
        reportSheet,
        'Execution Status'
      );
      const authorization = foA240FindReportMetric_(
        reportSheet,
        'Capital Deployment Authorization'
      );
      const executionValue = foA240Text_(
        execution['Current Value / Action']
      );
      const authorizationValue = foA240Text_(
        authorization['Current Value / Action']
      );
      return executionValue === 'EXECUTABLE'
        ? authorizationValue === 'AUTHORIZED'
        : authorizationValue === 'NOT AUTHORIZED';
    }, 'CRITICAL');

  suite.add('POLICY', 'Unsupported return claims are suppressed', function() {
    const coverage = foA240Number_(
      (foA240FindReportMetric_(
        reportSheet,
        'Return Attribution Coverage %'
      ) || {})['Current Value / Action']
    );
    const returnRow = foA240FindReportMetric_(
      reportSheet,
      'Portfolio Price Return %'
    );
    if (coverage >= FO_A240_RETURN_COVERAGE_THRESHOLD) return true;
    return foA240Text_(returnRow['Current Value / Action']) === 'SUPPRESSED';
  }, 'CRITICAL');

  suite.add('CLASSIFICATION',
    'Holdings and opportunities remain separated', function() {
      return foA240SheetRows_(reportSheet).filter(function(row) {
        return (
          row.Section === 'CURRENT HOLDING ACTION' ||
          row.Section === 'EXTERNAL OPPORTUNITY'
        );
      }).every(function(row) {
        const sourceType = row.Section === 'CURRENT HOLDING ACTION'
          ? 'CURRENT HOLDING'
          : 'EXTERNAL OPPORTUNITY';
        return foA240Text_(row.Source).indexOf('Report Action Cards A233') === 0 &&
          foA240ReportActionMatchesType_(
            dashboard,
            expectedDecisionRunId,
            row['Metric / Ticker'],
            sourceType
          );
      });
    }, 'HIGH');

  suite.add('RECONCILIATION', 'Conflict count reconciles', function() {
    const reported = foA240Number_(
      (foA240FindReportMetric_(
        reportSheet,
        'Report Conflict Count'
      ) || {})['Current Value / Action']
    );
    const actual = foA240RowsForRun_(
      conflictSheet,
      'Run ID',
      expectedDecisionRunId
    ).length;
    return reported === actual;
  }, 'HIGH');

  suite.add('CONTROL', 'Data-readiness banner is present', function() {
    return foA240SheetRows_(reportSheet).some(function(row) {
      return row.Section === 'DATA READINESS';
    });
  }, 'HIGH');

  suite.add('CONTROL', 'A2.3.3 source validation is passing', function() {
    return foA240LatestSourceValidationPass_(
      dashboard.getSheetByName(
        FO_SHEETS.REPORT_INTEGRATION_VALIDATION_A233
      )
    );
  }, 'CRITICAL');

  suite.add('CONTROL', 'Platform metadata is consistent', function() {
    if (!reportSheet || reportSheet.getLastRow() < 2) return false;
    return foA240SheetRows_(reportSheet).every(function(row) {
      return (
        foA240Text_(row['Platform Version']) ===
          foA240Text_(FO_CONFIG.PLATFORM_VERSION) &&
        foA240Text_(row.Baseline) === foA240Text_(FO_CONFIG.BASELINE)
      );
    });
  }, 'HIGH');

  suite.add('PRESENTATION',
    'Largest-position percentage is correctly classified', function() {
      const row = foA240FindReportMetric_(reportSheet, 'Largest Position');
      return foA240Text_(row.Status) !== '' &&
        foA240Text_(row.Status).indexOf('%') < 0 &&
        foA240Text_(row['Current Value / Action']).indexOf('%') >= 0;
    }, 'CRITICAL');

  suite.add('RECONCILIATION',
    'Action-card weights reconcile to Position Risk', function() {
      const weights = foA240PositionRiskMap_(dashboard);
      return foA240SheetRows_(reportSheet).filter(function(row) {
        return row.Section === 'CURRENT HOLDING ACTION';
      }).every(function(row) {
        const expected = foA240ResolvePositionWeightFromLabel_(
          weights, row['Metric / Ticker']
        );
        const reported = foA240ExtractPortfolioWeight_(
          row['Evidence / Commentary']
        );
        return expected === null ||
          Math.abs(expected - reported) <= 0.01;
      });
    }, 'CRITICAL');

  suite.add('GOVERNANCE',
    'Critical concentration receives a risk-management action', function() {
      const state = foA240RowsForRun_(
        stateSheet, 'Run ID', expectedDecisionRunId
      )[0] || {};
      if (foA240Text_(state['Portfolio Risk Level']).toUpperCase() !== 'CRITICAL') {
        return true;
      }
      const ticker = foA240Text_(state['Largest Position Ticker']).toUpperCase();
      return foA240SheetRows_(reportSheet).some(function(row) {
        return row.Section === 'CURRENT HOLDING ACTION' &&
          foA240Text_(row['Metric / Ticker']).toUpperCase().indexOf(ticker) === 0 &&
          foA240Text_(row['Current Value / Action']).indexOf(
            'REVIEW / REDUCE CONCENTRATION'
          ) >= 0;
      });
    }, 'CRITICAL');

  suite.add('PRESENTATION',
    'Zero contributor and detractor values are not ranked', function() {
      return ['Top Return Contributor', 'Top Return Detractor'].every(function(metric) {
        const row = foA240FindReportMetric_(reportSheet, metric);
        if (!row || !Object.keys(row).length) return true;
        const current = foA240Text_(row['Current Value / Action']).toUpperCase();
        return current === 'NONE' || Math.abs(foA240Number_(current)) > FO_A2401_ZERO_TOLERANCE;
      });
    }, 'HIGH');


  suite.add('PERCENTAGE UNIT',
    'Portfolio weights are valid percentage points', function() {
      const reportedWeights = foA240SheetRows_(reportSheet)
        .filter(function(row) {
          return row.Section === 'CURRENT HOLDING ACTION';
        })
        .map(function(row) {
          return foA240ExtractPortfolioWeight_(
            row['Evidence / Commentary']
          );
        });
      return reportedWeights.length > 0 &&
        reportedWeights.every(function(weight) {
          return Number.isFinite(weight) && weight >= 0 && weight <= 100;
        });
    }, 'CRITICAL');

  suite.add('RECONCILIATION',
    'Portfolio weights total approximately 100 percent', function() {
      const reportedWeights = foA240SheetRows_(reportSheet)
        .filter(function(row) {
          return row.Section === 'CURRENT HOLDING ACTION';
        })
        .map(function(row) {
          return foA240ExtractPortfolioWeight_(
            row['Evidence / Commentary']
          );
        });
      if (!reportedWeights.length) return false;
      const total = reportedWeights.reduce(function(sum, weight) {
        return sum + weight;
      }, 0);
      return Math.abs(total - 100) <= 0.25;
    }, 'CRITICAL');

  suite.add('RECONCILIATION',
    'Largest position percentage matches Position Risk', function() {
      const state = foA240RowsForRun_(
        stateSheet, 'Run ID', expectedDecisionRunId
      )[0] || {};
      const ticker = foA240Text_(
        state['Largest Position Ticker']
      ).toUpperCase();
      const sourcePct = foA240Number_(state['Largest Position %']);
      const row = foA240FindReportMetric_(reportSheet, 'Largest Position');
      const current = foA240Text_(row['Current Value / Action']);
      const match = current.match(/—\s*(-?[0-9.]+)%/);
      const reportedPct = match ? Number(match[1]) : NaN;
      const weights = foA240PositionRiskMap_(dashboard);
      const riskPct = Object.prototype.hasOwnProperty.call(
        weights.tickerTotals, ticker
      ) ? weights.tickerTotals[ticker] : null;
      return Number.isFinite(reportedPct) &&
        reportedPct >= 0 && reportedPct <= 100 &&
        Math.abs(reportedPct - sourcePct) <= 0.01 &&
        (riskPct === null || Math.abs(reportedPct - riskPct) <= 0.02);
    }, 'CRITICAL');

  suite.add('PRESENTATION',
    'Report contains no implausible portfolio percentages', function() {
      return foA240SheetRows_(reportSheet).every(function(row) {
        if (row.Section !== 'CURRENT HOLDING ACTION' &&
            row['Metric / Ticker'] !== 'Largest Position') {
          return true;
        }
        const text = foA240Text_(row['Current Value / Action']) + ' ' +
          foA240Text_(row['Evidence / Commentary']);
        const matches = text.match(/-?[0-9]+(?:\.[0-9]+)?%/g) || [];
        return matches.every(function(token) {
          const value = Number(token.replace('%', ''));
          return Number.isFinite(value) && value >= 0 && value <= 100;
        });
      });
    }, 'CRITICAL');

  const result = suite.run();
  const validationRun = foCreateRunMetadataA230('WEEKLY-CIO-VAL');
  const validationSheet = foEnsureSheetA230(
    dashboard,
    'WEEKLY_CIO_REPORT_VALIDATION_A240'
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

function foRunWeeklyCioReportLatestValidationA240() {
  const dashboard = foDashboard_();
  const reportSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_A240
  );
  if (!reportSheet || reportSheet.getLastRow() < 2) {
    throw new Error('Weekly CIO Report A240 is empty. Run A2.4.0 first.');
  }
  const row = foA240SheetRows_(reportSheet)[0] || {};
  return foRunWeeklyCioReportValidationA240(
    row['Report ID'],
    row['Decision Run ID']
  );
}

function foRunWeeklyCioReportSmokeTestA240() {
  const result = foRunWeeklyCioReportA240();
  if (result.validation.failedControls > 0) {
    throw new Error(
      'A2.4.0 weekly report smoke test failed: ' +
      JSON.stringify(result.validation)
    );
  }
  return {
    status: 'PASS',
    wave: 'A2.4.0.2',
    releaseTarget: FO_A240_RELEASE_TARGET,
    reportId: result.reportId,
    decisionRunId: result.decisionRunId,
    portfolioPosture: result.portfolioPosture,
    executionStatus: result.executionStatus,
    capitalDeploymentAuthorization:
      result.capitalDeploymentAuthorization,
    actionCardCount: result.actionCardCount,
    conflictCount: result.conflictCount,
    validation: result.validation.status
  };
}

function foA240ReportRow_(
  context,
  section,
  priority,
  metric,
  current,
  prior,
  delta,
  status,
  evidence,
  source
) {
  return [
    context.reportId,
    context.decisionRunId,
    context.reportTimestamp,
    context.weekEnding,
    section,
    priority,
    metric,
    current,
    prior,
    delta,
    status,
    evidence,
    source,
    context.platformVersion,
    context.baseline
  ];
}

function foA240ArchiveRow_(model, validation, run) {
  return [
    run.timestamp,
    model.reportId,
    model.weekEnding,
    model.decisionRunId,
    model.portfolioPosture,
    model.executionStatus,
    model.capitalDeploymentAuthorization,
    model.overallMateriality,
    model.riskLevel,
    model.riskScore,
    model.largestPositionTicker,
    model.largestPositionPct,
    model.priceFreshnessCoveragePct,
    model.costBasisCoveragePct,
    model.returnAttributionCoveragePct,
    model.actionCardCount,
    model.conflictCount,
    validation.status,
    run.platformVersion,
    run.baseline,
    model.actionQualitySignature
  ];
}

function foA240WhatsNew_(
  state,
  actionCards,
  conflicts,
  priorArchive,
  deploymentAuthorization
) {
  const hasPriorReport = Boolean(priorArchive && priorArchive['Report ID']);
  if (!hasPriorReport) {
    return {
      summary: '• Baseline weekly report established; no prior report is available for comparison.',
      changeCount: 1,
      priority: 'NORMAL',
      status: 'BASELINE CREATED',
      evidence: 'The current report establishes the comparison baseline for the next weekly cycle.'
    };
  }

  const changes = [];
  const addChange = function(priority, score, text) {
    changes.push({priority: priority, score: score, text: text});
  };
  const posture = foA240Text_(state['Portfolio Posture']);
  const execution = foA240Text_(state['Execution Status']);
  const riskLevel = foA240Text_(state['Portfolio Risk Level']);
  const riskScore = foA240Number_(state['Risk Score']);
  const materiality = foA240Number_(state['Overall Materiality']);
  const priorPosture = priorArchive['Portfolio Posture'];
  const priorExecution = priorArchive['Execution Status'];
  const priorRiskLevel = priorArchive['Portfolio Risk Level'];
  const priorRiskScore = priorArchive['Risk Score'];
  const priorMateriality = priorArchive['Overall Materiality'];
  const priorAuthorization = priorArchive['Capital Deployment Authorization'];
  const priorConflictCount = priorArchive['Conflict Count'];
  const priorQualitySignature = foA240Text_(
    priorArchive['Action Quality Signature']
  );

  if (foA240ChangeText_(priorPosture, posture) !== 'UNCHANGED') {
    addChange('CRITICAL', 100, 'Portfolio posture changed ' +
      foA240ChangeText_(priorPosture, posture) + '.');
  }
  if (foA240ChangeText_(priorExecution, execution) !== 'UNCHANGED') {
    addChange('CRITICAL', 95, 'Execution status changed ' +
      foA240ChangeText_(priorExecution, execution) + '.');
  }
  if (foA240ChangeText_(priorAuthorization, deploymentAuthorization) !== 'UNCHANGED') {
    addChange('CRITICAL', 90, 'Capital deployment authorization changed ' +
      foA240ChangeText_(priorAuthorization, deploymentAuthorization) + '.');
  }
  if (foA240ChangeText_(priorRiskLevel, riskLevel) !== 'UNCHANGED') {
    addChange('HIGH', 85, 'Portfolio risk changed ' +
      foA240ChangeText_(priorRiskLevel, riskLevel) + '.');
  }

  const materialityDelta = foA240NumericDelta_(priorMateriality, materiality);
  if (Math.abs(materialityDelta) >= 5) {
    addChange(
      Math.abs(materialityDelta) >= 10 ? 'CRITICAL' : 'HIGH',
      80 + Math.min(Math.abs(materialityDelta), 19),
      'Overall materiality ' + (materialityDelta > 0 ? 'increased' : 'decreased') +
        ' ' + foA240Number_(priorMateriality) + ' → ' + materiality +
        ' (' + (materialityDelta > 0 ? '+' : '') + materialityDelta + ').'
    );
  }

  const riskDelta = foA240NumericDelta_(priorRiskScore, riskScore);
  if (Math.abs(riskDelta) >= 5) {
    addChange(
      Math.abs(riskDelta) >= 10 ? 'CRITICAL' : 'HIGH',
      75 + Math.min(Math.abs(riskDelta), 19),
      'Risk score ' + (riskDelta > 0 ? 'increased' : 'decreased') +
        ' ' + foA240Number_(priorRiskScore) + ' → ' + riskScore +
        ' (' + (riskDelta > 0 ? '+' : '') + riskDelta + ').'
    );
  }

  const conflictDelta = foA240NumericDelta_(priorConflictCount, conflicts.length);
  if (conflictDelta !== 0) {
    addChange(
      conflicts.length ? 'CRITICAL' : 'HIGH',
      conflicts.length ? 92 : 70,
      conflicts.length
        ? 'Open report conflicts changed ' + foA240Number_(priorConflictCount) +
          ' → ' + conflicts.length + '.'
        : 'All previously reported conflicts are now clear.'
    );
  }

  actionCards.forEach(function(card) {
    const confidenceDelta = foA240Number_(card['Confidence Delta']);
    const materialityScore = foA240Number_(card['Materiality Score']);
    const executionStatus = foA240Text_(card['Execution Status']);
    if (Math.abs(confidenceDelta) < 5 && materialityScore < 70) return;
    const label = foA240ActionLabel_(card);
    const direction = confidenceDelta > 0
      ? 'increased'
      : (confidenceDelta < 0 ? 'decreased' : 'is unchanged');
    addChange(
      materialityScore >= 85 ? 'CRITICAL' : 'HIGH',
      materialityScore,
      label + ' confidence ' + direction +
        (confidenceDelta ? ' by ' + Math.abs(confidenceDelta) + ' points' : '') +
        '; execution status is ' + executionStatus + '.'
    );
  });

  if (priorQualitySignature) {
    const priorQuality = foA240ParseActionQualitySignature_(
      priorQualitySignature
    );
    const currentQuality = foA240ParseActionQualitySignature_(
      foA240ActionQualitySignature_(actionCards)
    );
    Object.keys(currentQuality).forEach(function(key) {
      const current = currentQuality[key];
      const prior = priorQuality[key];
      if (!prior) return;
      if (
        prior.grade === current.grade &&
        prior.contradiction === current.contradiction
      ) {
        return;
      }
      const blocked = current.contradiction === 'BLOCKED' ||
        current.grade === 'INSUFFICIENT DATA';
      addChange(
        blocked ? 'CRITICAL' : 'HIGH',
        blocked ? 94 : 78,
        current.label + ' recommendation quality changed ' +
          prior.grade + '/' + prior.contradiction + ' → ' +
          current.grade + '/' + current.contradiction + '.'
      );
    });
  }

  changes.sort(function(a, b) { return b.score - a.score; });
  const selected = changes.slice(0, 5);
  if (!selected.length) {
    return {
      summary: 'No material changes since the previous report.',
      changeCount: 0,
      priority: 'NORMAL',
      status: 'UNCHANGED',
      evidence: 'Existing archive comparisons produced no material executive change above the configured thresholds.'
    };
  }
  return {
    summary: selected.map(function(item) { return '• ' + item.text; }).join('\n'),
    changeCount: selected.length,
    priority: selected.some(function(item) { return item.priority === 'CRITICAL'; })
      ? 'CRITICAL'
      : 'HIGH',
    status: 'MATERIAL CHANGE',
    evidence: 'Executive changes are ranked by materiality and limited to five bullets.'
  };
}

function foA240ActionQualitySignature_(actionCards) {
  return actionCards.map(function(card) {
    const ticker = foA240Text_(card.Ticker).toUpperCase();
    const account = foA240Text_(card.Account).toUpperCase();
    const grade = foA240Text_(
      card['Recommendation Quality Grade'] || 'NOT ASSESSED'
    ).toUpperCase();
    const contradiction = foA240Text_(
      card['Contradiction Status'] || 'NOT ASSESSED'
    ).toUpperCase();
    return [ticker, account, grade, contradiction].join('~');
  }).sort().join(';');
}

function foA240ParseActionQualitySignature_(signature) {
  const result = {};
  foA240Text_(signature).split(';').forEach(function(segment) {
    if (!segment) return;
    const parts = segment.split('~');
    if (parts.length < 4) return;
    const ticker = parts[0];
    const account = parts[1];
    const key = ticker + '|' + account;
    result[key] = {
      label: ticker + (account ? ' (' + account + ')' : ''),
      grade: parts[2],
      contradiction: parts[3]
    };
  });
  return result;
}

function foA240EnsureAdditiveSchema_(dashboard, key) {
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
  ).getDisplayValues()[0].map(foA240Text_);

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

function foA240ExecutiveSummary_(state, deploymentAuthorization) {
  return (
    foA240Text_(state['Portfolio Posture']) + '. ' +
    'Capital deployment: ' + deploymentAuthorization + '. ' +
    foA240Text_(state['Primary Action']) + ' ' +
    'Portfolio risk is ' + foA240Text_(state['Portfolio Risk Level']) +
    ' at ' + foA240Number_(state['Risk Score']) + '. ' +
    'Decision freshness is ' +
    foA240PercentText_(state['Price Freshness Coverage %']) +
    '; cost-basis coverage is ' +
    foA240PercentText_(state['Cost Basis Coverage %']) +
    '; return-attribution coverage is ' +
    foA240PercentText_(state['Return Attribution Coverage %']) + '.'
  );
}

function foA240AppendMetricIfPresent_(add, metricMap, metric, section) {
  const item = metricMap.metrics[metric];
  if (!item) return;
  add(
    section,
    item.status === 'INSUFFICIENT' || item.status === 'LIMITED'
      ? 'HIGH'
      : 'NORMAL',
    metric,
    item.value,
    '',
    '',
    item.status,
    item.commentary,
    foA240MetricSource_('Return Attribution Summary A232', metricMap)
  );
}

function foA240AppendReturnDriver_(add, metricMap, metric) {
  const item = metricMap.metrics[metric];
  if (!item) return;
  const value = foA240Number_(item.value);
  const meaningful = Math.abs(value) > FO_A2401_ZERO_TOLERANCE;
  add(
    'PERIOD PERFORMANCE',
    'NORMAL',
    metric,
    meaningful ? foA240PercentText_(value) : 'NONE',
    '',
    '',
    meaningful ? foA240Text_(item.status) : 'NO MEASURABLE DIFFERENTIATION',
    meaningful
      ? foA240Text_(item.commentary)
      : 'No measurable price-return differentiation was observed between snapshots.',
    foA240MetricSource_('Return Attribution Summary A232', metricMap)
  );
}

function foA240PositionRiskMap_(dashboard) {
  const latest = foA240LatestRows_(
    dashboard.getSheetByName(FO_SHEETS.POSITION_RISK),
    'Run ID'
  );
  const exact = {};
  const tickerTotals = {};
  latest.rows.forEach(function(row) {
    const ticker = foA240Text_(row.Ticker).toUpperCase();
    const account = foA240Text_(row.Account).toUpperCase();
    const weight = foA240Number_(
      row['Portfolio Weight %'] !== undefined
        ? row['Portfolio Weight %']
        : row['Portfolio Weight']
    );
    if (!ticker) return;
    exact[ticker + '|' + account] = weight;
    tickerTotals[ticker] = (tickerTotals[ticker] || 0) + weight;
  });
  return {exact: exact, tickerTotals: tickerTotals};
}

function foA240ResolvePositionWeight_(map, ticker, account, fallback) {
  const key = foA240Text_(ticker).toUpperCase() + '|' +
    foA240Text_(account).toUpperCase();
  if (map && Object.prototype.hasOwnProperty.call(map.exact, key)) {
    return map.exact[key];
  }
  const tickerKey = foA240Text_(ticker).toUpperCase();
  if (map && Object.prototype.hasOwnProperty.call(map.tickerTotals, tickerKey)) {
    return map.tickerTotals[tickerKey];
  }
  return foA240Number_(fallback);
}

function foA240ResolvePositionWeightFromLabel_(map, label) {
  const parts = foA240Text_(label).split(' — ');
  const ticker = foA240Text_(parts[0]).toUpperCase();
  const account = foA240Text_(parts.slice(1).join(' — ')).toUpperCase();
  const key = ticker + '|' + account;
  if (map && Object.prototype.hasOwnProperty.call(map.exact, key)) {
    return map.exact[key];
  }
  if (map && Object.prototype.hasOwnProperty.call(map.tickerTotals, ticker)) {
    return map.tickerTotals[ticker];
  }
  return null;
}

function foA240ExtractPortfolioWeight_(commentary) {
  const match = foA240Text_(commentary).match(/Portfolio weight:\s*(-?[0-9.]+)%/i);
  return match ? Number(match[1]) : 0;
}

function foA240CleanNumericText_(text) {
  return foA240Text_(text).replace(/(-?\d+\.\d{4,})/g, function(value) {
    return Number(value).toFixed(2);
  });
}

function foA240LatestMetricMap_(sheet) {
  const latest = foA240LatestRows_(sheet, 'Run ID');
  const map = {
    runId: latest.runId,
    timestamp: '',
    metrics: {}
  };
  latest.rows.forEach(function(row) {
    const metric = foA240Text_(row.Metric);
    if (!metric) return;
    map.timestamp = map.timestamp || row.Timestamp || '';
    map.metrics[metric] = {
      value: row.Value,
      status: foA240Text_(row.Status),
      commentary: foA240Text_(row.Commentary)
    };
  });
  return map;
}

function foA240MetricValue_(map, metric) {
  return map.metrics[metric] ? map.metrics[metric].value : '';
}

function foA240MetricStatus_(map, metric) {
  return map.metrics[metric] ? map.metrics[metric].status : '';
}

function foA240MetricCommentary_(map, metric, fallback) {
  return map.metrics[metric] && map.metrics[metric].commentary
    ? map.metrics[metric].commentary
    : fallback;
}

function foA240MetricSource_(name, map) {
  return name + (map.runId ? ' | Run ' + map.runId : '');
}

function foA240LatestRows_(sheet, runHeader) {
  const rows = foA240SheetRows_(sheet);
  if (!rows.length) return {runId: '', rows: []};
  const latestRunId = foA240Text_(rows[rows.length - 1][runHeader]);
  return {
    runId: latestRunId,
    rows: rows.filter(function(row) {
      return foA240Text_(row[runHeader]) === latestRunId;
    })
  };
}

function foA240RowsForRun_(sheet, runHeader, runId) {
  if (!runId) return [];
  return foA240SheetRows_(sheet).filter(function(row) {
    return foA240Text_(row[runHeader]) === foA240Text_(runId);
  });
}

function foA240SheetRows_(sheet) {
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

function foA240LatestArchive_(sheet) {
  const rows = foA240SheetRows_(sheet);
  return rows.length ? rows[rows.length - 1] : {};
}

function foA240LatestCertification_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.PRODUCTION_CERTIFICATION
  );
  const rows = foA240SheetRows_(sheet);
  if (!rows.length) {
    return {
      status: 'NOT AVAILABLE',
      controlStatus: '',
      commentary: 'No production certification row is available.',
      source: 'Production Certification'
    };
  }
  const row = rows[rows.length - 1];
  return {
    status: foA240Text_(
      row['Certification Status'] ||
      row['Overall Status'] ||
      row.Status ||
      row.Result
    ).toUpperCase(),
    controlStatus: foA240Text_(row['Control Status']),
    commentary: foA240Text_(
      row.Commentary || row.Notes || row.Details
    ),
    source: 'Production Certification'
  };
}

function foA240LatestSourceValidationPass_(sheet) {
  const latest = foA240LatestRows_(sheet, 'Validation Run ID');
  if (!latest.rows.length) return false;
  return latest.rows.every(function(row) {
    return foA240Text_(row.Status).toUpperCase() === 'PASS';
  });
}

function foA240FindReportMetric_(sheet, metric) {
  const rows = foA240SheetRows_(sheet);
  for (let index = 0; index < rows.length; index++) {
    if (foA240Text_(rows[index]['Metric / Ticker']) === metric) {
      return rows[index];
    }
  }
  return {};
}

function foA240ReportActionMatchesType_(
  dashboard,
  decisionRunId,
  reportLabel,
  expectedType
) {
  const cards = foA240RowsForRun_(
    dashboard.getSheetByName(FO_SHEETS.REPORT_ACTION_CARDS_A233),
    'Run ID',
    decisionRunId
  );
  return cards.some(function(card) {
    return foA240ActionLabel_(card) === reportLabel &&
      foA240Text_(card['Security Type']).toUpperCase() === expectedType;
  });
}

function foA240ActionLabel_(card) {
  const account = foA240Text_(card.Account);
  return foA240Text_(card.Ticker) + (account ? ' — ' + account : '');
}

function foA240SchemaMatches_(sheet, expectedHeaders) {
  if (!sheet || sheet.getLastColumn() !== expectedHeaders.length) {
    return false;
  }
  const actual = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getDisplayValues()[0];
  return expectedHeaders.every(function(header, index) {
    return foA240Text_(actual[index]) === header;
  });
}

function foA240FormatReportSheet_(sheet) {
  if (!sheet) return;
  const columns = foGetHeadersA230('WEEKLY_CIO_REPORT_A240').length;
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columns)
    .setFontWeight('bold')
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF');
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, columns)
      .setVerticalAlignment('top')
      .setWrap(true);
  }
  sheet.autoResizeColumns(1, columns);
  sheet.setColumnWidth(7, 220);
  sheet.setColumnWidth(8, 260);
  sheet.setColumnWidth(12, 520);
  sheet.setColumnWidth(13, 240);
}

function foA240ResolveWeekEnding_(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid A2.4.0 week-ending date.');
  }
  const daysSinceFriday = (date.getDay() - 5 + 7) % 7;
  date.setDate(date.getDate() - daysSinceFriday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function foA240PortfolioPriority_(
  riskLevel,
  riskScore,
  materiality,
  executionStatus
) {
  const execution = foA240Text_(executionStatus).toUpperCase();
  if (
    foA240Text_(riskLevel).toUpperCase() === 'CRITICAL' ||
    riskScore >= 80 ||
    materiality >= 85 ||
    execution.indexOf('BLOCKED') === 0 ||
    execution === 'RISK REDUCTION REQUIRED'
  ) {
    return 'CRITICAL';
  }
  if (riskScore >= 60 || materiality >= 70) return 'HIGH';
  return 'NORMAL';
}

function foA240ActionPriority_(card) {
  const execution = foA240Text_(card['Execution Status']).toUpperCase();
  const materiality = foA240Number_(card['Materiality Score']);
  if (execution.indexOf('BLOCKED') === 0 || materiality >= 85) {
    return 'CRITICAL';
  }
  if (materiality >= 70 || execution === 'CONDITIONAL') return 'HIGH';
  return 'NORMAL';
}

function foA240ReadinessPriority_(status) {
  const value = foA240Text_(status).toUpperCase();
  if (value === 'BLOCKED' || value === 'UNAVAILABLE') return 'CRITICAL';
  if (value === 'PARTIAL' || value === 'INSUFFICIENT') return 'HIGH';
  return 'NORMAL';
}

function foA240ExecutionControlStatus_(executionStatus) {
  const value = foA240Text_(executionStatus).toUpperCase();
  if (
    value.indexOf('BLOCKED') === 0 ||
    value === 'RISK REDUCTION REQUIRED'
  ) {
    return 'BLOCKED';
  }
  if (value === 'CONDITIONAL') return 'CONDITIONAL';
  if (value === 'EXECUTABLE') return 'AVAILABLE';
  return 'INFORMATIONAL';
}

function foA240ChangeText_(prior, current) {
  const before = foA240Text_(prior);
  const after = foA240Text_(current);
  if (!before) return 'NO PRIOR WEEKLY REPORT';
  return before === after ? 'UNCHANGED' : before + ' → ' + after;
}

function foA240NumericDelta_(prior, current) {
  if (prior === '' || prior === null || prior === undefined) return '';
  return foA240Number_(current) - foA240Number_(prior);
}

function foA240IsNumeric_(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || value === undefined || value === '') return false;
  const text = foA240Text_(value).toUpperCase();
  if (text === 'UNAVAILABLE' || text === 'SUPPRESSED') return false;
  return Number.isFinite(foA240Number_(value));
}

function foA240Number_(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  const percentage = text.indexOf('%') >= 0;
  const number = Number(
    text.replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').trim()
  );
  if (!Number.isFinite(number)) return 0;
  return percentage ? number / 100 : number;
}

function foA240RatioPercentText_(value) {
  return (foA240Number_(value) * 100).toFixed(2) + '%';
}

function foA240PercentPointsText_(value) {
  return foA240Number_(value).toFixed(2) + '%';
}

function foA240PercentText_(value) {
  return foA240RatioPercentText_(value);
}

function foA240Text_(value) {
  return String(
    value === null || value === undefined ? '' : value
  ).trim();
}
