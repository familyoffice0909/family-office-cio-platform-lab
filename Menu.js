/************************************************************
 * Menu.gs
 * Family Office CIO Platform
 * Enterprise Menu Structure
 * Version: v2.6.0
 ************************************************************/

function onOpen() {

  const ui = SpreadsheetApp.getUi();

  //----------------------------------------------------------
  // Platform
  //----------------------------------------------------------

  const platformMenu = ui.createMenu('Platform')
    .addItem('Bootstrap Platform', 'foBootstrap')
    .addItem('Platform Health Check', 'foRunPlatformHealthCheck')
    .addItem('Platform Integrity Check', 'foRunPlatformIntegrityCheck')
    .addItem('Run Data Validation', 'foRunDataValidation');

  //----------------------------------------------------------
  // Investments
  //----------------------------------------------------------

  const investmentsMenu = ui.createMenu('Investments')
    .addItem('Recommendation Engine Smoke Test', 'foRunRecommendationEngineSmokeTest')
    .addItem('Append Sample Recommendation', 'foAppendSampleRecommendation')
    .addSeparator()
    .addItem('Rebuild Portfolio State', 'foRebuildPortfolioState')
    .addItem('Seed Known CDRs', 'foSeedKnownCDRs');

  //----------------------------------------------------------
  // Reports
  //----------------------------------------------------------

  const reportsMenu = ui.createMenu('Reports')
    .addItem('Archive Smoke Test Report', 'foArchiveSmokeTestReport');

  //----------------------------------------------------------
  // Administration
  //----------------------------------------------------------

  const adminMenu = ui.createMenu('Administration')
    .addItem('Show Platform Version', 'foShowVersion')
    .addItem('List Installed Triggers', 'foListTriggers')
    .addItem('Create Dashboard Backup', 'foCreateDashboardBackup');

  //----------------------------------------------------------
  // Diagnostics
  //----------------------------------------------------------

  const diagnosticsMenu = ui.createMenu('Diagnostics')
    .addItem('Run Modular Smoke Test', 'foRunModularSmokeTest');

  //----------------------------------------------------------
  // Root Menu
  //----------------------------------------------------------

  ui.createMenu('Family Office CIO')
    .addSubMenu(platformMenu)
    .addSubMenu(investmentsMenu)
    .addSubMenu(reportsMenu)
    .addSubMenu(adminMenu)
    .addSubMenu(diagnosticsMenu)
    .addToUi();
}