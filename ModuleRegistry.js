/*********************************************************
 * ModuleRegistry.gs
 * Wave 2.2
 *********************************************************/

const FO_MODULES = {
  HEALTH: foRunPlatformHealthCheck,
  INTEGRITY: foRunPlatformIntegrityCheck,
  VALIDATION: foRunDataValidation,
  MARKET_DATA: foRunMarketDataRefresh,
  VALUATION: foRunPortfolioValuation,
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