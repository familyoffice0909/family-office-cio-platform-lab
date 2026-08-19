const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('ConvictionScoringEngine.js', 'utf8');

const context = {
  console
};

vm.createContext(context);

// Apps Script-only globals. Anything these tests must not reach throws
// loudly rather than passing silently.
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

const decide = function() {
  return context.foDetermineDynamicRecommendation_.apply(null, arguments);
};

const NO_RULES = {};
const FRESH = 'FRESH';
const MAX = 0.15; // fraction, as rules.MAX_POSITION_WEIGHT supplies it

// Score pairs that resolve to a known rung when the override is inactive.
const STRONG_BUY_SCORES = [95, 20];
const ACCUMULATE_SCORES = [65, 33];
const AVOID_SCORES = [30, 80];
const WATCH_SCORES = [64, 33];

describe('Concentration hard override on the recommendation ladder', () => {
  describe('boundary at the configured limit', () => {
    test('exactly at the limit (15%) returns DO NOT ADD - inclusive', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 15, MAX)
      ).toBe('DO NOT ADD');
    });

    test('just under the limit (14.9%) falls through to the normal ladder', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 14.9, MAX)
      ).toBe('STRONG BUY');
    });

    test('just over the limit (15.1%) returns DO NOT ADD', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 15.1, MAX)
      ).toBe('DO NOT ADD');
    });

    test('the limit is read as a percentage of the fraction, not the fraction itself', () => {
      // A 1% position is far above an unscaled 0.15 but far below 15%.
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 1, MAX)
      ).toBe('STRONG BUY');
    });

    test('a non-default limit is honoured', () => {
      // With a 5% cap, a 9% position is blocked; with the 15% default it is not.
      expect(
        decide(ACCUMULATE_SCORES[0], ACCUMULATE_SCORES[1], FRESH, NO_RULES, 9, 0.05)
      ).toBe('DO NOT ADD');
      expect(
        decide(ACCUMULATE_SCORES[0], ACCUMULATE_SCORES[1], FRESH, NO_RULES, 9, MAX)
      ).toBe('ACCUMULATE');
    });
  });

  describe('override dominance over each ladder rung', () => {
    test('dominates a would-be STRONG BUY', () => {
      // Confirm the control resolves to STRONG BUY without the override.
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES)
      ).toBe('STRONG BUY');

      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 31, MAX)
      ).toBe('DO NOT ADD');
    });

    test('dominates a would-be ACCUMULATE', () => {
      expect(
        decide(ACCUMULATE_SCORES[0], ACCUMULATE_SCORES[1], FRESH, NO_RULES)
      ).toBe('ACCUMULATE');

      expect(
        decide(ACCUMULATE_SCORES[0], ACCUMULATE_SCORES[1], FRESH, NO_RULES, 27, MAX)
      ).toBe('DO NOT ADD');
    });

    test('dominates a would-be AVOID', () => {
      // AVOID is the first rung after the override, so this specifically
      // pins that the override is checked BEFORE it, not after.
      expect(
        decide(AVOID_SCORES[0], AVOID_SCORES[1], FRESH, NO_RULES)
      ).toBe('AVOID');

      expect(
        decide(AVOID_SCORES[0], AVOID_SCORES[1], FRESH, NO_RULES, 31, MAX)
      ).toBe('DO NOT ADD');
    });

    test('dominates a would-be WATCH', () => {
      expect(
        decide(WATCH_SCORES[0], WATCH_SCORES[1], FRESH, NO_RULES)
      ).toBe('WATCH');

      expect(
        decide(WATCH_SCORES[0], WATCH_SCORES[1], FRESH, NO_RULES, 31, MAX)
      ).toBe('DO NOT ADD');
    });

    test('a concentrated position can never receive a deployment verdict', () => {
      const deployment = ['STRONG BUY', 'BUY', 'ACCUMULATE'];
      const pairs = [[95, 20], [85, 30], [65, 50], [100, 0]];

      pairs.forEach(function(p) {
        const verdict = decide(p[0], p[1], FRESH, NO_RULES, 31, MAX);
        expect(verdict).toBe('DO NOT ADD');
        expect(deployment).not.toContain(verdict);
      });
    });
  });

  describe('MISSING freshness precedence', () => {
    test('MISSING wins over the override', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], 'MISSING', NO_RULES, 31, MAX)
      ).toBe('HOLD');
    });

    test('STALE does not gate, so the override still applies', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], 'STALE', NO_RULES, 31, MAX)
      ).toBe('DO NOT ADD');
    });
  });

  describe('partial-argument guard', () => {
    test('portfolioWeight alone does not trigger the override', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 31, undefined)
      ).toBe('STRONG BUY');
    });

    test('maxPositionWeight alone does not trigger the override', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, undefined, MAX)
      ).toBe('STRONG BUY');
    });

    test('both supplied is required for the override to apply', () => {
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 31, MAX)
      ).toBe('DO NOT ADD');
    });

    test('a zero weight with a valid limit does not trigger the override', () => {
      // 0 is defined and below the limit; it must not be treated as missing
      // nor as blocking.
      expect(
        decide(STRONG_BUY_SCORES[0], STRONG_BUY_SCORES[1], FRESH, NO_RULES, 0, MAX)
      ).toBe('STRONG BUY');
    });
  });

  describe('backward compatibility for existing four-argument callers', () => {
    test('STRONG BUY rung is unchanged when the new args are omitted', () => {
      expect(decide(95, 20, FRESH, NO_RULES)).toBe('STRONG BUY');
    });

    test('BUY rung is unchanged when the new args are omitted', () => {
      expect(decide(80, 35, FRESH, NO_RULES)).toBe('BUY');
    });

    test('ACCUMULATE rung is unchanged when the new args are omitted', () => {
      expect(decide(65, 50, FRESH, NO_RULES)).toBe('ACCUMULATE');
    });

    test('WATCH rung is unchanged when the new args are omitted', () => {
      expect(decide(64, 33, FRESH, NO_RULES)).toBe('WATCH');
    });

    test('AVOID rung is unchanged when the new args are omitted', () => {
      expect(decide(30, 80, FRESH, NO_RULES)).toBe('AVOID');
    });

    test('HOLD floor is unchanged when the new args are omitted', () => {
      expect(decide(44, 60, FRESH, NO_RULES)).toBe('HOLD');
    });

    test('MISSING gate is unchanged when the new args are omitted', () => {
      expect(decide(100, 0, 'MISSING', NO_RULES)).toBe('HOLD');
    });

    test('no four-argument call can ever produce DO NOT ADD', () => {
      const pairs = [
        [100, 0], [95, 20], [80, 35], [65, 50], [64, 33],
        [45, 60], [44, 60], [30, 80], [0, 100]
      ];

      pairs.forEach(function(p) {
        expect(decide(p[0], p[1], FRESH, NO_RULES)).not.toBe('DO NOT ADD');
      });
    });
  });
});
