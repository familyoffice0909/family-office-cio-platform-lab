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
  foRuntimeContextGet_();
  const settings = options || {};
  const dashboard = foDashboard_();

  if (
    settings.refreshDecisionState !== false &&
    typeof foRunExecutiveDecisionIntegrationA233 === 'function'
  ) {
    foRunExecutiveDecisionIntegrationA233();
  }

  const executiveEvidence =
    foGetA233ExecutiveEvidence_(dashboard);

  const stateRows = {
    runId: executiveEvidence.decisionState.runId,
    rows: executiveEvidence.decisionState.rows
  };

  if (!stateRows.runId || !stateRows.rows.length) {
    throw new Error(
      'Weekly CIO Report A240 requires Executive Decision State A233 evidence.'
    );
  }

  const decisionRunId = stateRows.runId;
  const state = stateRows.rows[0] || null;

  const run = foCreateRunMetadataA230('WEEKLY-CIO');
  const reportId = run.runId;
  const weekEnding = foA240ResolveWeekEnding_(
    settings.weekEnding || run.timestamp
  );

  const actionCards = executiveEvidence.actionCards.rows.filter(
    function(row) {
      return foA240Text_(row['Run ID']) === decisionRunId;
    }
  );

  const conflicts = executiveEvidence.conflicts.rows.filter(
    function(row) {
      return foA240Text_(row['Run ID']) === decisionRunId;
    }
  );

  const readiness = executiveEvidence.dataReadiness.rows.filter(
    function(row) {
      return foA240Text_(row['Run ID']) === decisionRunId;
    }
  );
  const readinessMetrics = {
    runId: decisionRunId,
    metrics: {}
  };

  readiness.forEach(function(row) {
    const metric = foA240Text_(row.Control);
    if (!metric) return;

    readinessMetrics.metrics[metric] = {
      value: row.Value,
      status: foA240Text_(row.Status),
      commentary: foA240Text_(row.Commentary)
    };
  });

  const returnMetrics = foA240LatestMetricMap_(
    dashboard.getSheetByName(FO_SHEETS.RETURN_ATTRIBUTION_SUMMARY_A232)
  );
  const coverageMetrics = foA240LatestMetricMap_(
    dashboard.getSheetByName(
      FO_SHEETS.ATTRIBUTION_COVERAGE_SUMMARY_A2311
    )
  );

  const comparisonEligibility =
    foA240ResolveWeeklyComparisonEligibility_(
      returnMetrics,
      coverageMetrics
    );
  const certification = foA240LatestCertification_(dashboard);
  const positionRisk = foA240PositionRiskMap_(dashboard);
  const certificationMetadata =
    foA240LatestCertificationMetadata_(dashboard);
  const positionRiskMetadata =
    foA240LatestPositionRiskMetadata_(dashboard);

  const positionRiskRows = foA240RowsForRun_(
    dashboard.getSheetByName(FO_SHEETS.POSITION_RISK),
    'Run ID',
    positionRiskMetadata.runId
  );

  const decisionEvidenceAlignment =
    foA240ValidateDecisionEvidenceAlignment_(
      decisionRunId,
      actionCards,
      conflicts,
      readiness,
      returnMetrics,
      coverageMetrics,
      certificationMetadata,
      positionRiskMetadata,
      run
    );

  const reportSheet = foEnsureSheetA230(
    dashboard,
    'WEEKLY_CIO_REPORT_A240'
  );
  const archiveSheet = foA240EnsureAdditiveSchema_(
    dashboard,
    'WEEKLY_CIO_REPORT_ARCHIVE_A240'
  );
  const baselineIntegrity = foA240ResolveProductionBaseline_(run);

  const priorBaseline = foA240ResolvePriorWeeklyBaseline_(
    archiveSheet,
    run,
    weekEnding
  );

  const priorArchive =
    priorBaseline.status === 'AVAILABLE'
      ? priorBaseline.priorReport
      : {};

  const reportingPeriodAlignment =
    foA240ValidateReportingPeriodAlignment_(
      weekEnding,
      run,
      state,
      returnMetrics,
      coverageMetrics,
      comparisonEligibility,
      positionRiskMetadata,
      certificationMetadata,
      priorBaseline
    );

  const concentrationAuthority =
    foA240ResolveConcentrationAuthority_(
      state,
      positionRiskRows,
      positionRiskMetadata
    );

  const concentrationTrend =
    foA240ReadConcentrationTrend_(
      dashboard,
      run.platformVersion,
      run.baseline
    );

  const trendAuthority =
    foA240ValidateTrendAuthority_(
      actionCards
    );

  const decisionHistoryIndex =
    foLoadDecisionHistoryIndex_(
      dashboard.getSheetByName(
        FO_SHEETS.INVESTMENT_DECISION_HISTORY
      )
    );

  const model = foA240BuildModel_(
    state,
    actionCards,
    conflicts,
    readiness,
    returnMetrics,
    coverageMetrics,
    certification,
    positionRisk,
    decisionEvidenceAlignment,
    reportingPeriodAlignment,
    concentrationAuthority,
    concentrationTrend,
    trendAuthority,
    readinessMetrics,
    decisionHistoryIndex,
    priorArchive,
    reportId,
    decisionRunId,
    weekEnding,
    run
  );

  const previousReportRows =
    foA240SheetRows_(reportSheet);

  foReplaceRowsA230(reportSheet, model.rows);
  foA240FormatReportSheet_(reportSheet);
  SpreadsheetApp.flush();

  const validation = foRunWeeklyCioReportValidationA240(
    reportId,
    decisionRunId
  );

  const persistenceStatus = foA240CanPersistWeeklyReport_(
    validation,
    baselineIntegrity
  )
    ? 'PERSISTED'
    : 'ANALYSIS ONLY';

  if (persistenceStatus === 'PERSISTED') {

    foAppendRowsA230(
      archiveSheet,
      [foA240ArchiveRow_(model, validation, run)]
    );

  } else {

    foReplaceRowsA230(
      reportSheet,
      previousReportRows
    );

  }

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
    persistenceStatus: persistenceStatus,
    productionBaselineStatus: baselineIntegrity.status,
    productionBaselineReason: baselineIntegrity.reason,
    weeklyComparisonStatus: priorBaseline.status,
    weeklyComparisonReason: priorBaseline.reason,
    priorReportId: priorBaseline.priorReportId,
    comparisonEligibility: comparisonEligibility.status,
    comparisonEligibilityReason: comparisonEligibility.reason,
    comparisonCoverage: comparisonEligibility.coverage,
    valuationTimestamp:
      comparisonEligibility.valuationTimestamp,
    latestPriceTimestamp:
      comparisonEligibility.latestPriceTimestamp,
    decisionEvidenceAlignment:
      decisionEvidenceAlignment.status,
    decisionEvidenceReason:
      decisionEvidenceAlignment.reason,
    decisionEvidenceComponents:
      decisionEvidenceAlignment,
    reportingPeriodAlignment:
      reportingPeriodAlignment.status,
    reportingPeriodReason:
      reportingPeriodAlignment.reason,
    reportingPeriodEvidence:
      reportingPeriodAlignment,
    concentrationAuthority:
      concentrationAuthority.status,
    concentrationAuthorityReason:
      concentrationAuthority.reason,
    concentrationAuthorityEvidence:
      concentrationAuthority,
    trendAuthority:
      trendAuthority.status,
    trendAuthorityReason:
      trendAuthority.reason,
    trendAuthorityEvidence:
      trendAuthority,
    releaseTarget: FO_A240_RELEASE_TARGET
  };
}


/**
 * Terminal-safe wrapper for clasp run-function.
 * Preserves the governed weekly report implementation and returns JSON text.
 */

/**
 * R7.7.C — Governed Weekly Retrieval API.
 *
 * Retrieves the newest persisted Weekly CIO report using the archive as
 * report-identity authority, then independently verifies report rows and
 * validation lineage before declaring the report deliverable.
 *
 * This function never reconstructs a report.
 */
function foGetLatestGovernedWeeklyReportA240() {
  const dashboard = foDashboard_();

  const reportSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_A240
  );
  const archiveSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_ARCHIVE_A240
  );
  const validationSheet = dashboard.getSheetByName(
    FO_SHEETS.WEEKLY_CIO_REPORT_VALIDATION_A240
  );

  if (!reportSheet || !archiveSheet || !validationSheet) {
    return {
      status: 'FAIL',
      deliveryStatus: 'DATA_ACCESS_FAILURE',
      deliverable: false,
      reason: 'One or more governed Weekly A240 worksheets are unavailable.'
    };
  }

  const archiveRows = foA240SheetRows_(archiveSheet);

  if (!archiveRows.length) {
    return {
      status: 'FAIL',
      deliveryStatus: 'PERSISTENCE_FAILURE',
      deliverable: false,
      reason: 'No persisted Weekly CIO archive record is available.'
    };
  }

  // Archive is append-only; newest persisted archive record is authoritative.
  const archive = archiveRows[archiveRows.length - 1];

  const reportId = String(archive['Report ID'] || '').trim();
  const decisionRunId = String(archive['Decision Run ID'] || '').trim();
  const archiveValidationStatus = String(
    archive['Validation Status'] || ''
  ).trim().toUpperCase();

  if (!reportId || !decisionRunId) {
    return {
      status: 'FAIL',
      deliveryStatus: 'GOVERNANCE_FAILURE',
      deliverable: false,
      reason: 'Latest Weekly archive record lacks Report ID or Decision Run ID.',
      archive: archive
    };
  }

  const reportRows = foA240SheetRows_(reportSheet).filter(function(row) {
    return String(row['Report ID'] || '').trim() === reportId &&
      String(row['Decision Run ID'] || '').trim() === decisionRunId;
  });

  if (!reportRows.length) {
    return {
      status: 'FAIL',
      deliveryStatus: 'PERSISTENCE_FAILURE',
      deliverable: false,
      reason: 'Persisted Weekly report rows were not found for the latest archive identity.',
      reportId: reportId,
      decisionRunId: decisionRunId,
      archive: archive
    };
  }

  const validationRows = foA240SheetRows_(validationSheet).filter(function(row) {
    return String(row['Report ID'] || '').trim() === reportId &&
      String(row['Decision Run ID'] || '').trim() === decisionRunId;
  });

  if (!validationRows.length) {
    return {
      status: 'FAIL',
      deliveryStatus: 'VALIDATION_FAILURE',
      deliverable: false,
      reason: 'No persisted Weekly validation lineage matches the latest archived report.',
      reportId: reportId,
      decisionRunId: decisionRunId,
      archive: archive,
      rows: reportRows
    };
  }

  const validationRunIds = Array.from(
    new Set(validationRows.map(function(row) {
      return String(row['Validation Run ID'] || '').trim();
    }).filter(Boolean))
  );

  if (validationRunIds.length !== 1) {
    return {
      status: 'FAIL',
      deliveryStatus: 'GOVERNANCE_FAILURE',
      deliverable: false,
      reason: 'Weekly validation lineage resolves to multiple Validation Run IDs.',
      reportId: reportId,
      decisionRunId: decisionRunId,
      validationRunIds: validationRunIds,
      archive: archive
    };
  }

  const failedValidation = validationRows.filter(function(row) {
    return String(row['Status'] || '').trim().toUpperCase() !== 'PASS';
  });

  if (archiveValidationStatus !== 'PASS' || failedValidation.length) {
    return {
      status: 'FAIL',
      deliveryStatus: 'VALIDATION_FAILURE',
      deliverable: false,
      reason: 'Latest persisted Weekly report has blocking or non-PASS validation evidence.',
      reportId: reportId,
      decisionRunId: decisionRunId,
      validationRunId: validationRunIds[0],
      archiveValidationStatus: archiveValidationStatus,
      failedValidation: failedValidation,
      archive: archive,
      rows: reportRows,
      validation: validationRows
    };
  }

  const reportLineageMismatch = reportRows.some(function(row) {
    return String(row['Report ID'] || '').trim() !== reportId ||
      String(row['Decision Run ID'] || '').trim() !== decisionRunId;
  });

  if (reportLineageMismatch) {
    return {
      status: 'FAIL',
      deliveryStatus: 'GOVERNANCE_FAILURE',
      deliverable: false,
      reason: 'Weekly report-row lineage does not match the latest archive identity.',
      reportId: reportId,
      decisionRunId: decisionRunId,
      archive: archive
    };
  }

  return {
    status: 'PASS',
    deliveryStatus: 'DELIVERABLE',
    deliverable: true,

    reportId: reportId,
    decisionRunId: decisionRunId,
    validationRunId: validationRunIds[0],

    validationStatus: 'PASS',
    platformVersion: archive['Platform Version'] || '',
    baseline: archive['Baseline'] || '',

    archive: archive,
    rows: reportRows,
    validation: validationRows,

    reportRowCount: reportRows.length,
    validationControlCount: validationRows.length,

    reason: 'Latest persisted Weekly CIO report passed governed retrieval and lineage verification.'
  };
}

function foGetLatestGovernedWeeklyReportA240Clasp() {
  const result = foGetLatestGovernedWeeklyReportA240();

  return JSON.stringify({
    status: result.status || '',
    deliveryStatus: result.deliveryStatus || '',
    deliverable: result.deliverable === true,
    reportId: result.reportId || '',
    decisionRunId: result.decisionRunId || '',
    validationRunId: result.validationRunId || '',
    validationStatus: result.validationStatus || '',
    platformVersion: result.platformVersion || '',
    baseline: result.baseline || '',
    reportRowCount: Number(result.reportRowCount || 0),
    validationControlCount: Number(result.validationControlCount || 0),
    reason: result.reason || ''
  });
}

function foRunWeeklyCioReportA240Clasp() {
  const result = foRunWeeklyCioReportA240();

  return JSON.stringify(result, function(key, value) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value === undefined) {
      return null;
    }

    return value;
  });
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
  decisionEvidenceAlignment,
  reportingPeriodAlignment,
  concentrationAuthority,
  concentrationTrend,
  trendAuthority,
  readinessMetrics,
  decisionHistoryIndex,
  priorArchive,
  reportId,
  decisionRunId,
  weekEnding,
  run
) {
  const weeklyComparisonEligibility =
    foA240ResolveWeeklyComparisonEligibility_(
      returnMetrics,
      coverageMetrics
    );

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
    decisionEvidenceAlignment.status === 'INCOMPATIBLE'
      ? 'CRITICAL'
      : decisionEvidenceAlignment.status === 'COMPATIBLE'
        ? 'HIGH'
        : 'NORMAL',
    'Decision Evidence Alignment',
    decisionEvidenceAlignment.status,
    '',
    '',
    decisionEvidenceAlignment.status === 'INCOMPATIBLE'
      ? 'BLOCKED'
      : decisionEvidenceAlignment.status === 'COMPATIBLE'
        ? 'CONTROLLED'
        : 'READY',
    decisionEvidenceAlignment.reason,
    'Executive Decision State A233 | Report Action Cards A233 | ' +
      'Report Conflicts A233 | Report Data Readiness A233 | ' +
      'Return Attribution Summary A232 | ' +
      'Attribution Coverage Summary A2311 | ' +
      'Production Certification | Position Risk'
  );

  add(
    'REPORT GOVERNANCE',
    reportingPeriodAlignment.status === 'INCOMPATIBLE'
      ? 'CRITICAL'
      : reportingPeriodAlignment.status === 'PARTIAL'
        ? 'HIGH'
        : 'NORMAL',
    'Reporting Period Alignment',
    reportingPeriodAlignment.status,
    '',
    '',
    reportingPeriodAlignment.status === 'INCOMPATIBLE'
      ? 'BLOCKED'
      : reportingPeriodAlignment.status === 'PARTIAL'
        ? 'CONTROLLED'
        : 'READY',
    reportingPeriodAlignment.reason,
    'Executive Decision State A233 | ' +
      'Return Attribution Summary A232 | ' +
      'Attribution Coverage Summary A2311 | ' +
      'Position Risk | Production Certification | ' +
      'Weekly CIO Report Archive A240'
  );

  add(
    'REPORT GOVERNANCE',
    concentrationAuthority.status === 'NOT CERTIFIED'
      ? 'CRITICAL'
      : concentrationAuthority.status === 'PARTIAL'
        ? 'HIGH'
        : 'NORMAL',
    'Concentration Authority',
    concentrationAuthority.status,
    '',
    '',
    concentrationAuthority.status === 'NOT CERTIFIED'
      ? 'BLOCKED'
      : concentrationAuthority.status === 'PARTIAL'
        ? 'CONTROLLED'
        : 'READY',
    concentrationAuthority.reason +
      ' | Basis: ' + concentrationAuthority.basis +
      ' | Ticker: ' + concentrationAuthority.ticker +
      (
        concentrationAuthority.account
          ? ' | Account: ' + concentrationAuthority.account
          : ''
      ) +
      ' | A233 weight: ' +
      foA240PercentPointsText_(
        concentrationAuthority.reportedPct
      ) +
      (
        concentrationAuthority.reconciledPct === null
          ? ''
          : ' | Position Risk weight: ' +
            foA240PercentPointsText_(
              concentrationAuthority.reconciledPct
            )
      ),
    'Executive Decision State A233 | Position Risk'
  );

  add(
    'REPORT GOVERNANCE',
    trendAuthority.status === 'NOT CERTIFIED'
      ? 'CRITICAL'
      : trendAuthority.status === 'PARTIAL'
        ? 'HIGH'
        : 'NORMAL',
    'Trend Authority',
    trendAuthority.status,
    '',
    '',
    trendAuthority.status === 'NOT CERTIFIED'
      ? 'BLOCKED'
      : trendAuthority.status === 'PARTIAL'
        ? 'CONTROLLED'
        : 'READY',
    trendAuthority.reason +
      ' | Certified cards: ' +
      trendAuthority.certifiedCount +
      ' | Partial cards: ' +
      trendAuthority.partialCount +
      ' | Not certified cards: ' +
      trendAuthority.notCertifiedCount,
    'Report Action Cards A233 | Investment Trend Intelligence | ' +
      'Materiality & Prioritization Intelligence'
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

  const largestPositionPriorRaw =
    priorArchive &&
    priorArchive['Report ID']
      ? priorArchive['Largest Position %']
      : null;

  const largestPositionPrior =
    largestPositionPriorRaw === '' ||
    largestPositionPriorRaw === null ||
    largestPositionPriorRaw === undefined
      ? null
      : foA240Number_(largestPositionPriorRaw);

  const largestPositionDelta =
    largestPositionPrior === null
      ? null
      : foA240NumericDelta_(
          largestPositionPrior,
          largestPct
        );

  add(
    'RISK',
    priority,
    'Largest Position',
    largestTicker + ' — ' + foA240PercentPointsText_(largestPct),
    largestPositionPrior === null
      ? ''
      : foA240PercentPointsText_(largestPositionPrior),
    largestPositionDelta === null
      ? ''
      : foA240PercentPointsText_(largestPositionDelta),
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
      control === 'Recognized Positions'
        ? String(foA240Number_(item.Value))
        : control.indexOf('%') >= 0
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
    weeklyComparisonEligibility.status === 'ELIGIBLE';

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
      : 'Weekly portfolio return is not displayed because the governed snapshot comparison is not eligible or the return metric is unavailable.',
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
    foA240MetricCommentary_(
      readinessMetrics,
      'Decision Price Freshness Coverage %',
      'Fresh decision inputs are required before an investment action can become executable.'
    ),
    'Report Data Readiness A233'
  );

  add(
    'DATA READINESS',
    weeklyComparisonEligibility.status === 'ELIGIBLE'
      ? 'NORMAL'
      : weeklyComparisonEligibility.status === 'INCOMPATIBLE'
        ? 'CRITICAL'
        : 'HIGH',
    'Weekly Comparison Eligibility',
    weeklyComparisonEligibility.status,
    '',
    '',
    weeklyComparisonEligibility.status === 'ELIGIBLE'
      ? 'READY'
      : 'SUPPRESSED',
    weeklyComparisonEligibility.reason,
    foA240MetricSource_(
      'Return Attribution Summary A232 / Attribution Coverage Summary A2311',
      returnMetrics
    )
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
    const decisionKey = foDecisionKey_(ticker, account);
    const priorDecision =
      decisionHistoryIndex &&
      decisionHistoryIndex.compatiblePrevious
        ? decisionHistoryIndex.compatiblePrevious[decisionKey]
        : null;

    const currentRecommendation = foA240Text_(card.Recommendation);
    const priorRecommendation = priorDecision
      ? foA240Text_(priorDecision.recommendation)
      : '';

    const recommendationChange = priorRecommendation
      ? (
          currentRecommendation === priorRecommendation
            ? 'UNCHANGED'
            : 'CHANGED'
        )
      : 'BASELINE CREATED';

    add(
      section,
      isPrimaryRiskDriver ? 'CRITICAL' : actionPriority,
      foA240ActionLabel_(card),
      foA240Text_(card['Execution Status']) + ' | ' + controlledAction,
      priorRecommendation || 'NOT AVAILABLE',
      recommendationChange,
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

  const conflictSummaryStatus = !conflicts.length
    ? 'CLEAR'
    : (
        conflicts.every(function(conflict) {
          return foA240Text_(
            conflict.Status
          ).toUpperCase().indexOf('CONTROLLED') === 0;
        })
          ? 'CONTROLLED'
          : 'OPEN'
      );

  const conflictSummaryCommentary =
    conflictSummaryStatus === 'CLEAR'
      ? 'No A2.3.3 report conflicts were detected.'
      : (
          conflictSummaryStatus === 'CONTROLLED'
            ? 'All reported A2.3.3 conflicts are controlled by governed execution constraints.'
            : 'One or more A2.3.3 conflicts remain open and require resolution.'
        );

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
    conflictSummaryStatus,
    conflictSummaryCommentary,
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
    decisionEvidenceAlignment:
      decisionEvidenceAlignment.status,
    decisionEvidenceReason:
      decisionEvidenceAlignment.reason,
    reportingPeriodAlignment:
      reportingPeriodAlignment.status,
    reportingPeriodReason:
      reportingPeriodAlignment.reason,
    concentrationAuthority:
      concentrationAuthority.status,
    concentrationAuthorityReason:
      concentrationAuthority.reason,
    trendAuthority:
      trendAuthority.status,
    trendAuthorityReason:
      trendAuthority.reason,
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

  suite.add(
    'PERIOD',
    'Reporting-period alignment is governable',
    function() {
      const reported = foA240FindReportMetric_(
        reportSheet,
        'Reporting Period Alignment'
      );

      const reportedStatus = foA240Text_(
        reported['Current Value / Action']
      );

      const reportedControl = foA240Text_(
        reported.Status
      );

      if (reportedStatus === 'INCOMPATIBLE') {
        return false;
      }

      if (reportedStatus === 'ALIGNED') {
        return reportedControl === 'READY';
      }

      if (reportedStatus === 'PARTIAL') {
        return reportedControl === 'CONTROLLED';
      }

      return false;
    },
    'CRITICAL'
  );

  suite.add(
    'LINEAGE',
    'Decision evidence alignment is compatible',
    function() {
      const actionCards = foA240RowsForRun_(
        actionSheet,
        'Run ID',
        expectedDecisionRunId
      );
      const conflicts = foA240RowsForRun_(
        conflictSheet,
        'Run ID',
        expectedDecisionRunId
      );
      const readiness = foA240RowsForRun_(
        dashboard.getSheetByName(
          FO_SHEETS.REPORT_DATA_READINESS_A233
        ),
        'Run ID',
        expectedDecisionRunId
      );
      const returnMetrics = foA240LatestMetricMap_(
        dashboard.getSheetByName(
          FO_SHEETS.RETURN_ATTRIBUTION_SUMMARY_A232
        )
      );
      const coverageMetrics = foA240LatestMetricMap_(
        dashboard.getSheetByName(
          FO_SHEETS.ATTRIBUTION_COVERAGE_SUMMARY_A2311
        )
      );
      const certificationMetadata =
        foA240LatestCertificationMetadata_(dashboard);
      const positionRiskMetadata =
        foA240LatestPositionRiskMetadata_(dashboard);

      const alignment =
        foA240ValidateDecisionEvidenceAlignment_(
          expectedDecisionRunId,
          actionCards,
          conflicts,
          readiness,
          returnMetrics,
          coverageMetrics,
          certificationMetadata,
          positionRiskMetadata,
          {
            platformVersion: FO_CONFIG.PLATFORM_VERSION,
            baseline: FO_CONFIG.BASELINE
          }
        );

      const reported = foA240FindReportMetric_(
        reportSheet,
        'Decision Evidence Alignment'
      );

      const reportedAlignment = foA240Text_(
        reported['Current Value / Action']
      );

      const reportedControl = foA240Text_(
        reported.Status
      );

      if (alignment.status === 'INCOMPATIBLE') {
        return false;
      }

      return (
        reportedAlignment === alignment.status &&
        (
          (
            alignment.status === 'ALIGNED' &&
            reportedControl === 'READY'
          ) ||
          (
            alignment.status === 'COMPATIBLE' &&
            reportedControl === 'CONTROLLED'
          )
        )
      );
    },
    'CRITICAL'
  );

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
    'Largest position percentage matches governed position authority',
    function() {
      const state = foA240RowsForRun_(
        stateSheet, 'Run ID', expectedDecisionRunId
      )[0] || {};

      const metadata =
        foA240LatestPositionRiskMetadata_(dashboard);

      const rows = foA240RowsForRun_(
        dashboard.getSheetByName(FO_SHEETS.POSITION_RISK),
        'Run ID',
        metadata.runId
      );

      const authority =
        foA240ResolveConcentrationAuthority_(
          state,
          rows,
          metadata
        );

      const reported = foA240FindReportMetric_(
        reportSheet,
        'Largest Position'
      );

      const current = foA240Text_(
        reported['Current Value / Action']
      );

      const match = current.match(/—\s*(-?[0-9.]+)%/);
      const reportedPct = match ? Number(match[1]) : NaN;

      return (
        authority.status !== 'NOT CERTIFIED' &&
        Number.isFinite(reportedPct) &&
        Math.abs(
          reportedPct - authority.reportedPct
        ) <= 0.01 &&
        (
          authority.reconciledPct === null ||
          Math.abs(
            reportedPct - authority.reconciledPct
          ) <= 0.02
        )
      );
    }, 'CRITICAL');



  suite.add(
    'GOVERNANCE',
    'Trend authority is certified or controlled',
    function() {

      const row = foA240FindReportMetric_(
        reportSheet,
        'Trend Authority'
      );

      const status = foA240Text_(
        row['Current Value / Action']
      );

      const control = foA240Text_(
        row.Status
      );

      if (status === 'NOT CERTIFIED') {
        return false;
      }

      if (status === 'PARTIAL') {
        return control === 'CONTROLLED';
      }

      if (status === 'CERTIFIED') {
        return control === 'READY';
      }

      return false;

    },
    'CRITICAL'
  );

  suite.add(
    'GOVERNANCE',
    'Concentration authority is certified or controlled',
    function() {
      const row = foA240FindReportMetric_(
        reportSheet,
        'Concentration Authority'
      );

      const status = foA240Text_(
        row['Current Value / Action']
      );

      const control = foA240Text_(row.Status);

      if (status === 'NOT CERTIFIED') {
        return false;
      }

      if (status === 'CERTIFIED') {
        return control === 'READY';
      }

      if (status === 'PARTIAL') {
        return control === 'CONTROLLED';
      }

      return false;
    },
    'CRITICAL'
  );

  suite.add('PRESENTATION',
    'Report contains no implausible portfolio percentages', function() {
      return foA240SheetRows_(reportSheet).every(function(row) {
        if (row['Metric / Ticker'] === 'Largest Position') {
          const match = foA240Text_(
            row['Current Value / Action']
          ).match(/-?[0-9]+(?:\.[0-9]+)?%/);

          if (!match) return false;

          const value = Number(
            match[0].replace('%', '')
          );

          return Number.isFinite(value) &&
            value >= 0 &&
            value <= 100;
        }

        if (row.Section !== 'CURRENT HOLDING ACTION') {
          return true;
        }

        const weight = foA240ExtractPortfolioWeight_(
          row['Evidence / Commentary']
        );

        return Number.isFinite(weight) &&
          weight >= 0 &&
          weight <= 100;
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
        expectedReportId,
        expectedDecisionRunId,
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

/**
 * D1-C6B.1
 *
 * Validates the governed trend evidence carried by A233 Action Cards.
 *
 * Trend and Overall Trajectory represent different governed concepts:
 * - Trend may describe current price or recommendation direction.
 * - Overall Trajectory describes multi-period strategic evolution.
 *
 * The helper does not calculate trends, trajectories, confidence, materiality,
 * or portfolio deterioration. It evaluates only inherited governed evidence.
 */
function foA240ValidateTrendAuthority_(actionCards) {
  const cards = Array.isArray(actionCards)
    ? actionCards
    : [];

  const result = {
    status: '',
    reason: '',
    cardCount: cards.length,
    certifiedCount: 0,
    partialCount: 0,
    notCertifiedCount: 0,
    cards: []
  };

  if (!cards.length) {
    result.status = 'PARTIAL';
    result.reason =
      'No governed A233 Action Cards are available for trend certification.';
    return result;
  }

  cards.forEach(function(card) {
    const ticker = foA240Text_(card.Ticker).toUpperCase();
    const account = foA240Text_(card.Account);

    const trend = foA240Text_(card.Trend);
    const trajectory = foA240Text_(
      card['Overall Trajectory']
    ).toUpperCase();
    const reversalStatus = foA240Text_(
      card['Reversal Status']
    ).toUpperCase();
    const evidenceStrength = foA240Text_(
      card['Trend Evidence Strength']
    ).toUpperCase();
    const significantChange = foA240Text_(
      card['Significant Change']
    ).toUpperCase();

    const confidence = foA240Number_(
      card.Confidence
    );
    const priorConfidence = foA240Number_(
      card['Prior Confidence']
    );
    const confidenceDelta = foA240Number_(
      card['Confidence Delta']
    );

    const cardResult = {
      ticker: ticker,
      account: account,
      trend: trend,
      trajectory: trajectory,
      reversalStatus: reversalStatus,
      evidenceStrength: evidenceStrength,
      significantChange: significantChange,
      confidence: confidence,
      priorConfidence: priorConfidence,
      confidenceDelta: confidenceDelta,
      status: '',
      reason: ''
    };

    if (!ticker) {
      cardResult.status = 'NOT CERTIFIED';
      cardResult.reason =
        'Action Card ticker is unavailable.';
      result.notCertifiedCount++;
      result.cards.push(cardResult);
      return;
    }

    const hasTrendEvidence = Boolean(
      trend ||
      trajectory ||
      reversalStatus ||
      evidenceStrength
    );

    if (!hasTrendEvidence) {
      cardResult.status = 'PARTIAL';
      cardResult.reason =
        'No governed trend or trajectory evidence is available.';
      result.partialCount++;
      result.cards.push(cardResult);
      return;
    }

    const reversalIndicated =
      reversalStatus &&
      reversalStatus !== 'NONE' &&
      reversalStatus !== 'STABLE';

    if (
      reversalIndicated &&
      !trajectory
    ) {
      cardResult.status = 'NOT CERTIFIED';
      cardResult.reason =
        'Reversal status is present without an Overall Trajectory.';
      result.notCertifiedCount++;
      result.cards.push(cardResult);
      return;
    }

    if (
      reversalStatus.indexOf('DOWNWARD') >= 0 &&
      trajectory &&
      trajectory.indexOf('DOWNWARD') < 0
    ) {
      cardResult.status = 'NOT CERTIFIED';
      cardResult.reason =
        'Downward reversal status conflicts with Overall Trajectory.';
      result.notCertifiedCount++;
      result.cards.push(cardResult);
      return;
    }

    if (
      reversalStatus.indexOf('UPWARD') >= 0 &&
      trajectory &&
      trajectory.indexOf('UPWARD') < 0
    ) {
      cardResult.status = 'NOT CERTIFIED';
      cardResult.reason =
        'Upward reversal status conflicts with Overall Trajectory.';
      result.notCertifiedCount++;
      result.cards.push(cardResult);
      return;
    }

    const confidenceFieldsAvailable =
      card.Confidence !== undefined &&
      card['Prior Confidence'] !== undefined &&
      card['Confidence Delta'] !== undefined;

    if (confidenceFieldsAvailable) {
      const calculatedDelta =
        confidence - priorConfidence;

      if (
        Math.abs(
          calculatedDelta - confidenceDelta
        ) > 0.01
      ) {
        cardResult.status = 'NOT CERTIFIED';
        cardResult.reason =
          'Confidence Delta does not reconcile to current and prior confidence.';
        result.notCertifiedCount++;
        result.cards.push(cardResult);
        return;
      }
    }

    const significantChangeAsserted = [
      'YES',
      'TRUE',
      'MATERIAL CHANGE',
      'SIGNIFICANT'
    ].indexOf(significantChange) >= 0;

    if (
      significantChangeAsserted &&
      !trajectory &&
      !trend
    ) {
      cardResult.status = 'NOT CERTIFIED';
      cardResult.reason =
        'Significant Change is asserted without governed trend evidence.';
      result.notCertifiedCount++;
      result.cards.push(cardResult);
      return;
    }

    if (
      !trajectory ||
      !evidenceStrength ||
      !confidenceFieldsAvailable
    ) {
      const missing = [];

      if (!trajectory) {
        missing.push('Overall Trajectory');
      }

      if (!evidenceStrength) {
        missing.push('Trend Evidence Strength');
      }

      if (!confidenceFieldsAvailable) {
        missing.push('confidence-history fields');
      }

      cardResult.status = 'PARTIAL';
      cardResult.reason =
        'Governed trend evidence is partial: ' +
        missing.join(', ') + '.';
      result.partialCount++;
      result.cards.push(cardResult);
      return;
    }

    cardResult.status = 'CERTIFIED';
    cardResult.reason =
      'Governed trend, trajectory, reversal, and confidence evidence are internally consistent.';
    result.certifiedCount++;
    result.cards.push(cardResult);
  });

  if (result.notCertifiedCount > 0) {
    result.status = 'NOT CERTIFIED';
    result.reason =
      result.notCertifiedCount +
      ' Action Card trend record(s) contain conflicting or unsupported governed evidence.';
    return result;
  }

  if (result.partialCount > 0) {
    result.status = 'PARTIAL';
    result.reason =
      result.partialCount +
      ' Action Card trend record(s) have incomplete governed trend evidence.';
    return result;
  }

  result.status = 'CERTIFIED';
  result.reason =
    'All Action Card trend records contain internally consistent governed trend evidence.';
  return result;
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
  const freshness = foA240Number_(state['Price Freshness Coverage %']);
  const freshnessReason = freshness < 0.80
    ? ' Execution remains blocked because decision freshness is ' +
      foA240PercentText_(state['Price Freshness Coverage %']) + '.'
    : '';

  return (
    foA240Text_(state['Portfolio Posture']) + '. ' +
    'Capital deployment: ' + deploymentAuthorization + '. ' +
    foA240Text_(state['Primary Action']) +
    freshnessReason + ' ' +
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
    foA240MetricDisplayValue_(metric, item.value),
    '',
    '',
    item.status,
    item.commentary,
    foA240MetricSource_('Return Attribution Summary A232', metricMap)
  );
}

function foA240MetricDisplayValue_(metric, value) {
  const currencyMetrics = {
    'Beginning Portfolio Market Value': true,
    'Eligible Beginning Market Value': true
  };

  if (currencyMetrics[metric]) {
    const amount = foA240Number_(value);
    return 'C$' + amount.toFixed(2).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ','
    );
  }

  return foA240Text_(value);
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

/**
 * D1-C3B.1
 *
 * Companion helper exposing Position Risk runtime metadata.
 * Existing foA240PositionRiskMap_() remains unchanged.
 */
function foA240LatestPositionRiskMetadata_(dashboard) {
  const latest = foA240LatestRows_(
    dashboard.getSheetByName(FO_SHEETS.POSITION_RISK),
    'Run ID'
  );

  const row = latest.rows.length
    ? latest.rows[0]
    : {};

  return {
    runId: foA240Text_(latest.runId),
    timestamp: foA240Text_(
      row.Timestamp ||
      row['Run Timestamp'] ||
      row['Generated Timestamp'] ||
      row['Generated At']
    ),
    platformVersion: foA240Text_(row['Platform Version']),
    baseline: foA240Text_(row.Baseline),
    source: 'Position Risk'
  };
}

/**
 * D1-C5B.1
 *
 * Reconciles the A233 largest-position authority against the latest governed
 * Position Risk rows.
 *
 * Portfolio Risk defines concentration at the individual ticker/account
 * position level. Ticker-level aggregation is not used as the authoritative
 * reconciliation basis.
 */
function foA240ResolveConcentrationAuthority_(
  state,
  positionRiskRows,
  positionRiskMetadata
) {
  const ticker = foA240Text_(
    state && state['Largest Position Ticker']
  ).toUpperCase();

  const reportedPct = foA240Number_(
    state && state['Largest Position %']
  );

  const freshnessCoverage = foA240Number_(
    state && state['Price Freshness Coverage %']
  );

  const rows = Array.isArray(positionRiskRows)
    ? positionRiskRows
    : [];

  const result = {
    status: '',
    reason: '',
    ticker: ticker,
    account: '',
    reportedPct: reportedPct,
    reconciledPct: null,
    matchingPositionCount: 0,
    valuationCoverage: freshnessCoverage,
    runId: foA240Text_(
      positionRiskMetadata && positionRiskMetadata.runId
    ),
    basis: 'LARGEST VALUED TICKER/ACCOUNT POSITION'
  };

  if (!ticker) {
    result.status = 'NOT CERTIFIED';
    result.reason =
      'A233 does not expose a largest-position ticker.';
    return result;
  }

  if (!Number.isFinite(reportedPct) || reportedPct < 0) {
    result.status = 'NOT CERTIFIED';
    result.reason =
      'A233 largest-position percentage is unavailable or invalid.';
    return result;
  }

  if (!result.runId || !rows.length) {
    result.status = 'NOT CERTIFIED';
    result.reason =
      'Latest governed Position Risk evidence is unavailable.';
    return result;
  }

  const tickerRows = rows.filter(function(row) {
    return foA240Text_(row.Ticker).toUpperCase() === ticker;
  });

  const tolerance = 0.02;

  const matchingRows = tickerRows.filter(function(row) {
    const positionPct = foA240Number_(
      row['Portfolio Weight %'] !== undefined
        ? row['Portfolio Weight %']
        : row['Portfolio Weight']
    );

    return Math.abs(positionPct - reportedPct) <= tolerance;
  });

  result.matchingPositionCount = matchingRows.length;

  if (!matchingRows.length) {
    result.status = 'NOT CERTIFIED';
    result.reason =
      'A233 largest-position percentage does not reconcile to an individual Position Risk ticker/account row.';
    return result;
  }

  const matched = matchingRows[0];

  result.account = foA240Text_(matched.Account);
  result.reconciledPct = foA240Number_(
    matched['Portfolio Weight %'] !== undefined
      ? matched['Portfolio Weight %']
      : matched['Portfolio Weight']
  );

  if (matchingRows.length > 1) {
    result.status = 'PARTIAL';
    result.reason =
      'Multiple Position Risk ticker/account rows match the governed largest-position percentage.';
    return result;
  }

  if (freshnessCoverage < 1) {
    result.status = 'PARTIAL';
    result.reason =
      'Largest valued position reconciles, but incomplete price freshness means full-portfolio concentration is not certified.';
    return result;
  }

  result.status = 'CERTIFIED';
  result.reason =
    'A233 largest-position authority reconciles to one governed Position Risk ticker/account row.';
  return result;
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


/**
 * Determines whether the Weekly Strategy Review may present governed
 * comparison evidence from the existing attribution and coverage
 * summaries.
 *
 * This helper does not calculate returns, create snapshots, or change
 * valuation logic. It evaluates only the evidence already supplied by
 * A232 and A2311.
 */
/**
 * D1-C3B.3
 *
 * Validates whether the governed evidence consumed by the Weekly Strategy
 * Review belongs to the current A233 decision lineage or to a compatible
 * governed engine lineage.
 *
 * This helper does not require separate governed engines to share the A233
 * Run ID. It evaluates lineage, platform version, and baseline compatibility
 * without changing analytical outputs.
 */
function foA240ValidateDecisionEvidenceAlignment_(
  decisionRunId,
  actionCards,
  conflicts,
  readiness,
  returnMetrics,
  coverageMetrics,
  certificationMetadata,
  positionRiskMetadata,
  run
) {
  const expectedDecisionRunId = foA240Text_(decisionRunId);
  const runtimeVersion = foA240Text_(
    run && run.platformVersion
  );
  const runtimeBaseline = foA240Text_(
    run && run.baseline
  );

  const rowAlignment = function(rows, allowEmpty) {
    const governedRows = Array.isArray(rows)
      ? rows
      : [];

    if (!governedRows.length) {
      return allowEmpty
        ? {
            status: 'ALIGNED',
            reason: 'No governed rows were required for this component.'
          }
        : {
            status: 'INCOMPATIBLE',
            reason: 'Required governed rows are unavailable.'
          };
    }

    const mismatch = governedRows.some(function(row) {
      return foA240Text_(row['Run ID']) !==
        expectedDecisionRunId;
    });

    return mismatch
      ? {
          status: 'INCOMPATIBLE',
          reason: 'One or more rows use a different A233 Decision Run ID.'
        }
      : {
          status: 'ALIGNED',
          reason: 'Rows match the current A233 Decision Run ID.'
        };
  };

  const governedMetadataAlignment = function(
    metadata,
    sourceName
  ) {
    const source = metadata || {};
    const sourceRunId = foA240Text_(source.runId);
    const sourceVersion = foA240Text_(source.platformVersion);
    const sourceBaseline = foA240Text_(source.baseline);

    if (!sourceRunId) {
      return {
        status: 'INCOMPATIBLE',
        reason: sourceName + ' Run ID is unavailable.',
        runId: ''
      };
    }

    if (
      runtimeVersion &&
      sourceVersion &&
      sourceVersion !== runtimeVersion
    ) {
      return {
        status: 'INCOMPATIBLE',
        reason:
          sourceName + ' uses a different platform version.',
        runId: sourceRunId
      };
    }

    if (
      runtimeBaseline &&
      sourceBaseline &&
      sourceBaseline !== runtimeBaseline
    ) {
      return {
        status: 'INCOMPATIBLE',
        reason:
          sourceName + ' uses a different governed baseline.',
        runId: sourceRunId
      };
    }

    if (sourceRunId === expectedDecisionRunId) {
      return {
        status: 'ALIGNED',
        reason:
          sourceName + ' uses the current A233 Decision Run ID.',
        runId: sourceRunId
      };
    }

    return {
      status: 'COMPATIBLE',
      reason:
        sourceName +
        ' uses a separate governed run namespace with compatible runtime metadata.',
      runId: sourceRunId
    };
  };

  const metricAlignment = function(
    metricMap,
    sourceName
  ) {
    const sourceRunId = foA240Text_(
      metricMap && metricMap.runId
    );

    if (!sourceRunId) {
      return {
        status: 'INCOMPATIBLE',
        reason: sourceName + ' Run ID is unavailable.',
        runId: ''
      };
    }

    if (sourceRunId === expectedDecisionRunId) {
      return {
        status: 'ALIGNED',
        reason:
          sourceName + ' uses the current A233 Decision Run ID.',
        runId: sourceRunId
      };
    }

    return {
      status: 'COMPATIBLE',
      reason:
        sourceName +
        ' uses a separate governed run namespace.',
      runId: sourceRunId
    };
  };

  const result = {
    decisionRunId: expectedDecisionRunId,
    actionCards: rowAlignment(actionCards, true),
    conflicts: rowAlignment(conflicts, true),
    readiness: rowAlignment(readiness, false),
    attribution: metricAlignment(
      returnMetrics,
      'Return Attribution Summary A232'
    ),
    coverage: metricAlignment(
      coverageMetrics,
      'Attribution Coverage Summary A2311'
    ),
    certification: governedMetadataAlignment(
      certificationMetadata,
      'Production Certification'
    ),
    positionRisk: governedMetadataAlignment(
      positionRiskMetadata,
      'Position Risk'
    )
  };

  if (!expectedDecisionRunId) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'The current A233 Decision Run ID is unavailable.';
    return result;
  }

  const componentNames = [
    'actionCards',
    'conflicts',
    'readiness',
    'attribution',
    'coverage',
    'certification',
    'positionRisk'
  ];

  const incompatibleComponents = componentNames.filter(
    function(name) {
      return result[name].status === 'INCOMPATIBLE';
    }
  );

  const attributionVersion = foA240Text_(
    returnMetrics && returnMetrics.platformVersion
  );

  const coverageVersion = foA240Text_(
    coverageMetrics && coverageMetrics.platformVersion
  );

  const attributionBaseline = foA240Text_(
    returnMetrics && returnMetrics.baseline
  );

  const coverageBaseline = foA240Text_(
    coverageMetrics && coverageMetrics.baseline
  );

  if (
    attributionVersion &&
    coverageVersion &&
    attributionVersion !== coverageVersion
  ) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Return Attribution and Attribution Coverage use different platform versions.';
    return result;
  }

  if (
    attributionBaseline &&
    coverageBaseline &&
    attributionBaseline !== coverageBaseline
  ) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Return Attribution and Attribution Coverage use different governed baselines.';
    return result;
  }

  if (incompatibleComponents.length) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Incompatible decision evidence: ' +
      incompatibleComponents.join(', ') + '.';
    return result;
  }

  const compatibleComponents = componentNames.filter(
    function(name) {
      return result[name].status === 'COMPATIBLE';
    }
  );

  if (compatibleComponents.length) {
    result.status = 'COMPATIBLE';
    result.reason =
      'Decision evidence is governed and compatible across separate run namespaces.';
    return result;
  }

  result.status = 'ALIGNED';
  result.reason =
    'All governed evidence uses the current A233 Decision Run ID.';
  return result;
}

/**
 * D1-C4.2
 *
 * Validates whether the governed evidence consumed by the Weekly Strategy
 * Review belongs to a defensible reporting-period environment.
 *
 * The helper does not calculate performance, create snapshots, or require
 * separate governed engines to share an identical timestamp.
 */
function foA240ValidateReportingPeriodAlignment_(
  weekEnding,
  run,
  state,
  returnMetrics,
  coverageMetrics,
  comparisonEligibility,
  positionRiskMetadata,
  certificationMetadata,
  priorBaseline
) {
  const reportTimestamp = foA240Text_(
    run && run.timestamp
  );

  const reportTime = foA240DateTime_(
    reportTimestamp
  );

  const weekEndingTime = foA240DateTime_(
    weekEnding
  );

  const runtimeVersion = foA240Text_(
    run && run.platformVersion
  );

  const runtimeBaseline = foA240Text_(
    run && run.baseline
  );

  const result = {
    status: '',
    reason: '',
    weekEnding: weekEnding,
    reportTimestamp: reportTimestamp,
    decisionTimestamp: foA240Text_(
      state && state.Timestamp
    ),
    attributionTimestamp: foA240Text_(
      returnMetrics && returnMetrics.timestamp
    ),
    coverageTimestamp: foA240Text_(
      coverageMetrics && coverageMetrics.timestamp
    ),
    valuationTimestamp: foA240Text_(
      comparisonEligibility &&
      comparisonEligibility.valuationTimestamp
    ),
    latestPriceTimestamp: foA240Text_(
      comparisonEligibility &&
      comparisonEligibility.latestPriceTimestamp
    ),
    positionRiskTimestamp: foA240Text_(
      positionRiskMetadata &&
      positionRiskMetadata.timestamp
    ),
    certificationTimestamp: foA240Text_(
      certificationMetadata &&
      certificationMetadata.timestamp
    ),
    priorReportId: foA240Text_(
      priorBaseline &&
      priorBaseline.priorReportId
    )
  };

  if (
    !Number.isFinite(reportTime) ||
    !Number.isFinite(weekEndingTime)
  ) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Weekly report timestamp or week-ending date is invalid.';
    return result;
  }

  if (weekEndingTime > reportTime) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Week ending occurs after the report generation timestamp.';
    return result;
  }

  const sourceMetadata = [
    {
      name: 'Return Attribution Summary A232',
      timestamp: result.attributionTimestamp,
      platformVersion: foA240Text_(
        returnMetrics && returnMetrics.platformVersion
      ),
      baseline: foA240Text_(
        returnMetrics && returnMetrics.baseline
      ),
      required: true
    },
    {
      name: 'Attribution Coverage Summary A2311',
      timestamp: result.coverageTimestamp,
      platformVersion: foA240Text_(
        coverageMetrics && coverageMetrics.platformVersion
      ),
      baseline: foA240Text_(
        coverageMetrics && coverageMetrics.baseline
      ),
      required: true
    },
    {
      name: 'Executive Decision State A233',
      timestamp: result.decisionTimestamp,
      platformVersion: foA240Text_(
        state && state['Platform Version']
      ),
      baseline: foA240Text_(
        state && state.Baseline
      ),
      required: true
    },
    {
      name: 'Position Risk',
      timestamp: result.positionRiskTimestamp,
      platformVersion: foA240Text_(
        positionRiskMetadata &&
        positionRiskMetadata.platformVersion
      ),
      baseline: foA240Text_(
        positionRiskMetadata &&
        positionRiskMetadata.baseline
      ),
      required: false
    },
    {
      name: 'Production Certification',
      timestamp: result.certificationTimestamp,
      platformVersion: foA240Text_(
        certificationMetadata &&
        certificationMetadata.platformVersion
      ),
      baseline: foA240Text_(
        certificationMetadata &&
        certificationMetadata.baseline
      ),
      required: false
    }
  ];

  const missingRequired = [];
  const missingOptional = [];
  const futureSources = [];
  const incompatibleMetadata = [];

  sourceMetadata.forEach(function(source) {
    const timestamp = foA240Text_(source.timestamp);

    if (!timestamp) {
      if (source.required) {
        missingRequired.push(source.name);
      } else {
        missingOptional.push(source.name);
      }
    } else {
      const sourceTime = foA240DateTime_(timestamp);

      if (
        !Number.isFinite(sourceTime) ||
        sourceTime > reportTime
      ) {
        futureSources.push(source.name);
      }
    }

    if (
      runtimeVersion &&
      source.platformVersion &&
      source.platformVersion !== runtimeVersion
    ) {
      incompatibleMetadata.push(
        source.name + ' platform version'
      );
    }

    if (
      runtimeBaseline &&
      source.baseline &&
      source.baseline !== runtimeBaseline
    ) {
      incompatibleMetadata.push(
        source.name + ' baseline'
      );
    }
  });

  if (futureSources.length) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Evidence timestamps are invalid or occur after report generation: ' +
      futureSources.join(', ') + '.';
    return result;
  }

  if (incompatibleMetadata.length) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Reporting-period evidence uses incompatible runtime metadata: ' +
      incompatibleMetadata.join(', ') + '.';
    return result;
  }

  const attributionTime = foA240DateTime_(
    result.attributionTimestamp
  );

  const coverageTime = foA240DateTime_(
    result.coverageTimestamp
  );

  if (
    Number.isFinite(attributionTime) &&
    Number.isFinite(coverageTime) &&
    Math.abs(attributionTime - coverageTime) >
      24 * 60 * 60 * 1000
  ) {
    result.status = 'INCOMPATIBLE';
    result.reason =
      'Return Attribution and Attribution Coverage timestamps differ by more than 24 hours.';
    return result;
  }

  if (
    priorBaseline &&
    priorBaseline.status === 'AVAILABLE'
  ) {
    const priorWeekEnding = foA240DateTime_(
      priorBaseline.priorReport &&
      priorBaseline.priorReport['Week Ending']
    );

    if (
      !Number.isFinite(priorWeekEnding) ||
      priorWeekEnding >= weekEndingTime
    ) {
      result.status = 'INCOMPATIBLE';
      result.reason =
        'The prior weekly baseline does not precede the current week ending.';
      return result;
    }
  }

  if (missingRequired.length) {
    result.status = 'PARTIAL';
    result.reason =
      'Required reporting-period timestamps are unavailable: ' +
      missingRequired.join(', ') +
      '. Unsupported period conclusions must remain suppressed.';
    return result;
  }

  if (
    !result.valuationTimestamp ||
    !result.latestPriceTimestamp ||
    missingOptional.length
  ) {
    const partialReasons = [];

    if (!result.valuationTimestamp) {
      partialReasons.push('valuation timestamp');
    }

    if (!result.latestPriceTimestamp) {
      partialReasons.push('latest-price timestamp');
    }

    missingOptional.forEach(function(name) {
      partialReasons.push(name + ' timestamp');
    });

    result.status = 'PARTIAL';
    result.reason =
      'Governed reporting-period evidence is partial: ' +
      partialReasons.join(', ') + '.';
    return result;
  }

  result.status = 'ALIGNED';
  result.reason =
    'Governed evidence timestamps and runtime metadata are defensibly aligned to the Weekly Strategy Review.';
  return result;
}

function foA240ResolveWeeklyComparisonEligibility_(
  returnMetrics,
  coverageMetrics
) {
  const returnRunId = foA240Text_(
    returnMetrics && returnMetrics.runId
  );

  const coverageRunId = foA240Text_(
    coverageMetrics && coverageMetrics.runId
  );

  const returnTimestamp = foA240Text_(
    returnMetrics && returnMetrics.timestamp
  );

  const coverageTimestamp = foA240Text_(
    coverageMetrics && coverageMetrics.timestamp
  );

  const coverageMetricNames = [
    'Return Attribution Coverage %',
    'Return Coverage %',
    'Portfolio Return Coverage %',
    'Comparable Return Coverage %'
  ];

  let coverageValue = null;

  for (
    let index = 0;
    index < coverageMetricNames.length;
    index++
  ) {
    const candidate = foA240FirstMetricValue_(
      returnMetrics,
      coverageMetrics,
      [coverageMetricNames[index]]
    );

    if (
      candidate !== '' &&
      candidate !== null &&
      candidate !== undefined
    ) {
      coverageValue = foA240Number_(candidate);
      break;
    }
  }

  if (
    coverageValue === null &&
    returnMetrics &&
    returnMetrics.metrics
  ) {
    const metricKeys = Object.keys(
      returnMetrics.metrics
    );

    for (
      let index = 0;
      index < metricKeys.length;
      index++
    ) {
      const key = metricKeys[index];

      if (
        /return/i.test(key) &&
        /coverage/i.test(key)
      ) {
        coverageValue = foA240Number_(
          returnMetrics.metrics[key].value
        );
        break;
      }
    }
  }

  const valuationTimestamp =
    foA240FirstMetricValue_(
      returnMetrics,
      coverageMetrics,
      [
        'Valuation Timestamp',
        'Portfolio Valuation Timestamp'
      ]
    ) ||
    returnTimestamp ||
    coverageTimestamp;

  const latestPriceTimestamp =
    foA240FirstMetricValue_(
      returnMetrics,
      coverageMetrics,
      [
        'Latest Price Timestamp',
        'Market Price Timestamp',
        'Price Timestamp'
      ]
    ) ||
    returnTimestamp ||
    coverageTimestamp;

  const returnPlatformVersion = foA240Text_(
    returnMetrics && returnMetrics.platformVersion
  );

  const coveragePlatformVersion = foA240Text_(
    coverageMetrics && coverageMetrics.platformVersion
  );

  const returnBaseline = foA240Text_(
    returnMetrics && returnMetrics.baseline
  );

  const coverageBaseline = foA240Text_(
    coverageMetrics && coverageMetrics.baseline
  );

  if (!returnRunId || !coverageRunId) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Return-attribution or coverage Run ID is unavailable.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    returnPlatformVersion &&
    coveragePlatformVersion &&
    returnPlatformVersion !== coveragePlatformVersion
  ) {
    return {
      status: 'INCOMPATIBLE',
      reason:
        'Return-attribution and coverage evidence use different platform versions.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    returnBaseline &&
    coverageBaseline &&
    returnBaseline !== coverageBaseline
  ) {
    return {
      status: 'INCOMPATIBLE',
      reason:
        'Return-attribution and coverage evidence use different governed baselines.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    !returnMetrics ||
    !returnMetrics.metrics ||
    Object.keys(returnMetrics.metrics).length === 0
  ) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Return Attribution Summary A232 has no governed evidence.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    !coverageMetrics ||
    !coverageMetrics.metrics ||
    Object.keys(coverageMetrics.metrics).length === 0
  ) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Attribution Coverage Summary A2311 has no governed evidence.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    coverageValue === null ||
    !Number.isFinite(coverageValue)
  ) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Return-attribution coverage is unavailable.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (
    coverageValue < FO_A240_RETURN_COVERAGE_THRESHOLD
  ) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Return-attribution coverage is below the governed threshold.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (!valuationTimestamp) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Valuation timestamp is unavailable.',
      coverage: coverageValue,
      valuationTimestamp: '',
      latestPriceTimestamp: latestPriceTimestamp,
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  if (!latestPriceTimestamp) {
    return {
      status: 'SUPPRESSED',
      reason:
        'Latest supported market-price timestamp is unavailable.',
      coverage: coverageValue,
      valuationTimestamp: valuationTimestamp,
      latestPriceTimestamp: '',
      returnRunId: returnRunId,
      coverageRunId: coverageRunId
    };
  }

  return {
    status: 'ELIGIBLE',
    reason:
      'Governed attribution and coverage evidence satisfy the weekly comparison gate.',
    coverage: coverageValue,
    valuationTimestamp: valuationTimestamp,
    latestPriceTimestamp: latestPriceTimestamp,
    returnRunId: returnRunId,
    coverageRunId: coverageRunId
  };
}


/**
 * Returns the first non-empty governed metric value across the
 * supplied metric maps and candidate metric names.
 */
function foA240FirstMetricValue_(
  primaryMap,
  secondaryMap,
  metricNames
) {
  const maps = [primaryMap, secondaryMap];

  for (let mapIndex = 0; mapIndex < maps.length; mapIndex++) {
    const map = maps[mapIndex];

    if (!map || !map.metrics) continue;

    for (
      let metricIndex = 0;
      metricIndex < metricNames.length;
      metricIndex++
    ) {
      const value = foA240MetricValue_(
        map,
        metricNames[metricIndex]
      );

      if (
        value !== '' &&
        value !== null &&
        value !== undefined
      ) {
        return value;
      }
    }
  }

  return '';
}


function foA240LatestMetricMap_(sheet) {
  const latest = foA240LatestRows_(sheet, 'Run ID');
  const map = {
    runId: latest.runId,
    priorRunId: '',
    timestamp: '',
    platformVersion: '',
    baseline: '',
    metrics: {}
  };

  latest.rows.forEach(function(row) {
    const metric = foA240Text_(row.Metric);

    map.priorRunId = map.priorRunId ||
      foA240Text_(row['Prior Run ID']);

    map.timestamp = map.timestamp ||
      foA240Text_(row.Timestamp);

    map.platformVersion = map.platformVersion ||
      foA240Text_(row['Platform Version']);

    map.baseline = map.baseline ||
      foA240Text_(row.Baseline);

    if (!metric) return;

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
  return foLatestRows_(sheet, runHeader);
}

function foA240RowsForRun_(sheet, runHeader, runId) {
  if (!runId) return [];
  return foA240SheetRows_(sheet).filter(function(row) {
    return foA240Text_(row[runHeader]) === foA240Text_(runId);
  });
}

function foA240SheetRows_(sheet) {
  return foSheetRows_(sheet);
}


/**
 * Verifies that runtime metadata agrees with FO_CONFIG.
 * FO_CONFIG remains the sole production-version authority.
 */

function foA240ReadConcentrationTrend_(spreadsheet, platformVersion, baseline) {
  const sheet = spreadsheet && spreadsheet.getSheetByName('Risk History');
  const rows = foA240SheetRows_(sheet);

  const currentVersion = foA240Text_(platformVersion);
  const currentBaseline = foA240Text_(baseline);

  const compatible = rows.filter(function(row) {
    const rowVersion = foA240Text_(row['Platform Version']);
    const rowBaseline = foA240Text_(row.Baseline);
    const runId = foA240Text_(row['Run ID']);
    const timestamp = foA240DateTime_(row.Timestamp);

    if (!runId || !Number.isFinite(timestamp)) return false;
    if (rowVersion !== currentVersion) return false;

    if (
      currentBaseline &&
      rowBaseline !== currentBaseline
    ) {
      return false;
    }

    return true;
  }).sort(function(a, b) {
    return foA240DateTime_(b.Timestamp) -
      foA240DateTime_(a.Timestamp);
  });

  if (compatible.length < 2) {
    return {
      status: 'UNAVAILABLE',
      reason:
        'No prior compatible Position Risk concentration baseline is available.'
    };
  }

  const current = compatible[0];
  const prior = compatible[1];

  function metric_(name) {
    const currentValue = Number(current[name]);
    const priorValue = Number(prior[name]);

    return {
      current: Number.isFinite(currentValue)
        ? currentValue
        : null,
      prior: Number.isFinite(priorValue)
        ? priorValue
        : null,
      delta: foA240NumericDelta_(
        Number.isFinite(priorValue) ? priorValue : null,
        Number.isFinite(currentValue) ? currentValue : null
      )
    };
  }

  return {
    status: 'AVAILABLE',
    currentRunId: foA240Text_(current['Run ID']),
    priorRunId: foA240Text_(prior['Run ID']),
    largestPosition: metric_('Largest Position %'),
    top5: metric_('Top 5 %'),
    sector: metric_('Sector Concentration %'),
    currency: metric_('Currency Concentration %')
  };
}


function foA240ResolveProductionBaseline_(run) {
  const runtimeVersion = foA240Text_(
    run && run.platformVersion
  );

  const runtimeBaseline = foA240Text_(
    run && run.baseline
  );

  const configAvailable =
    typeof FO_CONFIG !== 'undefined' &&
    FO_CONFIG !== null;

  const configVersion = configAvailable
    ? foA240Text_(FO_CONFIG.PLATFORM_VERSION)
    : '';

  const configBaseline = configAvailable
    ? foA240Text_(FO_CONFIG.BASELINE)
    : '';

  if (!configAvailable || !configVersion) {
    return {
      status: 'UNVERIFIED',
      reason: 'FO_CONFIG platform version is unavailable.',
      runtimeVersion: runtimeVersion,
      runtimeBaseline: runtimeBaseline,
      configVersion: configVersion,
      configBaseline: configBaseline
    };
  }

  if (
    runtimeVersion !== configVersion ||
    (
      configBaseline &&
      runtimeBaseline !== configBaseline
    )
  ) {
    return {
      status: 'VERSION_MISMATCH',
      reason:
        'Runtime platform metadata does not match FO_CONFIG.',
      runtimeVersion: runtimeVersion,
      runtimeBaseline: runtimeBaseline,
      configVersion: configVersion,
      configBaseline: configBaseline
    };
  }

  return {
    status: 'VERIFIED',
    reason: 'Runtime platform metadata matches FO_CONFIG.',
    runtimeVersion: runtimeVersion,
    runtimeBaseline: runtimeBaseline,
    configVersion: configVersion,
    configBaseline: configBaseline
  };
}


/**
 * Determines whether the generated report can become governed
 * weekly archive evidence.
 */
function foA240CanPersistWeeklyReport_(
  validation,
  baselineIntegrity
) {
  const failedControls = Number(
    validation && validation.failedControls
  ) || 0;

  return (
    failedControls === 0 &&
    baselineIntegrity &&
    baselineIntegrity.status === 'VERIFIED'
  );
}


/**
 * Selects the newest compatible prior weekly archive.
 * Incompatible records remain historical but cannot drive
 * certified weekly comparisons.
 */
function foA240ResolvePriorWeeklyBaseline_(
  sheet,
  run,
  currentWeekEnding
) {
  const rows = foA240SheetRows_(sheet);

  if (!rows.length) {
    return {
      status: 'BASELINE_BUILDING',
      reason: 'No prior persisted weekly review is available.',
      priorReport: {},
      priorReportId: ''
    };
  }

  const currentVersion = foA240Text_(
    run && run.platformVersion
  );

  const currentBaseline = foA240Text_(
    run && run.baseline
  );

  const currentWeekTime = foA240DateTime_(
    currentWeekEnding
  );

  let incompatibleReason =
    'No compatible prior governed weekly baseline was found.';

  for (
    let index = rows.length - 1;
    index >= 0;
    index--
  ) {
    const row = rows[index];

    const reportId = foA240Text_(
      row['Report ID']
    );

    const validationStatus = foA240Text_(
      row['Validation Status']
    ).toUpperCase();

    const platformVersion = foA240Text_(
      row['Platform Version']
    );

    const baseline = foA240Text_(
      row.Baseline
    );

    const priorWeekTime = foA240DateTime_(
      row['Week Ending']
    );

    if (!reportId) {
      incompatibleReason =
        'Prior weekly archive row has no Report ID.';
      continue;
    }

    const acceptedValidationStatuses = [
      'PASS',
      'PASS WITH OBSERVATIONS',
      'CERTIFIED',
      'CERTIFIED WITH OBSERVATIONS'
    ];

    if (
      acceptedValidationStatuses.indexOf(
        validationStatus
      ) === -1
    ) {
      incompatibleReason =
        'Prior weekly archive did not pass validation.';
      continue;
    }

    if (platformVersion !== currentVersion) {
      incompatibleReason =
        'Prior weekly archive uses a different platform version.';
      continue;
    }

    if (
      currentBaseline &&
      baseline !== currentBaseline
    ) {
      incompatibleReason =
        'Prior weekly archive uses a different governed baseline.';
      continue;
    }

    if (
      !Number.isFinite(priorWeekTime) ||
      !Number.isFinite(currentWeekTime) ||
      priorWeekTime >= currentWeekTime
    ) {
      incompatibleReason =
        'Prior weekly archive does not precede the current week.';
      continue;
    }

    return {
      status: 'AVAILABLE',
      reason:
        'Compatible prior governed weekly baseline located.',
      priorReport: row,
      priorReportId: reportId
    };
  }

  return {
    status: 'INCOMPATIBLE',
    reason: incompatibleReason,
    priorReport: {},
    priorReportId: ''
  };
}


/**
 * Normalizes Sheets Date objects and date-like values.
 */
function foA240DateTime_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : NaN;
}


function foA240LatestArchive_(sheet) {
  const rows = foA240SheetRows_(sheet);
  return rows.length ? rows[rows.length - 1] : {};
}

/**
 * D1-C3B.2
 *
 * Companion helper exposing Production Certification lineage metadata.
 * Existing foA240LatestCertification_() remains unchanged.
 */
function foA240LatestCertificationMetadata_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.PRODUCTION_CERTIFICATION
  );
  const rows = foA240SheetRows_(sheet);
  const row = rows.length
    ? rows[rows.length - 1]
    : {};

  return {
    runId: foA240Text_(
      row['Certification Run ID'] ||
      row['Run ID'] ||
      row['Validation Run ID']
    ),
    timestamp: foA240Text_(
      row.Timestamp ||
      row['Certification Timestamp'] ||
      row['Run Timestamp'] ||
      row['Generated Timestamp'] ||
      row['Generated At']
    ),
    platformVersion: foA240Text_(
      row['Platform Version']
    ),
    baseline: foA240Text_(
      row.Baseline
    ),
    status: foA240Text_(
      row['Certification Status'] ||
      row['Overall Status'] ||
      row.Status ||
      row.Result
    ).toUpperCase(),
    controlStatus: foA240Text_(
      row['Control Status']
    ),
    source: 'Production Certification'
  };
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
    const bodyRows = sheet.getLastRow() - 1;

    sheet.getRange(2, 1, bodyRows, columns)
      .setVerticalAlignment('top')
      .setWrap(true);

    // Columns H-J contain mixed governed values and narrative text.
    // Reset inherited spreadsheet formats so numeric values are not
    // rendered as percentages or currency from prior report layouts.
    sheet.getRange(2, 8, bodyRows, 3)
      .setNumberFormat('@');
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
