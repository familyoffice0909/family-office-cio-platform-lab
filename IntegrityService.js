function foRunLedgerIntegrityCheck() {
  const module = 'IntegrityService';

  try {
    foInfo_(module, 'Start', 'Ledger integrity check started.');

    const dashboard = foDashboard_();
    const sheet = dashboard.getSheetByName(
      FO_SHEETS.RECOMMENDATION_LEDGER
    );

    const result = foValidateRecommendationLedgerIntegrityA11_(sheet);

    const integritySheet = foEnsureSheet_(foLedger_(), 'Data Integrity', [
      'Timestamp',
      'Check Type',
      'Status',
      'Details',
      'Resolved?'
    ]);

    integritySheet.appendRow([
      new Date(),
      'Recommendation Ledger Integrity Check',
      result.status,
      result.issues.join(' | ') ||
        'Canonical recommendation ledger integrity valid.',
      result.status === 'PASS' ? 'Yes' : 'No'
    ]);

    foInfo_(
      module,
      'Complete',
      'Ledger integrity check status: ' + result.status
    );

    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foValidateRecommendationLedgerIntegrityA11_(sheet) {
  const issues = [];

  if (!sheet) {
    return {
      status: 'FAIL',
      checkedRows: 0,
      issues: ['Canonical Recommendation Ledger tab missing.']
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = (data[0] || []).map(function(value) {
    return String(value || '').trim();
  });

  const requiredHeaders = [
    'Recommendation ID',
    'Event ID',
    'Recommendation Date',
    'Ticker',
    'Recommendation Action',
    'Recommendation Status',
    'Created Date',
    'Last Updated'
  ];

  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) < 0) {
      issues.push(header + ' column missing.');
    }
  });

  if (issues.length) {
    return {
      status: 'FAIL',
      checkedRows: Math.max(data.length - 1, 0),
      issues: issues
    };
  }

  const recommendationIdIndex = headers.indexOf('Recommendation ID');
  const eventIdIndex = headers.indexOf('Event ID');
  const recommendationIds = {};
  const eventIds = {};
  let populatedRows = 0;

  data.slice(1).forEach(function(row, offset) {
    const sheetRow = offset + 2;
    const hasContent = row.some(function(value) {
      return String(value || '').trim() !== '';
    });

    if (!hasContent) {
      return;
    }

    populatedRows++;

    const recommendationId = String(
      row[recommendationIdIndex] || ''
    ).trim();
    const eventId = String(row[eventIdIndex] || '').trim();

    if (!recommendationId) {
      issues.push('Missing Recommendation ID at row ' + sheetRow + '.');
    } else if (recommendationIds[recommendationId]) {
      issues.push(
        'Duplicate Recommendation ID ' +
          recommendationId +
          ' at row ' +
          sheetRow +
          '.'
      );
    } else {
      recommendationIds[recommendationId] = sheetRow;
    }

    if (!eventId) {
      issues.push('Missing Event ID at row ' + sheetRow + '.');
    } else if (eventIds[eventId]) {
      issues.push(
        'Duplicate Event ID ' +
          eventId +
          ' at row ' +
          sheetRow +
          '.'
      );
    } else {
      eventIds[eventId] = sheetRow;
    }
  });

  if (!populatedRows) {
    issues.push('No recommendation events recorded yet.');
  }

  return {
    status: issues.length ? 'FAIL' : 'PASS',
    checkedRows: populatedRows,
    uniqueRecommendationIds: Object.keys(recommendationIds).length,
    uniqueEventIds: Object.keys(eventIds).length,
    issues: issues
  };
}

function foRunCanonicalRecommendationLedgerIntegritySmokeTestA11() {
  const dashboard = foDashboard_();
  const sheet = dashboard.getSheetByName(
    FO_SHEETS.RECOMMENDATION_LEDGER
  );

  const result = foValidateRecommendationLedgerIntegrityA11_(sheet);

  if (result.status !== 'PASS') {
    throw new Error(
      'Canonical Recommendation Ledger integrity failed: ' +
        JSON.stringify(result)
    );
  }

  const platform = foRunPlatformIntegrityCheck();

  if (!platform.ledger || platform.ledger.status !== 'PASS') {
    throw new Error(
      'Platform Integrity did not consume the canonical Recommendation Ledger result: ' +
        JSON.stringify(platform)
    );
  }

  return {
    status: 'PASS',
    ledger: result,
    platformIntegrityStatus: platform.status
  };
}

function foRunPlatformIntegrityCheck() {
  const module = 'IntegrityService';

  try {
    foInfo_(module, 'Start', 'Platform integrity check started.');

    const health = foRunPlatformHealthCheck();
    const ledger = foRunLedgerIntegrityCheck();

    const status =
      health.status === 'PASS' && ledger.status === 'PASS'
        ? 'PASS'
        : 'REVIEW';

    foInfo_(module, 'Complete', 'Platform integrity check completed: ' + status);

    return {
      status: status,
      health: health,
      ledger: ledger
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}