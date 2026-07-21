'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load(file) {
  const context = vm.createContext({console});
  vm.runInContext(read(file), context, {filename: file});
  return context;
}

function baseItem(overrides) {
  return Object.assign({
    ticker: 'MU',
    account: 'TFSA',
    currentPrice: 100,
    targetEntryPrice: 100,
    distancePct: 0,
    zonePosition: 'IN BUY ZONE',
    priceFreshness: 'FRESH',
    convictionScore: 92,
    riskScore: 20,
    confidence: 88,
    recommendation: 'BUY',
    portfolioWeight: 0.05,
    rationale: 'Aligned opportunity'
  }, overrides || {});
}

function assess(context, item, overrides) {
  const settings = Object.assign({
    action: 'BUY',
    allocationBand: '3-5%',
    trend: 'IMPROVING',
    convictionDelta: 8,
    riskDelta: -5,
    confidenceDelta: 7,
    distanceDelta: -0.01,
    materialityAssessment: {score: 82, level: 'HIGH'}
  }, overrides || {});

  return context.foAssessRecommendationQuality_(
    item,
    settings.action,
    settings.allocationBand,
    settings.trend,
    settings.convictionDelta,
    settings.riskDelta,
    settings.confidenceDelta,
    settings.distanceDelta,
    settings.materialityAssessment
  );
}

describe('Sprint 2.6.0 recommendation quality model', () => {
  const decisionContext = load('InvestmentDecisionSupportEngine.js');

  test('high-quality aligned recommendation is decision-ready', () => {
    const result = assess(decisionContext, baseItem());

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBe('HIGH');
    expect(result.evidenceBalance).toBe('POSITIVE');
    expect(result.contradictionStatus).toBe('CLEAR');
    expect(result.supportingEvidence).toContain('Fresh price data');
    expect(result.supportingEvidence).toContain(
      'Recommendation and action are aligned'
    );
  });

  test('missing market data cannot create false near-target evidence', () => {
    const item = baseItem({
      currentPrice: 0,
      targetEntryPrice: 0,
      distancePct: 0,
      zonePosition: 'UNAVAILABLE',
      priceFreshness: 'MISSING',
      convictionScore: 25,
      riskScore: 56,
      confidence: 0,
      recommendation: 'HOLD'
    });

    const result = assess(decisionContext, item, {
      action: 'REFRESH DATA',
      allocationBand: '0%',
      trend: 'STABLE',
      convictionDelta: 0,
      riskDelta: 0,
      confidenceDelta: 0,
      distanceDelta: 0,
      materialityAssessment: {score: 0, level: 'IMMATERIAL'}
    });

    expect(result.supportingEvidence).not.toContain(
      'Price is near the target entry'
    );
    expect(result.dataLimitations).toContain('Missing current price');
    expect(result.dataLimitations).toContain('Target entry is unavailable');
    expect(result.dataLimitations).toContain(
      'Distance to target is unavailable'
    );
    expect(result.contradictionStatus).toBe('BLOCKED');
  });

  test('mixed but usable recommendation is graded medium', () => {
    const item = baseItem({
      currentPrice: 109,
      distancePct: 0.09,
      convictionScore: 70,
      riskScore: 45,
      confidence: 65,
      recommendation: 'ACCUMULATE',
      zonePosition: 'ABOVE ZONE'
    });
    const result = assess(decisionContext, item, {
      action: 'ACCUMULATE',
      allocationBand: '1-2%',
      trend: 'STABLE',
      convictionDelta: 0,
      riskDelta: 0,
      confidenceDelta: 0,
      distanceDelta: 0,
      materialityAssessment: {score: 55, level: 'MEDIUM'}
    });

    expect(result.grade).toBe('MEDIUM');
    expect(result.contradictionStatus).toBe('CLEAR');
    expect(result.opposingEvidence).toContain('Risk requires position-size');
  });

  test('stale essential data is insufficient and blocked', () => {
    const item = baseItem({
      priceFreshness: 'STALE',
      recommendation: 'HOLD',
      confidence: 0,
      convictionScore: 45,
      riskScore: 40
    });
    const result = assess(decisionContext, item, {
      action: 'REFRESH DATA',
      allocationBand: '0%',
      trend: 'STABLE',
      materialityAssessment: {score: 25, level: 'LOW'}
    });

    expect(result.score).toBeLessThanOrEqual(49);
    expect(result.grade).toBe('INSUFFICIENT DATA');
    expect(result.evidenceBalance).toBe('INSUFFICIENT');
    expect(result.contradictionStatus).toBe('BLOCKED');
    expect(result.dataLimitations).toContain('Stale current price');
  });

  test('high-risk deployable action is blocked', () => {
    const result = assess(
      decisionContext,
      baseItem({riskScore: 70}),
      {action: 'BUY'}
    );

    expect(result.score).toBeLessThanOrEqual(59);
    expect(result.grade).toBe('LOW');
    expect(result.contradictionStatus).toBe('BLOCKED');
    expect(result.contradictionReasons).toContain('risk above 50');
  });

  test('semantic mismatch is surfaced deterministically', () => {
    const item = baseItem({recommendation: 'WATCH'});
    const first = assess(decisionContext, item, {
      action: 'HOLD',
      allocationBand: '0%',
      trend: 'STABLE'
    });
    const second = assess(decisionContext, item, {
      action: 'HOLD',
      allocationBand: '0%',
      trend: 'STABLE'
    });

    expect(first).toEqual(second);
    expect(first.contradictionStatus).toBe('REVIEW');
    expect(first.contradictionReasons).toContain('conflicts with action');
  });

  test('decision and history contracts preserve all quality fields', () => {
    const decisionHeaders = decisionContext.foDecisionSupportHeaders_();
    const historyHeaders = decisionContext.foDecisionHistoryHeaders_();

    const qualityHeaders = [
      'Recommendation Quality Score',
      'Recommendation Quality Grade',
      'Supporting Evidence',
      'Opposing Evidence',
      'Data Limitations',
      'Evidence Balance',
      'Contradiction Status',
      'Contradiction Reasons',
      'Quality Rationale'
    ];

    const calibrationHeaders = [
      'Confidence Calibration Score',
      'Confidence Reliability',
      'Calibration Sample Size',
      'Calibration Status',
      'Calibration Scope',
      'Confidence Band',
      'Calibration Rationale'
    ];

    expect(decisionHeaders.slice(-16, -7)).toEqual(qualityHeaders);
    expect(decisionHeaders.slice(-7)).toEqual(calibrationHeaders);
    expect(historyHeaders.slice(-9)).toEqual(qualityHeaders);
  });
});

describe('Sprint 2.6.0 downstream governance', () => {
  test('capital deployment blocks low and contradictory quality', () => {
    const context = load('CapitalDeploymentPriorityEngine.js');
    const item = {
      ticker: 'QNC',
      account: 'TFSA',
      recommendation: 'BUY',
      action: 'BUY',
      allocationBand: '1-2%',
      materialityScore: 80,
      priorityScore: 80,
      trend: 'IMPROVING',
      conviction: 90,
      risk: 25,
      confidence: 90,
      distancePct: 0,
      priceFreshness: 'FRESH',
      zonePosition: 'IN BUY ZONE',
      currentPrice: 10,
      targetEntryPrice: 10,
      recommendationQualityScore: 55,
      recommendationQualityGrade: 'LOW',
      evidenceBalance: 'MIXED',
      contradictionStatus: 'BLOCKED',
      qualityRationale: 'Low quality due to contradiction'
    };
    const policy = {
      minDeployScore: 70,
      minDeployNowScore: 85,
      maxRisk: 45,
      minConfidence: 55,
      staleBlocks: true,
      missingBlocks: true,
      highPortfolioMaterialityBlock: 80
    };
    const result = context.foBuildCapitalDeploymentRecord_(
      item,
      policy,
      {score: 20, level: 'LOW'}
    );

    expect(result.deploymentDecision).toBe('BLOCKED');
    expect(result.blockers).toContain('LOW RECOMMENDATION QUALITY');
    expect(result.blockers).toContain('RECOMMENDATION CONTRADICTION');
  });

  test('A233 blocks executable actions with insufficient quality', () => {
    const context = load('ExecutiveDecisionIntegrationA233.js');
    const decisions = [{
      ticker: 'QNC',
      account: 'TFSA',
      action: 'BUY',
      recommendation: 'BUY',
      allocationBand: '1-2%',
      confidence: 80,
      confidenceDelta: 0,
      trend: 'STABLE',
      materialityScore: 80,
      portfolioWeight: 0,
      priceFreshness: 'FRESH',
      currentPrice: 10,
      targetEntryPrice: 10,
      executiveReason: 'Test',
      recommendationQualityScore: 30,
      recommendationQualityGrade: 'INSUFFICIENT DATA',
      evidenceBalance: 'INSUFFICIENT',
      contradictionStatus: 'BLOCKED',
      qualityRationale: 'Essential data unavailable'
    }];
    const cards = context.foA233BuildActionCards_(
      decisions,
      {exact: {}, tickers: {}},
      {priceReady: true},
      {critical: false, riskLevel: 'LOW'},
      {
        runId: 'RUN-1',
        timestamp: new Date('2026-07-19T12:00:00Z'),
        platformVersion: 'v1.3.0',
        baseline: 'CB-002'
      }
    );

    expect(cards[0].executionStatus).toBe(
      'BLOCKED — RECOMMENDATION QUALITY'
    );
    expect(cards[0].recommendation).toBe('BUY');
    expect(cards[0].recommendationQualityGrade).toBe('INSUFFICIENT DATA');
  });

  test('executive report no longer reads CIO Decisions', () => {
    const source = read('ExecutiveReportingEngine.js');
    expect(source).not.toContain("getSheetByName('CIO Decisions')");
    expect(source).toContain('INVESTMENT_DECISION_SUPPORT');
    expect(source).toContain('foReadGovernedExecutiveDecisions_');
  });

  test('A233 action-card schema carries recommendation quality lineage', () => {
    const schema = read('WorksheetSchemaRegistryA230.js');
    expect(schema).toContain("'Recommendation Quality Grade'");
    expect(schema).toContain("'Contradiction Status'");
    expect(schema).toContain("'Quality Rationale'");
  });

  test('A233 action-card row matches the additive schema width', () => {
    const context = load('ExecutiveDecisionIntegrationA233.js');
    const row = context.foA233ActionCardRow_({
      runId: 'RUN',
      timestamp: new Date(),
      rank: 1,
      ticker: 'MU',
      securityType: 'CURRENT HOLDING',
      account: 'TFSA',
      action: 'BUY',
      executionStatus: 'EXECUTABLE',
      trigger: 'Trigger',
      invalidationCondition: 'Invalidation',
      confidence: 80,
      priorConfidence: 75,
      confidenceDelta: 5,
      trend: 'IMPROVING',
      materialityScore: 80,
      portfolioWeight: 0.05,
      priceFreshness: 'FRESH',
      currentPrice: 100,
      targetEntryPrice: 100,
      riskImpact: 'NEUTRAL',
      commentary: 'Commentary',
      platformVersion: 'v1.3.0',
      baseline: 'CB-002',
      recommendation: 'BUY',
      recommendationQualityScore: 90,
      recommendationQualityGrade: 'HIGH',
      evidenceBalance: 'POSITIVE',
      contradictionStatus: 'CLEAR',
      qualityRationale: 'High quality'
    });

    expect(row).toHaveLength(39);
  });
});

describe('Sprint 2.6.0 weekly change detection compatibility', () => {
  const weeklyContext = load('WeeklyCioReportA240.js');

  test('quality signature is stable for identical action-card state', () => {
    const cards = [{
      Ticker: 'MU',
      Account: 'TFSA',
      'Recommendation Quality Grade': 'HIGH',
      'Contradiction Status': 'CLEAR'
    }];

    expect(weeklyContext.foA240ActionQualitySignature_(cards)).toBe(
      weeklyContext.foA240ActionQualitySignature_(cards)
    );
  });

  test('quality signature changes only on grade or contradiction changes', () => {
    const before = [{
      Ticker: 'MU',
      Account: 'TFSA',
      'Recommendation Quality Grade': 'MEDIUM',
      'Contradiction Status': 'CLEAR'
    }];
    const after = [{
      Ticker: 'MU',
      Account: 'TFSA',
      'Recommendation Quality Grade': 'LOW',
      'Contradiction Status': 'BLOCKED'
    }];

    const prior = weeklyContext.foA240ActionQualitySignature_(before);
    const current = weeklyContext.foA240ActionQualitySignature_(after);
    expect(current).not.toBe(prior);
    expect(
      weeklyContext.foA240ParseActionQualitySignature_(current)['MU|TFSA']
    ).toEqual({
      label: 'MU (TFSA)',
      grade: 'LOW',
      contradiction: 'BLOCKED'
    });
  });

  test('history state signature includes quality grade and contradiction', () => {
    const source = read('DecisionHistoryRetentionService.js');
    expect(source).toContain('item.recommendationQualityGrade');
    expect(source).toContain('item.contradictionStatus');
  });
});
