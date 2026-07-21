'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'InvestmentTrendEngine.js'), 'utf8');
const context = vm.createContext({console});
vm.runInContext(source, context, {filename: 'InvestmentTrendEngine.js'});

describe('Sprint 2.8.0 Trend Detection Intelligence', () => {
  test('detects sustained improvement', () => {
    expect(context.foNumericTrajectory_([60, 67, 74, 82], 5, false))
      .toBe('IMPROVING');
  });

  test('interprets falling risk as improvement', () => {
    expect(context.foNumericTrajectory_([55, 48, 40], 5, true))
      .toBe('IMPROVING');
  });

  test('detects downward reversal', () => {
    expect(context.foNumericTrajectory_([60, 70, 80, 70], 5, false))
      .toBe('REVERSING DOWNWARD');
  });

  test('detects upward reversal', () => {
    expect(context.foNumericTrajectory_([80, 70, 60, 70], 5, false))
      .toBe('REVERSING UPWARD');
  });

  test('does not claim trajectory from one observation', () => {
    expect(context.foNumericTrajectory_([80], 5, false))
      .toBe('INSUFFICIENT HISTORY');
  });

  test('preserves bounded history contract', () => {
    const maxObservations = vm.runInContext(
      'FO_TREND_MAX_OBSERVATIONS_',
      context
    );

    expect(maxObservations).toBe(5);
  });

  test('output contract contains trajectory fields', () => {
    expect(source).toContain("'Observation Count'");
    expect(source).toContain("'Recommendation Quality Trajectory'");
    expect(source).toContain("'Reversal Status'");
    expect(source).toContain("'Trend Evidence Strength'");
    expect(source).toContain("'Overall Trajectory'");
    expect(source).toContain("'Trajectory Rationale'");
  });
});
