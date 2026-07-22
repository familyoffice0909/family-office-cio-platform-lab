'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Sprint 3.0.0 integration contract', () => {
  test('registers and orchestrates portfolio optimization after snapshot', () => {
    const registry = read('ModuleRegistry.js');
    const orchestrator = read('AutonomousCioOrchestrator.js');
    expect(registry).toContain(
      'PORTFOLIO_OPTIMIZATION: foRunPortfolioOptimizationIntelligence'
    );
    const snapshotIndex = orchestrator.indexOf("'Portfolio Snapshot'");
    const optimizationIndex = orchestrator.indexOf(
      "'Portfolio Optimization Intelligence'"
    );
    const reportingIndex = orchestrator.indexOf("'Executive Report'");
    expect(snapshotIndex).toBeGreaterThanOrEqual(0);
    expect(optimizationIndex).toBeGreaterThan(snapshotIndex);
    expect(reportingIndex).toBeGreaterThan(optimizationIndex);
  });

  test('registers both optimization worksheets as required sheets', () => {
    const config = read('Config.js');
    expect(config).toContain(
      "PORTFOLIO_OPTIMIZATION: 'Portfolio Optimization'"
    );
    expect(config).toContain(
      "PORTFOLIO_OPTIMIZATION_SUMMARY: 'Portfolio Optimization Summary'"
    );
    expect(config).toContain('FO_SHEETS.PORTFOLIO_OPTIMIZATION,');
    expect(config).toContain('FO_SHEETS.PORTFOLIO_OPTIMIZATION_SUMMARY,');
  });

  test('adds optimization summary to executive reporting', () => {
    const reporting = read('ExecutiveReportingEngine.js');
    expect(reporting).toContain(
      'foAppendPortfolioOptimizationExecutiveRows_'
    );
    expect(reporting).toContain("'Portfolio Optimization Summary'");
  });
});
