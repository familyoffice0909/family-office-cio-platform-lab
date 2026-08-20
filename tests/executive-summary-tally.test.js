const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
  'BuyZoneExecutiveDashboardEngine.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

// Apps Script-only globals. Collaborators these tests must not reach are
// stubbed to throw, so an accidental call fails loudly rather than
// passing silently.
vm.runInContext(
  `
  const FO_CONFIG = { PLATFORM_VERSION: 'test', BASELINE: 'test' };
  const FO_SHEETS = {};
  const SpreadsheetApp = {};
  function foEnsureSheet_() {
    throw new Error('foEnsureSheet_ is not exercised by these tests.');
  }
  function foDashboard_() {
    throw new Error('foDashboard_ is not exercised by these tests.');
  }
  function foRunBuyZoneIntelligence() {
    throw new Error('foRunBuyZoneIntelligence is not exercised by these tests.');
  }
  function foInfo_() {}
  function foError_() {}
  `,
  context
);

vm.runInContext(source, context);

// The nine live production positions as of 2026-08-20: five ACCUMULATE,
// two WATCH, two DO NOT ADD (QNC 27.24%, QQC/TFSA 30.96%).
function position(ticker, recommendation, extra) {
  return Object.assign({
    ticker: ticker,
    account: 'LIRA',
    recommendation: recommendation,
    convictionScore: 61,
    riskScore: 41,
    confidence: 68,
    priceFreshness: 'FRESH'
  }, extra || {});
}

const LIVE_NINE = [
  position('QQC', 'ACCUMULATE'),
  position('QBTS', 'ACCUMULATE'),
  position('RGTI', 'ACCUMULATE'),
  position('ONE', 'ACCUMULATE'),
  position('TD', 'ACCUMULATE'),
  position('ABX', 'WATCH'),
  position('BNS', 'WATCH'),
  position('QNC', 'DO NOT ADD'),
  position('QQCT', 'DO NOT ADD')
];

describe('Buy Zone Executive Summary recommendation tally', () => {
  describe('DO NOT ADD is counted', () => {
    test('counts include a DO NOT ADD key', () => {
      const counts = context.foBuyZoneRecommendationCounts_([]);
      expect(
        Object.prototype.hasOwnProperty.call(counts, 'DO NOT ADD')
      ).toBe(true);
      expect(counts['DO NOT ADD']).toBe(0);
    });

    test('a DO NOT ADD position increments the counter', () => {
      const counts = context.foBuyZoneRecommendationCounts_([
        position('QNC', 'DO NOT ADD')
      ]);
      expect(counts['DO NOT ADD']).toBe(1);
    });

    test('the live nine tally as 5 / 2 / 2', () => {
      const counts = context.foBuyZoneRecommendationCounts_(LIVE_NINE);
      expect(counts.ACCUMULATE).toBe(5);
      expect(counts.WATCH).toBe(2);
      expect(counts['DO NOT ADD']).toBe(2);
    });
  });

  describe('the tally sums to the position count', () => {
    test('nine positions in, nine counted', () => {
      // The defect: DO NOT ADD was dropped by the hasOwnProperty guard,
      // so the tally read 7 against 9 evaluated.
      const counts = context.foBuyZoneRecommendationCounts_(LIVE_NINE);
      const total = Object.keys(counts).reduce(function(sum, k) {
        return sum + counts[k];
      }, 0);

      expect(total).toBe(LIVE_NINE.length);
      expect(total).toBe(9);
    });

    test('a mix spanning every recommendation sums correctly', () => {
      const mixed = [
        position('A', 'STRONG BUY'), position('B', 'BUY'),
        position('C', 'ACCUMULATE'), position('D', 'WATCH'),
        position('E', 'HOLD'), position('F', 'AVOID'),
        position('G', 'DO NOT ADD')
      ];
      const counts = context.foBuyZoneRecommendationCounts_(mixed);
      const total = Object.keys(counts).reduce(function(sum, k) {
        return sum + counts[k];
      }, 0);

      expect(total).toBe(7);
      Object.keys(counts).forEach(function(k) {
        expect(counts[k]).toBe(1);
      });
    });

    test('an unrecognised recommendation is still excluded', () => {
      // The guard remains deliberate: only known verdicts are tallied,
      // so a future unmapped value surfaces as a sum mismatch rather
      // than being silently bucketed somewhere wrong.
      const counts = context.foBuyZoneRecommendationCounts_([
        position('X', 'SOMETHING NEW')
      ]);
      const total = Object.keys(counts).reduce(function(sum, k) {
        return sum + counts[k];
      }, 0);
      expect(total).toBe(0);
    });
  });

  describe('DO NOT ADD appears in the RECOMMENDATIONS output rows', () => {
    function recommendationRows() {
      return context.foBuildBuyZoneExecutiveRows_(LIVE_NINE)
        .filter(function(r) { return r[0] === 'RECOMMENDATIONS'; });
    }

    test('a DO NOT ADD row is emitted', () => {
      const row = recommendationRows().find(function(r) {
        return r[1] === 'DO NOT ADD';
      });
      expect(row).toBeDefined();
      expect(row[2]).toBe(2);
    });

    test('the emitted rows cover every counted verdict', () => {
      const labels = recommendationRows().map(function(r) { return r[1]; });
      ['STRONG BUY', 'BUY', 'ACCUMULATE', 'WATCH', 'HOLD', 'AVOID', 'DO NOT ADD']
        .forEach(function(label) {
          expect(labels).toContain(label);
        });
    });

    test('the emitted row values sum to the position count', () => {
      const total = recommendationRows().reduce(function(sum, r) {
        return sum + (Number(r[2]) || 0);
      }, 0);
      expect(total).toBe(9);
    });
  });

  describe('INVARIANTS - deliberately unchanged behaviour', () => {
    test('foIsExecutiveActionable_ still excludes DO NOT ADD', () => {
      // A blocked position must never count as actionable: both
      // "Actionable Candidates" and "Capital Deployment Readiness"
      // derive from this. A future "symmetry fix" adding DO NOT ADD
      // here should fail this test and be reconsidered deliberately.
      expect(context.foIsExecutiveActionable_('DO NOT ADD')).toBe(false);
    });

    test('foIsExecutiveActionable_ still admits only the three deployment verdicts', () => {
      expect(context.foIsExecutiveActionable_('STRONG BUY')).toBe(true);
      expect(context.foIsExecutiveActionable_('BUY')).toBe(true);
      expect(context.foIsExecutiveActionable_('ACCUMULATE')).toBe(true);

      ['WATCH', 'HOLD', 'AVOID', 'DO NOT ADD'].forEach(function(r) {
        expect(context.foIsExecutiveActionable_(r)).toBe(false);
      });
    });

    test('a DO NOT ADD position scores below an equivalent WATCH position', () => {
      // Same conviction / risk / confidence, differing only by verdict.
      // Pinned to the values computed from the live score shape.
      const blocked = context.foExecutiveOpportunityScore_(
        position('QNC', 'DO NOT ADD')
      );
      const watched = context.foExecutiveOpportunityScore_(
        position('ABX', 'WATCH')
      );

      expect(blocked).toBeCloseTo(40.30, 2);
      expect(watched).toBeCloseTo(57.80, 2);
      expect(blocked).toBeLessThan(watched);
    });

    test('foExecutiveBestRecommendation_ ranks DO NOT ADD below WATCH', () => {
      const best = context.foExecutiveBestRecommendation_([
        position('QNC', 'DO NOT ADD'),
        position('ABX', 'WATCH')
      ]);
      expect(best).toBe('WATCH');
    });

    test('foExecutiveBestRecommendation_ never elevates DO NOT ADD over a deployment verdict', () => {
      ['STRONG BUY', 'BUY', 'ACCUMULATE', 'WATCH', 'HOLD'].forEach(
        function(other) {
          const best = context.foExecutiveBestRecommendation_([
            position('QNC', 'DO NOT ADD'),
            position('OTHER', other)
          ]);
          expect(best).toBe(other);
        }
      );
    });
  });
});
