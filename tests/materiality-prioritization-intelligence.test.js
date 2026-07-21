'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'InvestmentDecisionSupportEngine.js'), 'utf8'
);
const context = vm.createContext({console});
vm.runInContext(source, context, {filename: 'InvestmentDecisionSupportEngine.js'});

function decision(overrides) {
  return Object.assign({
    action: 'HOLD',
    recommendation: 'HOLD',
    basePriorityScore: 35,
    materialityScore: 20,
    materialityLevel: 'LOW',
    materialityPrimaryDriver: 'NO MATERIAL CHANGE',
    contradictionStatus: 'CLEAR',
    contradictionReasons: 'NONE',
    recommendationQualityGrade: 'MEDIUM',
    confidence: 70,
    calibrationStatus: 'INSUFFICIENT HISTORY',
    confidenceCalibrationScore: 0
  }, overrides || {});
}

function trajectory(overrides) {
  return Object.assign({
    observationCount: 4,
    overallTrajectory: 'STABLE',
    reversalStatus: 'NONE',
    trendEvidenceStrength: 'MEDIUM',
    trajectoryRationale: 'Representative trajectory.'
  }, overrides || {});
}

describe('Sprint 2.9.0 materiality and prioritization intelligence', () => {
  test('suppresses stable immaterial non-actionable decisions', () => {
    const result = context.foApplyExecutivePriority_(decision(), trajectory());
    expect(result.priorityLevel).toBe('SUPPRESSED');
    expect(result.attentionType).toBe('NONE');
    expect(result.priorityScore).toBeLessThanOrEqual(29);
  });

  test('elevates medium-evidence downward reversal to high', () => {
    const result = context.foApplyExecutivePriority_(
      decision({materialityScore: 65, materialityLevel: 'HIGH'}),
      trajectory({
        overallTrajectory: 'REVERSING DOWNWARD',
        reversalStatus: 'REVERSING DOWNWARD'
      })
    );
    expect(result.priorityScore).toBeGreaterThanOrEqual(70);
    expect(result.priorityLevel).toBe('HIGH');
    expect(result.attentionType).toBe('RISK');
  });

  test('classifies improving executable decisions as opportunities', () => {
    const result = context.foApplyExecutivePriority_(
      decision({
        action: 'BUY',
        recommendation: 'BUY',
        basePriorityScore: 78,
        materialityScore: 70,
        materialityLevel: 'HIGH',
        recommendationQualityGrade: 'HIGH'
      }),
      trajectory({overallTrajectory: 'IMPROVING', trendEvidenceStrength: 'HIGH'})
    );
    expect(result.attentionType).toBe('OPPORTUNITY');
    expect(result.priorityLevel).not.toBe('SUPPRESSED');
  });

  test('elevates blocked executable decisions but does not change action', () => {
    const result = context.foApplyExecutivePriority_(
      decision({
        action: 'BUY',
        recommendation: 'BUY',
        contradictionStatus: 'BLOCKED',
        contradictionReasons: 'Risk contradiction'
      }),
      trajectory()
    );
    expect(result.priorityScore).toBeGreaterThanOrEqual(70);
    expect(result.attentionType).toBe('CONTROL');
    expect(result.action).toBe('BUY');
  });

  test('insufficient history contributes no trajectory urgency', () => {
    expect(context.foTrajectoryEvidenceMultiplier_('INSUFFICIENT')).toBe(0);
    expect(context.foTrajectoryUrgency_('INSUFFICIENT HISTORY')).toBe(0);
  });

  test('decision output contract exposes governed priority fields', () => {
    expect(source).toContain("'Base Priority Score'");
    expect(source).toContain("'Priority Level'");
    expect(source).toContain("'Attention Type'");
    expect(source).toContain("'Overall Trajectory'");
    expect(source).toContain("'Trend Evidence Strength'");
  });
});
