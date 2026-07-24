/**
 * Reporting Engine Enhancement v3.0.1
 * Production write-back readiness for governed executive reporting.
 *
 * Reuses the existing Portfolio Snapshot, Executive Reporting,
 * Executive Dashboard, and Ledger Report Archive services. It does not
 * create a second recommendation producer or a parallel history store.
 */

const FO_EXECUTIVE_REPORT_PERSISTENCE_VERSION_ = 'v3.0.1';

function foRunExecutiveReportProductionReady() {
  return foWithRuntimeLock_(
    'Run production-ready executive report',
    function() {
      return foRunExecutiveReportProductionReadyProtected_();
    }
  );
}

function foRunExecutiveReportProductionReadyProtected_() {
  foAssertRuntimeLockHeld_('Run production-ready executive report');
  const module = 'ExecutiveReportPersistenceService';
  const activeRunId = String(
    PropertiesService.getScriptProperties().getProperty('FO_ACTIVE_RUN_ID') || ''
  ).trim();
  const executionMode = activeRunId ? 'ORCHESTRATED' : 'DIRECT';

  try {
    foInfo_(
      module,
      'Start',
      'Production-ready executive reporting started. Mode: ' + executionMode
    );

    let snapshotResult = null;
    let dashboardResult = null;

    // The Autonomous CIO Orchestrator already builds the governed snapshot
    // before the report step. A direct menu run must build its own snapshot.
    if (!activeRunId) {
      snapshotResult = foBuildPortfolioSnapshot();
      if (!snapshotResult || snapshotResult.status !== 'SUCCESS') {
        throw new Error('Portfolio Dashboard snapshot was not persisted.');
      }
    }

    const reportResult = foRunExecutiveReportEngine();
    if (!reportResult || reportResult.status !== 'SUCCESS') {
      throw new Error('Executive analysis did not complete successfully.');
    }

    // In orchestrated mode the registered Dashboard step runs immediately
    // after this wrapper. A direct menu run must refresh it here.
    if (!activeRunId) {
      dashboardResult = foRunExecutiveDashboardEngine();
      if (!dashboardResult || dashboardResult.status !== 'SUCCESS') {
        throw new Error('Executive Dashboard refresh was not persisted.');
      }
    }

    const dashboard = foDashboard_();
    const snapshotId = snapshotResult && snapshotResult.snapshotId
      ? snapshotResult.snapshotId
      : foReadLatestPortfolioSnapshotIdV301_(dashboard);

    if (!snapshotId) {
      throw new Error(
        'Portfolio Dashboard snapshot verification failed: no Snapshot ID found.'
      );
    }

    const actionPlanChanged = foReadExecutiveActionPlanChangedV301_(dashboard);
    const recommendationEventStatus =
      foExecutiveRecommendationEventStatusV301_(actionPlanChanged);
    const materialityScore = foReadExecutiveMaterialityScoreV301_(dashboard);

    const ledgerArchiveId = foArchiveReport({
      reportId: reportResult.reportId,
      reportType: 'Executive CIO Report',
      title: 'Family Office CIO Executive Report',
      materialityScore: materialityScore,
      actionPlanChanged: actionPlanChanged,
      notes:
        'Reporting Engine Enhancement ' +
        FO_EXECUTIVE_REPORT_PERSISTENCE_VERSION_ +
        ' | Execution Mode: ' + executionMode +
        ' | Snapshot ID: ' + snapshotId +
        ' | Recommendation Event: ' + recommendationEventStatus
    });

    if (ledgerArchiveId !== reportResult.reportId) {
      throw new Error(
        'Investment Ledger archive returned an unexpected Report ID.'
      );
    }

    SpreadsheetApp.flush();

    const verification = foVerifyExecutiveReportPersistenceV301_(
      dashboard,
      reportResult.reportId,
      snapshotId
    );

    const failedControls = Object.keys(verification).filter(function(key) {
      return verification[key] !== true;
    });

    if (failedControls.length) {
      throw new Error(
        'Executive report write-back verification failed: ' +
        failedControls.join(', ')
      );
    }

    const persistence = {
      version: FO_EXECUTIVE_REPORT_PERSISTENCE_VERSION_,
      executionMode: executionMode,
      activeRunId: activeRunId,
      analysisStatus: 'COMPLETED',
      writeBackStatus: 'PERSISTED',
      recommendationEventStatus: recommendationEventStatus,
      actionPlanChanged: actionPlanChanged,
      portfolioSnapshotStatus: 'PERSISTED',
      portfolioSnapshotId: snapshotId,
      dashboardReportArchiveStatus: 'PERSISTED',
      ledgerReportArchiveStatus: 'PERSISTED',
      executiveDashboardStatus: activeRunId
        ? 'ORCHESTRATOR STEP PENDING'
        : 'PERSISTED'
    };

    foInfo_(
      module,
      'Complete',
      'Executive report write-back verified: ' + reportResult.reportId
    );

    return Object.assign({}, reportResult, {
      persistence: persistence,
      persistencePresentation:
        foBuildExecutivePersistencePresentationV301_(persistence),
      directDashboardRowsWritten:
        dashboardResult && dashboardResult.rowsWritten
          ? dashboardResult.rowsWritten
          : ''
    });
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foReadLatestPortfolioSnapshotIdV301_(dashboard) {
  const sheet = dashboard.getSheetByName('Portfolio Snapshot');
  if (!sheet || sheet.getLastRow() < 2) return '';

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const snapshotIndex = headers.indexOf('Snapshot ID');
  if (snapshotIndex < 0) return '';

  for (let r = 1; r < values.length; r++) {
    const snapshotId = String(values[r][snapshotIndex] || '').trim();
    if (snapshotId) return snapshotId;
  }

  return '';
}

function foReadExecutiveMaterialityScoreV301_(dashboard) {
  const sheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MATERIALITY);
  if (!sheet || sheet.getLastRow() < 2) return '';

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const scoreIndex = headers.indexOf('Portfolio Materiality Score');
  if (scoreIndex < 0) return '';

  const score = Number(values[1][scoreIndex]);
  return isFinite(score) ? score : '';
}

function foReadExecutiveActionPlanChangedV301_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.INVESTMENT_DECISION_SUPPORT
  );
  if (!sheet || sheet.getLastRow() < 2) return 'Not Evaluated';

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const changeIndex = headers.indexOf('Significant Change');
  if (changeIndex < 0) return 'Not Evaluated';

  let evaluated = false;
  for (let r = 1; r < values.length; r++) {
    const value = String(values[r][changeIndex] || '').trim().toUpperCase();
    if (!value) continue;
    evaluated = true;
    if (
      value === 'YES' ||
      value === 'TRUE' ||
      value === 'CHANGED' ||
      value === 'SIGNIFICANT'
    ) {
      return 'Yes';
    }
  }

  return evaluated ? 'No' : 'Not Evaluated';
}

function foExecutiveRecommendationEventStatusV301_(actionPlanChanged) {
  if (actionPlanChanged === 'Yes') return 'ELIGIBILITY REVIEW REQUIRED';
  if (actionPlanChanged === 'No') return 'NOT REQUIRED';
  return 'NOT EVALUATED';
}

function foVerifyExecutiveReportPersistenceV301_(
  dashboard,
  reportId,
  snapshotId
) {
  const ledger = foLedger_();

  return {
    executiveReportPersisted: foSheetContainsIdV301_(
      dashboard.getSheetByName('Executive CIO Report'),
      'Report ID',
      reportId
    ),
    dashboardArchivePersisted: foSheetContainsIdV301_(
      dashboard.getSheetByName('Executive Report Archive'),
      'Report ID',
      reportId
    ),
    ledgerArchivePersisted: foSheetContainsIdV301_(
      ledger.getSheetByName('Report Archive'),
      'Report ID',
      reportId
    ),
    portfolioSnapshotPersisted: foSheetContainsIdV301_(
      dashboard.getSheetByName('Portfolio Snapshot'),
      'Snapshot ID',
      snapshotId
    )
  };
}

function foSheetContainsIdV301_(sheet, headerName, expectedId) {
  if (!sheet || sheet.getLastRow() < 2) return false;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIndex = headers.indexOf(headerName);
  if (idIndex < 0) return false;

  const target = String(expectedId || '').trim();
  if (!target) return false;

  return values.slice(1).some(function(row) {
    return String(row[idIndex] || '').trim() === target;
  });
}

function foBuildExecutivePersistencePresentationV301_(persistence) {
  const lines = [
    '✅ Executive analysis completed.',
    '✅ Automated write-back completed.',
    persistence.recommendationEventStatus === 'NOT REQUIRED'
      ? '➖ Recommendation event not required because the action plan was unchanged.'
      : persistence.recommendationEventStatus === 'ELIGIBILITY REVIEW REQUIRED'
        ? '⚠️ Recommendation change detected; event eligibility requires governed lifecycle review.'
        : '⚠️ Recommendation-event eligibility was not evaluated.',
    '✅ Portfolio Dashboard snapshot persisted: ' +
      persistence.portfolioSnapshotId + '.',
    '✅ Report archived to the Portfolio Dashboard and Investment Ledger.'
  ];

  return lines.join('\n');
}

function foRunExecutiveReportProductionReadinessSmokeTest() {
  const module = 'ExecutiveReportPersistenceService';

  try {
    foInfo_(module, 'Start', 'Production-readiness smoke test started.');
    const result = foRunExecutiveReportProductionReady();

    if (!result.persistence || result.persistence.writeBackStatus !== 'PERSISTED') {
      throw new Error('Executive report write-back was not verified.');
    }

    foInfo_(
      module,
      'Complete',
      'Production-readiness smoke test completed: ' + result.reportId
    );

    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
