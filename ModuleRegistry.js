/*********************************************************
 * ModuleRegistry.gs
 * Wave 2.0
 *********************************************************/

const FO_MODULES = {
  HEALTH: foRunPlatformHealthCheck,
  INTEGRITY: foRunPlatformIntegrityCheck,
  VALIDATION: foRunDataValidation,
  MARKET_DATA: foRunMarketDataRefresh,
  PORTFOLIO: foBuildPortfolioSnapshot,
  MARKET: foRunMarketIntelligence,
  CIO: foRunCioDecisionEngine,
  REPORT: foRunExecutiveReportEngine,
  DASHBOARD: foRunExecutiveDashboardEngine
};

function foGetModule(name) {
  if (!FO_MODULES[name]) {
    throw new Error('Module not registered: ' + name);
  }

  return FO_MODULES[name];
}