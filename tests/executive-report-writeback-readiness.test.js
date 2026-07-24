'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Reporting Engine Enhancement v3.0.1 write-back readiness', () => {
  test('routes production reporting through the governed persistence wrapper', () => {
    const registry = read('ModuleRegistry.js');
    const menu = read('Menu.js');

    expect(registry).toContain(
      'REPORT: foRunExecutiveReportProductionReady'
    );
    expect(menu).toContain(
      ".addItem('Run Executive CIO Report', 'foRunExecutiveReportProductionReady')"
    );
    expect(menu).toContain(
      ".addItem('Executive Report Smoke Test', 'foRunExecutiveReportProductionReadinessSmokeTest')"
    );
  });

  test('reuses existing governed snapshot, report, dashboard, and archive services', () => {
    const source = read('ExecutiveReportPersistenceService.js');

    expect(source).toContain('foBuildPortfolioSnapshot()');
    expect(source).toContain('foRunExecutiveReportEngine()');
    expect(source).toContain('foRunExecutiveDashboardEngine()');
    expect(source).toContain('foArchiveReport({');
    expect(source).toContain('foVerifyExecutiveReportPersistenceV301_');
  });

  test('fails closed when any required persistence control is missing', () => {
    const source = read('ExecutiveReportPersistenceService.js');

    expect(source).toContain('failedControls.length');
    expect(source).toContain(
      'Executive report write-back verification failed:'
    );
    expect(source).toContain("writeBackStatus: 'PERSISTED'");
  });

  test('does not create a second recommendation-event producer', () => {
    const source = read('ExecutiveReportPersistenceService.js');

    expect(source).not.toContain('foAppendRecommendationEvent(');
    expect(source).toContain("return 'NOT REQUIRED'");
    expect(source).toContain("return 'ELIGIBILITY REVIEW REQUIRED'");
  });

  test('uses approved status-symbol semantics', () => {
    const source = read('ExecutiveReportPersistenceService.js');

    expect(source).toContain('✅ Executive analysis completed.');
    expect(source).toContain('✅ Automated write-back completed.');
    expect(source).toContain('➖ Recommendation event not required');
    expect(source).toContain('⚠️ Recommendation change detected');
    expect(source).not.toContain('❌ No Investment Ledger');
  });
});
