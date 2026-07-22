'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'PortfolioOptimizationIntelligence.js'),
  'utf8'
);
const context = vm.createContext({console});
vm.runInContext(source, context, {
  filename: 'PortfolioOptimizationIntelligence.js'
});

function policy(overrides) {
  return Object.assign({maxPositionWeight: 0.15}, overrides || {});
}

function positions(exact, ticker) {
  return {exact: exact || {}, ticker: ticker || {}};
}

function candidate(overrides) {
  return Object.assign({
    rank: 1,
    ticker: 'QQC',
    account: 'TFSA',
    deploymentDecision: 'DEPLOY NOW',
    deploymentScore: 90,
    allocationBand: '5%-10%',
    blocked: 'NO',
    blockers: '',
    portfolioDirective: 'DEPLOY SELECTIVELY'
  }, overrides || {});
}

describe('Sprint 3.0.0 portfolio optimization intelligence', () => {
  test('parses percentage and decimal allocation bands consistently', () => {
    expect(context.foParseOptimizationAllocationBand_('5%-10%'))
      .toEqual(expect.objectContaining({
        valid: true,
        minimum: 0.05,
        maximum: 0.10,
        midpoint: 0.075
      }));
    expect(context.foParseOptimizationAllocationBand_('0.05 - 0.10'))
      .toEqual(expect.objectContaining({midpoint: 0.075}));
  });

  test('caps an eligible candidate at remaining position capacity', () => {
    const result = context.foOptimizePortfolioCandidate_(
      candidate(),
      positions({'QQC|TFSA': 0.12}),
      policy()
    );
    expect(result.optimizedIncrementalWeight).toBe(0.03);
    expect(result.optimizedTargetWeight).toBe(0.15);
    expect(result.constraintStatus).toBe('CAPPED');
  });

  test('allocates the midpoint when capacity is sufficient', () => {
    const result = context.foOptimizePortfolioCandidate_(
      candidate(),
      positions({'QQC|TFSA': 0.04}),
      policy()
    );
    expect(result.requestedIncrementalWeight).toBe(0.075);
    expect(result.optimizedIncrementalWeight).toBe(0.075);
    expect(result.optimizedTargetWeight).toBe(0.115);
    expect(result.constraintStatus).toBe('PASS');
  });

  test('assigns zero incremental weight to blocked candidates', () => {
    const result = context.foOptimizePortfolioCandidate_(
      candidate({blocked: 'YES', blockers: 'RISK LIMIT'}),
      positions({'QQC|TFSA': 0.04}),
      policy()
    );
    expect(result.optimizedIncrementalWeight).toBe(0);
    expect(result.constraintStatus).toBe('BLOCKED');
    expect(result.constraintReason).toMatch(/RISK LIMIT/);
  });

  test('assigns zero incremental weight to non-deployable decisions', () => {
    const result = context.foOptimizePortfolioCandidate_(
      candidate({deploymentDecision: 'WATCHLIST'}),
      positions({'QQC|TFSA': 0.04}),
      policy()
    );
    expect(result.optimizedIncrementalWeight).toBe(0);
    expect(result.constraintReason).toMatch(/NOT ELIGIBLE/);
  });

  test('fails closed when current weight is unavailable', () => {
    const result = context.foOptimizePortfolioCandidate_(
      candidate(),
      positions(),
      policy()
    );
    expect(result.optimizedIncrementalWeight).toBe(0);
    expect(result.constraintReason).toMatch(/CURRENT WEIGHT UNAVAILABLE/);
  });

  test('produces deterministic ordering and portfolio summary', () => {
    const optimization = context.foBuildPortfolioOptimization_([
      candidate({rank: 2, ticker: 'B', account: 'TFSA'}),
      candidate({rank: 1, ticker: 'A', account: 'TFSA'})
    ], positions({'A|TFSA': 0.02, 'B|TFSA': 0.14}), policy());

    expect(Array.from(optimization.candidates, (item) => item.ticker))
      .toEqual(['A', 'B']);
    expect(optimization.summary.fundedCandidateCount).toBe(2);
    expect(optimization.summary.portfolioDirective)
      .toBe('OPTIMIZE SELECTIVELY');
  });

  test('output contract exposes governed optimization fields', () => {
    expect(source).toContain("'Optimized Incremental Weight'");
    expect(source).toContain("'Optimized Target Weight'");
    expect(source).toContain("'Constraint Status'");
    expect(source).toContain("'Optimization Rationale'");
  });
});
