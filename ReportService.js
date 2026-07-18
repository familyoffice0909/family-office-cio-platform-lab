function foArchiveReport(report) {
  return foWithRuntimeLock_('Archive report', function() {
    return foArchiveReportProtected_(report);
  });
}

function foArchiveReportProtected_(report) {
  foAssertRuntimeLockHeld_('Archive report');
  const module = 'ReportService';

  try {
    foInfo_(module, 'Start', 'Archiving report.');

    const ledger = foLedger_();

    const sheet = foEnsureSheet_(ledger, 'Report Archive', [
      'Timestamp',
      'Report ID',
      'Report Type',
      'Title',
      'Materiality Score',
      'Action Plan Changed?',
      'Report Link',
      'Notes'
    ]);

    const reportId = report.reportId || foNowId_('RPT');

    sheet.appendRow([
      new Date(),
      reportId,
      report.reportType || '',
      report.title || '',
      report.materialityScore || '',
      report.actionPlanChanged || '',
      report.reportLink || '',
      report.notes || ''
    ]);

    foInfo_(module, 'Complete', 'Report archived: ' + reportId);

    return reportId;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foArchiveSmokeTestReport() {
  return foArchiveReport({
    reportType: 'Smoke Test',
    title: 'Apps Script Modular Architecture Smoke Test',
    materialityScore: 0,
    actionPlanChanged: 'No',
    notes: 'Validated report archive service.'
  });
}
