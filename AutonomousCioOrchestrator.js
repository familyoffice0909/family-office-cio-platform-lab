/************************************************************
 * AutonomousCioOrchestrator.gs
 * Wave 2.3.3
 ************************************************************/

function foRunAutonomousCioOrchestrator() {
  const module = 'AutonomousCioOrchestrator';
  const runId = foNowId_('CIO-RUN');
  const startedAt = new Date();

  try {
    foInfo_(module, 'Start', 'Autonomous CIO orchestration started. Run ID: ' + runId);

    const steps = [];

    steps.push(foRunOrchestratorStep_(runId, 'Platform Health Check', foGetModule('HEALTH')));
    steps.push(foRunOrchestratorStep_(runId, 'Platform Integrity Check', foGetModule('INTEGRITY')));
    steps.push(foRunOrchestratorStep_(runId, 'Data Validation', foGetModule('VALIDATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Market Data Refresh', foGetModule('MARKET_DATA')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Valuation', foGetModule('VALUATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Data Integrity', foGetModule('PORTFOLIO_DATA_INTEGRITY')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Performance', foGetModule('PERFORMANCE')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Exposure Attribution', foGetModule('EXPOSURE')));
    steps.push(foRunOrchestratorStep_(runId, 'IBKR Reconciliation', foGetModule('IBKR_RECONCILIATION')));
    steps.push(foRunOrchestratorStep_(runId, 'Portfolio Snapshot', foGetModule('PORTFOLIO')));
    steps.push(foRunOrchestratorStep_(runId, 'Market Intelligence', foGetModule('MARKET')));
    steps.push(foRunOrchestratorStep_(runId, 'CIO Decision Engine', foGetModule('CIO')));
    steps.push(foRunOrchestratorStep_(runId, 'Executive Report', foGetModule('REPORT')));
    steps.push(foRunOrchestratorStep_(runId, 'Executive Dashboard', foGetModule('DASHBOARD')));

    const summary = foBuildOrchestratorSummary_(steps, startedAt);
    foWriteOrchestratorRunLog_(runId, startedAt, summary, steps);

    foInfo_(
      module,
      'Complete',
      'Autonomous CIO orchestration completed. Run ID: ' + runId + ' | Status: ' + summary.status
    );

    return {
      status: summary.status,
      runId: runId,
      stepsRun: steps.length,
      successfulSteps: summary.successfulSteps,
      failedSteps: summary.failedSteps,
      durationSeconds: summary.durationSeconds
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
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

function foBuildOrchestratorSummary_(steps, startedAt) {
  const completedAt = new Date();

  const successfulSteps = steps.filter(function(step) {
    return step.status === 'SUCCESS';
  }).length;

  const failedSteps = steps.filter(function(step) {
    return step.status === 'FAIL';
  }).length;

  let status = 'SUCCESS';

  if (failedSteps > 0 && successfulSteps > 0) {
    status = 'PARTIAL SUCCESS';
  }

  if (failedSteps > 0 && successfulSteps === 0) {
    status = 'FAIL';
  }

  return {
    status: status,
    successfulSteps: successfulSteps,
    failedSteps: failedSteps,
    durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
    completedAt: completedAt
  };
}

function foWriteOrchestratorRunLog_(runId, startedAt, summary, steps) {
  const dashboard = foDashboard_();

  const runSheet = foEnsureSheet_(dashboard, 'Autonomous CIO Run Log', [
    'Run ID',
    'Timestamp',
    'Overall Status',
    'Successful Steps',
    'Failed Steps',
    'Duration Seconds',
    'Platform Version',
    'Baseline'
  ]);

  runSheet.appendRow([
    runId,
    startedAt,
    summary.status,
    summary.successfulSteps,
    summary.failedSteps,
    summary.durationSeconds,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ]);

  const stepSheet = foEnsureSheet_(dashboard, 'Autonomous CIO Step Log', [
    'Run ID',
    'Step Name',
    'Status',
    'Started At',
    'Completed At',
    'Duration Seconds',
    'Message',
    'Platform Version',
    'Baseline'
  ]);

  const rows = steps.map(function(step) {
    return [
      step.runId,
      step.stepName,
      step.status,
      step.startedAt,
      step.completedAt,
      step.durationSeconds,
      step.message,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
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

    foInfo_(module, 'Complete', 'Autonomous CIO Orchestrator smoke test completed. Run ID: ' + result.runId);

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}