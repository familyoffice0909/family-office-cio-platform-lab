/*********************************************************
 * ModuleRegistry.gs
 * Wave 1D.1
 * Central Module Registry
 *********************************************************/

const FO_MODULES = {

  HEALTH: foRunPlatformHealthCheck,

  INTEGRITY: foRunPlatformIntegrityCheck,

  VALIDATION: foRunDataValidation,

  PORTFOLIO: foBuildPortfolioSnapshot,

  MARKET: foRunMarketIntelligence,

  CIO: foRunCioDecisionEngine,

  REPORT: foRunExecutiveReportEngine,

  DASHBOARD: foRunExecutiveDashboardEngine

};

function foGetModule(name) {

  if (!FO_MODULES[name]) {

    throw new Error("Module not registered: " + name);

  }

  return FO_MODULES[name];

}