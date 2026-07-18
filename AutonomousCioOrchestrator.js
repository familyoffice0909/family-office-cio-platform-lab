/************************************************************
 * AutonomousCioOrchestrator.js
 * Wave 3.1.2 — Orchestrator Integration & Terminal-State Semantics
 ************************************************************/

function foRunAutonomousCioOrchestrator() {
  return foWithRuntimeLock_(
    'Run Autonomous CIO Orchestrator',
    function() {
      return foRunAutonomousCioOrchestratorProtected_();
    }
  );
}

function foRunAutonomousCioOrchestratorProtected_() {
  foAssertRuntimeLockHeld_('Run Autonomous CIO Orchestrator');
  const module = 'AutonomousCioOrchestrator';
  const runId = foNowId_('CIO-RUN');
  const startedAt = new Date();
  const steps = [];
  let runRow = null;

  PropertiesService.getScriptProperties()
    .setProperty('FO_ACTIVE_RUN_ID', runId);

  try {
    foInfo_(module, 'Start', 'Autonomous CIO orchestration started. Run ID: ' + runId);
    runRow = foCreateOrchestratorRunWave312_(runId, startedAt);

    steps.push(foRunOrchestratorStep_(runId, 'Platform Health Check', foGetModule('HEALTH')));
    steps.push(foRunOrchestratorStep_(runId, 'Platform Integrity Check', foGetModule('INTEGRITY')));
    steps.push(foRunOrchestratorStep_(runId, 'Data Validation', foGetModule('VALIDATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Market Data Refresh', foGetModule('MARKET_DATA')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Valuation', foGetModule('VALUATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Data Integrity', foGetModule('PORTFOLIO_DATA_INTEGRITY')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Performance', foGetModule('PERFORMANCE')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Exposure Attribution', foGetModule('EXPOSURE')));
    steps.push(foRunOrchestratorStep_(runId, 'IBKR Reconciliation', foGetModule('IBKR_RECONCILIATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Buy Zone Intelligence', foGetModule('BUY_ZONE')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Materiality', foGetModule('PORTFOLIO_MATERIALITY')));
    steps.push(foRunOrchestratorStep_(runId, 'Capital Deployment Priority', foGetModule('CAPITAL_DEPLOYMENT')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Snapshot', foGetModule('PORTFOLIO')));
    steps.push(foRunOrchestratorStep_(runId, 'Market Intelligence', foGetModule('MARKET')));
    steps.push(foRunOrchestratorStep_(runId, 'CIO Decision Engine', foGetModule('CIO')));
    steps.push(foRunOrchestratorStep_(runId, 'Executive Report', foGetModule('REPORT')));
    steps.push(foRunOrchestratorStep_(runId, 'Executive Dashboard', foGetModule('DASHBOARD')));

    const preCertificationSummary =
      foBuildPreCertificationSummaryWave323_(steps, startedAt);

    foPersistPreCertificationCheckpointWave323_(
      runId,
      runRow,
      startedAt,
      preCertificationSummary
    );

    SpreadsheetApp.flush();

    steps.push(foRunOrchestratorStep_(runId, 'Production Certification', function() {
      return foRunProductionCertificationWave311({
        orchestratorRunId: runId,
        orchestratorSteps: steps.slice(),
        orchestratorExecutionStatus:
          preCertificationSummary.executionStatus,
        orchestratorOperationalStatus:
          preCertificationSummary.operationalStatus,
        orchestratorCompletedSteps:
          preCertificationSummary.successfulSteps,
        orchestratorFailedSteps:
          preCertificationSummary.failedSteps,
        orchestratorCheckpointAt:
          preCertificationSummary.completedAt
      });
    }));

    const summary = foBuildOrchestratorSummaryWave312_(steps, startedAt);
    foFinalizeOrchestratorRunWave312_(runId, runRow, startedAt, summary, steps);

    foInfo_(module, 'Complete', 'Autonomous CIO orchestration completed. Run ID: ' + runId + ' | Operational Status: ' + summary.operationalStatus);

    return {
      status: summary.operationalStatus,
      operationalStatus: summary.operationalStatus,
      executionStatus: summary.executionStatus,
      controlStatus: summary.controlStatus,
      certificationStatus: summary.certificationStatus,
      runId: runId,
      stepsRun: steps.length,
      successfulSteps: summary.successfulSteps,
      failedSteps: summary.failedSteps,
      durationSeconds: summary.durationSeconds
    };
  } catch (error) {
    const failedSummary = foBuildFailedOrchestratorSummaryWave312_(steps, startedAt, error);
    if (runRow) {
      foFinalizeOrchestratorRunWave312_(runId, runRow, startedAt, failedSummary, steps);
    }
    foError_(module, 'Failure', error);
    throw error;
  } finally {
    PropertiesService.getScriptProperties().deleteProperty('FO_ACTIVE_RUN_ID');
  }
}

function foRunOrchestratorStep_(runId, stepName, stepFunction) {
  const startedAt = new Date();
  try {
    foInfo_('AutonomousCioOrchestrator', 'Step Start', runId + ' | ' + stepName + ' started.');
    if (typeof stepFunction !== 'function') {
      throw new Error('Registered module is not executable: ' + stepName);
    }
    const result = stepFunction();
    const completedAt = new Date();
    foInfo_('AutonomousCioOrchestrator', 'Step Complete', runId + ' | ' + stepName + ' completed.');
    return {
      runId: runId,
      stepName: stepName,
      status: 'SUCCESS',
      startedAt: startedAt,
      completedAt: completedAt,
      durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
      message: foSafeStringify_(result)
    };
  } catch (error) {
    const completedAt = new Date();
    foError_('AutonomousCioOrchestrator', 'Step Failure: ' + stepName, error);
    return {
      runId: runId,
      stepName: stepName,
      status: 'FAIL',
      startedAt: startedAt,
      completedAt: completedAt,
      durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
      message: error && error.message ? error.message : String(error)
    };
  }
}

function foBuildPreCertificationSummaryWave323_(steps, startedAt) {
  const completedAt = new Date();
  const successfulSteps = steps.filter(function(step) {
    return step.status === 'SUCCESS';
  }).length;
  const failedSteps = steps.filter(function(step) {
    return step.status === 'FAIL';
  }).length;

  return {
    executionStatus: failedSteps > 0 ? 'FAIL' : 'SUCCESS',
    controlStatus: 'NOT EVALUATED',
    certificationStatus: 'NOT EVALUATED',
    operationalStatus: failedSteps > 0
      ? 'FAILED'
      : 'READY FOR CERTIFICATION',
    successfulSteps: successfulSteps,
    failedSteps: failedSteps,
    durationSeconds: Math.round(
      (completedAt.getTime() - startedAt.getTime()) / 1000
    ),
    completedAt: completedAt
  };
}

function foPersistPreCertificationCheckpointWave323_(
  runId,
  runRow,
  startedAt,
  summary
) {
  const dashboard = foDashboard_();
  const runSheet = dashboard.getSheetByName(
    'Autonomous CIO Run Log'
  );

  if (!runSheet) {
    throw new Error(
      'Autonomous CIO Run Log is missing during pre-certification finalization'
    );
  }

  const resolvedRow =
    runRow ||
    foFindOrchestratorRunRowWave312_(runSheet, runId);

  if (!resolvedRow) {
    throw new Error(
      'Unable to locate orchestrator run for pre-certification finalization: ' +
        runId
    );
  }

  runSheet.getRange(resolvedRow, 1, 1, 13).setValues([[
    runId,
    startedAt,
    summary.operationalStatus,
    summary.successfulSteps,
    summary.failedSteps,
    summary.durationSeconds,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    summary.executionStatus,
    summary.controlStatus,
    summary.certificationStatus,
    summary.operationalStatus,
    summary.completedAt
  ]]);
}

function foBuildOrchestratorSummaryWave312_(steps, startedAt) {
  const completedAt = new Date();
  const successfulSteps = steps.filter(function(step) { return step.status === 'SUCCESS'; }).length;
  const failedSteps = steps.filter(function(step) { return step.status === 'FAIL'; }).length;
  const certificationStep = steps.filter(function(step) { return step.stepName === 'Production Certification'; })[0];
  const certificationResult = foParseOrchestratorStepResultWave312_(certificationStep);
  const executionStatus = failedSteps > 0 ? 'FAIL' : 'SUCCESS';
  const certificationStatus = String(certificationResult.certificationStatus || certificationResult.status || 'NOT AVAILABLE').toUpperCase();
  const controlStatus = String(certificationResult.controlStatus || (failedSteps > 0 ? 'FAIL' : 'PASS')).toUpperCase();

  let operationalStatus = 'COMPLETED — NOT CERTIFIED';
  if (executionStatus === 'FAIL') operationalStatus = 'FAILED';
  else if (certificationStatus === 'CERTIFIED') operationalStatus = 'COMPLETED — CERTIFIED';
  else if (certificationStatus === 'CERTIFIED WITH OBSERVATIONS') operationalStatus = 'COMPLETED — CERTIFIED WITH OBSERVATIONS';
  else if (certificationStatus === 'NOT CERTIFIED') operationalStatus = 'COMPLETED — NOT CERTIFIED';

  return {
    status: operationalStatus,
    operationalStatus: operationalStatus,
    executionStatus: executionStatus,
    controlStatus: controlStatus,
    certificationStatus: certificationStatus,
    successfulSteps: successfulSteps,
    failedSteps: failedSteps,
    durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
    completedAt: completedAt
  };
}

function foBuildFailedOrchestratorSummaryWave312_(steps, startedAt, error) {
  const completedAt = new Date();
  return {
    status: 'FAILED',
    operationalStatus: 'FAILED',
    executionStatus: 'FAIL',
    controlStatus: 'FAIL',
    certificationStatus: 'NOT AVAILABLE',
    successfulSteps: steps.filter(function(step) { return step.status === 'SUCCESS'; }).length,
    failedSteps: Math.max(1, steps.filter(function(step) { return step.status === 'FAIL'; }).length),
    durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
    completedAt: completedAt,
    errorMessage: error && error.message ? error.message : String(error)
  };
}

function foParseOrchestratorStepResultWave312_(step) {
  if (!step || !step.message) return {};
  try {
    const parsed = JSON.parse(step.message);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function foGetOrchestratorRunHeadersWave312_() {
  return [
    'Run ID', 'Timestamp', 'Overall Status', 'Successful Steps', 'Failed Steps',
    'Duration Seconds', 'Platform Version', 'Baseline', 'Execution Status',
    'Control Status', 'Certification Status', 'Operational Status', 'Completed At'
  ];
}

function foCreateOrchestratorRunWave312_(runId, startedAt) {
  const dashboard = foDashboard_();
  const headers = foGetOrchestratorRunHeadersWave312_();
  const runSheet = foEnsureSheet_(dashboard, 'Autonomous CIO Run Log', headers);
  foEnsureOrchestratorRunHeadersWave312_(runSheet, headers);
  runSheet.appendRow([
    runId, startedAt, 'IN PROGRESS', 0, 0, 0,
    FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE,
    'IN PROGRESS', 'NOT EVALUATED', 'NOT EVALUATED', 'IN PROGRESS', ''
  ]);
  return runSheet.getLastRow();
}

function foEnsureOrchestratorRunHeadersWave312_(runSheet, headers) {
  if (runSheet.getMaxColumns() < headers.length) {
    runSheet.insertColumnsAfter(runSheet.getMaxColumns(), headers.length - runSheet.getMaxColumns());
  }
  runSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  runSheet.setFrozenRows(1);
}

function foFinalizeOrchestratorRunWave312_(runId, runRow, startedAt, summary, steps) {
  const dashboard = foDashboard_();
  const runSheet = dashboard.getSheetByName('Autonomous CIO Run Log');
  if (!runSheet) throw new Error('Autonomous CIO Run Log is missing during finalization');
  const resolvedRow = runRow || foFindOrchestratorRunRowWave312_(runSheet, runId);
  if (!resolvedRow) throw new Error('Unable to locate orchestrator run for finalization: ' + runId);

  runSheet.getRange(resolvedRow, 1, 1, 13).setValues([[
    runId,
    startedAt,
    summary.operationalStatus,
    summary.successfulSteps,
    summary.failedSteps,
    summary.durationSeconds,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE,
    summary.executionStatus,
    summary.controlStatus,
    summary.certificationStatus,
    summary.operationalStatus,
    summary.completedAt
  ]]);

  foAppendOrchestratorStepsWave312_(dashboard, steps);
}

function foFindOrchestratorRunRowWave312_(runSheet, runId) {
  if (runSheet.getLastRow() < 2) return null;
  const values = runSheet.getRange(2, 1, runSheet.getLastRow() - 1, 1).getValues();
  for (let index = values.length - 1; index >= 0; index--) {
    if (String(values[index][0] || '') === runId) return index + 2;
  }
  return null;
}

function foAppendOrchestratorStepsWave312_(dashboard, steps) {
  const stepSheet = foEnsureSheet_(dashboard, 'Autonomous CIO Step Log', [
    'Run ID', 'Step Name', 'Status', 'Started At', 'Completed At',
    'Duration Seconds', 'Message', 'Platform Version', 'Baseline'
  ]);
  const rows = steps.map(function(step) {
    return [
      step.runId, step.stepName, step.status, step.startedAt, step.completedAt,
      step.durationSeconds, step.message, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE
    ];
  });
  if (rows.length > 0) {
    stepSheet.getRange(stepSheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }
}

function foSafeStringify_(value) {
  try {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function foRunAutonomousCioOrchestratorSmokeTest() {
  const module = 'AutonomousCioOrchestrator';
  try {
    foInfo_(module, 'Start', 'Autonomous CIO Orchestrator smoke test started.');
    const result = foRunAutonomousCioOrchestrator();
    const allowedOperationalStatuses = [
      'COMPLETED — CERTIFIED',
      'COMPLETED — CERTIFIED WITH OBSERVATIONS',
      'COMPLETED — NOT CERTIFIED',
      'FAILED'
    ];
    if (allowedOperationalStatuses.indexOf(result.operationalStatus) === -1) {
      throw new Error('Unexpected terminal operational status: ' + result.operationalStatus);
    }
    if (result.executionStatus !== 'SUCCESS' && result.executionStatus !== 'FAIL') {
      throw new Error('Unexpected execution status: ' + result.executionStatus);
    }
    if (!result.controlStatus) throw new Error('Control status is missing');
    if (!result.certificationStatus) throw new Error('Certification status is missing');
    foInfo_(module, 'Complete', 'Autonomous CIO Orchestrator smoke test completed. Run ID: ' + result.runId + ' | Operational Status: ' + result.operationalStatus);
    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
