/************************************************************
 * Menu.gs
 * Family Office CIO Platform
 * Enterprise Menu Structure
 ************************************************************/

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  const platformMenu = ui.createMenu('Platform')
    .addItem('Bootstrap Platform', 'foBootstrap')
    .addItem('Platform Health Check', 'foRunPlatformHealthCheck')
    .addItem('Platform Integrity Check', 'foRunPlatformIntegrityCheck')
    .addItem('Run Data Validation', 'foRunDataValidation');

  const investmentsMenu = ui.createMenu('Investments')
    .addItem('Seed Market Symbol Registry', 'foSeedMarketSymbolRegistry')
    .addItem('Run Market Data Refresh', 'foRunMarketDataRefresh')
    .addItem('Market Data Smoke Test', 'foRunMarketDataSmokeTest')
    .addSeparator()
    .addItem('Run Portfolio Valuation', 'foRunPortfolioValuation')
    .addItem('Portfolio Valuation Smoke Test', 'foRunPortfolioValuationSmokeTest')
    .addSeparator()
    .addItem('Run Portfolio Data Integrity', 'foRunPortfolioDataIntegrity')
    .addItem('Portfolio Data Integrity Smoke Test', 'foRunPortfolioDataIntegritySmokeTest')
    .addSeparator()
    .addItem('Run Portfolio Performance', 'foRunPortfolioPerformance')
    .addItem('Portfolio Performance Smoke Test', 'foRunPortfolioPerformanceSmokeTest')
    .addSeparator()
    .addItem('Run Portfolio Exposure Attribution', 'foRunPortfolioExposureAttribution')
    .addItem('Portfolio Exposure Attribution Smoke Test', 'foRunPortfolioExposureAttributionSmokeTest')
    .addSeparator()
    .addItem('Seed IBKR Position Snapshot', 'foSeedIbkrPositionSnapshot')
    .addItem('Run IBKR Reconciliation', 'foRunIbkrReconciliation')
    .addItem('IBKR Reconciliation Smoke Test', 'foRunIbkrReconciliationSmokeTest')
    .addSeparator()
    .addItem('Recommendation Engine Smoke Test', 'foRunRecommendationEngineSmokeTest')
    .addItem('Append Sample Recommendation', 'foAppendSampleRecommendation')
    .addSeparator()
    .addItem('Portfolio Engine Smoke Test', 'foRunPortfolioEngineSmokeTest')
    .addItem('Build Portfolio Snapshot', 'foBuildPortfolioSnapshot')
    .addSeparator()
    .addItem('Run Market Intelligence', 'foRunMarketIntelligence')
    .addItem('Market Intelligence Smoke Test', 'foRunMarketIntelligenceSmokeTest')
    .addSeparator()
    .addItem('Run CIO Decision Engine', 'foRunCioDecisionEngine')
    .addItem('CIO Decision Engine Smoke Test', 'foRunCioDecisionEngineSmokeTest')
    .addSeparator()
    .addItem('Rebuild Portfolio State', 'foRebuildPortfolioState')
    .addItem('Seed Known CDRs', 'foSeedKnownCDRs');

  const reportsMenu = ui.createMenu('Reports')
    .addItem('Run Executive Dashboard', 'foRunExecutiveDashboardEngine')
    .addItem('Executive Dashboard Smoke Test', 'foRunExecutiveDashboardSmokeTest')
    .addSeparator()
    .addItem('Run Executive CIO Report', 'foRunExecutiveReportProductionReady')
    .addItem('Executive Report Smoke Test', 'foRunExecutiveReportProductionReadinessSmokeTest')
    .addSeparator()
    .addItem('Run Weekly CIO Report A240', 'foRunWeeklyCioReportA240')
    .addItem('Weekly CIO Report Smoke Test A240', 'foRunWeeklyCioReportSmokeTestA240')
    .addSeparator()
    .addItem('Archive Smoke Test Report', 'foArchiveSmokeTestReport');

  const orchestratorMenu = ui.createMenu('Orchestrator')
    .addItem('Run Autonomous CIO Orchestrator', 'foRunAutonomousCioOrchestrator')
    .addItem('Autonomous CIO Smoke Test', 'foRunAutonomousCioOrchestratorSmokeTest');

  const adminMenu = ui.createMenu('Administration')
    .addItem('Show Platform Version', 'foShowVersion')
    .addItem('List Installed Triggers', 'foListTriggers')
    .addItem('Create Dashboard Backup', 'foCreateDashboardBackup');

  const diagnosticsMenu = ui.createMenu('Diagnostics')
    .addItem('Run Modular Smoke Test', 'foRunModularSmokeTest');

  ui.createMenu('Family Office CIO')
    .addSubMenu(platformMenu)
    .addSubMenu(investmentsMenu)
    .addSubMenu(reportsMenu)
    .addSubMenu(orchestratorMenu)
    .addSubMenu(adminMenu)
    .addSubMenu(diagnosticsMenu)
    .addToUi();
}