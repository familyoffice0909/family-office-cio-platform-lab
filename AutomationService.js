/**
 * Legacy automation compatibility service.
 */

const FO_AUTOMATION = {
  AUTOMATION_VERSION: 'v1.0.0',
  BASELINE: FO_CONFIG.BASELINE,
  RELEASE: FO_CONFIG.RELEASE_NAME + ' ' + FO_CONFIG.PLATFORM_VERSION,
  HEALTH_SHEET: FO_SHEETS.PLATFORM_HEALTH,
  AUTOMATION_LOG: FO_SHEETS.AUTOMATION_LOG
};

function foAutomationLog_(level, module, action, message) {
  const sheet = foEnsureSheet_(
    foDashboard_(),
    FO_AUTOMATION.AUTOMATION_LOG,
    [
      'Timestamp', 'Level', 'Module', 'Action', 'Message',
      'Platform Version', 'Automation Version', 'Baseline', 'User'
    ]
  );

  sheet.appendRow([
    new Date(),
    level,
    module,
    action,
    message,
    FO_CONFIG.PLATFORM_VERSION,
    FO_AUTOMATION.AUTOMATION_VERSION,
    FO_AUTOMATION.BASELINE,
    foGetActiveUser_()
  ]);
}

function foAutomationInfo_(module, action, message) {
  foAutomationLog_('INFO', module, action, message);
}

function foAutomationWarn_(module, action, message) {
  foAutomationLog_('WARNING', module, action, message);
}

function foAutomationError_(module, action, error) {
  const message = error && error.stack ? error.stack : String(error);
  foAutomationLog_('ERROR', module, action, message);
}

function foGetAutomationVersion() {
  return {
    platformVersion: FO_CONFIG.PLATFORM_VERSION,
    automationVersion: FO_AUTOMATION.AUTOMATION_VERSION,
    baseline: FO_AUTOMATION.BASELINE,
    release: FO_AUTOMATION.RELEASE,
    dashboardSpreadsheetId: FO_CONFIG.DASHBOARD_SPREADSHEET_ID,
    ledgerSpreadsheetId: FO_CONFIG.LEDGER_SPREADSHEET_ID,
    baseCurrency: FO_CONFIG.BASE_CURRENCY
  };
}

function foAutomationBootstrap() {
  const module = 'AutomationBootstrap';

  try {
    foAutomationInfo_(module, 'Start', 'Automation bootstrap started.');

    foEnsureSheet_(foDashboard_(), FO_AUTOMATION.AUTOMATION_LOG, [
      'Timestamp', 'Level', 'Module', 'Action', 'Message',
      'Platform Version', 'Automation Version', 'Baseline', 'User'
    ]);

    foEnsureSheet_(foDashboard_(), FO_AUTOMATION.HEALTH_SHEET, [
      'Timestamp', 'Check', 'Status', 'Details', 'Platform Version', 'Baseline'
    ]);

    const health = foRunPlatformHealthCheck();

    foAutomationInfo_(
      module,
      'Complete',
      'Automation bootstrap completed. Health status: ' + health.status
    );

    return {
      status: 'SUCCESS',
      version: foGetAutomationVersion(),
      health: health
    };
  } catch (error) {
    foAutomationError_(module, 'Failure', error);
    throw error;
  }
}

function foShowAutomationVersion() {
  const v = foGetAutomationVersion();

  SpreadsheetApp.getUi().alert(
    FO_CONFIG.PLATFORM_NAME +
      '\nPlatform Version: ' + v.platformVersion +
      '\nAutomation Version: ' + v.automationVersion +
      '\nBaseline: ' + v.baseline +
      '\nRelease: ' + v.release +
      '\nBase Currency: ' + v.baseCurrency
  );
}
