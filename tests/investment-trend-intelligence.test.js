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

  test('keeps blank distance distinct from zero distance', () => {
    expect(context.foTrendNullableNumber_('')).toBeNull();
    expect(context.foTrendNullableNumber_(0)).toBe(0);

    const previous = {distancePct: null, zonePosition: 'UNAVAILABLE'};
    const current = {distancePct: null, zonePosition: 'UNAVAILABLE'};

    expect(
      context.foEntryDistanceTrend_(previous, current, null)
    ).toBe('INSUFFICIENT DATA');
  });

  test('deduplicates same-day observations before bounding history', () => {
    const result = context.foDeduplicateTrendSeriesByDay_([
      {timestamp: '2026-07-20T17:00:00Z', marker: 'prior'},
      {timestamp: '2026-07-21T08:00:00Z', marker: 'first'},
      {timestamp: '2026-07-21T17:00:00Z', marker: 'latest'}
    ]);

    expect(result).toHaveLength(2);
    expect(result[1].marker).toBe('latest');
  });

  test('propagates component reversal into formal reversal status', () => {
    expect(
      context.foResolveReversalStatus_(
        'STABLE',
        ['STABLE', 'REVERSING DOWNWARD']
      )
    ).toBe('REVERSING DOWNWARD');
  });

  test('counts reversals from formal reversal status', () => {
    const trends = [
      {reversalStatus: 'REVERSING UPWARD'},
      {reversalStatus: 'REVERSING DOWNWARD'},
      {reversalStatus: 'REVERSING DOWNWARD'},
      {reversalStatus: 'NONE'}
    ];

    expect(
      context.foCountTrendReversals_(trends, 'REVERSING UPWARD')
    ).toBe(1);
    expect(
      context.foCountTrendReversals_(trends, 'REVERSING DOWNWARD')
    ).toBe(2);
  });

});
