function foRunPlatformHealthCheck() {
  const module = 'HealthCheck';

  try {
    foInfo_(module, 'Start', 'Platform health check started.');

    const dashboard = foDashboard_();
    const rows = [];
    let failures = 0;

    FO_REQUIRED_DASHBOARD_SHEETS.forEach(function (sheetName) {
      const sheet = dashboard.getSheetByName(sheetName);
      const status = sheet ? 'PASS' : 'FAIL';

      if (!sheet) failures++;

      rows.push([
        foTimestamp_(),
        sheetName,
        status,
        sheet ? 'Worksheet found.' : 'Worksheet missing.',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]);
    });

    const healthSheet = foEnsureSheet_(dashboard, FO_SHEETS.PLATFORM_HEALTH, [
      'Timestamp',
      'Check',
      'Status',
      'Details',
      'Platform Version',
      'Baseline'
    ]);

    if (healthSheet.getLastRow() > 1) {
      healthSheet.getRange(2, 1, healthSheet.getLastRow() - 1, 6).clearContent();
    }

    if (rows.length > 0) {
      healthSheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }

    const result = failures === 0 ? 'PASS' : 'FAIL';

    foLog_(
      result === 'PASS' ? 'INFO' : 'ERROR',
      module,
      'Complete',
      result === 'PASS'
        ? 'All required worksheets found.'
        : failures + ' worksheet(s) missing.'
    );

    return {
      status: result,
      checkedWorksheets: FO_REQUIRED_DASHBOARD_SHEETS.length,
      failures: failures
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}