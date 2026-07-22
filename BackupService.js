function foCreateDashboardBackup() {
  const module = 'BackupService';

  try {
    foInfo_(module, 'Start', 'Creating dashboard backup.');

    foDashboard_();
    const file = DriveApp.getFileById(FO_CONFIG.DASHBOARD_SPREADSHEET_ID);

    const timestamp = Utilities.formatDate(
      new Date(),
      FO_CONFIG.TIMEZONE,
      'yyyyMMdd-HHmmss'
    );

    const backupName =
      'BACKUP - Family Office Portfolio Dashboard - ' +
      FO_CONFIG.PLATFORM_VERSION +
      ' - ' +
      timestamp;

    const copy = file.makeCopy(backupName);

    foInfo_(module, 'Complete', 'Backup created: ' + copy.getName());

    return {
      status: 'SUCCESS',
      backupName: copy.getName(),
      backupId: copy.getId()
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
