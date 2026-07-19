'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Wave A2.4.0 static integration', () => {
  test('weekly report entry points are present', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain('function foRunWeeklyCioReportA240(');
    expect(source).toContain('function foRunWeeklyCioReportValidationA240(');
    expect(source).toContain('function foRunWeeklyCioReportSmokeTestA240(');
  });

  test('weekly report is governed by A2.3.3', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain('foRunExecutiveDecisionIntegrationA233');
    expect(source).toContain('EXECUTIVE_DECISION_STATE_A233');
    expect(source).toContain('REPORT_ACTION_CARDS_A233');
    expect(source).toContain('REPORT_DATA_READINESS_A233');
  });

  test('A2.4.0 worksheets are registered', () => {
    const config = read('Config.js');
    const schemas = read('WorksheetSchemaRegistryA230.js');
    expect(config).toContain('WEEKLY_CIO_REPORT_A240');
    expect(config).toContain('WEEKLY_CIO_REPORT_ARCHIVE_A240');
    expect(config).toContain('WEEKLY_CIO_REPORT_VALIDATION_A240');
    expect(schemas).toContain('WEEKLY_CIO_REPORT_A240:Object.freeze');
  });

  test('A2.4.0 engine and menu entries are registered', () => {
    expect(read('EngineRegistryA230.js')).toContain('WEEKLY_CIO_REPORT');
    expect(read('Menu.js')).toContain('foRunWeeklyCioReportA240');
    expect(read('Menu.js')).toContain('foRunWeeklyCioReportSmokeTestA240');
  });

  test('platform metadata is reconciled to v2.1.0-rc.3 and CB-002', () => {
    const config = read('Config.js');
    const packageJson = JSON.parse(read('package.json'));
    expect(config).toContain("PLATFORM_VERSION: 'v2.1.0-rc.3'");
    expect(config).toContain("BASELINE: 'CB-002'");
    expect(config).toContain("RELEASE_STATUS: 'RELEASE_CANDIDATE'");
    expect(config).toContain(
      "RELEASE_LINEAGE: 'v1.3.0 -> r1.3.1.1 -> v2.1.0-rc.1 -> v2.1.0-rc.2 -> v2.1.0-rc.3'"
    );
    expect(packageJson.version).toBe('2.1.0-rc.3');
  });

  test('Sprint 2.5.0 executive change detection reuses archive comparisons', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain("WHAT'S NEW");
    expect(source).toContain('function foA240WhatsNew_(');
    expect(source).toContain('foA240ChangeText_(');
    expect(source).toContain('foA240NumericDelta_(');
    expect(source).toContain('changes.slice(0, 5)');
    expect(source).toContain('No material changes since the previous report.');
  });

  test('A2.4.0.2 percentage and executive-rounding controls remain present', () => {
    const source = read('WeeklyCioReportA240.js');
    expect(source).toContain('A2.4.0.2 Percentage Unit Normalization');
    expect(source).toContain('Portfolio weights total approximately 100 percent');
    expect(source).toContain('Report contains no implausible portfolio percentages');
    expect(source).toContain('function foA240RatioPercentText_(');
    expect(source).toContain('function foA240PercentPointsText_(');
    expect(source).toContain('function foA240CleanNumericText_(');
    expect(source).toContain('return Number(value).toFixed(2);');
  });
});
