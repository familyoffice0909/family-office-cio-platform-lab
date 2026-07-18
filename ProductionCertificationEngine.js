/**
 * Production Certification Engine
 * Wave 2.6.0-R2 — Production Certification
 */

function foRunProductionCertification() {
  return foWithRuntimeLock_(
    'Run Production Certification',
    function() {
      return foRunProductionCertificationProtected_();
    }
  );
}

function foRunProductionCertificationProtected_() {
  foAssertRuntimeLockHeld_('Run Production Certification');
  const module = 'ProductionCertificationEngine';
  const dashboard = foDashboard_();
  const runId = foNowId_('CERT-RUN');
  const startedAt = new Date();

  try {
    foInfo_(module, 'Start', 'Production certification started: ' + runId);

    const schemaResults = foValidateRegisteredSchemas_(dashboard);
    const priceResults = foValidateProductionPrices_(dashboard);
    const historyResults = foValidateDeploymentHistory_(dashboard);
    const deploymentResults = foValidateDeploymentContract_(dashboard);
    const orchestratorResults = foValidateLatestOrchestratorRun_(dashboard);

    const controls = []
      .concat(schemaResults.map(function(item) {
        return foCertificationControl_(
          'SCHEMA',
          item.sheetName,
          item.status,
          item.issues.join(' | ') || 'Schema valid'
        );
      }))
      .concat(priceResults)
      .concat(historyResults)
      .concat(deploymentResults)
      .concat(orchestratorResults);

    const summary = foBuildCertificationSummary_(controls);
    foWriteProductionCertification_(
      dashboard,
      runId,
      startedAt,
      summary,
      controls
    );

    foInfo_(
      module,
      'Complete',
      'Production certification completed: ' +
        summary.status + ' | ' + runId
    );

    return {
      status: summary.status,
      certificationRunId: runId,
      passedControls: summary.passed,
      warningControls: summary.warnings,
      failedControls: summary.failed,
      totalControls: controls.length
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foValidateProductionPrices_(dashboard) {
  const controls = [];
  const definitions = [
    {
      sheetName: FO_SHEETS.BUY_ZONE_INTELLIGENCE,
      priceHeaders: ['Current Price', 'Target Entry Price'],
      freshnessHeader: 'Price Freshness'
    },
    {
      sheetName: FO_SHEETS.INVESTMENT_DECISION_SUPPORT,
      priceHeaders: ['Current Price', 'Target Entry Price'],
      freshnessHeader: 'Price Freshness'
    },
    {
      sheetName: FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES,
      priceHeaders: ['Current Price', 'Target Entry Price'],
      freshnessHeader: 'Price Freshness'
    }
  ];

  definitions.forEach(function(definition) {
    const sheet = dashboard.getSheetByName(definition.sheetName);

    if (!sheet || sheet.getLastRow() < 2) {
      controls.push(
        foCertificationControl_(
          'DATA',
          definition.sheetName + ' prices',
          'FAIL',
          'Worksheet missing or contains no data rows'
        )
      );
      return;
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const issues = [];

    definition.priceHeaders.forEach(function(header) {
      const index = headers.indexOf(header);

      if (index === -1) {
        issues.push('Missing price column: ' + header);
        return;
      }

      values.slice(1).forEach(function(row, rowIndex) {
        const freshnessIndex = headers.indexOf(definition.freshnessHeader);
        const freshness = freshnessIndex >= 0
          ? String(row[freshnessIndex] || '')
          : '';
        const value = row[index];

        if (
          value === '' ||
          value === null ||
          value === undefined
        ) {
          if (header === 'Current Price' && freshness !== 'MISSING') {
            issues.push(
              header + ' blank at row ' + (rowIndex + 2)
            );
          }
          return;
        }

        if (
          Object.prototype.toString.call(value) === '[object Date]'
        ) {
          issues.push(
            header + ' contains Date object at row ' + (rowIndex + 2)
          );
          return;
        }

        const number = Number(value);

        if (!isFinite(number)) {
          issues.push(
            header + ' non-numeric at row ' + (rowIndex + 2)
          );
        } else if (number < 0) {
          issues.push(
            header + ' negative at row ' + (rowIndex + 2)
          );
        } else if (number > 1000000) {
          issues.push(
            header + ' implausibly large at row ' + (rowIndex + 2)
          );
        }
      });
    });

    controls.push(
      foCertificationControl_(
        'DATA',
        definition.sheetName + ' prices',
        issues.length ? 'FAIL' : 'PASS',
        issues.join(' | ') || 'Price integrity valid'
      )
    );
  });

  return controls;
}

function foValidateDeploymentHistory_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_HISTORY
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return [
      foCertificationControl_(
        'AUDIT',
        'Capital Deployment History',
        'FAIL',
        'History missing or empty'
      )
    ];
  }

  const expectedHeaders =
    foCapitalDeploymentHistoryHeadersWave322_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const issues = [];

  expectedHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      issues.push('Missing history column: ' + header);
    }
  });

  if (issues.length) {
    return [
      foCertificationControl_(
        'AUDIT',
        'Capital Deployment History',
        'FAIL',
        issues.join(' | ')
      )
    ];
  }

  const indexes = {};
  expectedHeaders.forEach(function(header) {
    indexes[header] = headers.indexOf(header);
  });

  values.slice(1).forEach(function(row, index) {
    const sheetRow = index + 2;
    const timestamp = row[indexes.Timestamp];
    const runId = String(row[indexes['Run ID']] || '').trim();
    const directive = String(
      row[indexes['Portfolio Directive']] || ''
    ).trim();
    const ticker = String(row[indexes['Top Ticker']] || '').trim();
    const decision = String(row[indexes['Top Decision']] || '').trim();
    const baseline = String(row[indexes.Baseline] || '').trim();
    const signature = String(
      row[indexes['State Signature']] || ''
    ).trim();

    if (!timestamp) issues.push('Missing timestamp at row ' + sheetRow);

    if (
      !runId ||
      (
        runId.indexOf('CIO-RUN-') !== 0 &&
        runId.indexOf('CAPITAL-RUN-') !== 0 &&
        runId.indexOf('LEGACY-CAPITAL-RUN-') !== 0
      )
    ) {
      issues.push('Invalid Run ID at row ' + sheetRow);
    }

    if (!directive) {
      issues.push('Missing directive at row ' + sheetRow);
    }

    if (!ticker) {
      issues.push('Missing top ticker at row ' + sheetRow);
    }

    if (!decision) {
      issues.push('Missing top decision at row ' + sheetRow);
    }

    if (!baseline) {
      issues.push('Missing baseline at row ' + sheetRow);
    }

    if (!signature) {
      issues.push('Missing signature at row ' + sheetRow);
    }
  });

  return [
    foCertificationControl_(
      'AUDIT',
      'Capital Deployment History',
      issues.length ? 'FAIL' : 'PASS',
      issues.join(' | ') ||
        'History schema, directive and lineage valid'
    )
  ];
}

function foValidateDeploymentContract_(dashboard) {
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.CAPITAL_DEPLOYMENT_PRIORITIES
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return [
      foCertificationControl_(
        'CONTROL',
        'Capital Deployment Contract',
        'FAIL',
        'Deployment priorities missing'
      )
    ];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const decisionIndex = headers.indexOf('Deployment Decision');
  const blockedIndex = headers.indexOf('Blocked');
  const directiveIndex = headers.indexOf('Portfolio Directive');
  const issues = [];

  const rows = values.slice(1);
  const deployableCount = rows.filter(function(row) {
    const decision = String(row[decisionIndex] || '');
    return decision === 'DEPLOY NOW' || decision === 'DEPLOY SOON';
  }).length;

  const blockedCount = rows.filter(function(row) {
    return String(row[blockedIndex] || '') === 'YES';
  }).length;

  const directive = rows.length
    ? String(rows[0][directiveIndex] || '')
    : '';

  if (
    deployableCount === 0 &&
    directive.indexOf('HOLD CASH') === -1
  ) {
    issues.push('No deployable candidates but directive does not hold cash');
  }

  if (
    blockedCount === rows.length &&
    directive.indexOf('HOLD CASH') === -1
  ) {
    issues.push('All candidates blocked but directive does not hold cash');
  }

  return [
    foCertificationControl_(
      'CONTROL',
      'Capital Deployment Contract',
      issues.length ? 'FAIL' : 'PASS',
      issues.join(' | ') ||
        'Deployment directive is consistent with candidate state'
    )
  ];
}

function foValidateLatestOrchestratorRun_(dashboard) {
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
        'Latest Orchestrator Run',
        'FAIL',
        'Run or step log missing'
      )
    ];
  }

  const latestRun = runSheet.getRange(
    runSheet.getLastRow(),
    1,
    1,
    runSheet.getLastColumn()
  ).getValues()[0];

  const runId = String(latestRun[0] || '');
  const recordedStatus = String(latestRun[2] || '');
  const stepValues = stepSheet.getDataRange().getValues();
  const stepHeaders = stepValues[0].map(String);
  const runIdIndex = stepHeaders.indexOf('Run ID');
  const statusIndex = stepHeaders.indexOf('Status');
  const messageIndex = stepHeaders.indexOf('Message');

  const relatedSteps = stepValues.slice(1).filter(function(row) {
    return String(row[runIdIndex] || '') === runId;
  });

  let failures = 0;
  let warnings = 0;

  relatedSteps.forEach(function(row) {
    const status = String(row[statusIndex] || '').toUpperCase();
    const message = String(row[messageIndex] || '').toUpperCase();

    if (
      status === 'FAIL' ||
      message.indexOf('"STATUS":"FAIL"') >= 0 ||
      message.indexOf('"OVERALLSTATUS":"FAIL"') >= 0
    ) {
      failures++;
    } else if (
      message.indexOf('WARNING') >= 0 ||
      message.indexOf('OBSERVATION') >= 0 ||
      message.indexOf('"STATUS":"REVIEW"') >= 0 ||
      message.indexOf('PASS_WITH_WARNINGS') >= 0 ||
      message.indexOf('PASS WITH OBSERVATIONS') >= 0
    ) {
      warnings++;
    }
  });

  let status = 'PASS';
  let message =
    'Run ' + runId + ' recorded ' + recordedStatus +
    ' with no embedded control failures';

  if (failures > 0) {
    status = 'FAIL';
    message =
      'Run ' + runId + ' contains ' + failures +
      ' embedded control failure(s)';
  } else if (warnings > 0) {
    status = 'WARN';
    message =
      'Run ' + runId + ' contains ' + warnings +
      ' warning/review observation(s)';
  }

  return [
    foCertificationControl_(
      'ORCHESTRATION',
      'Latest Orchestrator Run',
      status,
      message
    )
  ];
}

function foCertificationControl_(category, control, status, details) {
  return {
    category: category,
    control: control,
    status: status,
    details: details
  };
}

function foBuildCertificationSummary_(controls) {
  const passed = controls.filter(function(item) {
    return item.status === 'PASS';
  }).length;
  const warnings = controls.filter(function(item) {
    return item.status === 'WARN';
  }).length;
  const failed = controls.filter(function(item) {
    return item.status === 'FAIL';
  }).length;

  let status = 'CERTIFIED';

  if (failed > 0) {
    status = 'NOT CERTIFIED';
  } else if (warnings > 0) {
    status = 'CERTIFIED WITH OBSERVATIONS';
  }

  return {
    status: status,
    passed: passed,
    warnings: warnings,
    failed: failed
  };
}

function foWriteProductionCertification_(
  dashboard,
  runId,
  startedAt,
  summary,
  controls
) {
  const summaryHeaders = [
    'Certification Run ID',
    'Timestamp',
    'Certification Status',
    'Passed Controls',
    'Warning Controls',
    'Failed Controls',
    'Platform Version',
    'Baseline'
  ];

  const summarySheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PRODUCTION_CERTIFICATION,
    summaryHeaders
  );

  summarySheet.clearContents();
  summarySheet.getRange(1, 1, 1, summaryHeaders.length)
    .setValues([summaryHeaders]);
  summarySheet.getRange(2, 1, 1, summaryHeaders.length)
    .setValues([[
      runId,
      startedAt,
      summary.status,
      summary.passed,
      summary.warnings,
      summary.failed,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]]);

  const detailHeaders = [
    'Certification Run ID',
    'Category',
    'Control',
    'Status',
    'Details',
    'Timestamp',
    'Platform Version',
    'Baseline'
  ];

  const detailSheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.PRODUCTION_CERTIFICATION_DETAILS,
    detailHeaders
  );

  detailSheet.clearContents();
  detailSheet.getRange(1, 1, 1, detailHeaders.length)
    .setValues([detailHeaders]);

  const rows = controls.map(function(item) {
    return [
      runId,
      item.category,
      item.control,
      item.status,
      item.details,
      startedAt,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ];
  });

  if (rows.length) {
    detailSheet.getRange(2, 1, rows.length, detailHeaders.length)
      .setValues(rows);
  }

  [summarySheet, detailSheet].forEach(function(sheet) {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold')
      .setBackground('#1f4e78')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });

  detailSheet.setColumnWidth(5, 620);
}

function foRunProductionCertificationSmokeTest() {
  const result = foRunProductionCertification();

  if (
    result.status !== 'CERTIFIED' &&
    result.status !== 'CERTIFIED WITH OBSERVATIONS' &&
    result.status !== 'NOT CERTIFIED'
  ) {
    throw new Error(
      'Unexpected certification status: ' + result.status
    );
  }

  return result;
}
