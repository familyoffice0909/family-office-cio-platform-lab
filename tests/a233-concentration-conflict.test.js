const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
  'ExecutiveDecisionIntegrationA233.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

vm.runInContext(
  `
  const FO_CONFIG = { PLATFORM_VERSION: 'test', BASELINE: 'test' };
  const FO_SHEETS = {};
  function foEnsureSheet_() {
    throw new Error('foEnsureSheet_ is not exercised by these tests.');
  }
  function foDashboard_() {
    throw new Error('foDashboard_ is not exercised by these tests.');
  }
  function foInfo_() {}
  function foError_() {}
  `,
  context
);

vm.runInContext(source, context);

const RUN = {
  runId: 'EXEC-DECISION-TEST',
  timestamp: '2026-08-20',
  platformVersion: 'v3.4.4',
  baseline: 'CB-002'
};

const CRITICAL_RISK = {
  critical: true,
  riskScore: 84.9,
  largestPositionPct: 31.2959
};

const HEALTHY_RISK = {
  critical: false,
  riskScore: 42,
  largestPositionPct: 12
};

// Readiness that trips no other conflict: fresh inputs, sufficient cost
// basis, return already suppressed.
const CLEAN_READINESS = {
  priceFreshnessCoveragePct: 1,
  costBasisCoveragePct: 1,
  portfolioReturnStatus: 'SUPPRESSED'
};

const NO_STALE_POLICY = { staleActionableCount: 0 };

function card(ticker, action, extra) {
  return Object.assign({
    ticker: ticker,
    account: 'LIRA',
    action: action,
    contradictionStatus: 'CLEAR',
    recommendationQualityGrade: 'HIGH',
    qualityRationale: ''
  }, extra || {});
}

// Tonight's live production card set: five ACCUMULATE, two WATCH,
// two DO NOT ADD (QNC 27.24%, QQC/TFSA 30.96%).
const LIVE_CARDS = [
  card('ONE', 'ACCUMULATE'), card('QQC', 'ACCUMULATE'),
  card('QBTS', 'ACCUMULATE'), card('RGTI', 'ACCUMULATE'),
  card('TD', 'ACCUMULATE'), card('ABX', 'WATCH'),
  card('BNS', 'WATCH'),
  card('QNC', 'DO NOT ADD'), card('QQCT', 'DO NOT ADD')
];

function build(cards, risk, policy, readiness) {
  return context.foA233BuildConflicts_(
    cards,
    policy || NO_STALE_POLICY,
    risk || CRITICAL_RISK,
    readiness || CLEAN_READINESS,
    RUN
  );
}

function codes(conflicts) {
  return conflicts.map(function(c) { return c.conflictCode; });
}

function find(conflicts, code) {
  return conflicts.filter(function(c) { return c.conflictCode === code; })[0];
}

const NEW_CODE = 'CRITICAL_RISK_DRIVEN_BY_CONCENTRATION';

describe('A233 concentration conflict', () => {
  describe('firing conditions', () => {
    test('fires when risk is critical AND a card is DO NOT ADD', () => {
      const conflicts = build([
        card('QNC', 'DO NOT ADD'),
        card('ABX', 'WATCH')
      ]);
      expect(codes(conflicts)).toContain(NEW_CODE);
    });

    test('does NOT fire when risk is critical but no card is DO NOT ADD', () => {
      // The pre-#93 shape: blocked positions arrived as WATCH, so nothing
      // signalled concentration at this layer.
      const conflicts = build([
        card('ONE', 'ACCUMULATE'),
        card('ABX', 'WATCH'),
        card('BNS', 'WATCH')
      ]);
      expect(codes(conflicts)).not.toContain(NEW_CODE);
    });

    test('does NOT fire when risk is not critical, even with DO NOT ADD cards', () => {
      const conflicts = build(
        [card('QNC', 'DO NOT ADD'), card('QQCT', 'DO NOT ADD')],
        HEALTHY_RISK
      );
      expect(codes(conflicts)).not.toContain(NEW_CODE);
    });

    test('does NOT fire on an empty card set', () => {
      expect(codes(build([]))).not.toContain(NEW_CODE);
    });

    test('fires on a single blocked position', () => {
      const conflicts = build([card('QNC', 'DO NOT ADD')]);
      expect(codes(conflicts)).toContain(NEW_CODE);
    });
  });

  describe('evidence names the specific tickers', () => {
    test('lists every blocked ticker, not a bare count', () => {
      const conflict = find(build(LIVE_CARDS), NEW_CODE);
      expect(conflict.evidence).toContain('QNC');
      expect(conflict.evidence).toContain('QQCT');
      expect(conflict.evidence).toContain('Concentration-blocked positions:');
    });

    test('includes the risk score', () => {
      const conflict = find(build(LIVE_CARDS), NEW_CODE);
      expect(conflict.evidence).toContain('84.9');
    });

    test('names only blocked tickers, not deployment or watch tickers', () => {
      const conflict = find(build(LIVE_CARDS), NEW_CODE);
      ['ONE', 'QBTS', 'RGTI', 'TD', 'ABX', 'BNS'].forEach(function(t) {
        expect(conflict.evidence).not.toContain(t);
      });
    });

    test('this is an improvement over the accumulation conflict evidence format', () => {
      // CRITICAL_RISK_WITH_ACCUMULATION reports a count; this reports
      // identities, so a reader can act without a second lookup.
      const conflicts = build(LIVE_CARDS);
      const accumulation = find(conflicts, 'CRITICAL_RISK_WITH_ACCUMULATION');
      const concentration = find(conflicts, NEW_CODE);

      expect(accumulation.evidence).toContain('Deployment cards 5');
      expect(concentration.evidence).toContain('QNC, QQCT');
    });

    test('carries the expected severity, status and run metadata', () => {
      const conflict = find(build(LIVE_CARDS), NEW_CODE);
      expect(conflict.severity).toBe('CRITICAL');
      expect(conflict.status).toBe('CONTROLLED — CAPITAL BLOCKED');
      expect(conflict.runId).toBe(RUN.runId);
      expect(conflict.platformVersion).toBe(RUN.platformVersion);
      expect(conflict.baseline).toBe(RUN.baseline);
    });
  });

  describe('coexistence with the accumulation conflict', () => {
    test('both fire simultaneously on the live card set', () => {
      // The actual tonight scenario: 5 ACCUMULATE cards trip the first,
      // 2 DO NOT ADD cards trip the second. They are not mutually
      // exclusive and both are correct.
      const conflicts = build(LIVE_CARDS);
      expect(codes(conflicts)).toContain('CRITICAL_RISK_WITH_ACCUMULATION');
      expect(codes(conflicts)).toContain(NEW_CODE);
      expect(conflicts.length).toBe(2);
    });

    test('only the accumulation conflict fires with no blocked cards', () => {
      const conflicts = build([
        card('ONE', 'ACCUMULATE'), card('TD', 'ACCUMULATE')
      ]);
      expect(codes(conflicts)).toEqual(['CRITICAL_RISK_WITH_ACCUMULATION']);
    });

    test('only the concentration conflict fires with no deployment cards', () => {
      const conflicts = build([
        card('QNC', 'DO NOT ADD'), card('ABX', 'WATCH')
      ]);
      expect(codes(conflicts)).toEqual([NEW_CODE]);
    });
  });

  describe('existing conflict types unaffected', () => {
    test('a blocked card is not counted as a deployment card', () => {
      // DO NOT ADD must never satisfy foA233IsDeploymentAction_, so a
      // portfolio with only blocked cards raises no accumulation conflict.
      const conflicts = build([card('QNC', 'DO NOT ADD')]);
      expect(codes(conflicts)).not.toContain('CRITICAL_RISK_WITH_ACCUMULATION');
      expect(context.foA233IsDeploymentAction_('DO NOT ADD')).toBe(false);
    });

    test('the stale-evaluation conflict still fires on its own condition', () => {
      const conflicts = build(
        [card('ABX', 'WATCH')],
        CRITICAL_RISK,
        NO_STALE_POLICY,
        { priceFreshnessCoveragePct: 0, costBasisCoveragePct: 1,
          portfolioReturnStatus: 'SUPPRESSED' }
      );
      expect(codes(conflicts)).toContain('CRITICAL_RISK_WITH_STALE_EVALUATION');
    });

    test('the stale-price conflict still fires on its own condition', () => {
      const conflicts = build(
        [card('ABX', 'WATCH')],
        CRITICAL_RISK,
        { staleActionableCount: 3 }
      );
      expect(codes(conflicts)).toContain('STALE_PRICE_WITH_ACCUMULATION');
    });

    test('the cost-basis conflict still fires on its own condition', () => {
      const conflicts = build(
        [card('ABX', 'WATCH')],
        CRITICAL_RISK,
        NO_STALE_POLICY,
        { priceFreshnessCoveragePct: 1, costBasisCoveragePct: 0.5,
          portfolioReturnStatus: 'AVAILABLE' }
      );
      expect(codes(conflicts)).toContain(
        'INSUFFICIENT_COST_BASIS_WITH_RETURN_AVAILABLE'
      );
    });

    test('a clean portfolio still raises no conflicts at all', () => {
      expect(build([card('ABX', 'WATCH')], HEALTHY_RISK).length).toBe(0);
    });
  });
});
