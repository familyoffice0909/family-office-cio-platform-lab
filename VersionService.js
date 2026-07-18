function foGetVersion() {
  return {
    platformName: FO_CONFIG.PLATFORM_NAME,
    platformVersion: FO_CONFIG.PLATFORM_VERSION,
    releaseName: FO_CONFIG.RELEASE_NAME,
    releaseStatus: FO_CONFIG.RELEASE_STATUS,
    releaseLineage: FO_CONFIG.RELEASE_LINEAGE,
    baseline: FO_CONFIG.BASELINE,
    build: FO_CONFIG.BUILD,
    environment: FO_CONFIG.ENVIRONMENT,
    engineName: FO_CONFIG.ENGINE_NAME,
    engineVersion: FO_CONFIG.ENGINE_VERSION,
    baseCurrency: FO_CONFIG.BASE_CURRENCY
  };
}

function foShowVersion() {
  const v = foGetVersion();

  SpreadsheetApp.getUi().alert(
    v.platformName +
    '\nPlatform Version: ' + v.platformVersion +
    '\nRelease: ' + v.releaseName +
    '\nRelease Status: ' + v.releaseStatus +
    '\nRelease Lineage: ' + v.releaseLineage +
    '\nBaseline: ' + v.baseline +
    '\nBuild: ' + v.build +
    '\nEnvironment: ' + v.environment +
    '\nEngine: ' + v.engineName +
    '\nEngine Version: ' + v.engineVersion +
    '\nBase Currency: ' + v.baseCurrency
  );
}
