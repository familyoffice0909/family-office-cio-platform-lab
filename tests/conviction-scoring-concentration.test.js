const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
  'ConvictionScoringEngine.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

// ConvictionScoringEngine.js references two Apps Script-only globals at
// load time. Neither is reachable from the pure scoring functions under
// test; they are stubbed so the source can be evaluated in isolation.
vm.runInContext(
  `
  const FO_SHEETS = {};
  function foEnsureSheet_() {
    throw new Error('foEnsureSheet_ is not exercised by these tests.');
  }
  `,
  context
);

vm.runInContext(source, context);

// Default MAX_POSITION_WEIGHT, expressed as a fraction (0-1) exactly as
// rules.MAX_POSITION_WEIGHT supplies it. Position weights are percentages
// (0-100), matching Position Risk's published figures.
const MAX_WEIGHT = 0.15;

describe('Conviction / risk concentration scoring', () => {
  describe('units scaling (regression for c2b4782)', () => {
    test('a 30% position does not score identically to a 1% position', () => {
      const smallCapacity = context.foConvictionCapacityScore_(1, MAX_WEIGHT);
      const largeCapacity = context.foConvictionCapacityScore_(30, MAX_WEIGHT);
      const smallRisk = context.foRiskConcentrationScore_(1, MAX_WEIGHT);
      const largeRisk = context.foRiskConcentrationScore_(30, MAX_WEIGHT);

      // Under the units bug every position collapsed to capacity 0 /
      // concentration risk 100, so these pairs were indistinguishable.
      expect(smallCapacity).not.toBe(largeCapacity);
      expect(smallRisk).not.toBe(largeRisk);
    });

    test('a 30% position exceeds the limit and scores worst-case', () => {
      expect(context.foConvictionCapacityScore_(30, MAX_WEIGHT)).toBe(0);
      expect(context.foRiskConcentrationScore_(30, MAX_WEIGHT)).toBe(100);
    });

    test('a 1% position is well within the limit and scores strongly', () => {
      expect(context.foConvictionCapacityScore_(1, MAX_WEIGHT))
        .toBeGreaterThan(90);
      expect(context.foRiskConcentrationScore_(1, MAX_WEIGHT))
        .toBeLessThan(10);
    });

    test('the limit is interpreted as a percentage, not a fraction', () => {
      // A 0.5% position is far below a 15% limit but above an unscaled
      // 0.15 threshold. Under the bug this returned capacity 0.
      expect(context.foConvictionCapacityScore_(0.5, MAX_WEIGHT))
        .toBeGreaterThan(0);
    });
  });

  describe('monotonicity across a weight spread', () => {
    // Strict monotonicity only holds below the limit. At or above it both
    // scores saturate (capacity 0, concentration risk clamped to 100), so
    // 15 and 30 are deliberately excluded from the strict assertions and
    // covered by the saturation tests below.
    const belowLimit = [0.5, 5, 10, 14.9];
    const fullSpread = [0.5, 5, 10, 14.9, 15, 30];

    test('capacity strictly decreases as weight rises, below the limit', () => {
      const scores = belowLimit.map(function(w) {
        return context.foConvictionCapacityScore_(w, MAX_WEIGHT);
      });

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThan(scores[i - 1]);
      }
    });

    test('concentration risk strictly increases as weight rises, below the limit', () => {
      const scores = belowLimit.map(function(w) {
        return context.foRiskConcentrationScore_(w, MAX_WEIGHT);
      });

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThan(scores[i - 1]);
      }
    });

    test('capacity never rises as weight rises, across the full spread', () => {
      const scores = fullSpread.map(function(w) {
        return context.foConvictionCapacityScore_(w, MAX_WEIGHT);
      });

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    test('concentration risk never falls as weight rises, across the full spread', () => {
      const scores = fullSpread.map(function(w) {
        return context.foRiskConcentrationScore_(w, MAX_WEIGHT);
      });

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    test('capacity and concentration risk are complementary', () => {
      fullSpread.forEach(function(w) {
        const capacity = context.foConvictionCapacityScore_(w, MAX_WEIGHT);
        const risk = context.foRiskConcentrationScore_(w, MAX_WEIGHT);
        expect(capacity + risk).toBeCloseTo(100, 6);
      });
    });

    test('the spread produces genuinely distinct scores, not one collapsed value', () => {
      // The units bug collapsed every weight to the same pair of scores.
      const distinct = new Set(belowLimit.map(function(w) {
        return context.foConvictionCapacityScore_(w, MAX_WEIGHT);
      }));

      expect(distinct.size).toBe(belowLimit.length);
    });
  });

  describe('boundary around the default limit (BNS case)', () => {
    test('just under the limit scores meaningfully better than just over', () => {
      const underCapacity = context.foConvictionCapacityScore_(14.9, MAX_WEIGHT);
      const overCapacity = context.foConvictionCapacityScore_(15.1, MAX_WEIGHT);
      const underRisk = context.foRiskConcentrationScore_(14.9, MAX_WEIGHT);
      const overRisk = context.foRiskConcentrationScore_(15.1, MAX_WEIGHT);

      expect(underCapacity).toBeGreaterThan(overCapacity);
      expect(underRisk).toBeLessThan(overRisk);
    });

    test('just under the limit is still non-zero capacity', () => {
      // BNS sat at 14.69% in production and must not be zeroed out.
      expect(context.foConvictionCapacityScore_(14.69, MAX_WEIGHT))
        .toBeGreaterThan(0);
    });

    test('at or above the limit capacity is zero', () => {
      expect(context.foConvictionCapacityScore_(15, MAX_WEIGHT)).toBe(0);
      expect(context.foConvictionCapacityScore_(15.1, MAX_WEIGHT)).toBe(0);
    });

    test('concentration risk is capped at 100 beyond the limit', () => {
      expect(context.foRiskConcentrationScore_(15.1, MAX_WEIGHT)).toBe(100);
      expect(context.foRiskConcentrationScore_(200, MAX_WEIGHT)).toBe(100);
    });
  });

  describe('zero, negative and missing weight guards', () => {
    test('zero weight returns the documented defaults', () => {
      expect(context.foConvictionCapacityScore_(0, MAX_WEIGHT)).toBe(100);
      expect(context.foRiskConcentrationScore_(0, MAX_WEIGHT)).toBe(5);
    });

    test('negative weight returns the documented defaults', () => {
      expect(context.foConvictionCapacityScore_(-5, MAX_WEIGHT)).toBe(100);
      expect(context.foRiskConcentrationScore_(-5, MAX_WEIGHT)).toBe(5);
    });

    test('non-numeric weight is treated as zero and does not throw', () => {
      expect(function() {
        context.foConvictionCapacityScore_('not-a-number', MAX_WEIGHT);
      }).not.toThrow();

      expect(context.foConvictionCapacityScore_('not-a-number', MAX_WEIGHT))
        .toBe(100);
      expect(context.foRiskConcentrationScore_(undefined, MAX_WEIGHT))
        .toBe(5);
    });

    test('omitted maxWeight falls back to the 0.15 default', () => {
      expect(context.foConvictionCapacityScore_(30))
        .toBe(context.foConvictionCapacityScore_(30, MAX_WEIGHT));
      expect(context.foRiskConcentrationScore_(1))
        .toBe(context.foRiskConcentrationScore_(1, MAX_WEIGHT));
    });
  });
});
