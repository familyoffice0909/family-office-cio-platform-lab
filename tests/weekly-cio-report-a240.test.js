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

  test('feature does not change platform version metadata', () => {
    const config = read('Config.js');
    expect(config).toContain("PLATFORM_VERSION: 'v1.3.0'");
  });
});
