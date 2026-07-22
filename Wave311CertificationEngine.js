/**
 * Wave 3.1.1 — Certification Engine Corrections
 *
 * Corrects current-run certification and standardizes control statuses:
 * PASS, PASS WITH OBSERVATIONS, REVIEW, FAIL.
 *
 * This file intentionally reuses the validated Wave 2.6.0-R2 schema,
 * price, history, deployment-contract, summary-writing helpers.
 */

function foRunProductionCertificationWave311(context) {
  return foWithRuntimeLock_(
    'Run Production Certification Wave311',
    function() {
      return foRunProductionCertificationWave311Protected_(context);
    }
  );
}

function foRunProductionCertificationWave311Protected_(context) {
  foAssertRuntimeLockHeld_('Run Production Certification Wave311');
  const module = 'ProductionCertificationEngineWave311';
  const dashboard = foDashboard_();
  const certificationRunId = foNowId_('CERT-RUN');
  const startedAt = new Date();
  const certificationContext = context || {};

  try {
    foInfo_(
      module,
      'Start',
      'Production certification started: ' + certificationRunId
    );

    const schemaResults = foValidateRegisteredSchemas_(dashboard).map(
      function(item) {
        return foCertificationControl_(
          'SCHEMA',
          item.sheetName,
          item.status,
          item.issues.join(' | ') || 'Schema valid'
        );
      }
    );

    const controls = []
      .concat(schemaResults)
      .concat(foValidateProductionPrices_(dashboard))
      .concat(foValidateDeploymentHistory_(dashboard))
      .concat(foValidateDeploymentContract_(dashboard))
      .concat(
        foValidateCurrentOrchestratorRunWave311_(
          dashboard,
          certificationContext
        )
      )
      .map(foNormalizeCertificationControlWave311_);

    const summary = foBuildCertificationSummaryWave311_(controls);

    foWriteProductionCertification_(
      dashboard,
      certificationRunId,
      startedAt,
      summary,
      controls
    );

    foInfo_(
      module,
      'Complete',
      'Production certification completed: ' +
        summary.status +
        ' | ' +
        certificationRunId +
        ' | Orchestrator Run: ' +
        (summary.orchestratorRunId || 'STANDALONE')
    );

    return {
      status: summary.status,
      certificationStatus: summary.status,
      controlStatus: summary.controlStatus,
      executionStatus: 'SUCCESS',
      certificationRunId: certificationRunId,
      orchestratorRunId: summary.orchestratorRunId || '',
      passedControls: summary.passed,
      observationControls: summary.observations,
      reviewControls: summary.reviews,
      warningControls: summary.observations + summary.reviews,
      failedControls: summary.failed,
      totalControls: controls.length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foValidateCurrentOrchestratorRunWave311_(dashboard, context) {
  const activeRunId = String(
    context.orchestratorRunId ||
      PropertiesService.getScriptProperties().getProperty('FO_ACTIVE_RUN_ID') ||
      ''
  ).trim();

  const inMemorySteps = Array.isArray(context.orchestratorSteps)
    ? context.orchestratorSteps
    : [];

  if (activeRunId && inMemorySteps.length) {
    const executionStatus = String(
      context.orchestratorExecutionStatus ||
        'IN PROGRESS'
    ).trim();

    return [
      foEvaluateOrchestratorStepsWave311_(
        activeRunId,
        executionStatus,
        inMemorySteps,
        'Current Orchestrator Run'
      )
    ];
  }

  return foValidateLatestCompletedOrchestratorRunWave311_(dashboard);
}

function foValidateLatestCompletedOrchestratorRunWave311_(dashboard) {
  const runSheet = dashboard.getSheetByName('Autonomous CIO Run Log');
  const stepSheet = dashboard.getSheetByName('Autonomous CIO Step Log');

  if (
    !runSheet ||
    !stepSheet ||
    runSheet.getLastRow() < 2 ||
    stepSheet.getLastRow() < 2
  ) {
    return [
      foCertificationControl_(
        'ORCHESTRATION',
        'Latest Completed Orchestrator Run',
        'FAIL',
        'Run or step log missing'
      )
    ];
  }

  const latestRun = runSheet
    .getRange(
      runSheet.getLastRow(),
      1,
      1,
      runSheet.getLastColumn()
    )
    .getValues()[0];

  const runId = String(latestRun[0] || '');
  const recordedStatus = String(latestRun[2] || '');
  const stepValues = stepSheet.getDataRange().getValues();
  const headers = stepValues[0].map(String);
  const runIdIndex = headers.indexOf('Run ID');
  const stepNameIndex = headers.indexOf('Step Name');
  const statusIndex = headers.indexOf('Status');
  const messageIndex = headers.indexOf('Message');

  if (runIdIndex < 0 || statusIndex < 0 || messageIndex < 0) {
    return [
      foCertificationControl_(
        'ORCHESTRATION',
        'Latest Completed Orchestrator Run',
        'FAIL',
        'Required orchestrator step-log columns are missing'
      )
    ];
  }

  const steps = stepValues.slice(1)
    .filter(function(row) {
      return String(row[runIdIndex] || '') === runId;
    })
    .map(function(row) {
      return {
        stepName: stepNameIndex >= 0
          ? String(row[stepNameIndex] || '')
          : '',
        status: String(row[statusIndex] || ''),
        message: String(row[messageIndex] || '')
      };
    });

  return [
    foEvaluateOrchestratorStepsWave311_(
      runId,
      recordedStatus,
      steps,
      'Latest Completed Orchestrator Run'
    )
  ];
}

function foEvaluateOrchestratorStepsWave311_(
  runId,
  recordedStatus,
  steps,
  controlName
) {
  let failures = 0;
  let observations = 0;
  let reviews = 0;
  const failureNames = [];
  const reviewNames = [];
  const observationNames = [];

  steps.forEach(function(step) {
    const status = String(step.status || '').toUpperCase();
    const message = String(step.message || '').toUpperCase();

    if (
      status === 'FAIL' ||
      message.indexOf('"STATUS":"FAIL"') >= 0 ||
      message.indexOf('"OVERALLSTATUS":"FAIL"') >= 0 ||
      message.indexOf('"CERTIFICATIONSTATUS":"NOT CERTIFIED"') >= 0
    ) {
      failures++;
      failureNames.push(
        String(step.stepName || 'Unnamed Step')
      );
      return;
    }

    if (
      status === 'REVIEW' ||
      message.indexOf('"STATUS":"REVIEW"') >= 0
    ) {
      reviews++;
      reviewNames.push(
        String(step.stepName || 'Unnamed Step')
      );
      return;
    }

    if (
      status === 'PASS WITH OBSERVATIONS' ||
      status === 'WARN' ||
      message.indexOf('WARNING') >= 0 ||
      message.indexOf('OBSERVATION') >= 0 ||
      message.indexOf('PASS_WITH_WARNINGS') >= 0 ||
      message.indexOf('PASS WITH OBSERVATIONS') >= 0
    ) {
      observations++;
      observationNames.push(
        String(step.stepName || 'Unnamed Step')
      );
    }
  });

  let controlStatus = 'PASS';
  let details =
    'Run ' +
    runId +
    ' evaluated directly with ' +
    steps.length +
    ' completed step(s); execution status ' +
    recordedStatus;

  if (failures > 0) {
    controlStatus = 'FAIL';
    details +=
      '; embedded control failures: ' +
      failures +
      ' [' +
      failureNames.join(', ') +
      ']';
  } else if (reviews > 0) {
    controlStatus = 'REVIEW';
    details +=
      '; review findings: ' +
      reviews +
      ' [' +
      reviewNames.join(', ') +
      ']';
  } else if (observations > 0) {
    controlStatus = 'PASS WITH OBSERVATIONS';
    details +=
      '; observations: ' +
      observations +
      ' [' +
      observationNames.join(', ') +
      ']';
  } else {
    details += '; no embedded control failures';
  }

  return foCertificationControl_(
    'ORCHESTRATION',
    controlName,
    controlStatus,
    details
  );
}

function foNormalizeCertificationControlWave311_(control) {
  const normalized = Object.assign({}, control);
  const raw = String(normalized.status || '').toUpperCase().trim();

  if (raw === 'WARN' || raw === 'PASS_WITH_WARNINGS') {
    normalized.status = 'PASS WITH OBSERVATIONS';
  } else if (
    raw === 'PASS' ||
    raw === 'PASS WITH OBSERVATIONS' ||
    raw === 'REVIEW' ||
    raw === 'FAIL'
  ) {
    normalized.status = raw;
  } else {
    normalized.status = 'REVIEW';
    normalized.details =
      (normalized.details ? normalized.details + ' | ' : '') +
      'Unrecognized control status normalized from: ' +
      raw;
  }

  return normalized;
}

function foBuildCertificationSummaryWave311_(controls) {
  const passed = controls.filter(function(item) {
    return item.status === 'PASS';
  }).length;

  const observations = controls.filter(function(item) {
    return item.status === 'PASS WITH OBSERVATIONS';
  }).length;

  const reviews = controls.filter(function(item) {
    return item.status === 'REVIEW';
  }).length;

  const failed = controls.filter(function(item) {
    return item.status === 'FAIL';
  }).length;

  let status = 'CERTIFIED';
  let controlStatus = 'PASS';

  if (failed > 0) {
    status = 'NOT CERTIFIED';
    controlStatus = 'FAIL';
  } else if (reviews > 0) {
    status = 'CERTIFIED WITH OBSERVATIONS';
    controlStatus = 'REVIEW';
  } else if (observations > 0) {
    status = 'CERTIFIED WITH OBSERVATIONS';
    controlStatus = 'PASS WITH OBSERVATIONS';
  }

  return {
    status: status,
    controlStatus: controlStatus,
    orchestratorRunId:
      PropertiesService.getScriptProperties().getProperty('FO_ACTIVE_RUN_ID') ||
      '',
    passed: passed,
    warnings: observations + reviews,
    observations: observations,
    reviews: reviews,
    failed: failed
  };
}

function foRunOrchestratorFinalizationSynchronizationSmokeTestWave323() {
  const result = foRunAutonomousCioOrchestrator();

  if (result.executionStatus !== 'SUCCESS') {
    throw new Error(
      'Expected successful execution, received: ' +
        result.executionStatus
    );
  }

  const dashboard = foDashboard_();
  const details = dashboard.getSheetByName(
    'Production Certification Details'
  );

  if (!details || details.getLastRow() < 2) {
    throw new Error(
      'Production Certification Details is missing or empty'
    );
  }

  const values = details.getDataRange().getValues();
  const headers = values[0].map(String);
  const controlIndex = headers.indexOf('Control');
  const detailsIndex = headers.indexOf('Details');

  if (controlIndex < 0 || detailsIndex < 0) {
    throw new Error(
      'Certification Details columns are incomplete'
    );
  }

  const matching = values.slice(1).filter(function(row) {
    return String(row[controlIndex] || '') ===
      'Current Orchestrator Run';
  });

  if (!matching.length) {
    throw new Error(
      'Current Orchestrator Run certification control is missing'
    );
  }

  const message = String(
    matching[matching.length - 1][detailsIndex] || ''
  );

  if (message.indexOf('execution status IN PROGRESS') >= 0) {
    throw new Error(
      'Certification still evaluated an IN PROGRESS run'
    );
  }

  if (message.indexOf('execution status SUCCESS') < 0) {
    throw new Error(
      'Certification did not evaluate the finalized SUCCESS checkpoint: ' +
        message
    );
  }

  return {
    status: 'PASS',
    orchestratorResult: result,
    certificationDetails: message
  };
}

function foRunProductionCertificationWave311SmokeTest() {
  const result = foRunProductionCertificationWave311();

  if (
    result.status !== 'CERTIFIED' &&
    result.status !== 'CERTIFIED WITH OBSERVATIONS' &&
    result.status !== 'NOT CERTIFIED'
  ) {
    throw new Error(
      'Unexpected certification status: ' + result.status
    );
  }

  if (
    result.executionStatus !== 'SUCCESS' ||
    !result.controlStatus ||
    !result.certificationStatus
  ) {
    throw new Error(
      'Wave 3.1.1 status semantics are incomplete'
    );
  }

  return result;
}
